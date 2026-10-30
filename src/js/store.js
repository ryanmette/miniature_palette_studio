// store.js — the single persistence chokepoint: a versioned, portable "my collection" + prefs model.
// localStorage today, but the shape is plain-serialisable so it can move to IndexedDB, a native
// store, or a synced file (export/import JSON) WITHOUT touching callers. No personal data leaves the
// device. Collection states are mutually exclusive: a paint is owned, to-buy, or neither (CLAUDE.md
// collection model). Owned/to-buy markers are a shared model usable by any surface, not just the shelf.

const KEY = 'ps-state';
const LEGACY_KEYS = ['ps-owned', 'ps-theme'];   // the pre-v1 keys migrateLegacy() reads
// Set by the app (onSaveFail). Declared before load(), which can save while this module starts.
let onSaveError = null;
// v2 (PLAN §5 item 34) adds two maps BESIDE the v1 fields, never in place of them: `wantInfo` (a to-buy
// paint's count and project) and `schemes` (saved schemes and shopping-list projects). `want` stays a list
// of ids, so a v1 build that meets v2 data (an old cached app, an iOS app not yet updated) still reads the
// whole shopping list; it only drops the two maps it does not know.
const VERSION = 2;
// A to-buy paint's count: 1 is the default and is not stored. 99 is a sanity cap for a hand-edited file.
const QTY_MAX = 99;
const NAME_MAX = 80;
// A scheme's link is the share link's query (share.js encodeState), "?p=…&h=…". It is the scheme's whole
// state: the starting paint, the harmony, the holds, the locks. A longer string is not a link we made.
const LINK_MAX = 4000;
const SCHEME_ID = /^[a-z0-9]{8}$/;
// The settings a backup carries. theme and locale are null until the painter picks one: null means
// "follow the device". (Ideal | Real is not here: it belongs to one scheme and lives in the link.)
const PREF_DEFAULTS = { theme: null, ladder: 'wash', locale: null, collection: 'off', contrast: false };
// The values each pref may have. A backup is a file the painter can edit or get from somewhere else, so
// a value is kept only when it is one of these: an odd theme ('Dark') stopped the device-following, and
// contrast: 'no' turned Include Contrast on. The locales are i18n.js's LOCALES keys (i18n imports this
// module, so it cannot import i18n); test/store.test.mjs checks that the two lists agree.
const LOCALES = ['en-GB', 'en-US'];
const PREF_OK = {
  theme: v => v === null || v === 'light' || v === 'dark',
  ladder: v => v === 'wash' || v === 'tone' || v === 'both',
  locale: v => v === null || LOCALES.includes(v),
  collection: v => v === 'off' || v === 'prefer' || v === 'only',
  contrast: v => typeof v === 'boolean',
};
/** Does the blob `src` carry a usable value for pref `k`? */
const hasPref = (src, k) => k in src && PREF_OK[k](src[k]);

const fresh = () => ({ v: VERSION, owned: [], want: [], wantInfo: {}, schemes: {}, prefs: { ...PREF_DEFAULTS } });

const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
/** An ISO 8601 time, or null for anything that is not a time. */
const isoOrNull = x => { const t = typeof x === 'string' ? Date.parse(x) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : null; };
/** A name as the painter typed it, with the spaces tidied: '  Plague   Marine ' → 'Plague Marine'. */
// The cut counts characters (code points), not UTF-16 units, so it never splits an emoji in half.
const cleanName = x => (typeof x === 'string' ? [...x.trim().replace(/\s+/g, ' ')].slice(0, NAME_MAX).join('').trim() : '');
const isLink = x => typeof x === 'string' && x.startsWith('?') && x.length <= LINK_MAX;
const cleanQty = x => (Number.isInteger(x) && x >= 2 && x <= QTY_MAX ? x : undefined);

/** One-time pickup of the pre-v1 keys (ps-owned / ps-theme) so existing users keep their data. */
function migrateLegacy() {
  const s = fresh();
  try {
    const o = JSON.parse(localStorage.getItem('ps-owned') || 'null');
    if (Array.isArray(o)) s.owned = o.filter(x => typeof x === 'string');
    const t = localStorage.getItem('ps-theme');
    if (t === 'light' || t === 'dark') s.prefs.theme = t;
  } catch { /* private mode / corrupt */ }
  return s;
}

