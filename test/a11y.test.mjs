// Unit tests for the accessibility module (src/js/a11y.js): colour-blindness (CVD) simulation, WCAG contrast
// verdicts, and palette-collision detection. Run under `node --test` with `node:assert/strict`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCvd, CVD_TYPES, CVD_MATRICES, wcag, WCAG_AA, minPairDelta } from '../src/js/a11y.js';

// The three simulated colour-vision deficiencies (protan/deutan/tritan) each have a 3×3 transform matrix.
// This just pins the registry shape the simulation relies on.
test('three CVD types with 3×3 matrices', () => {
  assert.deepEqual(CVD_TYPES, ['protanopia', 'deuteranopia', 'tritanopia']);
  for (const t of CVD_TYPES) {
    assert.equal(CVD_MATRICES[t].length, 3);
    for (const row of CVD_MATRICES[t]) assert.equal(row.length, 3);
  }
});

// simulateCvd always returns a valid hex, and a saturated colour actually changes under the relevant
// deficiency (green shifts for deuteranopia, red for protanopia) — proving the transform does something.
test('simulateCvd returns valid hex and shifts saturated colours', () => {
  for (const t of CVD_TYPES) assert.match(simulateCvd('#C01411', t), /^#[0-9A-F]{6}$/);
  assert.notEqual(simulateCvd('#00FF00', 'deuteranopia'), '#00FF00');
  assert.notEqual(simulateCvd('#FF0000', 'protanopia'), '#FF0000');
});

// Black has no colour to shift, so it's unchanged under CVD; an unknown deficiency name throws rather than
// silently returning a wrong colour.
test('black stays black under CVD; unknown type throws', () => {
  assert.equal(simulateCvd('#000000', 'protanopia'), '#000000');
  assert.throws(() => simulateCvd('#000000', 'nope'));
});

// wcag returns the contrast ratio plus AA pass/fail flags: white-on-black is the max 21:1 and passes both
// text (4.5:1) and large (3:1); a near-grey-on-grey pair fails text. Also pins the AA threshold constants.
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

// minPairDelta finds the closest pair of colours AFTER applying a CVD transform — i.e. which two palette
// colours would "merge" for that viewer. A red/green pair collides under deuteranopia (smaller ΔE than a
// well-separated set), and it reports the offending pair's indices.
test('minPairDelta flags red/green collision under deuteranopia', () => {
  const far = minPairDelta(['#C01411', '#FFFFFF', '#08085A'], 'deuteranopia');
  const near = minPairDelta(['#0F702A', '#C01411'], 'deuteranopia'); // green vs red → merge
  assert.ok(near.delta < far.delta);
  assert.deepEqual(near.pair, [0, 1]);
});
