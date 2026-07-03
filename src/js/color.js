// color.js — pure colour math for Palette Studio. No DOM, no globals, no deps.
// Conventions locked in CLAUDE.md §7: sRGB ↔ linear ↔ XYZ ↔ CIELAB (D65),
// matching via CIEDE2000 (kL=kC=kH=1). Verified against Sharma et al. reference pairs.

// Clamp a number into the 0–1 range (used for linear-light / lightness / saturation values).
export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
// Clamp a number into the 0–255 range (used for 8-bit RGB channel values).
export const clamp255 = x => (x < 0 ? 0 : x > 255 ? 255 : x);

/** "#RGB" or "#RRGGBB" → [r,g,b] in 0–255. */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');            // coerce to string, trim spaces, drop a leading "#"
  if (h.length === 3) h = h.split('').map(c => c + c).join(''); // expand shorthand "#abc" → "aabbcc" (each digit doubled)
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`invalid hex: ${hex}`); // reject anything that isn't exactly 6 hex digits
  // Slice the 6 digits into three 2-char pairs and parse each as base-16 → a 0–255 channel.
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** [r,g,b] 0–255 → "#RRGGBB" (uppercase). */
export function rgbToHex([r, g, b]) {
  // For each channel: clamp to 0–255, round to an integer, format as a zero-padded 2-digit hex byte, then join + uppercase.
  return '#' + [r, g, b].map(v => Math.round(clamp255(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// "sRGB" is the gamma-encoded colour you see in a hex code; "linear light" undoes that gamma curve
// so the numbers are proportional to physical light — the space you must be in to blend, matrix-
// transform, or measure colour correctly. srgbToLinear reverses the sRGB transfer function.
/** sRGB channel 0–255 → linear-light 0–1. */
export const srgbToLinear = c => {
  c /= 255;                                                              // normalise the 0–255 byte to 0–1 first
  // Two-piece sRGB curve: a small linear toe below the 0.04045 breakpoint, a 2.4-power curve above it.
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
/** linear-light 0–1 → sRGB channel 0–255. */
// Inverse of the above: linear toe below the 0.0031308 breakpoint, else the 1/2.4 gamma curve, scaled back to 0–255.
export const linearToSrgb = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export const rgbToLinear = ([r, g, b]) => [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]; // convert a whole RGB triple to linear
export const linearToRgb = ([r, g, b]) => [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)]; // and back again

// D65 reference white point (the "daylight" whitepoint) as XYZ — the neutral that Lab normalises against.
const D65 = [0.95047, 1.0, 1.08883];

// "XYZ" is a device-independent tristimulus space (an intermediate on the way to Lab). The three
// rows below are the standard sRGB→XYZ matrix; each output is a weighted mix of the linear R/G/B.
/** [r,g,b] 0–255 → CIE XYZ (D65, Y in 0–1). */
export function rgbToXyz([r, g, b]) {
  const [R, G, B] = rgbToLinear([r, g, b]);                // must matrix-multiply in LINEAR light, not sRGB
  return [
    R * 0.4124 + G * 0.3576 + B * 0.1805,                  // X
    R * 0.2126 + G * 0.7152 + B * 0.0722,                  // Y (also luminance — note the 0.2126/0.7152/0.0722 weights)
    R * 0.0193 + G * 0.1192 + B * 0.9505,                  // Z
  ];
}

// "CIELAB" (Lab) is a perceptual space: L = lightness (0–100), a = green→red, b = blue→yellow.
// Equal distances in Lab roughly match equal perceived colour differences — which is why we match paints here.
/** CIE XYZ (D65) → CIELAB [L,a,b]. */
export function xyzToLab([x, y, z]) {
  // f() is the CIELAB nonlinearity: a cube root above a small threshold, with a linear "toe" below it
  // (the toe avoids an infinite slope near black). 0.00885… = (6/29)³; 0.1284… = 3·(6/29)²; 4/29 is the offset.
  const f = t => (t > 0.008856451679035631 ? Math.cbrt(t) : t / 0.12841854934601665 + 4 / 29);
  const fx = f(x / D65[0]), fy = f(y / D65[1]), fz = f(z / D65[2]); // normalise each axis by the D65 white, then shape
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];         // pack into L / a / b with the standard scale factors
}

export const rgbToLab = rgb => xyzToLab(rgbToXyz(rgb));   // convenience chain: RGB → XYZ → Lab
export const hexToLab = hex => rgbToLab(hexToRgb(hex));   // and from a hex string straight to Lab

// "Chroma" (C*) is how colourful/saturated a colour is in Lab: the distance of (a,b) from the neutral axis.
/** Lab chroma C* = √(a*² + b*²) — perceptual colourfulness (0 = a pure neutral). */
export const labChroma = hex => { const [, a, b] = hexToLab(hex); return Math.hypot(a, b); }; // hypot = √(a²+b²)
/** Neutral-seed detection threshold (locked, CLAUDE.md §7). Lab chroma is used rather than HSL
 *  saturation because visually-black "saturated" hexes (e.g. #100000, HSL S=1) must classify as
 *  neutral. Seeds in the borderline band just above the threshold stay in normal hue mode. */
export const NEUTRAL_CHROMA = 10;
/** Hysteresis exit threshold (locked, §7): the studio ENTERS neutral mode below NEUTRAL_CHROMA but
 *  only EXITS above NEUTRAL_EXIT, so a drag hovering on the boundary can't flip the mode per frame
 *  (banner/strip thrash). Seeds in the 10–14 deadband keep whichever mode they arrived in. */
// "Hysteresis" = using two different thresholds for on vs off so the state doesn't chatter near the edge.
export const NEUTRAL_EXIT = 14;
export const isNeutral = hex => labChroma(hex) < NEUTRAL_CHROMA; // true when a colour is too grey to have a usable hue

// "ΔE" (deltaE) is a single number for "how different do these two colours look" — smaller = closer,
// ~0 is indistinguishable. CIEDE2000 is the modern, perceptually-tuned formula (see §3.2's ΔE scale).
// It works in Lab but applies correction weights so differences read evenly across the colour space.
/** CIEDE2000 colour difference between two CIELAB values (kL=kC=kH=1). */
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;         // unpack the two Lab colours
  const rad = Math.PI / 180, deg = 180 / Math.PI;        // degree↔radian helpers (the constants below are in degrees)
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2); // each colour's chroma (distance from the neutral axis)
  const Cbar = (C1 + C2) / 2, Cbar7 = Math.pow(Cbar, 7); // average chroma, raised to the 7th (used by the G factor)
  // G slightly stretches the a* axis for low-chroma (near-grey) colours so their hue differences count fairly.
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;          // a' = the G-adjusted a* for each colour
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2); // recompute chroma with the adjusted a'
  let h1p = Math.atan2(b1, a1p); if (h1p < 0) h1p += 2 * Math.PI; // hue angle of colour 1, wrapped into 0–2π
  let h2p = Math.atan2(b2, a2p); if (h2p < 0) h2p += 2 * Math.PI; // hue angle of colour 2, wrapped into 0–2π
  const dLp = L2 - L1, dCp = C2p - C1p;                  // raw lightness and chroma differences
  let dhp = 0;
  if (C1p * C2p !== 0) {                                 // hue difference is undefined if either colour is neutral
    dhp = h2p - h1p;
    if (dhp > Math.PI) dhp -= 2 * Math.PI; else if (dhp < -Math.PI) dhp += 2 * Math.PI; // take the shorter way round the circle
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2); // ΔH': hue difference expressed as a chord length
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;      // mean lightness and mean chroma (used by the weighting terms)
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;                  // mean hue: if one is neutral just add (the neutral one is 0)
  else hbp = Math.abs(h1p - h2p) > Math.PI ? (h1p + h2p + 2 * Math.PI) / 2 : (h1p + h2p) / 2; // else average, handling wraparound
  // T re-weights the hue term by where the mean hue sits (blues/reds are treated differently from greens).
  const T = 1 - 0.17 * Math.cos(hbp - 30 * rad) + 0.24 * Math.cos(2 * hbp)
    + 0.32 * Math.cos(3 * hbp + 6 * rad) - 0.20 * Math.cos(4 * hbp - 63 * rad);
  // dTheta peaks around 275° (the blue region) — it drives the hue-vs-chroma rotation correction below.
  const dTheta = 30 * rad * Math.exp(-Math.pow((hbp * deg - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + 6103515625));  // Rc: strength of that rotation, larger for high chroma
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2)); // lightness weight (loosens at very dark/light)
  const Sc = 1 + 0.045 * Cbp;                            // chroma weight (grows with chroma)
  const Sh = 1 + 0.015 * Cbp * T;                        // hue weight (grows with chroma, shaped by T)
  const Rt = -Math.sin(2 * dTheta) * Rc;                 // Rt: rotation term coupling chroma and hue error in the blue zone
  // Final ΔE: root-sum-of-squares of the three weighted differences, plus the Rt cross-term.
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
}

