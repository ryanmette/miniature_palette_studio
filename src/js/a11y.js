// a11y.js — colour-vision-deficiency simulation + WCAG contrast (CLAUDE.md §7).
// Pure: no DOM. CVD uses Machado et al. (2009) severity-1.0 matrices applied in LINEAR RGB.

import { hexToRgb, rgbToHex, rgbToLinear, linearToRgb, clamp01, contrastRatio, deltaE2000, hexToLab } from './color.js';

// "CVD" = colour-vision deficiency (colour blindness). Each 3×3 matrix below transforms a colour into
// how it would appear to someone with that deficiency, so the tool can flag colours that would clash.
// Names: protan = red-weak, deutan = green-weak, tritan = blue-weak. Numbers from Machado et al. (2009);
// row-major means matrix[outputChannel][inputChannel]. They must be applied in LINEAR RGB, not sRGB.
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

export const CVD_TYPES = Object.freeze(Object.keys(CVD_MATRICES)); // ['protanopia','deuteranopia','tritanopia'] for menus/loops

/** Simulate how `hex` appears under a colour-vision deficiency. Returns a hex. */
export function simulateCvd(hex, type) {
  const m = CVD_MATRICES[type];                        // look up the matrix for this deficiency
  if (!m) throw new Error(`unknown CVD type: ${type}`); // fail loudly on an unknown type
  const [r, g, b] = rgbToLinear(hexToRgb(hex));        // decode the hex and move into linear light (required for the matrix)
  const out = [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,           // new red   = row 0 · (r,g,b)
    m[1][0] * r + m[1][1] * g + m[1][2] * b,           // new green = row 1 · (r,g,b)
    m[2][0] * r + m[2][1] * g + m[2][2] * b,           // new blue  = row 2 · (r,g,b)
  ].map(clamp01);                                       // clamp any out-of-gamut result back into 0–1
  return rgbToHex(linearToRgb(out));                    // back to sRGB, then to a hex string
}

// WCAG AA needs a contrast ratio of at least 4.5:1 for normal text, 3:1 for large/bold text and UI.
/** WCAG 2.1 AA thresholds. */
export const WCAG_AA = Object.freeze({ text: 4.5, large: 3.0 });

/**
 * WCAG contrast verdict between two colours.
 * @returns {{ratio:number, passAAText:boolean, passAALarge:boolean}}
 */
export function wcag(a, b) {
  const ratio = contrastRatio(a, b);                   // the raw 1–21 contrast ratio
  return { ratio, passAAText: ratio >= WCAG_AA.text, passAALarge: ratio >= WCAG_AA.large }; // plus pass/fail against each threshold
}

export { contrastRatio } from './color.js';            // re-export so callers can get it from a11y without importing color too

/** Smallest ΔE2000 between any pair of colours after simulating a CVD type (collision risk). */
// If the closest pair is very close after simulation, those two paints would look the same to that
// viewer — a "collision". This returns the tightest gap and which two colours caused it.
export function minPairDelta(hexes, type) {
  const labs = hexes.map(h => hexToLab(simulateCvd(h, type))); // simulate the deficiency on each colour, then take its Lab
  let delta = Infinity, pair = null;                   // track the smallest gap found so far and the pair that made it
  for (let i = 0; i < labs.length; i++) {              // compare every unique pair (j starts at i+1 to avoid repeats/self)
    for (let j = i + 1; j < labs.length; j++) {
      const d = deltaE2000(labs[i], labs[j]);          // perceptual difference between this pair
      if (d < delta) { delta = d; pair = [i, j]; }      // keep it if it's the closest yet
    }
  }
  return { delta, pair };                              // pair is null if fewer than 2 colours were given
}
