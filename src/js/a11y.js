// a11y.js — colour-vision-deficiency simulation + WCAG contrast (CLAUDE.md §7).
// Pure: no DOM. CVD uses Machado et al. (2009) severity-1.0 matrices applied in LINEAR RGB.
//
// What this is FOR: roughly 1 in 12 men has some colour-vision deficiency, and a paint scheme that
// relies on red-vs-green to separate two roles falls apart for them. The Accessibility tab shows the
// palette as those viewers see it, and flags pairs that collapse into each other.
//
// The simulation is a per-pixel matrix in LINEAR RGB — the linear step matters, since the matrices
// model how light reaching the eye is resolved by two working cone types instead of three, and sRGB
// values are gamma-encoded, not proportional to light. Applying them to raw 0-255 sRGB would produce
// plausible-looking but wrong colours.

import { hexToRgb, rgbToHex, rgbToLinear, linearToRgb, clamp01, contrastRatio, deltaE2000, hexToLab } from './color.js';

/**
 * Machado et al. (2009), severity 1.0 — i.e. the full dichromatic case, not a partial deficiency.
 * Row-major 3×3, operating on linear RGB. Named for the cone that is missing:
 *   protanopia   — no long-wave (red) cone; reds darken and slide toward the greens
 *   deuteranopia — no medium-wave (green) cone; the classic red/green confusion
 *   tritanopia   — no short-wave (blue) cone; blues and yellows collapse (rare)
 * Frozen because these are published constants, not tunables (§7: change them and every result in
 * the tab shifts, so they'd need a CHANGELOG note).
 */
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

/**
 * Simulate how `hex` appears under a colour-vision deficiency. Returns a hex.
 * Straight 3×3 matrix multiply in linear light, then back to sRGB. The clamp matters: the matrices
 * can push a channel slightly outside 0–1 for very saturated inputs, which would wrap into a wildly
 * wrong colour once it is re-encoded.
 */
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

/**
 * WCAG 2.1 AA thresholds — the ratios text must clear to be readable. 4.5:1 for body text, relaxed
 * to 3:1 for large text and UI components (bigger shapes survive lower contrast). §3 requires the
 * app's own chrome to meet these too: the tool that checks accessibility has to be accessible.
 */
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

/**
 * Smallest ΔE2000 between any pair of colours after simulating a CVD type — the palette's "collision
 * risk". A scheme can have four perfectly distinct colours that collapse into two under deuteranopia;
 * this finds the closest surviving pair so the UI can name it. Returns the distance AND which pair,
 * because "these two" is the actionable part — a painter can change one of them.
 * O(n²) over the palette, which is a handful of colours, so the brute force is the honest choice.
 */
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
