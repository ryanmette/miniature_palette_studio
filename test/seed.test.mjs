import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemeBaseOf, pickForSchemeBase, partnerHex, swatchKeyHex, parseSeedQuery } from '../src/js/seed.js';
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

/* ---- the seed field's query parser (decision 3 of the picker build) ---- */

test('parseSeedQuery: "#" and 6 digits seed live, typed or pasted', () => {
  assert.deepEqual(parseSeedQuery('#9A1115'), { kind: 'hex', hex: '#9A1115', live: true });
  // a paste brings spaces and lower case with it; the old hex box kept 6 characters and held "9A111"
  assert.deepEqual(parseSeedQuery('  #9a1115 \n'), { kind: 'hex', hex: '#9A1115', live: true });
});

test('parseSeedQuery: 6 digits without "#" need Enter', () => {
  assert.deepEqual(parseSeedQuery('9a1115'), { kind: 'hex', hex: '#9A1115', live: false });
});

test('parseSeedQuery: "#RGB" is a colour, but never a live one', () => {
  // while you type "#9A1115", the first 3 digits must not seed #99AA11 for a moment
  assert.deepEqual(parseSeedQuery('#9A1'), { kind: 'hex', hex: '#99AA11', live: false });
});

test('parseSeedQuery: "#" with 0, 1, 2, 4 or 5 digits is not a colour yet', () => {
  for (const q of ['#', '#9', '#9A', '#9A11', '#9A111']) assert.deepEqual(parseSeedQuery(q), { kind: 'partial' }, q);
});

test('parseSeedQuery: a hex word with letters only is a name first, the colour last', () => {
  assert.deepEqual(parseSeedQuery('decade'), { kind: 'name', hexWord: '#DECADE' });
  assert.deepEqual(parseSeedQuery('ABADDB'), { kind: 'name', hexWord: '#ABADDB' });
});

test('parseSeedQuery: a paint name never becomes a colour', () => {
  // the old hex box kept only the hex letters of "Abaddon Black" and seeded #ABADDB
  assert.deepEqual(parseSeedQuery('Abaddon Black'), { kind: 'name' });
  assert.deepEqual(parseSeedQuery('abaddon'), { kind: 'name' });
  assert.deepEqual(parseSeedQuery('9A1'), { kind: 'name' });          // 3 digits need the "#"
  assert.deepEqual(parseSeedQuery('#9A1115FF'), { kind: 'name' });    // 8 digits: not a hex this field takes
});

test('parseSeedQuery: nothing typed', () => {
  assert.deepEqual(parseSeedQuery(''), { kind: 'empty' });
  assert.deepEqual(parseSeedQuery('   '), { kind: 'empty' });
  assert.deepEqual(parseSeedQuery(undefined), { kind: 'empty' });
});

test('parseSeedQuery: no typed text reaches the page as markup', () => {
  // every hex is rebuilt from a number (normHex), so a result can only hold "#" and hex digits
  for (const q of ['#9a1115', '#abc', '9a1115', 'decade']) {
    const r = parseSeedQuery(q);
    assert.match(r.hex || r.hexWord, /^#[0-9A-F]{6}$/, q);
  }
});

/* ---- Recent picks (the seed field's browse grid; this visit only) ---- */
import { addRecent, RECENT_MAX } from '../src/js/seed.js';

test('addRecent: the new pick first, no repeats, the input not changed', () => {
  const before = ['b', 'a'];
  assert.deepEqual(addRecent(before, 'c'), ['c', 'b', 'a']);
  assert.deepEqual(addRecent(before, 'a'), ['a', 'b']);         // a pick again moves to the front, once
  assert.deepEqual(before, ['b', 'a']);                         // a new array: the list in memory is replaced
});

test('addRecent: at most RECENT_MAX (or max), the oldest drop off', () => {
  let r = [];
  for (let i = 0; i < RECENT_MAX + 5; i++) r = addRecent(r, 'p' + i);
  assert.equal(r.length, RECENT_MAX);
  assert.equal(r[0], 'p' + (RECENT_MAX + 4));
  assert.deepEqual(addRecent(['x', 'y', 'z'], 'w', 2), ['w', 'x']);
});

test('addRecent: no id, or no list, changes nothing', () => {
  assert.deepEqual(addRecent(['a'], null), ['a']);
  assert.deepEqual(addRecent(undefined, 'a'), ['a']);
  assert.deepEqual(addRecent(null, ''), []);
});
