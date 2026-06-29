// harmony.js — colour-harmony generation (CLAUDE.md §7). Pure: no DOM, no globals.
// Most harmonies rotate hue in HSL keeping S/L; "value" harmonies (shades/monochromatic) instead
// vary saturation/lightness at the base hue. Each partner is a {dh,ds,dl} step from the base — the
// steps are locked so results never drift.

import { rotateHue, adjustHsl } from './color.js';

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
 *  Value harmonies (shades/monochromatic) return false; rule-less custom returns true (no partners). */
export const isHueHarmony = type => (HARMONY_STEPS[type] || []).every(s => !s.ds && !s.dl);

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
