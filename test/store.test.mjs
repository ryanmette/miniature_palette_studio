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
  assert.equal(saved.v, 2);
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
  assert.deepEqual(info, { ok: true, owned: 3, want: 1, schemes: 0, saved: '2026-09-30T10:00:00.000Z', lost: 3, schemesLost: 0 });   // c, w1, w2 have no mark there
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
  assert.deepEqual(store.inspectJSON(backup), { ok: true, owned: 1, want: 1, schemes: 0, saved: null, lost: 0, schemesLost: 0 });
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

test('another tab: a save or a Delete there is taken here too, so this tab cannot write its old copy back', async () => {
  // The browser sends `storage` to the OTHER tabs only. Catch the listener store.js adds at import.
  let onStorage = null;
  globalThis.addEventListener = (type, fn) => { if (type === 'storage') onStorage = fn; };
  try {
    const { store, ls } = await freshStore();
    store.setMark('p1', 'owned'); store.setPref('collection', 'prefer');
    assert.equal(typeof onStorage, 'function');
    let calls = 0, before = null;
    store.onExternalChange(b => { calls++; before = b; });
    // the other tab marked p2 and set Only: this tab takes its state, and is told what the prefs were
    onStorage({ key: 'ps-state', newValue: JSON.stringify({ v: 1, owned: ['p2'], want: [], prefs: { collection: 'only' } }) });
    assert.equal(calls, 1);
    assert.equal(before.collection, 'prefer');
    assert.equal(store.isOwned('p1'), false);
    assert.equal(store.isOwned('p2'), true);
    assert.equal(store.getPref('collection'), 'only');
    // the other tab deleted the shelf: this tab is fresh, and its next save does not bring p2 back
    onStorage({ key: 'ps-state', newValue: null });
    assert.deepEqual(store.counts(), { owned: 0, want: 0 });
    store.setPref('ladder', 'tone');
    assert.deepEqual(JSON.parse(ls.getItem('ps-state')).owned, []);
    // another key, or a value that is not JSON, changes nothing
    onStorage({ key: 'other', newValue: '{}' });
    onStorage({ key: 'ps-state', newValue: '{not json' });
    assert.equal(calls, 2);
    assert.equal(store.getPref('ladder'), 'tone');
  } finally { delete globalThis.addEventListener; }
});

/* ---- v2: the shopping list's count and project, and kept schemes (PLAN §5 item 34) ---- */

const LINK = '?p=citadel-base-death-guard-green&h=triadic';
const LINK2 = '?p=citadel-base-kantor-blue&h=split';
const at = iso => ({ now: new Date(iso) });

test('v2: a v1 state loads as one pot each, no project, no schemes', async () => {
  const { store, ls } = await freshStore({ 'ps-state': JSON.stringify({ v: 1, owned: ['a'], want: ['b', 'c'], prefs: {} }) });
  assert.equal(store.qtyOf('b'), 1);
  assert.equal(store.projectOf('b'), null);
  assert.deepEqual(store.listSchemes(), []);
  store.setMark('d', 'owned');
  const saved = JSON.parse(ls.getItem('ps-state'));
  assert.equal(saved.v, 2);
  assert.deepEqual(saved.want, ['b', 'c'], '`want` stays a list of ids, so a v1 build still reads the list');
  assert.deepEqual(saved.wantInfo, {});
  assert.deepEqual(saved.schemes, {});
});

