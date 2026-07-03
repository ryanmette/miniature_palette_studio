// Unit tests for the pure colour-math module (src/js/color.js). These run under Node's built-in test
// runner (`node --test`) using `node:assert/strict` — no test framework to install. `color.js` has no DOM
// or globals, so it can be imported and exercised directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb, rgbToHex, rgbToLab, deltaE2000, deltaE2000Hex,
  rgbToHsl, hslToRgb, rotateHue, relativeLuminance, contrastRatio, textOn, adjustDirection,
  labChroma, isNeutral } from '../src/js/color.js';

// approx: assert two numbers are equal within a tolerance (eps) — colour math is floating-point, so exact
// equality would be brittle.
const approx = (a, b, eps = 1e-2) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b} (±${eps})`);

// Hex parsing/formatting round-trips (full form survives a there-and-back, "#FFF" shorthand expands),
// and an unparseable string throws rather than returning garbage.
test('hex round-trips and short form', () => {
  assert.equal(rgbToHex(hexToRgb('#9A1115')), '#9A1115');
  assert.deepEqual(hexToRgb('#FFF'), [255, 255, 255]);
  assert.throws(() => hexToRgb('nope'));
});

// The ΔE2000 (perceptual colour-distance) implementation must reproduce the published Sharma et al. test
// vectors to 3 decimal places. This is the correctness anchor for the whole matching engine, so it must be exact.
test('CIEDE2000 — Sharma et al. reference pairs (exact to 3dp)', () => {
  const refs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
    [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
    [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, exp] of refs) approx(deltaE2000(a, b), exp, 1e-3);
});

// Sanity-check the sRGB→Lab conversion at its extremes: pure white has lightness L*≈100, pure black L*≈0.
test('Lab anchors: white L*≈100, black L*≈0', () => {
  approx(rgbToLab([255, 255, 255])[0], 100, 0.01);
  approx(rgbToLab([0, 0, 0])[0], 0, 0.01);
});

// RGB→HSL→RGB must return the original colour (within 1 unit of 255) across a spread of hues — HSL is used
// for harmony rotation, so a lossy round-trip would drift every generated scheme.
test('HSL round-trips within 1/255', () => {
  for (const hex of ['#9A1115', '#2D567C', '#FFD900', '#808080', '#0F702A']) {
    const rgb = hexToRgb(hex);
    hslToRgb(rgbToHsl(rgb)).map(Math.round).forEach((v, i) => approx(v, rgb[i], 1));
  }
});

// Hue rotation: a full 360° turn is a no-op, and rotating red by 180° lands on ~cyan (its complement).
test('rotateHue: 360°=identity, +180° of red ≈ cyan', () => {
  assert.equal(rotateHue('#FF0000', 360), '#FF0000');
  approx(deltaE2000Hex(rotateHue('#FF0000', 180), '#00FFFF'), 0, 0.5);
});

// WCAG relative luminance + contrast ratio: white=1, black=0, and white-on-black is the maximum 21:1 ratio.
// These feed the accessibility contrast checks, so the anchors must be exact.
test('relative luminance & contrast', () => {
  approx(relativeLuminance('#FFFFFF'), 1, 1e-6);
  approx(relativeLuminance('#000000'), 0, 1e-6);
  approx(contrastRatio('#FFFFFF', '#000000'), 21, 1e-2);
});

// textOn chooses a legible label colour (near-black or white) for text sitting on a swatch: dark ink on
// light/yellow backgrounds, white on dark/navy ones. This is the swatch-legibility rule from §3.5.
test('textOn picks legible colour', () => {
  assert.equal(textOn('#FFFFFF'), '#15150F');
  assert.equal(textOn('#FFD900'), '#15150F');
  assert.equal(textOn('#000000'), '#FFFFFF');
  assert.equal(textOn('#08085A'), '#FFFFFF');
});

// adjustDirection describes how to nudge a real paint toward an ideal ("lighten", "mute", "shift hue", …).
// When the two colours are effectively identical it returns null — nothing to adjust. Note the small-gap case
// (#818181) stays below the 0.03 threshold and is treated as "same".
test('adjustDirection: null when the colours are effectively the same', () => {
  assert.equal(adjustDirection('#808080', '#808080'), null);
  assert.equal(adjustDirection('#808080', '#818181'), null);   // below the 0.03 threshold
});

// Lightness is the highest-priority axis: when the ideal is mainly lighter/darker, that's the named direction,
// and a small gap gets the "slightly" qualifier.
test('adjustDirection: names the lightness axis (the highest-priority axis)', () => {
  assert.equal(adjustDirection('#FFFFFF', '#000000'), 'lighten');   // ideal far lighter
  assert.equal(adjustDirection('#000000', '#FFFFFF'), 'darken');    // ideal far darker
  assert.equal(adjustDirection('#8F8F8F', '#808080'), 'lighten slightly'); // small gap → "slightly"
});

// When lightness matches but saturation differs a lot, the named direction is "mute" (toward grey) or
// "saturate" (toward vivid) — saturation outranks hue even though it's weighted 0.8.
test('adjustDirection: names the saturation axis when it dominates', () => {
  // same hue/lightness, big saturation gap → mute / saturate (sat is weighted 0.8, still wins here)
  assert.equal(adjustDirection('#808080', '#FF0000'), 'mute');      // ideal greyer than paint
  assert.equal(adjustDirection('#FF0000', '#808080'), 'saturate');  // ideal more saturated than paint
});

// Only when lightness and saturation both match does the direction fall through to hue ("shift hue").
test('adjustDirection: falls back to hue when only hue differs', () => {
  // equal S and L, hue 120° apart → hue is the only non-trivial axis
  assert.equal(adjustDirection('#00FF00', '#FF0000'), 'shift hue');
});

// labChroma is Lab colourfulness (C*): near-zero for blacks/whites/greys, large for a vivid primary. It's the
// perceptual saturation used to decide the neutral-mode entry below.
test('labChroma: achromatic hexes ≈ 0; saturated hexes are high', () => {
  assert.ok(labChroma('#000000') < 0.5);
  assert.ok(labChroma('#FFFFFF') < 0.5);
  assert.ok(labChroma('#808080') < 0.5);
  assert.ok(labChroma('#FF0000') > 60);
});

// isNeutral flags a seed as having "no usable hue" (Lab C* < 10) so the studio can switch to neutral mode.
// The key case is #100000: HSL saturation reads it as fully saturated, but it's visually black — the
// perceptual Lab-chroma test classifies it correctly as neutral where HSL would get it wrong.
test('isNeutral (CLAUDE.md §7, Lab C* < 10): blacks/whites/greys yes, colours no', () => {
  for (const hex of ['#000000', '#FFFFFF', '#808080', '#1B1B1F', '#E8E8E4']) assert.equal(isNeutral(hex), true, hex);
  // the case HSL saturation gets wrong: visually-black but HSL S = 1.0
  assert.equal(isNeutral('#100000'), true);
  for (const hex of ['#9A1115', '#86D562', '#2D567C', '#C2912F']) assert.equal(isNeutral(hex), false, hex);
});
