import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapPalette, readSnap } from '../src/js/undo.js';
import { hslToRgb, rgbToHex, rgbToHsl, hexToRgb } from '../src/js/color.js';

/** The colour an added swatch shows on screen (app.js paletteNodes). */
const hexOf = (n, wheelL = 0.5) => rgbToHex(hslToRgb([n.h, n.s, n.l ?? wheelL]));

/** A palette state as app.js passes it to snapPalette: `state` plus the neutral-mode holders. */
const S = (over = {}) => ({
  customHex: '#9A1115', baseId: 'citadel-base-mephiston-red', harmony: 'complementary', seedRole: 'main',
  showReal: false, popHex: null, neutral: false, preNeutral: null, preSeedRole: null,
  extraNodes: [], dropOffsets: [], ...over,
});

test('an added swatch comes back exactly after an undo: the second + on #9A1115', () => {
  // addFreeNode: the base's own hue and saturation, the lightness 0.12 darker. The old snapshot rounded
  // the hue to 0.1° and the saturation to 0.001, and this swatch came back as #630B0E.
  const [h, s, l] = rgbToHsl(hexToRgb('#9A1115'));
  const n = { h, s, l: l - 0.12 };
  assert.equal(hexOf(n), '#630B0D');
  const [back] = readSnap(snapPalette(S({ extraNodes: [n] }))).extraNodes;
  assert.deepEqual(back, n);
  assert.equal(hexOf(back), '#630B0D');
});

test('the snapshot round trip is exact for any added swatch', () => {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // fixed sequence: a failure repeats
  for (let i = 0; i < 5000; i++) {
    const nodes = Array.from({ length: 6 }, () =>
      ({ h: rand() * 360, s: rand(), l: 0.06 + rand() * 0.88, ...(rand() < 0.3 ? { locked: true } : {}) }));
    const back = readSnap(snapPalette(S({ extraNodes: nodes }))).extraNodes;
    assert.deepEqual(back, nodes);   // the same numbers, not only the same hex
    assert.deepEqual(back.map(n => hexOf(n)), nodes.map(n => hexOf(n)));
  }
});

test('state → snapshot → state → snapshot gives the same string (pushHistory compares strings)', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1000; i++) {
    const s = S({
      customHex: i % 2 ? '#2D567C' : null, seedRole: i % 3 ? 'main' : 'accent', showReal: i % 5 === 0,
      popHex: i % 4 ? null : '#9C1626', neutral: [true, false, null][i % 3], preNeutral: i % 2 ? 'triadic' : null,
      extraNodes: Array.from({ length: i % 7 }, () => ({ h: rand() * 360, s: rand(), ...(rand() < 0.8 ? { l: rand() } : {}) })),
      dropOffsets: i % 2 ? [180] : [],
    });
    const snap = snapPalette(s);
    const o = readSnap(snap);
    // app.js applySnap puts these fields back into `state` and the neutral-mode holders
    assert.equal(snapPalette({ ...s, ...o }), snap);
  }
});

test('a tab or the theme is not palette state: the snapshot does not change, so no new undo step', () => {
  const s = S({ extraNodes: [{ h: 358.248, s: 0.8012, l: 0.2153 }] });
  assert.equal(snapPalette({ ...s, tab: 'equiv', theme: 'dark', mode: 'shelf', hiHex: '#FFFFFF' }), snapPalette(s));
});

test('a swatch with no lightness still follows the wheel\'s, and a grey keeps its hue', () => {
  // An old link's h.s token has no lightness (share.js decodeNodes): the swatch follows the wheel slider.
  // A hex in the snapshot would fix its lightness, and it would turn a grey's hue to 0 (its place on
  // the wheel moves, though its colour does not).
  const nodes = [{ h: 90, s: 0.4 }, { h: 200, s: 0, l: 0.5 }, { h: 300.5, s: 0.7, l: 0.3, locked: true }];
  assert.deepEqual(readSnap(snapPalette(S({ extraNodes: nodes }))).extraNodes, nodes);
});

test('a swatch that was unlocked comes back with no lock flag', () => {
  const [n] = readSnap(snapPalette(S({ extraNodes: [{ h: 10, s: 0.5, l: 0.5, locked: false }] }))).extraNodes;
  assert.deepEqual(n, { h: 10, s: 0.5, l: 0.5 });
});

test('the seed and the neutral-mode holders come back as they went in', () => {
  const o = readSnap(snapPalette(S({ customHex: null, seedRole: 'accent', showReal: true, popHex: '#0F6B6E',
    neutral: true, preNeutral: 'triadic', preSeedRole: 'accent', dropOffsets: [120, 240] })));
  assert.deepEqual(o, {
    customHex: null, baseId: 'citadel-base-mephiston-red', harmony: 'complementary', seedRole: 'accent',
    showReal: true, popHex: '#0F6B6E', neutral: true, preNeutral: 'triadic', preSeedRole: 'accent',
    extraNodes: [], dropOffsets: [120, 240],
  });
  // A custom hex wins over the paint id, as on screen; a mode not held yet stays null
  const c = readSnap(snapPalette(S({ neutral: null })));
  assert.equal(c.customHex, '#9A1115');
  assert.equal(c.baseId, null);
  assert.equal(c.neutral, null);
  assert.equal(readSnap(snapPalette(S({ seedRole: 'nonsense' }))).seedRole, 'main');
});

test('the snapshot holds its own copy: a later edit of the state does not change it', () => {
  const s = S({ extraNodes: [{ h: 10, s: 0.5, l: 0.5 }], dropOffsets: [180] });
  const snap = snapPalette(s);
  const o = readSnap(snap);
  o.extraNodes[0].locked = true; o.dropOffsets.push(240);   // what lockSwatch / detachPartner do to `state`
  assert.deepEqual(readSnap(snap).extraNodes, [{ h: 10, s: 0.5, l: 0.5 }]);
  assert.deepEqual(readSnap(snap).dropOffsets, [180]);
});