test('v2: a count is set after the fact, only on a to-buy paint, 1–99, and 1 is not stored', async () => {
  const { store, ls } = await freshStore();
  assert.equal(store.qtyOf('p'), 0, 'not to buy → 0 pots');
  assert.equal(store.setQty('p', 3), false, 'only a to-buy paint has a count');
  store.setMark('p', 'want');
  assert.equal(store.qtyOf('p'), 1);
  assert.equal(store.setQty('p', 3), true);
  assert.equal(store.qtyOf('p'), 3);
  assert.deepEqual(JSON.parse(ls.getItem('ps-state')).wantInfo, { p: { qty: 3 } });
  store.setQty('p', 500); assert.equal(store.qtyOf('p'), 99);
  store.setQty('p', 2.6); assert.equal(store.qtyOf('p'), 3);
  assert.equal(store.setQty('p', 'lots'), false); assert.equal(store.qtyOf('p'), 3);
  store.setQty('p', 0); assert.equal(store.qtyOf('p'), 1);
  assert.deepEqual(JSON.parse(ls.getItem('ps-state')).wantInfo, {}, 'one pot is the default, not stored');
});

test('v2: marking a paint to buy again keeps its count; buying it ends the count', async () => {
  const { store } = await freshStore();
  store.setMark('p', 'want'); store.setQty('p', 2);
  store.setMarks(['p', 'q'], 'want');
  assert.equal(store.qtyOf('p'), 2, 'already on the list: the count stays');
  store.setMark('p', 'owned');
  assert.equal(store.qtyOf('p'), 0);
  store.setMark('p', 'want');
  assert.equal(store.qtyOf('p'), 1, 'back on the list: one pot again');
});

test('v2: createScheme keeps a scheme with a stable id; a bad link makes none', async () => {
  const { store } = await freshStore();
  assert.equal(store.createScheme({ link: 'citadel' }), null, 'a link starts with ?');
  assert.equal(store.createScheme({ link: '?' + 'x'.repeat(5000) }), null);
  const sid = store.createScheme({ link: LINK, name: '  Plague   Marine ', saved: true, ...at('2026-10-20T09:00:00Z') });
  assert.match(sid, /^[a-z0-9]{8}$/);
  assert.deepEqual(store.getScheme(sid), { id: sid, name: 'Plague Marine', link: LINK, saved: true,
    created: '2026-10-20T09:00:00.000Z', changed: '2026-10-20T09:00:00.000Z' });
  // a new link (the painter changed the harmony and pressed Save) keeps the id
  assert.equal(store.updateScheme(sid, { link: LINK2 }, at('2026-10-27T09:00:00Z')), true);
  assert.equal(store.getScheme(sid).link, LINK2);
  assert.equal(store.getScheme(sid).changed, '2026-10-27T09:00:00.000Z');
  assert.equal(store.updateScheme(sid, { link: 'nope' }), false);
  assert.equal(store.getScheme(sid).link, LINK2, 'a bad link changes nothing');
  assert.equal(store.updateScheme('missing', { name: 'x' }), false);
  // getScheme hands out a copy
  store.getScheme(sid).name = 'hacked';
  assert.equal(store.getScheme(sid).name, 'Plague Marine');
});

test('v2: listSchemes is newest change first; findSchemeByLink prefers a saved one', async () => {
  const { store } = await freshStore();
  const a = store.createScheme({ link: LINK, saved: true, ...at('2026-10-01T00:00:00Z') });
  const b = store.createScheme({ link: LINK2, saved: true, ...at('2026-10-05T00:00:00Z') });
  assert.deepEqual(store.listSchemes().map(s => s.id), [b, a]);
  store.updateScheme(a, { name: 'Renamed' }, at('2026-10-09T00:00:00Z'));
  assert.deepEqual(store.listSchemes().map(s => s.id), [a, b]);
  const p = store.createScheme({ link: LINK });   // a project with the same link, not saved
  store.setMark('x', 'want', { for: p });
  assert.equal(store.findSchemeByLink(LINK), a);
  assert.equal(store.findSchemeByLink('?none'), null);
});

