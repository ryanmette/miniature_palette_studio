// store.js — the single persistence chokepoint: a versioned, portable "my collection" + prefs model.
// localStorage today, but the shape is plain-serialisable so it can move to IndexedDB, a native
// store, or a synced file (export/import JSON) WITHOUT touching callers. No personal data leaves the
// device. Collection states are mutually exclusive: a paint is owned, to-buy, or neither (CLAUDE.md
// collection model). Owned/to-buy markers are a shared model usable by any surface, not just the shelf.

const KEY = 'ps-state';
const VERSION = 1;
const PREF_DEFAULTS = { theme: null, ladder: 'wash', fill: 'ideal', locale: null, boost: false };

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

function persist() {
  state.owned = [...owned];
  state.want = [...want];
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode — in-memory only */ }
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
    const s = normalise(JSON.parse(str));
    owned.clear(); s.owned.forEach(x => owned.add(x));
    want.clear(); s.want.forEach(x => want.add(x));
    Object.assign(state.prefs, s.prefs);
    persist();
    return true;
  } catch { return false; }
}
