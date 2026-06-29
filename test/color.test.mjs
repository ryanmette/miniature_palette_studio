import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb, rgbToHex, rgbToLab, deltaE2000, deltaE2000Hex,
  rgbToHsl, hslToRgb, rotateHue, relativeLuminance, contrastRatio, textOn, adjustDirection,
} from '../src/js/color.js';

const approx = (a, b, eps = 1e-2) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b} (±${eps})`);

test('hex round-trips and short form', () => {
  assert.equal(rgbToHex(hexToRgb('#9A1115')), '#9A1115');
  assert.deepEqual(hexToRgb('#FFF'), [255, 255, 255]);
  assert.throws(() => hexToRgb('nope'));
});

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

test('Lab anchors: white L*≈100, black L*≈0', () => {
  approx(rgbToLab([255, 255, 255])[0], 100, 0.01);
  approx(rgbToLab([0, 0, 0])[0], 0, 0.01);
});

test('HSL round-trips within 1/255', () => {
  for (const hex of ['#9A1115', '#2D567C', '#FFD900', '#808080', '#0F702A']) {
    const rgb = hexToRgb(hex);
    hslToRgb(rgbToHsl(rgb)).map(Math.round).forEach((v, i) => approx(v, rgb[i], 1));
  }
});

test('rotateHue: 360°=identity, +180° of red ≈ cyan', () => {
  assert.equal(rotateHue('#FF0000', 360), '#FF0000');
  approx(deltaE2000Hex(rotateHue('#FF0000', 180), '#00FFFF'), 0, 0.5);
});

test('relative luminance & contrast', () => {
  approx(relativeLuminance('#FFFFFF'), 1, 1e-6);
  approx(relativeLuminance('#000000'), 0, 1e-6);
  approx(contrastRatio('#FFFFFF', '#000000'), 21, 1e-2);
});

test('textOn picks legible colour', () => {
  assert.equal(textOn('#FFFFFF'), '#15150F');
  assert.equal(textOn('#FFD900'), '#15150F');
  assert.equal(textOn('#000000'), '#FFFFFF');
  assert.equal(textOn('#08085A'), '#FFFFFF');
});

test('adjustDirection: null when the colours are effectively the same', () => {
  assert.equal(adjustDirection('#808080', '#808080'), null);
  assert.equal(adjustDirection('#808080', '#818181'), null);   // below the 0.03 threshold
});

test('adjustDirection: names the lightness axis (the highest-priority axis)', () => {
  assert.equal(adjustDirection('#FFFFFF', '#000000'), 'lighten');   // ideal far lighter
  assert.equal(adjustDirection('#000000', '#FFFFFF'), 'darken');    // ideal far darker
  assert.equal(adjustDirection('#8F8F8F', '#808080'), 'lighten slightly'); // small gap → "slightly"
});

test('adjustDirection: names the saturation axis when it dominates', () => {
  // same hue/lightness, big saturation gap → mute / saturate (sat is weighted 0.8, still wins here)
  assert.equal(adjustDirection('#808080', '#FF0000'), 'mute');      // ideal greyer than paint
  assert.equal(adjustDirection('#FF0000', '#808080'), 'saturate');  // ideal more saturated than paint
});

test('adjustDirection: falls back to hue when only hue differs', () => {
  // equal S and L, hue 120° apart → hue is the only non-trivial axis
  assert.equal(adjustDirection('#00FF00', '#FF0000'), 'shift hue');
});