test('v2: a to-buy paint points at its project; a project nobody points at goes, a saved one stays', async () => {
  const { store } = await freshStore();
  const proj = store.createScheme({ link: LINK });                 // skipped at export: not saved
  const kept = store.createScheme({ link: LINK2, saved: true });
  store.setMarks(['a', 'b'], 'want', { for: proj });
  store.setMark('c', 'want', { for: kept });
  store.setMark('d', 'want', { for: 'no-such-scheme' });
  assert.equal(store.projectOf('a'), proj);
  assert.equal(store.projectOf('c'), kept);
  assert.equal(store.projectOf('d'), null, 'an unknown scheme id is not kept');
  store.setMark('a', 'owned');
  assert.ok(store.getScheme(proj), 'b still points at it');
  store.setMark('b', 'owned');                                     // the last paint is bought
  assert.equal(store.getScheme(proj), null, 'an unsaved project leaves with its last paint');
  store.setMark('c', 'owned');
  assert.ok(store.getScheme(kept), 'a saved scheme stays for good (Ryan: a name saves for good)');
});

test('v2: a project made a moment ago is not dropped by an unrelated mark before its paints come', async () => {
  const { store } = await freshStore();
  const proj = store.createScheme({ link: LINK });
  store.setMark('elsewhere', 'owned');                       // any other change first
  store.setMark('other', 'want');
  assert.ok(store.getScheme(proj), 'still there for its paints');
  store.setMark('a', 'want', { for: proj });
  assert.equal(store.projectOf('a'), proj);
  // moving the paint to another project leaves the first one with nothing: it goes
  const next = store.createScheme({ link: LINK2 });
  store.setMark('a', 'want', { for: next });
  assert.equal(store.getScheme(proj), null);
  assert.ok(store.getScheme(next));
  // un-saving a saved scheme no paint points at removes it
  const s = store.createScheme({ link: '?p=x', saved: true });
  store.updateScheme(s, { saved: false });
  assert.equal(store.getScheme(s), null);
});

test('v2: deleteScheme keeps the paints on the list, with no project', async () => {
  const { store, ls } = await freshStore();
  const sid = store.createScheme({ link: LINK, name: 'Blue knight', saved: true });
  store.setMarks(['a', 'b'], 'want', { for: sid });
  store.setQty('a', 2);
  assert.equal(store.deleteScheme(sid), true);
  assert.equal(store.deleteScheme(sid), false);
  assert.equal(store.isWant('a'), true);
  assert.equal(store.isWant('b'), true);
  assert.equal(store.projectOf('a'), null);
  assert.equal(store.qtyOf('a'), 2, 'the count stays');
  assert.deepEqual(JSON.parse(ls.getItem('ps-state')).wantInfo, { a: { qty: 2 } });
});

test('v2: uniqueName adds (2), (3)… when another scheme has the name', async () => {
  const { store } = await freshStore();
  assert.equal(store.uniqueName('Plague Marine'), 'Plague Marine');
  const a = store.createScheme({ link: LINK, name: 'Plague Marine', saved: true });
  assert.equal(store.uniqueName(' plague  MARINE '), 'plague MARINE (2)', 'case and spaces do not count');
  assert.equal(store.uniqueName('Plague Marine', a), 'Plague Marine', 'its own name is free');
  store.createScheme({ link: LINK2, name: 'Plague Marine (2)', saved: true });
  assert.equal(store.uniqueName('Plague Marine'), 'Plague Marine (3)');
  assert.equal(store.uniqueName('   '), '');
});

test('inspectJSON counts the saved schemes here that a Restore would delete (review 2026-10-29)', async () => {
  const { store } = await freshStore();
  const keep = store.createScheme({ link: LINK, name: 'Blue knight', saved: true });
  store.createScheme({ link: LINK2, name: 'Plague Marine', saved: true });
  const v1 = JSON.stringify({ v: 1, owned: [], want: [], prefs: {} });
  assert.equal(store.inspectJSON(v1).schemesLost, 2, 'a backup with no schemes takes both');
  const v2 = JSON.stringify({ v: 2, owned: [], want: [], schemes: { [keep]: { name: 'Blue knight', link: LINK, saved: true } } });
  assert.equal(store.inspectJSON(v2).schemesLost, 1, 'the one in the backup is not lost');
});

