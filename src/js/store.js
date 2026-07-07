// store.js — the single persistence chokepoint: a versioned, portable "my collection" + prefs model.
// localStorage today, but the shape is plain-serialisable so it can move to IndexedDB, a native
// store, or a synced file (export/import JSON) WITHOUT touching callers. No personal data leaves the
// device. Collection states are mutually exclusive: a paint is owned, to-buy, or neither (CLAUDE.md
// collection model). Owned/to-buy markers are a shared model usable by any surface, not just the shelf.

const KEY = 'ps-state';
const VERSION = 1;
const PREF_DEFAULTS = { theme: null, ladder: 'wash', fill: 'ideal', locale: null, collection: 'off', contrast: false };

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

/** Coerce any parsed blob into a valid state (defensive against hand-edited/corrupt data). */
function normalise(s) {
  return {
    v: VERSION,
    owned: Array.isArray(s?.owned) ? s.owned.filter(x => typeof x === 'string') : [],
    want: Array.isArray(s?.want) ? s.want.filter(x => typeof x === 'string') : [],
    prefs: { ...PREF_DEFAULTS, ...(s?.prefs && typeof s.prefs === 'object' ? s.prefs : {}) },
  };
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

/* ---- portability (the basis for paintRack-CSV / JSON import + future sync) ---- */
export function exportJSON() { persist(); return JSON.stringify(state, null, 2); }
export function importJSON(str) {
  try {
    const o = JSON.parse(str);
    // Only a blob that LOOKS like our backup may replace the collection. Anything else parseable
    // (an exported scheme, paints.json picked by mistake, '[]') must be rejected — normalise()
    // would happily coerce it to an empty state and silently wipe the shelf under a success toast.
    const shaped = o && typeof o === 'object' && !Array.isArray(o)
      && (Array.isArray(o.owned) || Array.isArray(o.want) || (o.prefs && typeof o.prefs === 'object'));
    if (!shaped) return false;
    const s = normalise(o);
    owned.clear(); s.owned.forEach(x => owned.add(x));
    want.clear(); s.want.forEach(x => want.add(x));
    // Merge only the prefs the backup actually carries — an older backup that predates a pref key
    // must not reset that pref to its default.
    if (o.prefs && typeof o.prefs === 'object') {
      for (const k of Object.keys(PREF_DEFAULTS)) if (k in o.prefs) state.prefs[k] = o.prefs[k];
    }
    persist();
    return true;
  } catch { return false; }
}
