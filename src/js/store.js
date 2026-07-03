// store.js — the single persistence chokepoint: a versioned, portable "my collection" + prefs model.
// localStorage today, but the shape is plain-serialisable so it can move to IndexedDB, a native
// store, or a synced file (export/import JSON) WITHOUT touching callers. No personal data leaves the
// device. Collection states are mutually exclusive: a paint is owned, to-buy, or neither (CLAUDE.md
// collection model). Owned/to-buy markers are a shared model usable by any surface, not just the shelf.

// localStorage is the browser's simple per-origin key→string store that survives reloads and restarts.
// We keep the ENTIRE collection+prefs blob under this one key, loaded/saved in a single read/write.
const KEY = 'ps-state';
// Schema version stamped into the saved blob. "Versioned schema" = the stored shape carries a number so
// that if the format ever changes we can detect old data and migrate it, instead of silently misreading.
const VERSION = 1;
// Default user preferences — the baseline every fresh or repaired state starts from (null = auto/unset).
const PREF_DEFAULTS = { theme: null, ladder: 'wash', fill: 'ideal', locale: null, collection: 'off', contrast: false };

// Factory for a brand-new empty state: no owned paints, no to-buy paints, default prefs, current version.
const fresh = () => ({ v: VERSION, owned: [], want: [], prefs: { ...PREF_DEFAULTS } });

/** One-time pickup of the pre-v1 keys (ps-owned / ps-theme) so existing users keep their data. */
// Migration = read the old-format keys once and fold them into the current state shape. Runs only when
// no current-format blob exists yet, so returning users don't lose what they saved under the old scheme.
function migrateLegacy() {
  const s = fresh();                                   // start from an empty current-shape state
  try {
    // Old "ps-owned" was a bare JSON array of owned ids; keep only genuine strings.
    const o = JSON.parse(localStorage.getItem('ps-owned') || 'null');
    if (Array.isArray(o)) s.owned = o.filter(x => typeof x === 'string');
    // Old "ps-theme" was a plain 'light'/'dark' string; carry it into the new prefs object.
    const t = localStorage.getItem('ps-theme');
    if (t === 'light' || t === 'dark') s.prefs.theme = t;
  } catch { /* private mode / corrupt */ }             // reading storage can throw; ignore and keep empty
  return s;
}

/** Coerce any parsed blob into a valid state (defensive against hand-edited/corrupt data). */
// Never trust what came out of storage: rebuild a known-good object, dropping anything of the wrong type
// (arrays that aren't arrays, non-string ids, a prefs value that isn't an object) and re-stamping VERSION.
function normalise(s) {
  return {
    v: VERSION,                                                                    // always the current version
    owned: Array.isArray(s?.owned) ? s.owned.filter(x => typeof x === 'string') : [],  // string ids only, else empty
    want: Array.isArray(s?.want) ? s.want.filter(x => typeof x === 'string') : [],     // string ids only, else empty
    prefs: { ...PREF_DEFAULTS, ...(s?.prefs && typeof s.prefs === 'object' ? s.prefs : {}) },  // defaults, overlaid by any valid saved prefs
  };
}

// Load the saved state on module init: try the current-format blob first, else fall back to legacy migration.
function load() {
  try {
    const raw = localStorage.getItem(KEY);             // the stored JSON string (or null if never saved)
    if (raw) return normalise(JSON.parse(raw));        // parse + sanitise the current-format blob
  } catch { /* private mode / corrupt → fall through */ }  // parse failed or storage blocked → try legacy path
  return normalise(migrateLegacy());                   // no/invalid current blob → import old keys (also sanitised)
}

const state = load();                 // the canonical saved object (single source of truth for persistence)
const owned = new Set(state.owned);   // fast in-memory mirror of owned ids (Set = O(1) has/add/delete)
const want = new Set(state.want);     // fast in-memory mirror of to-buy ids

// Flush the in-memory Sets back into `state` and write the whole blob to localStorage as JSON.
function persist() {
  state.owned = [...owned];           // copy Set → array so it can be JSON-serialised
  state.want = [...want];
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode — in-memory only */ }  // write can throw (quota/private mode); app keeps working from memory
}

/* ---- collection (owned / to-buy are mutually exclusive) ---- */
export const isOwned = id => owned.has(id);   // true if this paint id is marked owned
export const isWant = id => want.has(id);     // true if this paint id is marked to-buy
/** @returns {'owned'|'want'|'none'} */
// Report a paint's single current mark (owned wins if somehow both were set — but setMark prevents that).
export const markOf = id => (owned.has(id) ? 'owned' : want.has(id) ? 'want' : 'none');
/** Set a paint's mark. `mark` is 'owned' | 'want' | 'none'; clears the other state. */
export function setMark(id, mark) {
  owned.delete(id); want.delete(id);          // clear both first — enforces mutual exclusivity
  if (mark === 'owned') owned.add(id);        // then set at most one (anything else, e.g. 'none', leaves it cleared)
  else if (mark === 'want') want.add(id);
  persist();                                  // save immediately so the mark survives a reload
}
export const ownedIds = () => owned;   // live Set — treat as read-only (mutating it bypasses persist())
export const wantIds = () => want;     // live Set — same caveat
export const counts = () => ({ owned: owned.size, want: want.size });  // sizes for the shelf/summary UI

/* ---- prefs ---- */
export const getPref = k => state.prefs[k];                            // read one preference by key
export function setPref(k, v) { state.prefs[k] = v; persist(); }       // write one preference and save

/* ---- portability (the basis for paintRack-CSV / JSON import + future sync) ---- */
// Export the full state as pretty-printed JSON (persist() first so the Sets are flushed into `state`).
export function exportJSON() { persist(); return JSON.stringify(state, null, 2); }
// Import a previously exported JSON string, REPLACING the current collection + prefs. Returns success flag.
export function importJSON(str) {
  try {
    const s = normalise(JSON.parse(str));                 // parse + sanitise the incoming blob (never trust it)
    owned.clear(); s.owned.forEach(x => owned.add(x));    // replace owned Set with the imported ids
    want.clear(); s.want.forEach(x => want.add(x));       // replace to-buy Set with the imported ids
    Object.assign(state.prefs, s.prefs);                  // merge imported prefs over current ones
    persist();                                            // save the imported state
    return true;                                          // signal success to the caller
  } catch { return false; }                               // malformed JSON → leave state untouched, report failure
}