/** Coerce any parsed blob into a valid state (defensive against hand-edited/corrupt data).
 *  A paint is owned OR to-buy, never both, so a to-buy id that is also owned is dropped. Only the
 *  known pref keys are kept: an old key (such as the removed `fill`) must not ride along in a backup.
 *  A pref with a value it may not have (PREF_OK) gets its default. A v1 blob has no `wantInfo` or
 *  `schemes`: every to-buy paint is then one pot with no project, which is what v1 meant. */
function normalise(s) {
  const owned = Array.isArray(s?.owned) ? [...new Set(s.owned.filter(x => typeof x === 'string'))] : [];
  const has = new Set(owned);
  const want = Array.isArray(s?.want) ? [...new Set(s.want.filter(x => typeof x === 'string' && !has.has(x)))] : [];
  const schemes = {};
  for (const [sid, v] of Object.entries(isObj(s?.schemes) ? s.schemes : {})) {
    if (!SCHEME_ID.test(sid) || !isObj(v) || !isLink(v.link)) continue;   // a scheme without its link is nothing to open
    schemes[sid] = { name: cleanName(v.name), link: v.link, saved: v.saved === true, created: isoOrNull(v.created), changed: isoOrNull(v.changed) };
    // `asked`: the naming step at the first export has shown this project (a Skip keeps it unnamed for good).
    if (v.asked === true) schemes[sid].asked = true;
  }
  const wantInfo = {};
  const srcInfo = isObj(s?.wantInfo) ? s.wantInfo : {};
  for (const id of want) {
    const e = srcInfo[id]; if (!isObj(e)) continue;
    const out = {};
    const qty = cleanQty(e.qty); if (qty) out.qty = qty;
    if (typeof e.for === 'string' && schemes[e.for]) out.for = e.for;
    if (Object.keys(out).length) wantInfo[id] = out;
  }
  pruneObj(schemes, wantInfo);
  const src = isObj(s?.prefs) ? s.prefs : {};
  const prefs = {};
  for (const k of Object.keys(PREF_DEFAULTS)) prefs[k] = hasPref(src, k) ? src[k] : PREF_DEFAULTS[k];
  return { v: VERSION, owned, want, wantInfo, schemes, prefs };
}

/** A project that was never saved (its name was skipped at export) lives only while a to-buy paint
 *  points at it: drop the ones nothing points at. A saved scheme always stays. */
function pruneObj(schemesObj, infoObj) {
  const used = new Set(Object.values(infoObj).map(e => e.for).filter(Boolean));
  for (const [sid, sc] of Object.entries(schemesObj)) if (!sc.saved && !used.has(sid)) delete schemesObj[sid];
}

/** True when this device had nothing saved when the app loaded (no state, no legacy keys): a first
 *  visit, or the first one after Delete. Read before anything is written. The first-run block uses it. */
export const firstVisit = (() => {
  try { return !localStorage.getItem(KEY) && !LEGACY_KEYS.some(k => localStorage.getItem(k)); } catch { return false; }
})();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalise(JSON.parse(raw));
  } catch { /* private mode / corrupt → fall through */ }
  return normalise(migrateLegacy());
}

const state = load();
const owned = new Set(state.owned);
const want = new Set(state.want);
const info = new Map(Object.entries(state.wantInfo));     // to-buy id → { qty?, for? }
const schemes = new Map(Object.entries(state.schemes));   // scheme id → { name, link, saved, created, changed }

/** Take a normalised state's collection (not its prefs: each caller treats the prefs in its own way). */
function adopt(s) {
  owned.clear(); s.owned.forEach(x => owned.add(x));
  want.clear(); s.want.forEach(x => want.add(x));
  info.clear(); for (const [id, e] of Object.entries(s.wantInfo)) info.set(id, { ...e });
  schemes.clear(); for (const [sid, sc] of Object.entries(s.schemes)) schemes.set(sid, { ...sc });
}
/** Drop the unsaved projects among `sids` that no to-buy paint points at any more. Only the ones a
 *  change just left: a project made a moment ago, whose paints are not marked yet, must not go. */