test('uniqueName: an 80-character name still gets a name of its own (review 2026-10-29)', async () => {
  const { store } = await freshStore();
  const long = 'x'.repeat(80);
  store.createScheme({ link: LINK, name: long, saved: true });
  const next = store.uniqueName(long);
  assert.equal([...next].length, 80);
  assert.ok(next.endsWith(' (2)'));
  const b = store.createScheme({ link: LINK2, name: next, saved: true });
  assert.notEqual(store.getScheme(b).name, long, 'the stored name differs from the first');
});

test('cleanName never splits an emoji (it cuts by characters)', async () => {
  const { store } = await freshStore();
  const sid = store.createScheme({ link: LINK, name: 'a'.repeat(79) + '😀😀', saved: true });
  assert.equal(store.getScheme(sid).name, 'a'.repeat(79) + '😀');
});

test('putScheme brings a dropped project back under its own id', async () => {
  const { store } = await freshStore();
  const sid = store.createScheme({ link: LINK });
  store.setMark('a', 'want', { for: sid });
  const rec = store.getScheme(sid);
  store.setMark('a', 'none');
  assert.equal(store.getScheme(sid), null, 'the project went with its last paint');
  assert.equal(store.putScheme(rec), true);
  store.setMark('a', 'want', { for: sid });
  assert.equal(store.projectOf('a'), sid);
  assert.equal(store.putScheme(rec), false, 'an id in use changes nothing');
  assert.equal(store.putScheme({ id: 'bad', link: LINK }), false);
});

test('seenNews has its own key: not in the backup file, and Delete removes it', async () => {
  const { store, ls } = await freshStore();
  assert.equal(store.seenNews(), null);
  store.setSeenNews('1.14.0');
  assert.equal(store.seenNews(), '1.14.0');
  assert.doesNotMatch(store.exportJSON(), /1\.14\.0/);
  store.clear();
  assert.equal(ls.getItem('ps-seen'), null);
});

test('a save that fails calls onSaveFail', async () => {
  const { store, ls } = await freshStore();
  let n = 0;
  store.onSaveFail(() => n++);
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  store.setMark('a', 'owned');
  assert.equal(n, 1);
});

test('v2: normalise drops bad schemes and bad counts from a hand-edited file', async () => {
  const blob = { v: 2, owned: ['o'], want: ['a', 'b', 'c'],
    wantInfo: { a: { qty: 3, for: 'abcd1234' }, b: { qty: 1, for: 'gone0000' }, c: { qty: 'x' }, o: { qty: 5 }, z: { qty: 4 } },
    schemes: {
      abcd1234: { name: 7, link: LINK, saved: 'yes', created: 'last week' },   // kept: odd fields tidied
      'BAD ID': { link: LINK, saved: true },
      nolink00: { name: 'x', saved: true },
      lonely00: { link: LINK2, saved: false },                                // nothing points at it
    }, prefs: {} };
  const { store } = await freshStore({ 'ps-state': JSON.stringify(blob) });
  const out = JSON.parse(store.exportJSON());
  assert.deepEqual(Object.keys(out.schemes), ['abcd1234']);
  assert.deepEqual(out.schemes.abcd1234, { name: '', link: LINK, saved: false, created: null, changed: null });
  assert.deepEqual(out.wantInfo, { a: { qty: 3, for: 'abcd1234' } }, 'b: no count, no scheme · c: not a number · o, z: not to buy');
});

