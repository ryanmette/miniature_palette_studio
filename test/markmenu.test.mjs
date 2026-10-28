import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMenuKey, menuPlacement, LONG_PRESS_MS, MOVE_SLOP, LIFT_GUARD_MS } from '../src/js/markmenu.js';

test('isMenuKey: Shift+F10 and the ContextMenu key open the menu', () => {
  assert.equal(isMenuKey({ key: 'F10', shiftKey: true }), true);
  assert.equal(isMenuKey({ key: 'ContextMenu' }), true);
  assert.equal(isMenuKey({ key: 'ContextMenu', shiftKey: true }), true);
});

test('isMenuKey: F10 alone, or with another modifier, is not the menu key', () => {
  assert.equal(isMenuKey({ key: 'F10' }), false);                                    // the browser's own menu bar
  assert.equal(isMenuKey({ key: 'F10', shiftKey: true, ctrlKey: true }), false);
  assert.equal(isMenuKey({ key: 'F10', shiftKey: true, metaKey: true }), false);
  assert.equal(isMenuKey({ key: 'F10', shiftKey: true, altKey: true }), false);
  assert.equal(isMenuKey({ key: 'p' }), false);
  assert.equal(isMenuKey(null), false);
});

test('menuPlacement: a right-click opens the menu at the pointer', () => {
  assert.deepEqual(menuPlacement({ point: { x: 100, y: 200 }, w: 180, h: 200, vw: 1000, vh: 800 }), { left: 100, top: 200 });
});

test('menuPlacement: near an edge, the menu moves back onto the screen, 8px from it', () => {
  assert.deepEqual(menuPlacement({ point: { x: 990, y: 790 }, w: 180, h: 200, vw: 1000, vh: 800 }), { left: 812, top: 592 });
  assert.deepEqual(menuPlacement({ point: { x: 0, y: 0 }, w: 180, h: 200, vw: 1000, vh: 800 }), { left: 8, top: 8 });
});

test('menuPlacement: for a long-press or a key, the menu opens under the item, away from the finger', () => {
  const rect = { left: 40, top: 100, bottom: 164 };
  assert.deepEqual(menuPlacement({ rect, w: 180, h: 200, vw: 390, vh: 800 }), { left: 40, top: 168 });
});

test('menuPlacement: with no room under the item, the menu opens over it', () => {
  const rect = { left: 40, top: 600, bottom: 664 };
  assert.deepEqual(menuPlacement({ rect, w: 180, h: 200, vw: 390, vh: 800 }), { left: 40, top: 396 });
});

test('menuPlacement: a menu taller than the screen starts at the top edge (its CSS scrolls it)', () => {
  const rect = { left: 40, top: 100, bottom: 164 };
  assert.equal(menuPlacement({ rect, w: 180, h: 400, vw: 390, vh: 300 }).top, 8);
});

test('the long-press guards are the Shelf’s: 500ms hold, 10px slop, 350ms lift guard', () => {
  // a change to these is a change to how every surface feels on a phone: update CLAUDE.md §3.5 too
  assert.deepEqual([LONG_PRESS_MS, MOVE_SLOP, LIFT_GUARD_MS], [500, 10, 350]);
});