function dropUnused(sids) {
  if (!sids.size) return;
  const used = new Set([...info.values()].map(e => e.for).filter(Boolean));
  for (const sid of sids) if (schemes.get(sid)?.saved === false && !used.has(sid)) schemes.delete(sid);
}

/* Native-shell persistence (IOS_APP_PLAN §4b): WKWebView can evict localStorage, so under Capacitor
 * every persist ALSO writes through to the Preferences plugin. The plugin object is injected by the
 * shell at runtime — never an import, so §6's no-dependency rule holds and the web pays nothing. */
const nativePrefs = () =>
  (globalThis.Capacitor?.isNativePlatform?.() && globalThis.Capacitor?.Plugins?.Preferences) || null;

function persist() {
  state.owned = [...owned];
  state.want = [...want];
  state.wantInfo = Object.fromEntries([...info].filter(([id]) => want.has(id)));
  state.schemes = Object.fromEntries(schemes);
  const json = JSON.stringify(state);
  try { localStorage.setItem(KEY, json); }
  catch { onSaveError?.(); }   // storage full, or a browser that refuses to store: the app says so once
  nativePrefs()?.set({ key: KEY, value: json }).catch(() => { /* mirror only — localStorage is the fast path */ });
}

/** Recover from native storage when WKWebView evicted localStorage (await BEFORE the first render;
 *  resolves false immediately on the web). localStorage, when present, is always authoritative —
 *  the Preferences copy is a write-through mirror of it. @returns {Promise<boolean>} state changed */
export async function hydrate() {
  const p = nativePrefs(); if (!p) return false;
  try {
    let ls = null; try { ls = localStorage.getItem(KEY); } catch { /* private mode */ }
    if (ls) { persist(); return false; }               // intact → just refresh the mirror
    const { value } = await p.get({ key: KEY });
    if (!value) { persist(); return false; }           // first native run → seed the mirror
    const s = normalise(JSON.parse(value));            // evicted → the mirror is the survivor
    adopt(s);
    for (const k of Object.keys(PREF_DEFAULTS)) if (k in s.prefs) state.prefs[k] = s.prefs[k];
    persist();
    return true;
  } catch { return false; }
}

/** Run `fn` when a save fails (the shelf then lives in this tab only). The app tells the painter. */
export function onSaveFail(fn) { onSaveError = fn; }

/* ---- What's new (mockups/whats-new.html, A2) ----
 * The WHATS_NEW version this device last showed in About. A fact about this device, as the open tab is,
 * so it has its own key and is not in the backup file: a Restore of an old backup must not show the dot again. */
const SEEN_KEY = 'ps-seen';
export const seenNews = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
export function setSeenNews(v) { try { localStorage.setItem(SEEN_KEY, v); } catch { /* private mode */ } }
let onSeen = null;
/** Run `fn` when another tab saved a new seenNews (About opened there). */
export function onSeenNewsChange(fn) { onSeen = fn; }

/* ---- collection (owned / to-buy are mutually exclusive) ---- */
export const isOwned = id => owned.has(id);
export const isWant = id => want.has(id);
/** @returns {'owned'|'want'|'none'} */
export const markOf = id => (owned.has(id) ? 'owned' : want.has(id) ? 'want' : 'none');
/* A paint already on the list keeps its count and project when it is marked to buy again; `forId` (a
 * scheme id) sets the project. Any other mark ends its count and project: a bought paint is one pot owned.
 * Adds to `left` the project the paint stopped pointing at, if any. */
function applyMark(id, mark, forId, left) {
  const was = want.has(id), before = info.get(id)?.for;
  owned.delete(id); want.delete(id);
  if (mark === 'want') {
    want.add(id);
    const e = was ? { ...info.get(id) } : {};
    if (forId && schemes.has(forId)) e.for = forId;
    if (Object.keys(e).length) info.set(id, e); else info.delete(id);
  } else {
    info.delete(id);
    if (mark === 'owned') owned.add(id);
  }
  if (before && info.get(id)?.for !== before) left.add(before);
}
/** Set a paint's mark. `mark` is 'owned' | 'want' | 'none'; clears the other state.
 *  `opts.for`: with 'want', the scheme the paint is bought for (a scheme id from createScheme). */