test('v2: the backup carries the schemes and counts; Restore replaces them; inspect counts saved ones', async () => {
  const { store } = await freshStore();
  const sid = store.createScheme({ link: LINK, name: 'Plague Marine', saved: true });
  const proj = store.createScheme({ link: LINK2 });
  store.setMark('a', 'want', { for: sid }); store.setQty('a', 2);
  store.setMark('b', 'want', { for: proj });
  const json = store.exportJSON();
  const { store: other } = await freshStore();
  other.createScheme({ link: '?p=other', saved: true });
  assert.equal(other.inspectJSON(json).schemes, 1, 'the saved one; the project is not a saved scheme');
  assert.equal(other.importJSON(json), true);
  assert.deepEqual(other.listSchemes().map(s => s.id).sort(), [sid, proj].sort(), "Restore replaces this device's schemes");
  assert.equal(other.qtyOf('a'), 2);
  assert.equal(other.projectOf('a'), sid);
  assert.equal(other.getScheme(sid).name, 'Plague Marine');
  // a v1 backup restores with no schemes
  assert.equal(other.importJSON(JSON.stringify({ v: 1, owned: [], want: ['a'] })), true);
  assert.deepEqual(other.listSchemes(), []);
  assert.equal(other.qtyOf('a'), 1);
});

test('v2: clear() empties the schemes and counts; another tab takes them too', async () => {
  let onStorage = null;
  globalThis.addEventListener = (type, fn) => { if (type === 'storage') onStorage = fn; };
  try {
    const { store } = await freshStore();
    const sid = store.createScheme({ link: LINK, saved: true });
    store.setMark('a', 'want', { for: sid }); store.setQty('a', 4);
    onStorage({ key: 'ps-state', newValue: JSON.stringify({ v: 2, owned: [], want: ['b'],
      wantInfo: { b: { qty: 2, for: 'tab2tab2' } }, schemes: { tab2tab2: { link: LINK2, saved: true } }, prefs: {} }) });
    assert.equal(store.getScheme(sid), null);
    assert.equal(store.qtyOf('b'), 2);
    assert.equal(store.projectOf('b'), 'tab2tab2');
    store.clear();
    assert.deepEqual(store.listSchemes(), []);
    assert.equal(store.qtyOf('b'), 0);
  } finally { delete globalThis.addEventListener; }
});

test('v2: setQtys sets many counts in one write and skips paints that are not to buy', async () => {
  const { store, ls } = await freshStore();
  store.setMarks(['a', 'b'], 'want');
  let writes = 0;
  const set = ls.setItem; ls.setItem = (k, v) => { writes++; set(k, v); };
  assert.equal(store.setQtys([['a', 2], ['b', 5], ['c', 3], ['a', null]]), 2);
  assert.equal(writes, 1);
  assert.equal(store.qtyOf('a'), 2);
  assert.equal(store.qtyOf('b'), 5);
  assert.equal(store.qtyOf('c'), 0);
  assert.equal(store.setQtys([]), 0);
  assert.equal(writes, 1, 'nothing set → nothing written');
});

test('v2: asked — the naming step shows a project once; it survives a reload and does not move the scheme', async () => {
  const { store, ls } = await freshStore();
  const t0 = new Date('2026-10-29T10:00:00Z'), t1 = new Date('2026-10-29T11:00:00Z');
  const sid = store.createScheme({ link: '?p=a&c=112233&h=triadic', now: t0 });
  store.setMark('p1', 'want', { for: sid });
  assert.equal(store.getScheme(sid).asked, undefined);
  assert.equal(store.updateScheme(sid, { asked: true }, { now: t1 }), true);
  assert.equal(store.getScheme(sid).asked, true);
  assert.equal(store.getScheme(sid).changed, t0.toISOString());   // asked is not a change
  store.updateScheme(sid, { name: 'Blue knight' }, { now: t1 });
  assert.equal(store.getScheme(sid).asked, true);                  // a rename keeps it
  const again = await freshStore({ 'ps-state': ls.getItem('ps-state') });
  assert.equal(again.store.getScheme(sid).asked, true);
  assert.equal(again.store.getScheme(sid).saved, false);           // asked and skipped: still not saved
});
