import { test } from 'node:test';
import assert from 'node:assert/strict';

// store.js is the single persistence chokepoint (CLAUDE.md §4). It has no DOM dependency — only
// localStorage — so we stub that and exercise the real module. The module reads storage once at
// import time (`const state = load()`), so each scenario re-imports a FRESH instance (cache-busted
// query string) against a controlled localStorage, letting us test load / migration / corruption too.

// A minimal in-memory stand-in for the browser's localStorage API, seedable with initial key/values, so we
// can control exactly what store.js sees when it loads.
function mockLocalStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}

let seq = 0;   // bumps the import query string so each freshStore() gets an uncached module instance
/** Fresh store instance with a controlled localStorage (re-runs store.js top-level load()). */
async function freshStore(seed) {
  globalThis.localStorage = mockLocalStorage(seed);            // install our stub before the module loads
  const store = await import(`../src/js/store.js?t=${seq++}`); // cache-busted import re-runs store.js's load()
  return { store, ls: globalThis.localStorage };
}

// A brand-new store (empty storage) starts with an empty collection and the documented default prefs
// (ladder=wash, no theme set, collection=off).
test('fresh state: empty collection + default prefs', async () => {
  const { store } = await freshStore();
  assert.deepEqual(store.counts(), { owned: 0, want: 0 });
  assert.equal(store.markOf('x'), 'none');
  assert.equal(store.getPref('ladder'), 'wash');
  assert.equal(store.getPref('theme'), null);
  assert.equal(store.getPref('collection'), 'off');
});

// A paint can be "owned" OR "want" (to-buy) but never both: setting one clears the other, and "none" clears
// both. This is the core state machine of the collection.
test('setMark: owned and want are mutually exclusive', async () => {
  const { store } = await freshStore();
  store.setMark('p1', 'owned');
  assert.equal(store.isOwned('p1'), true);
  assert.equal(store.isWant('p1'), false);
  assert.equal(store.markOf('p1'), 'owned');

  store.setMark('p1', 'want');            // flipping to want clears owned
  assert.equal(store.isOwned('p1'), false);
  assert.equal(store.isWant('p1'), true);
  assert.equal(store.markOf('p1'), 'want');

  store.setMark('p1', 'none');            // clears both
  assert.equal(store.markOf('p1'), 'none');
  assert.deepEqual(store.counts(), { owned: 0, want: 0 });
});

// Marks are written through to localStorage under the versioned "ps-state" key (v:1), with owned/want stored
// as id arrays — the persisted shape other tools (export, migration) depend on.
test('setMark persists to localStorage under ps-state', async () => {
  const { store, ls } = await freshStore();
  store.setMark('a', 'owned');
  store.setMark('b', 'want');
  const saved = JSON.parse(ls.getItem('ps-state'));
  assert.equal(saved.v, 1);
  assert.deepEqual(saved.owned, ['a']);
  assert.deepEqual(saved.want, ['b']);
});

// The reverse of the above: an existing ps-state in storage is loaded back into the live model (marks + prefs),
// and any pref not present keeps its default.
test('persisted ps-state is read back on load', async () => {
  const seed = { 'ps-state': JSON.stringify({ v: 1, owned: ['a'], want: ['b'], prefs: { theme: 'dark' } }) };
  const { store } = await freshStore(seed);
  assert.equal(store.isOwned('a'), true);
  assert.equal(store.isWant('b'), true);
  assert.equal(store.getPref('theme'), 'dark');
  assert.equal(store.getPref('ladder'), 'wash');   // unset key keeps its default
});

// Defensive loading: valid JSON but wrong shapes (numbers/null in the owned array, a string where an array is
// expected, junk prefs) are coerced to safe values rather than crashing — resilience against hand-edited storage.
test('normalise coerces corrupt/hand-edited data', async () => {
  const seed = { 'ps-state': JSON.stringify({ owned: ['a', 5, 'b', null], want: 'nope', prefs: 'bad' }) };
  const { store } = await freshStore(seed);
  assert.deepEqual([...store.ownedIds()].sort(), ['a', 'b']);  // non-strings dropped
  assert.deepEqual([...store.wantIds()], []);                  // non-array → []
  assert.equal(store.getPref('ladder'), 'wash');               // unusable prefs → defaults
});

// Completely unparseable storage (not even valid JSON) falls back to a clean empty state instead of throwing.
test('corrupt JSON in storage falls back to a fresh state', async () => {
  const { store } = await freshStore({ 'ps-state': '{not json' });
  assert.deepEqual(store.counts(), { owned: 0, want: 0 });
});

// Backward compatibility: data saved under the old pre-v1 keys (ps-owned / ps-theme) is migrated into the new
// unified model on load, with the same non-string filtering applied.
test('migrates pre-v1 legacy keys (ps-owned / ps-theme)', async () => {
  const seed = { 'ps-owned': JSON.stringify(['x', 'y', 7]), 'ps-theme': 'dark' };
  const { store } = await freshStore(seed);
  assert.equal(store.isOwned('x'), true);
  assert.equal(store.isOwned('y'), true);
  assert.equal(store.counts().owned, 2);           // non-string filtered out
  assert.equal(store.getPref('theme'), 'dark');
});

// setPref updates a preference in memory and writes it through to the persisted prefs object.
test('setPref updates and persists', async () => {
  const { store, ls } = await freshStore();
  store.setPref('ladder', 'tone');
  store.setPref('collection', 'only');
  assert.equal(store.getPref('ladder'), 'tone');
  const saved = JSON.parse(ls.getItem('ps-state'));
  assert.equal(saved.prefs.ladder, 'tone');
  assert.equal(saved.prefs.collection, 'only');
});

// The portable backup path: exportJSON serialises collection + prefs, and importing it into a separate clean
// store reproduces the exact state — the basis for moving data between devices/storage backends.
test('exportJSON / importJSON round-trips collection + prefs', async () => {
  const { store } = await freshStore();
  store.setMark('a', 'owned');
  store.setMark('b', 'want');
  store.setPref('theme', 'dark');
  const json = store.exportJSON();

  const { store: store2 } = await freshStore();    // a separate, clean instance
  assert.equal(store2.isOwned('a'), false);         // starts empty
  assert.equal(store2.importJSON(json), true);
  assert.equal(store2.isOwned('a'), true);
  assert.equal(store2.isWant('b'), true);
  assert.equal(store2.getPref('theme'), 'dark');
});

// A failed import (garbage input) returns false and leaves the current collection untouched — no partial
// corruption from a bad file.
test('importJSON returns false on garbage and keeps existing state', async () => {
  const { store } = await freshStore();
  store.setMark('a', 'owned');
  assert.equal(store.importJSON('not json at all'), false);
  assert.equal(store.isOwned('a'), true);           // unchanged
});

// A successful import REPLACES the whole collection (it's a restore, not a merge): prior marks are cleared and
// only the imported ones remain.
test('importJSON replaces the prior collection (clears old marks)', async () => {
  const { store } = await freshStore();
  store.setMark('old', 'owned');
  assert.equal(store.importJSON(JSON.stringify({ owned: ['new'], want: [], prefs: {} })), true);
  assert.equal(store.isOwned('old'), false);        // cleared
  assert.equal(store.isOwned('new'), true);
});
