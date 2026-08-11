import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, decodeNodes, decodeOffsets } from '../src/js/share.js';

const V = { validHarmony: h => ['complementary', 'triadic', 'shades', 'neutral-pop'].includes(h),
            hasPaint: id => ['citadel-red', 'vallejo-blue'].includes(id),
            validTab: t => ['plan', 'equiv', 'a11y'].includes(t) };

test('a paint seed round-trips as the paint, with the hex as a fallback', () => {
  const p = encodeState({ baseId: 'citadel-red', pickHex: '#9A1115', harmony: 'triadic', tab: 'plan' });
  assert.equal(p.get('p'), 'citadel-red');
  assert.equal(p.get('c'), '9A1115');       // hex rides along for links whose paint is gone
  const back = decodeState(p, V);
  assert.equal(back.baseId, 'citadel-red');
  assert.equal(back.customHex, undefined);  // the paint won; no anonymous "Custom #…"
});

test('a custom hex seed omits the paint id', () => {
  const p = encodeState({ customHex: '#2D567C', baseId: 'citadel-red', pickHex: '#2D567C', harmony: 'complementary' });
  assert.equal(p.get('p'), null);
  assert.equal(decodeState(p, V).customHex, '#2D567C');
});

test('full round trip preserves every palette field', () => {
  const s = {
    customHex: null, baseId: 'vallejo-blue', pickHex: '#2D567C', harmony: 'shades',
    seedRole: 'accent', theme: 'dark', showReal: true, tab: 'equiv', mode: 'shelf',
    popHex: '#9C1626', wheelL: 0.5,
    extraNodes: [{ h: 120, s: 0.5, l: 0.4 }, { h: 300, s: 0.8, l: 0.6, locked: true }],
    dropOffsets: [180, 240],
  };
  const back = decodeState(encodeState(s), V);
  assert.equal(back.baseId, 'vallejo-blue');
  assert.equal(back.harmony, 'shades');
  assert.equal(back.seedRole, 'accent');
  assert.equal(back.theme, 'dark');
  assert.equal(back.showReal, true);
  assert.equal(back.tab, 'equiv');
  assert.equal(back.mode, 'shelf');
  assert.equal(back.popHex, '#9C1626');
  assert.deepEqual(back.dropOffsets, [180, 240]);
  assert.deepEqual(back.extraNodes, [{ h: 120, s: 0.5, l: 0.4 }, { h: 300, s: 0.8, l: 0.6, locked: true }]);
});

test('defaults are omitted from the link (short, pasteable URLs)', () => {
  const p = encodeState({ baseId: 'citadel-red', pickHex: '#9A1115', harmony: 'complementary',
    tab: 'plan', mode: 'studio', seedRole: 'main', theme: 'light', showReal: false });
  assert.deepEqual([...p.keys()].sort(), ['c', 'h', 'p']);
});

test('an added swatch without its own lightness falls back to the wheel slider on encode', () => {
  const p = encodeState({ pickHex: '#000000', extraNodes: [{ h: 90, s: 0.4 }], wheelL: 0.33 });
  assert.equal(p.get('x'), '90.40.33');
  assert.deepEqual(decodeNodes('90.40.33'), [{ h: 90, s: 0.4, l: 0.33 }]);
});

test('a link naming a harmony, paint or tab this build lacks still opens', () => {
  // Forward/backward compatibility: validation failures drop the field so the caller's default
  // applies — an unknown value must never break the load.
  const back = decodeState('h=nonesuch&p=deleted-paint&v=bogus&c=9A1115', V);
  assert.equal(back.harmony, undefined);
  assert.equal(back.baseId, undefined);
  assert.equal(back.tab, undefined);
  assert.equal(back.customHex, '#9A1115');   // falls through to the hex
});

test('malformed swatch tokens are dropped, not thrown on', () => {
  assert.deepEqual(decodeNodes('abc.def.ghi'), []);
  assert.deepEqual(decodeNodes('120.50.40-garbage-300.80.60'),
    [{ h: 120, s: 0.5, l: 0.4 }, { h: 300, s: 0.8, l: 0.6 }]);
  assert.deepEqual(decodeNodes(''), []);
  assert.deepEqual(decodeNodes(null), []);
});

test('swatch values are clamped and hues wrapped', () => {
  assert.deepEqual(decodeNodes('400.150.200'), [{ h: 40, s: 1, l: 1 }]);
  assert.deepEqual(decodeNodes('30.50.50'), [{ h: 30, s: 0.5, l: 0.5 }]);
});

test('a negative hue is not representable — "-" is the swatch separator', () => {
  // encodeState always writes an already-wrapped 0-359 hue, so this can only come from a
  // hand-edited link; it splits into an empty token and is dropped rather than mis-parsed.
  assert.deepEqual(decodeNodes('-30.50.50'), [{ h: 30, s: 0.5, l: 0.5 }]);
});

test('the added-swatch cap is enforced on decode (URL length + per-frame scans)', () => {
  const many = Array.from({ length: 12 }, (_, i) => `${i * 20}.50.50`).join('-');
  assert.equal(decodeNodes(many, 6).length, 6);
});

test('an achromatic pop from a hand-edited link is clamped to a real pop', () => {
  // A grey `pp` would turn the neutral recipes into hue-0 red tints beside a grey "pop" swatch.
  const back = decodeState('pp=808080', V);
  assert.notEqual(back.popHex, '#808080');
  assert.ok(back.popHex.startsWith('#'));
});

test('decodeOffsets ignores junk', () => {
  assert.deepEqual(decodeOffsets('180.240'), [180, 240]);
  assert.deepEqual(decodeOffsets('180.x.240'), [180, 240]);
  assert.deepEqual(decodeOffsets(''), []);
});
