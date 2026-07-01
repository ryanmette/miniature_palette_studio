// color.js — pure colour math for Palette Studio. No DOM, no globals, no deps.
// Conventions locked in CLAUDE.md §7: sRGB ↔ linear ↔ XYZ ↔ CIELAB (D65),
// matching via CIEDE2000 (kL=kC=kH=1). Verified against Sharma et al. reference pairs.

export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp255 = x => (x < 0 ? 0 : x > 255 ? 255 : x);

/** "#RGB" or "#RRGGBB" → [r,g,b] in 0–255. */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`invalid hex: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** [r,g,b] 0–255 → "#RRGGBB" (uppercase). */
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(clamp255(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** sRGB channel 0–255 → linear-light 0–1. */
export const srgbToLinear = c => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
/** linear-light 0–1 → sRGB channel 0–255. */
export const linearToSrgb = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export const rgbToLinear = ([r, g, b]) => [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
export const linearToRgb = ([r, g, b]) => [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];

const D65 = [0.95047, 1.0, 1.08883];

/** [r,g,b] 0–255 → CIE XYZ (D65, Y in 0–1). */
export function rgbToXyz([r, g, b]) {
  const [R, G, B] = rgbToLinear([r, g, b]);
  return [
    R * 0.4124 + G * 0.3576 + B * 0.1805,
    R * 0.2126 + G * 0.7152 + B * 0.0722,
    R * 0.0193 + G * 0.1192 + B * 0.9505,
  ];
}

/** CIE XYZ (D65) → CIELAB [L,a,b]. */
export function xyzToLab([x, y, z]) {
  const f = t => (t > 0.008856451679035631 ? Math.cbrt(t) : t / 0.12841854934601665 + 4 / 29);
  const fx = f(x / D65[0]), fy = f(y / D65[1]), fz = f(z / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const rgbToLab = rgb => xyzToLab(rgbToXyz(rgb));
export const hexToLab = hex => rgbToLab(hexToRgb(hex));

/** Lab chroma C* = √(a*² + b*²) — perceptual colourfulness (0 = a pure neutral). */
export const labChroma = hex => { const [, a, b] = hexToLab(hex); return Math.hypot(a, b); };
/** Neutral-seed detection threshold (locked, CLAUDE.md §7). Lab chroma is used rather than HSL
 *  saturation because visually-black "saturated" hexes (e.g. #100000, HSL S=1) must classify as
 *  neutral. Seeds in the borderline band just above the threshold stay in normal hue mode. */
export const NEUTRAL_CHROMA = 10;
export const isNeutral = hex => labChroma(hex) < NEUTRAL_CHROMA;

/** CIEDE2000 colour difference between two CIELAB values (kL=kC=kH=1). */
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2, Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  let h1p = Math.atan2(b1, a1p); if (h1p < 0) h1p += 2 * Math.PI;
  let h2p = Math.atan2(b2, a2p); if (h2p < 0) h2p += 2 * Math.PI;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > Math.PI) dhp -= 2 * Math.PI; else if (dhp < -Math.PI) dhp += 2 * Math.PI;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else hbp = Math.abs(h1p - h2p) > Math.PI ? (h1p + h2p + 2 * Math.PI) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos(hbp - 30 * rad) + 0.24 * Math.cos(2 * hbp)
    + 0.32 * Math.cos(3 * hbp + 6 * rad) - 0.20 * Math.cos(4 * hbp - 63 * rad);
  const dTheta = 30 * rad * Math.exp(-Math.pow((hbp * deg - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + 6103515625));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
}

export const deltaE2000Hex = (h1, h2) => deltaE2000(hexToLab(h1), hexToLab(h2));

/** [r,g,b] 0–255 → HSL [h 0–360, s 0–1, l 0–1]. */
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}

/** HSL [h,s,l] → [r,g,b] 0–255. */
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0]; else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x]; else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
  return rgb.map(v => (v + m) * 255);
}

/** Rotate a colour's hue by `deg`, preserving S and L. Returns a hex. */
export function rotateHue(hex, deg) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h + deg, s, l]));
}

/** Adjust lightness/saturation (deltas in 0–1), preserving hue. Returns a hex. */
export function adjustHsl(hex, { dl = 0, ds = 0 } = {}) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, clamp01(s + ds), clamp01(l + dl)]));
}

/**
 * Plain-language direction to nudge an owned `paintHex` toward the `idealHex` (use-what-you-own, #6).
 * Picks the single most-impactful axis (lightness > saturation > hue) so the hint stays actionable.
 * @returns {string|null} e.g. "lighten slightly", "darken", "mute", "saturate", "shift hue" — or null if already close.
 */
export function adjustDirection(idealHex, paintHex) {
  const [ih, is, il] = rgbToHsl(hexToRgb(idealHex));
  const [ph, ps, pl] = rgbToHsl(hexToRgb(paintHex));
  const dl = il - pl, ds = is - ps;
  let dh = ih - ph; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  // Compare on a common ~0–1 scale; lightness/saturation read more strongly to a painter than hue.
  const cands = [
    { m: Math.abs(dl), word: dl > 0 ? 'lighten' : 'darken' },
    { m: Math.abs(ds) * 0.8, word: ds > 0 ? 'saturate' : 'mute' },
    { m: (Math.abs(dh) / 180) * 0.6, word: 'shift hue' },
  ];
  cands.sort((a, b) => b.m - a.m);
  const top = cands[0];
  if (top.m < 0.03) return null;                 // effectively the same colour — no adjustment worth naming
  return top.word + (top.m < 0.12 ? ' slightly' : '');
}

/** WCAG 2.1 relative luminance of a colour (hex or [r,g,b]), 0–1. */
export function relativeLuminance(color) {
  const [r, g, b] = (typeof color === 'string' ? hexToRgb(color) : color).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two colours, 1–21. */
export function contrastRatio(a, b) {
  const L1 = relativeLuminance(a), L2 = relativeLuminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const NEAR_BLACK = '#15150F', NEAR_WHITE = '#FFFFFF';
/** Pick legible text colour for a swatch: whichever of black/white has higher contrast (§3.5/§7). */
export function textOn(hex) {
  return contrastRatio(hex, NEAR_BLACK) >= contrastRatio(hex, NEAR_WHITE) ? NEAR_BLACK : NEAR_WHITE;
}
