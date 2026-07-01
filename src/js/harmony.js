// harmony.js — colour-harmony generation (CLAUDE.md §7). Pure: no DOM, no globals.
// Most harmonies rotate hue in HSL keeping S/L; "value" harmonies (shades/monochromatic) instead
// vary saturation/lightness at the base hue. Each partner is a {dh,ds,dl} step from the base — the
// steps are locked so results never drift.

import { rotateHue, adjustHsl, rgbToHsl, hslToRgb, hexToRgb, rgbToHex, clamp01 } from './color.js';

/** Partner steps per harmony type (deltas from the base): dh = hue°, ds/dl = sat/lightness in 0–1.
 *  The base (a zero step) is implicit. */
export const HARMONY_STEPS = Object.freeze({
  complementary: [{ dh: 180 }],
  analogous: [{ dh: -30 }, { dh: 30 }],
  triadic: [{ dh: 120 }, { dh: 240 }],
  'split-complementary': [{ dh: 150 }, { dh: 210 }],
  tetradic: [{ dh: 60 }, { dh: 180 }, { dh: 240 }], // rectangle
  square: [{ dh: 90 }, { dh: 180 }, { dh: 270 }],   // four hues evenly spaced 90° apart
  compound: [{ dh: 30 }, { dh: 180 }, { dh: 210 }], // base + a neighbour + the complement + its neighbour
  shades: [{ dl: -0.24 }, { dl: -0.12 }, { dl: 0.12 }, { dl: 0.24 }],            // same hue + sat, stepped lightness
  monochromatic: [{ ds: -0.34, dl: -0.06 }, { ds: -0.17 }, { ds: 0.10, dl: 0.12 }], // same hue, vary saturation (+ a touch of value)
  custom: [],               // no rule — the palette is whatever you build/lock/edit by hand
});

/** Hue-only projection (degrees) kept for the wheel glyph + gap math; value steps project to 0°. */
export const HARMONY_OFFSETS = Object.freeze(Object.fromEntries(
  Object.entries(HARMONY_STEPS).map(([k, steps]) => [k, steps.map(s => s.dh || 0)])
));

export const HARMONY_TYPES = Object.freeze(Object.keys(HARMONY_STEPS));

/** True when `type` is a known harmony. */
export const isHarmony = type => Object.prototype.hasOwnProperty.call(HARMONY_STEPS, type);

/** True when every partner is a pure hue rotation (so the wheel can place it on the ring).
 *  Value harmonies (shades/monochromatic) return false; rule-less custom returns true (no partners).
 *  Unknown types (incl. the neutral harmonies below) return false — they have no ring partners. */
export const isHueHarmony = type => { const s = HARMONY_STEPS[type]; return !!s && s.every(st => !st.ds && !st.dl); };

/** Apply one {dh,ds,dl} step to a base hex. */
const applyStep = (hex, { dh = 0, ds = 0, dl = 0 }) => {
  const rotated = dh ? rotateHue(hex, dh) : hex;
  return (ds || dl) ? adjustHsl(rotated, { ds, dl }) : rotated;
};

/**
 * Full scheme for a base colour: the base (deg 0) followed by its harmony partners.
 * @returns {{hex:string, deg:number}[]}
 */
export function harmonize(hex, type) {
  if (!isHarmony(type)) throw new Error(`unknown harmony: ${type}`);
  return [{ hex, deg: 0 }, ...HARMONY_STEPS[type].map(st => ({ hex: applyStep(hex, st), deg: st.dh || 0 }))];
}

/** Just the harmony partners (excludes the base). */
export function harmonyPartners(hex, type) {
  if (!isHarmony(type)) throw new Error(`unknown harmony: ${type}`);
  return HARMONY_STEPS[type].map(st => ({ hex: applyStep(hex, st), deg: st.dh || 0 }));
}

/* ---- Neutral-seed harmonies (CLAUDE.md §7) ----
   A neutral seed (Lab C* below the isNeutral threshold) has no usable hue, so hue rotation is
   meaningless: hue-bearing partners derive from a chosen POP colour instead, and temperature
   partners derive from the seed's lightness. All constants are locked so results never drift. */

/** Default pop accent: hsl(355, .75, .35) — the classic dark-neutral + crimson pairing. */
export const DEFAULT_POP = '#9C1626';
/** A pop must keep some chroma or the whole scheme collapses back to grey (wheel clamps to this). */
export const POP_MIN_S = 0.15;

const NEUTRAL_TYPES = Object.freeze(['neutral-pop', 'duotone', 'warm-cool']);
/** True for the pop-era harmonies that only exist for neutral seeds (not in HARMONY_STEPS). */
export const isNeutralHarmony = type => NEUTRAL_TYPES.includes(type);
/** Every harmony a neutral seed can use: the neutral recipes + the value/rule-less survivors. */
export const NEUTRAL_HARMONY_TYPES = Object.freeze([...NEUTRAL_TYPES, 'shades', 'custom']);

/**
 * Partners for a neutral seed. Same {hex, deg} shape as harmonyPartners; deg is null — these
 * partners live off the wheel ring (the pop node is separate wheel state, not a ring rotation).
 * Steps move lightness *away* from the seed's end of the value range so a black seed climbs and
 * a white seed descends.
 */
export function neutralPartners(seedHex, popHex, type) {
  if (!isNeutralHarmony(type)) return harmonyPartners(seedHex, type);
  const seedL = rgbToHsl(hexToRgb(seedHex))[2];
  const [popH] = rgbToHsl(hexToRgb(popHex));
  const away = seedL < 0.5 ? 1 : -1;
  const L = d => clamp01(seedL + away * d);
  const tint = (h, s, l) => rgbToHex(hslToRgb([h, s, l]));
  switch (type) {
    case 'neutral-pop':   // bridge grey with a whisper of the pop's hue, then the pop itself
      return [{ hex: tint(popH, 0.07, L(0.20)), deg: null }, { hex: popHex, deg: null }];
    case 'duotone':       // the pop family twice: a muted mid tone + the pop itself
      return [{ hex: tint(popH, 0.30, L(0.24)), deg: null }, { hex: popHex, deg: null }];
    case 'warm-cool':     // the neutral splits in temperature: a cool tint + a warm tint (no pop)
      return [{ hex: tint(222, 0.14, L(0.16)), deg: null }, { hex: tint(32, 0.16, L(0.24)), deg: null }];
  }
}
