// harmony.js — colour-harmony generation (CLAUDE.md §7). Pure: no DOM, no globals.
// Most harmonies rotate hue in HSL keeping S/L; "value" harmonies (shades/monochromatic) instead
// vary saturation/lightness at the base hue. Each partner is a {dh,ds,dl} step from the base — the
// steps are locked so results never drift.

import { rotateHue, adjustHsl, rgbToHsl, hslToRgb, hexToRgb, rgbToHex, clamp01 } from './color.js';

// Each harmony is a fixed list of "partner" colours described as a step away from the seed:
//   dh = rotate the hue by this many degrees; ds/dl = shift saturation/lightness by this much (0–1).
// The seed itself is the implicit first swatch (a zero step), so only the partners are listed here.
// Object.freeze makes the table read-only so a stray write can't silently change the harmonies.
/** Partner steps per harmony type (deltas from the base): dh = hue°, ds/dl = sat/lightness in 0–1.
 *  The base (a zero step) is implicit. */
export const HARMONY_STEPS = Object.freeze({
  complementary: [{ dh: 180 }],                     // the opposite colour on the wheel
  analogous: [{ dh: -30 }, { dh: 30 }],             // the two immediate neighbours
  triadic: [{ dh: 120 }, { dh: 240 }],              // an evenly-spaced triangle
  'split-complementary': [{ dh: 150 }, { dh: 210 }], // the two colours flanking the complement
  tetradic: [{ dh: 60 }, { dh: 180 }, { dh: 240 }], // rectangle
  square: [{ dh: 90 }, { dh: 180 }, { dh: 270 }],   // four hues evenly spaced 90° apart
  compound: [{ dh: 30 }, { dh: 180 }, { dh: 210 }], // base + a neighbour + the complement + its neighbour
  shades: [{ dl: -0.24 }, { dl: -0.12 }, { dl: 0.12 }, { dl: 0.24 }],            // same hue + sat, stepped lightness
  monochromatic: [{ ds: -0.34, dl: -0.06 }, { ds: -0.17 }, { ds: 0.10, dl: 0.12 }], // same hue, vary saturation (+ a touch of value)
  custom: [],               // no rule — the palette is whatever you build/lock/edit by hand
});

// Reduce each harmony to just its hue offsets (dropping ds/dl), so the wheel knows where to draw each
// node on the ring. `s.dh || 0` means a value-only step (no dh) projects to 0° — it sits on the seed.
/** Hue-only projection (degrees) kept for the wheel glyph + gap math; value steps project to 0°. */
export const HARMONY_OFFSETS = Object.freeze(Object.fromEntries(
  Object.entries(HARMONY_STEPS).map(([k, steps]) => [k, steps.map(s => s.dh || 0)])
));

export const HARMONY_TYPES = Object.freeze(Object.keys(HARMONY_STEPS)); // the list of harmony names, for menus/validation

/** True when `type` is a known harmony. */
// hasOwnProperty guards against inherited object keys (e.g. "toString") being mistaken for a harmony.
export const isHarmony = type => Object.prototype.hasOwnProperty.call(HARMONY_STEPS, type);

/** True when every partner is a pure hue rotation (so the wheel can place it on the ring).
 *  Value harmonies (shades/monochromatic) return false; rule-less custom returns true (no partners).
 *  Unknown types (incl. the neutral harmonies below) return false — they have no ring partners. */
// !!s = the type exists; .every(...no ds/dl...) = none of its steps touch saturation/lightness.
export const isHueHarmony = type => { const s = HARMONY_STEPS[type]; return !!s && s.every(st => !st.ds && !st.dl); };

/** Apply one {dh,ds,dl} step to a base hex. */
const applyStep = (hex, { dh = 0, ds = 0, dl = 0 }) => {
  const rotated = dh ? rotateHue(hex, dh) : hex;        // spin the hue if there's a hue delta, else leave the colour as-is
  return (ds || dl) ? adjustHsl(rotated, { ds, dl }) : rotated; // then nudge sat/lightness if this step asks for it
};

/**
 * Full scheme for a base colour: the base (deg 0) followed by its harmony partners.
 * @returns {{hex:string, deg:number}[]}
 */
