// harmony.js — colour-harmony generation by rotating hue in HSL (CLAUDE.md §7).
// Pure: no DOM, no globals. Angles are locked so results never drift.

import { rotateHue } from './color.js';

/** Partner hue offsets (degrees) per harmony type. The base (0°) is implicit. */
export const HARMONY_OFFSETS = Object.freeze({
  complementary: [180],
  analogous: [-30, 30],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  tetradic: [60, 180, 240], // rectangle
});

export const HARMONY_TYPES = Object.freeze(Object.keys(HARMONY_OFFSETS));

/** True when `type` is a known harmony. */
export const isHarmony = type => Object.prototype.hasOwnProperty.call(HARMONY_OFFSETS, type);

/**
 * Full scheme for a base colour: the base at 0° followed by its harmony partners.
 * @returns {{hex:string, deg:number}[]}
 */
export function harmonize(hex, type) {
  if (!isHarmony(type)) throw new Error(`unknown harmony: ${type}`);
  return [{ hex, deg: 0 }, ...HARMONY_OFFSETS[type].map(deg => ({ hex: rotateHue(hex, deg), deg }))];
}

/** Just the harmony partners (excludes the base). */
export function harmonyPartners(hex, type) {
  if (!isHarmony(type)) throw new Error(`unknown harmony: ${type}`);
  return HARMONY_OFFSETS[type].map(deg => ({ hex: rotateHue(hex, deg), deg }));
}