export const deltaE2000Hex = (h1, h2) => deltaE2000(hexToLab(h1), hexToLab(h2)); // ΔE straight from two hex strings

// "HSL" = Hue (0–360° around the colour wheel), Saturation (0–1), Lightness (0–1) — the space the
// harmony engine rotates in because "shift the hue, keep S/L" maps directly onto colour-wheel maths.
/** [r,g,b] 0–255 → HSL [h 0–360, s 0–1, l 0–1]. */
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;                          // normalise channels to 0–1
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; // brightest/darkest channel and their gap (chroma)
  let h = 0;                                             // hue defaults to 0 for greys (d === 0)
  const l = (mx + mn) / 2;                               // lightness is the midpoint of brightest and darkest
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); // saturation: gap scaled by how far l is from the mid
  if (d !== 0) {                                         // only compute a hue if the colour isn't a pure grey
    if (mx === r) h = ((g - b) / d) % 6;                 // red is dominant → hue sits in the red sector
    else if (mx === g) h = (b - r) / d + 2;              // green dominant → green sector (offset 2)
    else h = (r - g) / d + 4;                            // blue dominant → blue sector (offset 4)
    h *= 60; if (h < 0) h += 360;                        // sectors are 60° wide; wrap negatives into 0–360
  }
  return [h, s, l];
}