export function setMark(id, mark, { for: forId } = {}) {
  const left = new Set();
  applyMark(id, mark, forId, left);
  dropUnused(left);
  persist();
}
/** Bulk mark — ONE persist for N ids. A 500-cell shelf selection through setMark would serialise
 *  the whole state 500 times inside one event handler. */
export function setMarks(ids, mark, { for: forId } = {}) {
  const left = new Set();
  for (const id of ids) applyMark(id, mark, forId, left);
  dropUnused(left);
  persist();
}
export const ownedIds = () => owned;   // live Set — treat as read-only
export const wantIds = () => want;
export const counts = () => ({ owned: owned.size, want: want.size });

/* ---- the shopping list's count and project (v2) ---- */
/** How many pots of a to-buy paint: 1 unless the painter set more; 0 when it is not to buy. */
export const qtyOf = id => (want.has(id) ? (info.get(id)?.qty ?? 1) : 0);
/** Set the count of a to-buy paint (a whole number, 1–99; 1 is the default and is not stored).
 *  @returns {boolean} false (and no change) when the paint is not to buy or n is not a number */
export function setQty(id, n) {
  const ok = applyQty(id, n);
  if (ok) persist();
  return ok;
}
/** Bulk counts — ONE persist (a CSV import sets many). @param {Iterable<[string, number]>} pairs
 *  @returns {number} how many counts were set */
export function setQtys(pairs) {
  let n = 0;
  for (const [id, q] of pairs) if (applyQty(id, q)) n++;
  if (n) persist();
  return n;
}
function applyQty(id, n) {
  if (!want.has(id) || n === null || n === '' || !Number.isFinite(Number(n))) return false;
  const q = Math.min(QTY_MAX, Math.max(1, Math.round(Number(n))));
  const e = { ...info.get(id) };
  if (q > 1) e.qty = q; else delete e.qty;
  if (Object.keys(e).length) info.set(id, e); else info.delete(id);
  return true;
}
/** The scheme id a to-buy paint is for, or null (marked by hand on the Shelf, or its scheme was deleted). */
export const projectOf = id => (want.has(id) && info.get(id)?.for) || null;

/* ---- schemes: the library and the shopping list's projects (v2) ----
 * One record for both (mockups/scheme-library.html §0). Its id never changes: a saved scheme that you
 * change gets a new link, and a key made from the link would lose the paints that point at it. */
function newSchemeId() {
  const ABC = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (;;) {
    const bytes = new Uint8Array(8);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const sid = [...bytes].map(b => ABC[b % ABC.length]).join('');
    if (!schemes.has(sid)) return sid;
  }
}
const copyScheme = sid => (schemes.has(sid) ? { id: sid, ...schemes.get(sid) } : null);

/**
 * Keep a scheme. `link` is its share-link query (share.js encodeState). `saved: false` makes a project
 * that lives only while to-buy paints point at it (setMark's `for`). `now` is a parameter for the tests.
 * @returns {string|null} the new scheme's id, or null when `link` is not a link
 */
export function createScheme({ link, name = '', saved = false, now = new Date() } = {}) {
  if (!isLink(link)) return null;
  const sid = newSchemeId(), t = now.toISOString();
  schemes.set(sid, { name: cleanName(name), link, saved: saved === true, created: t, changed: t });
  persist();
  return sid;
}
/** Put back a scheme record under its own id (a store swap's Undo brings back a project that the swap dropped).
 *  A record that is not valid, or an id in use, changes nothing. @returns {boolean} */
export function putScheme(sc) {
  if (!isObj(sc) || !SCHEME_ID.test(sc.id) || schemes.has(sc.id) || !isLink(sc.link)) return false;
  const { id, ...rec } = sc;
  schemes.set(id, { ...rec, name: cleanName(rec.name) });
  persist();
  return true;
}
/** @returns {{id, name, link, saved, created, changed}|null} a copy; changing it changes nothing */
export const getScheme = sid => copyScheme(sid);
/** Every kept scheme, newest change first (Ryan, 2026-10-29: one list, no folders). Copies. */
export const listSchemes = () => [...schemes.keys()].map(copyScheme)
  .sort((a, b) => String(b.changed || b.created).localeCompare(String(a.changed || a.created)));