export function harmonize(hex, type) {
  if (!isHarmony(type)) throw new Error(`unknown harmony: ${type}`); // fail loudly on an unknown harmony name
  // First entry is the seed at 0°; the rest are its partners, each tagged with its wheel angle (deg).
  return [{ hex, deg: 0 }, ...HARMONY_STEPS[type].map(st => ({ hex: applyStep(hex, st), deg: st.dh || 0 }))];
}

/** Just the harmony partners (excludes the base). */
export function harmonyPartners(hex, type) {
  if (!isHarmony(type)) throw new Error(`unknown harmony: ${type}`);
  return HARMONY_STEPS[type].map(st => ({ hex: applyStep(hex, st), deg: st.dh || 0 })); // same as harmonize but without the seed
}

/* ---- Neutral-seed harmonies (CLAUDE.md §7) ----
   A neutral seed (Lab C* below the isNeutral threshold) has no usable hue, so hue rotation is
   meaningless: hue-bearing partners derive from a chosen POP colour instead, and temperature
   partners derive from the seed's lightness. All constants are locked so results never drift. */

// The "pop" is the single accent colour a grey scheme is built around (a neutral has no hue of its own).
/** Default pop accent: hsl(355, .75, .35) — the classic dark-neutral + crimson pairing. */
export const DEFAULT_POP = '#9C1626';
/** A pop must keep some chroma or the whole scheme collapses back to grey (wheel clamps to this). */
export const POP_MIN_S = 0.15;                          // minimum saturation the pop is allowed to have

const NEUTRAL_TYPES = Object.freeze(['neutral-pop', 'duotone', 'warm-cool']); // the three neutral-only recipes
/** True for the pop-era harmonies that only exist for neutral seeds (not in HARMONY_STEPS). */
export const isNeutralHarmony = type => NEUTRAL_TYPES.includes(type);
/** Every harmony a neutral seed can use: the neutral recipes + the value/rule-less survivors. */
// shades (a value ramp) and custom (hand-built) still work without a hue, so a neutral seed keeps them.
export const NEUTRAL_HARMONY_TYPES = Object.freeze([...NEUTRAL_TYPES, 'shades', 'custom']);

/**
 * Partners for a neutral seed. Same {hex, deg} shape as harmonyPartners; deg is null — these
 * partners live off the wheel ring (the pop node is separate wheel state, not a ring rotation).
 * Steps move lightness *away* from the seed's end of the value range so a black seed climbs and
 * a white seed descends.
 */
export function neutralPartners(seedHex, popHex, type) {
  if (!isNeutralHarmony(type)) return harmonyPartners(seedHex, type); // not a neutral recipe → fall back to the normal engine
  const seedL = rgbToHsl(hexToRgb(seedHex))[2];        // the seed's lightness (index [2] of HSL) — the only useful info in a grey
  const [popH] = rgbToHsl(hexToRgb(popHex));           // the pop's hue — the colour we borrow to add interest
  const away = seedL < 0.5 ? 1 : -1;                   // a dark seed steps lighter (+1), a light seed steps darker (−1)
  const L = d => clamp01(seedL + away * d);            // helper: move `d` away from the seed's lightness, clamped to 0–1
  const tint = (h, s, l) => rgbToHex(hslToRgb([h, s, l])); // helper: build a hex from HSL parts
  switch (type) {
    case 'neutral-pop':   // bridge grey with a whisper of the pop's hue, then the pop itself
      return [{ hex: tint(popH, 0.07, L(0.20)), deg: null }, { hex: popHex, deg: null }]; // deg null → these live off the wheel ring
    case 'duotone':       // the pop family twice: a muted mid tone + the pop itself
      return [{ hex: tint(popH, 0.30, L(0.24)), deg: null }, { hex: popHex, deg: null }];
    case 'warm-cool':     // the neutral splits in temperature: a cool tint + a warm tint (no pop)
      return [{ hex: tint(222, 0.14, L(0.16)), deg: null }, { hex: tint(32, 0.16, L(0.24)), deg: null }]; // 222°≈blue (cool), 32°≈orange (warm)
  }
}
