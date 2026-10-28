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

test('importJSON rejects JSON that is not a collection backup (no silent wipe)', async () => {
  const { store } = await freshStore();
  store.setMark('a', 'owned');
  assert.equal(store.importJSON('[]'), false);                 // an array is not a backup
  assert.equal(store.importJSON('42'), false);
  assert.equal(store.importJSON(JSON.stringify({ version: '1.0', paints: [], groups: [] })), false);   // paints.json picked by mistake
  assert.equal(store.markOf('a'), 'owned');                    // collection untouched by the rejects
});

test('importJSON merges only the prefs the backup carries', async () => {
  const { store } = await freshStore();
  store.setPref('ladder', 'both');
  store.setPref('theme', 'dark');
  assert.equal(store.importJSON(JSON.stringify({ owned: ['x'], prefs: { theme: 'light' } })), true);
  assert.equal(store.getPref('theme'), 'light');   // carried by the backup → applied
  assert.equal(store.getPref('ladder'), 'both');   // absent from the backup → kept, not reset to default
  assert.equal(store.markOf('x'), 'owned');
});

test('hydrate: no-op on the web, restores from the native mirror after eviction', async () => {
  // web (no Capacitor global) → instant false
  delete globalThis.Capacitor;
  const { store } = await freshStore();
  assert.equal(await store.hydrate(), false);

  // native, localStorage EVICTED, mirror holds the collection → restored + re-persisted
  const mirror = new Map([['ps-state', JSON.stringify({ v: 1, owned: ['a'], want: ['b'], prefs: { theme: 'dark' } })]]);
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { Preferences: {
    get: async ({ key }) => ({ value: mirror.get(key) ?? null }),
    set: async ({ key, value }) => { mirror.set(key, value); },
  } } };
  const { store: s2, ls } = await freshStore();          // fresh empty localStorage = the eviction
  assert.equal(await s2.hydrate(), true);
  assert.equal(s2.markOf('a'), 'owned');
  assert.equal(s2.markOf('b'), 'want');
  assert.equal(s2.getPref('theme'), 'dark');
  assert.ok(ls.getItem('ps-state').includes('"a"'), 'restored state re-persisted to localStorage');

  // native, localStorage INTACT → localStorage wins; the mirror is refreshed from it
  const { store: s3 } = await freshStore({ 'ps-state': JSON.stringify({ v: 1, owned: ['web'], want: [], prefs: {} }) });
  assert.equal(await s3.hydrate(), false);
  assert.equal(s3.markOf('web'), 'owned');
  assert.ok(mirror.get('ps-state').includes('"web"'), 'mirror refreshed from the authoritative localStorage');
  delete globalThis.Capacitor;
});

/* ---- the backup file: ⋯ → Back up / Restore…, and About & data → Delete (CLAUDE.md §3.6) ---- */

test('exportJSON writes a `saved` date that importJSON ignores', async () => {
  const { store } = await freshStore();
  store.setMark('a', 'owned');
  const json = store.exportJSON({ now: new Date('2026-09-30T10:00:00Z') });
  const o = JSON.parse(json);
  assert.equal(o.saved, '2026-09-30T10:00:00.000Z');
  assert.deepEqual(o.owned, ['a']);
  const { store: s2, ls } = await freshStore();
  assert.equal(s2.importJSON(json), true);
  assert.equal(JSON.parse(ls.getItem('ps-state')).saved, undefined, 'the date is about the file, not the stored state');
});

test('a backup carries exactly theme, locale, collection, ladder and contrast (no dead `fill`)', async () => {
  const seed = { 'ps-state': JSON.stringify({ v: 1, owned: [], want: [], prefs: { fill: 'real', theme: 'dark', bogus: 1 } }) };
  const { store } = await freshStore(seed);
  const prefs = JSON.parse(store.exportJSON()).prefs;
  assert.deepEqual(Object.keys(prefs).sort(), ['collection', 'contrast', 'ladder', 'locale', 'theme']);
  assert.equal(prefs.theme, 'dark');
  assert.equal(store.getPref('fill'), undefined);
});

test('inspectJSON counts a backup and applies nothing', async () => {
  const { store } = await freshStore();
  store.setMarks(['a', 'b', 'c'], 'owned');
  store.setMarks(['w1', 'w2'], 'want');
  const backup = JSON.stringify({ v: 1, owned: ['a', 'x', 'y'], want: ['b'], prefs: { theme: 'light' }, saved: '2026-09-30T10:00:00.000Z' });
  const info = store.inspectJSON(backup);
  assert.deepEqual(info, { ok: true, owned: 3, want: 1, saved: '2026-09-30T10:00:00.000Z', lost: 3 });   // c, w1, w2 have no mark there
  assert.deepEqual(store.counts(), { owned: 3, want: 2 }, 'nothing applied');
  assert.equal(store.getPref('theme'), null);
});

