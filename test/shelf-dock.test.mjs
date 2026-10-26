import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shelfFilterSummary, dockStep, DOCK_TUCK, DOCK_REVEAL } from '../src/js/ui.js';

test('shelfFilterSummary: the chip always says search, even with nothing on', () => {
  assert.deepEqual(shelfFilterSummary({}), { text: '⌕ Search', filters: 0, sheet: 0, any: false });
});

test('shelfFilterSummary: query and filter count; sort is not counted', () => {
  const s = shelfFilterSummary({ q: ' green ', mark: 'owned', brand: 'AK Interactive', type: '' });
  assert.equal(s.text, '⌕ “green” · 2 filters');
  assert.equal(s.filters, 2);
  assert.equal(s.sheet, 1);   // only brand/type live in the sheet → the Filters badge
  assert.equal(s.any, true);
  assert.equal(shelfFilterSummary({ type: 'metal' }).text, '⌕ Search · 1 filter');
});

test('dockStep: a small scroll down tucks the open panel', () => {
  let s = { acc: 0, open: true };
  s = dockStep(s, DOCK_TUCK);          // exactly the threshold: not yet
  assert.equal(s.open, true);
  s = dockStep(s, 1);
  assert.deepEqual(s, { acc: 0, open: false });
});

test('dockStep: a small scroll up does not reveal — only a real one does', () => {
  let s = { acc: 0, open: false };
  for (let i = 0; i < 5; i++) s = dockStep(s, -10);   // 50px up: still looking for a paint
  assert.equal(s.open, false);
  s = dockStep(s, -(DOCK_REVEAL - 50) - 1);           // past the threshold
  assert.deepEqual(s, { acc: 0, open: true });
});

test('dockStep: a change of direction starts a new run', () => {
  let s = { acc: 0, open: false };
  s = dockStep(s, -50);
  s = dockStep(s, 5);                  // back down: the 50px up is forgotten
  s = dockStep(s, -50);
  assert.equal(s.open, false);
  assert.deepEqual(dockStep({ acc: 3, open: true }, 0), { acc: 3, open: true });   // no movement: no change
});