/** The kept scheme whose link is exactly `link` (a saved one first), or null. The Studio's "Changed" state
 *  is a plain compare of the link now with the saved link. */
export function findSchemeByLink(link) {
  let hit = null;
  for (const [sid, sc] of schemes) if (sc.link === link) { if (sc.saved) return sid; if (!hit) hit = sid; }
  return hit;
}
/**
 * Change a kept scheme: any of `name`, `link`, `saved`, and `asked: true` (the naming step has shown it). A link that is not a link changes nothing.
 * Un-saving a scheme that no paint points at removes it, as for any project.
 * @returns {boolean} false when there is no such scheme or the patch is not valid
 */
export function updateScheme(sid, patch = {}, { now = new Date() } = {}) {
  const sc = schemes.get(sid);
  if (!sc || !isObj(patch)) return false;
  if ('link' in patch && !isLink(patch.link)) return false;
  const next = { ...sc };
  if ('name' in patch) next.name = cleanName(patch.name);
  if ('link' in patch) next.link = patch.link;
  if ('saved' in patch) next.saved = patch.saved === true;
  if (patch.asked === true) next.asked = true;   // once asked, never asked again (a rename does not clear it)
  // Being asked is not a change to the scheme: it must not move the scheme up the Schemes list.
  if (Object.keys(patch).some(k => k !== 'asked')) next.changed = now.toISOString();
  schemes.set(sid, next);
  dropUnused(new Set([sid]));
  persist();
  return true;
}
/** Delete a kept scheme. Its to-buy paints stay on the list, with no project ("Other paints").
 *  @returns {boolean} false when there is no such scheme */
export function deleteScheme(sid) {
  if (!schemes.delete(sid)) return false;
  for (const [id, e] of info) {
    if (e.for !== sid) continue;
    const rest = { ...e }; delete rest.for;
    if (Object.keys(rest).length) info.set(id, rest); else info.delete(id);
  }
  persist();
  return true;
}
/** `name`, or "name (2)", "name (3)"… when another kept scheme has it (case and spaces do not count).
 *  A project is one scheme, so two schemes never share a name (mockups/project-naming.html, answer 1). */
export function uniqueName(name, exceptSid = null) {
  const base = cleanName(name);
  if (!base) return '';
  const fold = x => x.toLowerCase();
  const taken = new Set([...schemes].filter(([sid]) => sid !== exceptSid).map(([, sc]) => fold(sc.name)));
  if (!taken.has(fold(base))) return base;
  // The suffix must fit inside NAME_MAX: cut after it, and an 80-character name plus " (2)" came back as the
  // same 80 characters, so two schemes shared one name.
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const c = [...base].slice(0, NAME_MAX - suffix.length).join('').trim() + suffix;
    if (!taken.has(fold(c))) return c;
  }
}

/* ---- prefs ---- */
export const getPref = k => state.prefs[k];
/** Save the state as it is, so the next visit is not a first visit (the first-run block has done its job). */
export function keep() { persist(); }
export function setPref(k, v) { state.prefs[k] = v; persist(); }

/* ---- portability: the backup file (⋯ → Back up / Restore…) and the basis for future sync ---- */
/** Does this parsed blob LOOK like our backup? Only such a blob may replace the shelf. Anything else
 *  parseable (an exported scheme, paints.json picked by mistake, '[]') must be rejected: normalise()
 *  would coerce it to an empty state and silently wipe the shelf under a success toast. */
const isBackup = o => isObj(o)
  && (Array.isArray(o.owned) || Array.isArray(o.want) || isObj(o.prefs) || isObj(o.schemes));
const parse = str => { try { return JSON.parse(str); } catch { return undefined; } };

/** The backup file's text: the whole state plus `saved`, the time of the backup (ISO 8601), so the
 *  Restore confirm can say how old the file is. `now` is a parameter for the tests. */
export function exportJSON({ now = new Date() } = {}) {
  persist();
  return JSON.stringify({ ...state, saved: now.toISOString() }, null, 2);
}

