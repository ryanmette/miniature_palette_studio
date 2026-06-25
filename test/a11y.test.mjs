import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCvd, CVD_TYPES, CVD_MATRICES, wcag, WCAG_AA, minPairDelta } from '../src/js/a11y.js';

test('three CVD types with 3×3 matrices', () => {
  assert.deepEqual(CVD_TYPES, ['protanopia', 'deuteranopia', 'tritanopia']);
  for (const t of CVD_TYPES) {
    assert.equal(CVD_MATRICES[t].length, 3);
    for (const row of CVD_MATRICES[t]) assert.equal(row.length, 3);
  }
});

test('simulateCvd returns valid hex and shifts saturated colours', () => {
  for (const t of CVD_TYPES) assert.match(simulateCvd('#C01411', t), /^#[0-9A-F]{6}$/);
  assert.notEqual(simulateCvd('#00FF00', 'deuteranopia'), '#00FF00');
  assert.notEqual(simulateCvd('#FF0000', 'protanopia'), '#FF0000');
});

test('black stays black under CVD; unknown type throws', () => {
  assert.equal(simulateCvd('#000000', 'protanopia'), '#000000');
  assert.throws(() => simulateCvd('#000000', 'nope'));
});

test('WCAG verdicts', () => {
  const hi = wcag('#FFFFFF', '#000000');
  assert.ok(Math.abs(hi.ratio - 21) < 0.01);
  assert.equal(hi.passAAText, true);
  assert.equal(hi.passAALarge, true);
  const lo = wcag('#777777', '#888888');
  assert.equal(lo.passAAText, false);
  assert.equal(WCAG_AA.text, 4.5);
  assert.equal(WCAG_AA.large, 3.0);
});

test('minPairDelta flags red/green collision under deuteranopia', () => {
  const far = minPairDelta(['#C01411', '#FFFFFF', '#08085A'], 'deuteranopia');
  const near = minPairDelta(['#0F702A', '#C01411'], 'deuteranopia'); // green vs red → merge
  assert.ok(near.delta < far.delta);
  assert.deepEqual(near.pair, [0, 1]);
});
