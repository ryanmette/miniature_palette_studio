// store.js — the single persistence chokepoint: a versioned, portable "my collection" + prefs model.
// localStorage today, but the shape is plain-serialisable so it can move to IndexedDB, a native
// store, or a synced file (export/import JSON) WITHOUT touching callers. No personal data leaves the
// device. Collection states are mutually exclusive: a paint is owned, to-buy, or neither (CLAUDE.md
// collection model). Owned/to-buy markers are a shared model usable by any surface, not just the shelf.

const KEY = 'ps-state';
const LEGACY_KEYS = ['ps-owned', 'ps-theme'];   // the pre-v1 keys migrateLegacy() reads
const VERSION = 1;
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

const fresh = () => ({ v: VERSION, owned: [], want: [], prefs: { ...PREF_DEFAULTS } });

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
 *  A pref with a value it may not have (PREF_OK) gets its default. */
function normalise(s) {
  const owned = Array.isArray(s?.owned) ? [...new Set(s.owned.filter(x => typeof x === 'string'))] : [];
  const has = new Set(owned);
  const want = Array.isArray(s?.want) ? [...new Set(s.want.filter(x => typeof x === 'string' && !has.has(x)))] : [];
  const src = s?.prefs && typeof s.prefs === 'object' && !Array.isArray(s.prefs) ? s.prefs : {};
  const prefs = {};
  for (const k of Object.keys(PREF_DEFAULTS)) prefs[k] = hasPref(src, k) ? src[k] : PREF_DEFAULTS[k];
  return { v: VERSION, owned, want, prefs };
}

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

/* Native-shell persistence (IOS_APP_PLAN §4b): WKWebView can evict localStorage, so under Capacitor
 * every persist ALSO writes through to the Preferences plugin. The plugin object is injected by the
 * shell at runtime — never an import, so §6's no-dependency rule holds and the web pays nothing. */
const nativePrefs = () =>
  (globalThis.Capacitor?.isNativePlatform?.() && globalThis.Capacitor?.Plugins?.Preferences) || null;

function persist() {
  state.owned = [...owned];
  state.want = [...want];
  const json = JSON.stringify(state);
  try { localStorage.setItem(KEY, json); } catch { /* private mode — in-memory only */ }
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
    owned.clear(); s.owned.forEach(x => owned.add(x));
    want.clear(); s.want.forEach(x => want.add(x));
    for (const k of Object.keys(PREF_DEFAULTS)) if (k in s.prefs) state.prefs[k] = s.prefs[k];
    persist();
    return true;
  } catch { return false; }
}

/* ---- collection (owned / to-buy are mutually exclusive) ---- */
export const isOwned = id => owned.has(id);
export const isWant = id => want.has(id);
/** @returns {'owned'|'want'|'none'} */
export const markOf = id => (owned.has(id) ? 'owned' : want.has(id) ? 'want' : 'none');
/** Set a paint's mark. `mark` is 'owned' | 'want' | 'none'; clears the other state. */
export function setMark(id, mark) {
  owned.delete(id); want.delete(id);
  if (mark === 'owned') owned.add(id);
  else if (mark === 'want') want.add(id);
  persist();
}
/** Bulk mark — ONE persist for N ids. A 500-cell shelf selection through setMark would serialise
 *  the whole state 500 times inside one event handler. */
export function setMarks(ids, mark) {
  for (const id of ids) {
    owned.delete(id); want.delete(id);
    if (mark === 'owned') owned.add(id);
    else if (mark === 'want') want.add(id);
  }
  persist();
}
export const ownedIds = () => owned;   // live Set — treat as read-only
export const wantIds = () => want;
export const counts = () => ({ owned: owned.size, want: want.size });

/* ---- prefs ---- */
export const getPref = k => state.prefs[k];
export function setPref(k, v) { state.prefs[k] = v; persist(); }

/* ---- portability: the backup file (⋯ → Back up / Restore…) and the basis for future sync ---- */
/** Does this parsed blob LOOK like our backup? Only such a blob may replace the shelf. Anything else
 *  parseable (an exported scheme, paints.json picked by mistake, '[]') must be rejected: normalise()
 *  would coerce it to an empty state and silently wipe the shelf under a success toast. */
const isBackup = o => !!o && typeof o === 'object' && !Array.isArray(o)
  && (Array.isArray(o.owned) || Array.isArray(o.want) || (o.prefs && typeof o.prefs === 'object'));
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
 * @returns {{ok:false} | {ok:true, owned:number, want:number, saved:string|null, lost:number}}
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
  return { ok: true, owned: s.owned.length, want: s.want.length, saved: Number.isFinite(t) ? new Date(t).toISOString() : null, lost };
}

/** Replace the shelf and settings with a backup's. @returns {boolean} false (and no change) when it is not a backup */
export function importJSON(str) {
  const o = parse(str);
  if (!isBackup(o)) return false;
  const s = normalise(o);
  owned.clear(); s.owned.forEach(x => owned.add(x));
  want.clear(); s.want.forEach(x => want.add(x));
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
  owned.clear(); want.clear();
  state.owned = []; state.want = [];
  state.prefs = { ...PREF_DEFAULTS };
  for (const k of [KEY, ...LEGACY_KEYS]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
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
  if (e.key !== KEY && e.key !== null) return;   // null: localStorage.clear() in another tab
  let s;
  try { s = e.key === KEY && e.newValue ? normalise(JSON.parse(e.newValue)) : fresh(); } catch { return; }
  const before = { ...state.prefs };
  owned.clear(); s.owned.forEach(x => owned.add(x));
  want.clear(); s.want.forEach(x => want.add(x));
  state.owned = [...owned]; state.want = [...want];
  state.prefs = { ...s.prefs };
  onExternal?.(before);
});