/** HSL [h,s,l] → [r,g,b] 0–255. */
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360;                           // wrap hue into 0–360 (handles negative / >360 rotations)
  const c = (1 - Math.abs(2 * l - 1)) * s;               // chroma: the strongest the colour can be at this L and S
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));      // the second (intermediate) component within the 60° sector
  const m = l - c / 2;                                   // the amount to lift every channel so the lightness comes out right
  let rgb;
  // Pick which two of R/G/B carry the chroma based on which 60° hue sector we're in.
  if (h < 60) rgb = [c, x, 0]; else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x]; else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
  return rgb.map(v => (v + m) * 255);                    // add the lightness lift and scale back up to 0–255
}

/** Rotate a colour's hue by `deg`, preserving S and L. Returns a hex. */
export function rotateHue(hex, deg) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));             // hex → HSL so we can spin the hue
  return rgbToHex(hslToRgb([h + deg, s, l]));            // add the rotation, keep S/L, convert back to hex (this is a harmony step)
}

/** Adjust lightness/saturation (deltas in 0–1), preserving hue. Returns a hex. */
export function adjustHsl(hex, { dl = 0, ds = 0 } = {}) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));             // hex → HSL
  return rgbToHex(hslToRgb([h, clamp01(s + ds), clamp01(l + dl)])); // nudge S and L (clamped to 0–1), keep hue; used by value harmonies
}

/**
 * Plain-language direction to nudge an owned `paintHex` toward the `idealHex` (use-what-you-own, #6).
 * Picks the single most-impactful axis (lightness > saturation > hue) so the hint stays actionable.
 * @returns {string|null} e.g. "lighten slightly", "darken", "mute", "saturate", "shift hue" — or null if already close.
 */
export function adjustDirection(idealHex, paintHex) {
  const [ih, is, il] = rgbToHsl(hexToRgb(idealHex));     // the target colour in HSL
  const [ph, ps, pl] = rgbToHsl(hexToRgb(paintHex));     // the paint you own in HSL
  const dl = il - pl, ds = is - ps;                      // how far off in lightness and saturation
  let dh = ih - ph; if (dh > 180) dh -= 360; if (dh < -180) dh += 360; // hue gap, taken the short way round the wheel
  // Compare on a common ~0–1 scale; lightness/saturation read more strongly to a painter than hue.
  const cands = [
    { m: Math.abs(dl), word: dl > 0 ? 'lighten' : 'darken' },      // lightness axis: magnitude + which way to go
    { m: Math.abs(ds) * 0.8, word: ds > 0 ? 'saturate' : 'mute' }, // saturation axis, weighted down to 0.8 (matters a bit less)
    { m: (Math.abs(dh) / 180) * 0.6, word: 'shift hue' },          // hue axis, normalised to 0–1 then weighted down to 0.6
  ];
  cands.sort((a, b) => b.m - a.m);               // biggest-magnitude axis first — that's the single most useful nudge
  const top = cands[0];
  if (top.m < 0.03) return null;                 // effectively the same colour — no adjustment worth naming
  return top.word + (top.m < 0.12 ? ' slightly' : ''); // a small-but-real gap gets softened to "… slightly"
}

// "Relative luminance" = how bright a colour reads to the eye (0 = black, 1 = white). WCAG defines it
// as a fixed weighted sum of the LINEAR RGB channels (green counts most, blue least).
/** WCAG 2.1 relative luminance of a colour (hex or [r,g,b]), 0–1. */
export function relativeLuminance(color) {
  const [r, g, b] = (typeof color === 'string' ? hexToRgb(color) : color).map(srgbToLinear); // accept hex or rgb, then linearise
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;           // the standard luminance weights
}

/** WCAG 2.1 contrast ratio between two colours, 1–21. */
export function contrastRatio(a, b) {
  const L1 = relativeLuminance(a), L2 = relativeLuminance(b); // luminance of each colour
  // (lighter + 0.05) / (darker + 0.05) — the +0.05 models ambient screen flare and keeps the ratio finite.
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

// Not pure #000/#FFF: near-black is a very dark warm grey from the token palette (matches the app's ink).
const NEAR_BLACK = '#15150F', NEAR_WHITE = '#FFFFFF';
/** Pick legible text colour for a swatch: whichever of black/white has higher contrast (§3.5/§7). */
export function textOn(hex) {
  return contrastRatio(hex, NEAR_BLACK) >= contrastRatio(hex, NEAR_WHITE) ? NEAR_BLACK : NEAR_WHITE; // higher contrast wins
}
