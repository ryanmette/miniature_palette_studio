import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemeBaseOf, pickForSchemeBase, partnerHex, swatchKeyHex } from '../src/js/seed.js';
import { rotateHue, rgbToHex, hslToRgb } from '../src/js/color.js';

const PICK = '#9A1115';
const toHex = hsl => rgbToHex(hslToRgb(hsl));

test('main-seed mode: the pick IS the scheme base, both directions', () => {
  assert.equal(schemeBaseOf(PICK, 'main'), PICK);
  assert.equal(pickForSchemeBase(PICK, 'main'), PICK);
});

test('accent-seed mode: the scheme base is the pick’s complement', () => {
  const base = schemeBaseOf(PICK, 'accent');
  assert.equal(base, rotateHue(PICK, 180));
  assert.notEqual(base, PICK);
});

test('the frame round-trips: writing a scheme base and reading it back is identity', () => {
  // This is the property that F2/F3 broke — a wheel drag or a base-column edit writes through
  // pickForSchemeBase, and the wheel then reads back through schemeBaseOf. If the two disagree the
  // colour visibly jumps 180° the instant it is set.
  for (const role of ['main', 'accent']) {
    for (const hex of ['#9A1115', '#2D567C', '#C8A13A', '#70746D']) {
      assert.equal(schemeBaseOf(pickForSchemeBase(hex, role), role), hex, `${role} / ${hex}`);
    }
  }
});

test('partners rotate the SCHEME base, not the pick', () => {
  const base = schemeBaseOf(PICK, 'accent');
  // The complementary partner of an accent-seeded scheme is the pick itself — that is exactly the
  // case the old code got backwards, resolving p:180 against the pick and landing on the base.
  assert.equal(partnerHex(base, 180), PICK);
  assert.equal(partnerHex(base, 0), base);
});

test('swatchKeyHex resolves base / partner / added keys in the scheme frame', () => {
  const frame = { schemeBase: '#2D567C', extraNodes: [{ h: 120, s: 0.5, l: 0.4 }], wheelL: 0.5, toHex };
  assert.equal(swatchKeyHex('base', frame), '#2D567C');
  assert.equal(swatchKeyHex('p:180', frame), rotateHue('#2D567C', 180));
  assert.equal(swatchKeyHex('x:0', frame), toHex([120, 0.5, 0.4]));
});

test('swatchKeyHex: an added swatch without its own lightness falls back to the wheel slider', () => {
  const frame = { schemeBase: '#2D567C', extraNodes: [{ h: 200, s: 0.6 }], wheelL: 0.33, toHex };
  assert.equal(swatchKeyHex('x:0', frame), toHex([200, 0.6, 0.33]));
});

test('swatchKeyHex: an out-of-range added index falls back to the scheme base, never undefined', () => {
  const frame = { schemeBase: '#2D567C', extraNodes: [], wheelL: 0.5, toHex };
  assert.equal(swatchKeyHex('x:7', frame), '#2D567C');
});

test('accent-seed: a partner key and the palette column agree on the same colour', () => {
  // End-to-end of the F3 bug, in the pure layer: the live palette mints p:<deg> keys relative to the
  // scheme base, so resolving one must land on the colour that column actually renders.
  const base = schemeBaseOf(PICK, 'accent');
  const columnHex = partnerHex(base, 180);                    // what the column draws
  const resolved = swatchKeyHex('p:180', { schemeBase: base, toHex });   // what lock/edit acts on
  assert.equal(resolved, columnHex);
});