test('inspectJSON: no date → saved null; a bad date → null; not a backup → ok false', async () => {
  const { store } = await freshStore();
  assert.equal(store.inspectJSON(JSON.stringify({ owned: ['a'] })).saved, null);
  assert.equal(store.inspectJSON(JSON.stringify({ owned: ['a'], saved: 'last tuesday' })).saved, null);
  assert.deepEqual(store.inspectJSON('[]'), { ok: false });
  assert.deepEqual(store.inspectJSON('not json'), { ok: false });
  assert.deepEqual(store.inspectJSON(JSON.stringify({ version: '1.6.0', paints: [] })), { ok: false });   // paints.json picked by mistake
});

test('inspectJSON and importJSON agree on a paint listed as both owned and to buy (owned wins)', async () => {
  const { store } = await freshStore();
  const backup = JSON.stringify({ owned: ['a', 'a'], want: ['a', 'b'] });
  assert.deepEqual(store.inspectJSON(backup), { ok: true, owned: 1, want: 1, saved: null, lost: 0 });
  store.importJSON(backup);
  assert.equal(store.markOf('a'), 'owned');
  assert.deepEqual(store.counts(), { owned: 1, want: 1 });
});

test('importJSON: a restored theme or locale of null stays null (follow the device)', async () => {
  const { store } = await freshStore();
  store.setPref('theme', 'dark'); store.setPref('locale', 'en-US');
  assert.equal(store.importJSON(JSON.stringify({ owned: [], prefs: { theme: null, locale: null, collection: 'only' } })), true);
  assert.equal(store.getPref('theme'), null);
  assert.equal(store.getPref('locale'), null);
  assert.equal(store.getPref('collection'), 'only');
});

test('clear() removes ps-state, the legacy keys and the iOS mirror, so the next start stays empty', async () => {
  const mirror = new Map();
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { Preferences: {
    get: async ({ key }) => ({ value: mirror.get(key) ?? null }),
    set: async ({ key, value }) => { mirror.set(key, value); },
    remove: async ({ key }) => { mirror.delete(key); },
  } } };
  const { store, ls } = await freshStore({ 'ps-owned': JSON.stringify(['legacy']), 'ps-theme': 'dark' });
  store.setMark('a', 'owned'); store.setPref('collection', 'prefer');
  assert.ok(mirror.has('ps-state'));
  store.clear();
  await new Promise(r => setTimeout(r));   // the mirror's remove() is async
  assert.equal(ls.getItem('ps-state'), null);
  assert.equal(ls.getItem('ps-owned'), null);
  assert.equal(ls.getItem('ps-theme'), null);
  assert.equal(mirror.has('ps-state'), false);
  assert.deepEqual(store.counts(), { owned: 0, want: 0 });
  assert.equal(store.getPref('collection'), 'off');
  assert.equal(store.getPref('theme'), null);
  // the next start: nothing in localStorage, nothing in the mirror → an empty shelf, not the old one
  const { store: next } = await import(`../src/js/store.js?t=${seq++}`).then(m => ({ store: m }));
  assert.equal(await next.hydrate(), false);
  assert.deepEqual(next.counts(), { owned: 0, want: 0 });
  delete globalThis.Capacitor;
});

test('a pref value it may not have gets the default on load, and is not restored from a backup (B2)', async () => {
  const junk = { theme: 'Dark', locale: 'fr-FR', collection: 'yes', ladder: 7, contrast: 'no' };
  // on load: every junk value falls back to its default
  const { store } = await freshStore({ 'ps-state': JSON.stringify({ v: 1, owned: [], want: [], prefs: junk }) });
  assert.deepEqual(JSON.parse(store.exportJSON()).prefs, { theme: null, ladder: 'wash', locale: null, collection: 'off', contrast: false });
  // on restore: a junk value counts as not carried, so this device's own value stays
  store.setPref('theme', 'dark'); store.setPref('collection', 'prefer'); store.setPref('contrast', true);
  assert.equal(store.importJSON(JSON.stringify({ owned: ['a'], prefs: junk })), true);
  assert.equal(store.getPref('theme'), 'dark');
  assert.equal(store.getPref('collection'), 'prefer');
  assert.equal(store.getPref('contrast'), true);
  assert.equal(store.getPref('ladder'), 'wash');
  assert.equal(store.getPref('locale'), null);
  // ...and the junk never reaches the next backup
  assert.doesNotMatch(store.exportJSON(), /fr-FR|"Dark"|"yes"/);
});

test('store accepts exactly the locales i18n.js has', async () => {
  const { store } = await freshStore();
  const { LOCALE_IDS } = await import('../src/js/i18n.js');
  assert.ok(LOCALE_IDS.length >= 2);
  for (const l of LOCALE_IDS) {
    assert.equal(store.importJSON(JSON.stringify({ owned: [], prefs: { locale: l } })), true);
    assert.equal(store.getPref('locale'), l, `${l} is kept`);
  }
  store.importJSON(JSON.stringify({ owned: [], prefs: { locale: 'xx-XX' } }));
  assert.equal(store.getPref('locale'), LOCALE_IDS[LOCALE_IDS.length - 1], 'an unknown locale is not restored');
});
