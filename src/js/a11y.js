// a11y.js — colour-vision-deficiency simulation + WCAG contrast (CLAUDE.md §7).
// Pure: no DOM. CVD uses Machado et al. (2009) severity-1.0 matrices applied in LINEAR RGB.

import { hexToRgb, rgbToHex, rgbToLinear, linearToRgb, clamp01, contrastRatio, deltaE2000, hexToLab } from './color.js';

/** Machado et al. (2009), severity 1.0. Row-major 3×3, operate on linear RGB. */
export const CVD_MATRICES = Object.freeze({
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
});

export const CVD_TYPES = Object.freeze(Object.keys(CVD_MATRICES));

/** Simulate how `hex` appears under a colour-vision deficiency. Returns a hex. */
export function simulateCvd(hex, type) {
  const m = CVD_MATRICES[type];
  if (!m) throw new Error(`unknown CVD type: ${type}`);
  const [r, g, b] = rgbToLinear(hexToRgb(hex));
  const out = [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ].map(clamp01);
  return rgbToHex(linearToRgb(out));
}

/** WCAG 2.1 AA thresholds. */
export const WCAG_AA = Object.freeze({ text: 4.5, large: 3.0 });

/**
 * WCAG contrast verdict between two colours.
 * @returns {{ratio:number, passAAText:boolean, passAALarge:boolean}}
 */
export function wcag(a, b) {
  const ratio = contrastRatio(a, b);
  return { ratio, passAAText: ratio >= WCAG_AA.text, passAALarge: ratio >= WCAG_AA.large };
}

export { contrastRatio } from './color.js';

/** Smallest ΔE2000 between any pair of colours after simulating a CVD type (collision risk). */
export function minPairDelta(hexes, type) {
  const labs = hexes.map(h => hexToLab(simulateCvd(h, type)));
  let delta = Infinity, pair = null;
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      const d = deltaE2000(labs[i], labs[j]);
      if (d < delta) { delta = d; pair = [i, j]; }
    }
  }
  return { delta, pair };
}
