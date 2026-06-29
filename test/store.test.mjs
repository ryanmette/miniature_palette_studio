import { test } from 'node:test';
import assert from 'node:assert/strict';

// store.js is the single persistence chokepoint (CLAUDE.md §4). It has no DOM dependency — only
// localStorage — so we stub that and exercise the real module. The module reads storage once at
// import time (`const state = load()`), so each scenario re-imports a FRESH instance (cache-busted
// query string) against a controlled localStorage, letting us test load / migration / corruption too.

function mockLocalStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}

let seq = 0;
/** Fresh store instance with a controlled localStorage (re-runs store.js top-level load()). */
async function freshStore(seed) {
  globalThis.localStorage = mockLocalStorage(seed);
  const store = await import(`../src/js/store.js?t=${seq++}`);
  return { store, ls: globalThis.localStorage };
}

test('fresh state: empty collection + default prefs', async () => {
  const { store } = await freshStore();
  assert.deepEqual(store.counts(), { owned: 0, want: 0 });
  assert.equal(store.markOf('x'), 'none');
  assert.equal(store.getPref('ladder'), 'wash');
  assert.equal(store.getPref('theme'), null);
  assert.equal(store.getPref('collection'), 'off');
});

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

test('setMark persists to localStorage under ps-state', async () => {
  const { store, ls } = await freshStore();
  store.setMark('a', 'owned');
  store.setMark('b', 'want');
  const saved = JSON.parse(ls.getItem('ps-state'));
  assert.equal(saved.v, 1);
  assert.deepEqual(saved.owned, ['a']);
  assert.deepEqual(saved.want, ['b']);
});

test('persisted ps-state is read back on load', async () => {
  const seed = { 'ps-state': JSON.stringify({ v: 1, owned: ['a'], want: ['b'], prefs: { theme: 'dark' } }) };
  const { store } = await freshStore(seed);
  assert.equal(store.isOwned('a'), true);
  assert.equal(store.isWant('b'), true);
  assert.equal(store.getPref('theme'), 'dark');
  assert.equal(store.getPref('ladder'), 'wash');   // unset key keeps its default
});

test('normalise coerces corrupt/hand-edited data', async () => {
  const seed = { 'ps-state': JSON.stringify({ owned: ['a', 5, 'b', null], want: 'nope', prefs: 'bad' }) };
  const { store } = await freshStore(seed);
  assert.deepEqual([...store.ownedIds()].sort(), ['a', 'b']);  // non-strings dropped
  assert.deepEqual([...store.wantIds()], []);                  // non-array → []
  assert.equal(store.getPref('ladder'), 'wash');               // unusable prefs → defaults
});

test('corrupt JSON in storage falls back to a fresh state', async () => {
  const { store } = await freshStore({ 'ps-state': '{not json' });
  assert.deepEqual(store.counts(), { owned: 0, want: 0 });
});

test('migrates pre-v1 legacy keys (ps-owned / ps-theme)', async () => {
  const seed = { 'ps-owned': JSON.stringify(['x', 'y', 7]), 'ps-theme': 'dark' };
  const { store } = await freshStore(seed);
  assert.equal(store.isOwned('x'), true);
  assert.equal(store.isOwned('y'), true);
  assert.equal(store.counts().owned, 2);           // non-string filtered out
  assert.equal(store.getPref('theme'), 'dark');
});

test('setPref updates and persists', async () => {
  const { store, ls } = await freshStore();
  store.setPref('ladder', 'tone');
  store.setPref('collection', 'only');
  assert.equal(store.getPref('ladder'), 'tone');
  const saved = JSON.parse(ls.getItem('ps-state'));
  assert.equal(saved.prefs.ladder, 'tone');
  assert.equal(saved.prefs.collection, 'only');
});

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

test('importJSON returns false on garbage and keeps existing state', async () => {
  const { store } = await freshStore();
  store.setMark('a', 'owned');
  assert.equal(store.importJSON('not json at all'), false);
  assert.equal(store.isOwned('a'), true);           // unchanged
});

test('importJSON replaces the prior collection (clears old marks)', async () => {
  const { store } = await freshStore();
  store.setMark('old', 'owned');
  assert.equal(store.importJSON(JSON.stringify({ owned: ['new'], want: [], prefs: {} })), true);
  assert.equal(store.isOwned('old'), false);        // cleared
  assert.equal(store.isOwned('new'), true);
});