/**
 * Read a backup WITHOUT applying it — the Restore confirm shows what it would do first.
 * `lost` counts the paints marked on THIS device (owned or to buy) that the backup has no mark for:
 * Replace takes those marks away. `saved` is the backup's ISO date, or null when it has none.
 * `schemes` counts the saved schemes in the backup (a v1 backup has none); `schemesLost` counts the saved
 * schemes on THIS device that the backup does not have.
 * @returns {{ok:false} | {ok:true, owned:number, want:number, schemes:number, saved:string|null, lost:number, schemesLost:number}}
 */
export function inspectJSON(str) {
  const o = parse(str);
  if (!isBackup(o)) return { ok: false };
  const s = normalise(o);
  const theirs = new Set([...s.owned, ...s.want]);
  let lost = 0;
  for (const id of owned) if (!theirs.has(id)) lost++;
  for (const id of want) if (!theirs.has(id)) lost++;
  const t = typeof o.saved === 'string' ? Date.parse(o.saved) : NaN;
  const saved = Object.values(s.schemes).filter(sc => sc.saved).length;
  // Replace takes the schemes too, so a saved scheme here that the backup does not have is lost.
  let schemesLost = 0;
  for (const [sid, sc] of schemes) if (sc.saved && !s.schemes[sid]) schemesLost++;
  return { ok: true, owned: s.owned.length, want: s.want.length, schemes: saved, saved: Number.isFinite(t) ? new Date(t).toISOString() : null, lost, schemesLost };
}

/** Replace the shelf, the schemes and the settings with a backup's. @returns {boolean} false (and no change) when it is not a backup */
export function importJSON(str) {
  const o = parse(str);
  if (!isBackup(o)) return false;
  const s = normalise(o);
  adopt(s);   // the schemes too: Restore replaces the whole shelf, and a v1 backup has none
  // Merge only the prefs the backup actually carries — an older backup that predates a pref key
  // must not reset that pref to its default. A value the pref may not have counts as not carried.
  if (o.prefs && typeof o.prefs === 'object') {
    for (const k of Object.keys(PREF_DEFAULTS)) if (hasPref(o.prefs, k)) state.prefs[k] = s.prefs[k];
  }
  persist();
  return true;
}

/**
 * Delete the shelf and settings on this device (About & data → Delete my shelf and settings…).
 * Every copy goes: ps-state, the pre-v1 keys, and the iOS app's mirror. With only ps-state gone, the
 * next start would bring the data back — load() falls back to the legacy keys, and hydrate() to the
 * mirror. The in-memory state goes back to a fresh one; nothing is written until the next change.
 */
export function clear() {
  owned.clear(); want.clear(); info.clear(); schemes.clear();
  state.owned = []; state.want = []; state.wantInfo = {}; state.schemes = {};
  state.prefs = { ...PREF_DEFAULTS };
  for (const k of [KEY, SEEN_KEY, ...LEGACY_KEYS]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
  nativePrefs()?.remove({ key: KEY }).catch(() => { /* best effort: the next save overwrites the mirror anyway */ });
}

/* Another tab or window of the app on this device (the installed app and a browser tab, say) saved or
 * deleted the state. Take it here too: this tab's next save wrote its old copy back, so a Delete or a
 * Restore in the other tab came undone. The browser sends `storage` only to the OTHER tabs, and nothing
 * here saves, so two tabs cannot answer each other in a loop. */
let onExternal = null;
/** Run `fn(prefsBefore)` after another tab saved or deleted the state, so the app can repaint. */
export function onExternalChange(fn) { onExternal = fn; }
globalThis.addEventListener?.('storage', e => {
  if (e.key === SEEN_KEY) { onSeen?.(); return; }
  if (e.key !== KEY && e.key !== null) return;   // null: localStorage.clear() in another tab
  let s;
  try { s = e.key === KEY && e.newValue ? normalise(JSON.parse(e.newValue)) : fresh(); } catch { return; }
  const before = { ...state.prefs };
  adopt(s);
  state.owned = [...owned]; state.want = [...want]; state.wantInfo = s.wantInfo; state.schemes = s.schemes;
  state.prefs = { ...s.prefs };
  onExternal?.(before);
});
