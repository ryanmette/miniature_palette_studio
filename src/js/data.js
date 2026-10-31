// data.js — load + index the paint dataset and search it by perceptual distance.
// Pure search functions (testable); only loadDataset() touches the network.

import { hexToLab, hexToRgb, rgbToHsl, deltaE2000, adjustDirection } from './color.js';

/** Fixed ΔE2000 → quality mapping (CLAUDE.md §3.2). */
export function matchQuality(dE) {
  if (dE <= 1.0) return { label: 'Indistinguishable', tier: 'success' };
  if (dE <= 2.0) return { label: 'Excellent', tier: 'success' };
  if (dE <= 3.5) return { label: 'Good', tier: 'success' };
  if (dE <= 5.0) return { label: 'Fair', tier: 'warning' };
  if (dE <= 10) return { label: 'Loose', tier: 'warning' };
  return { label: 'Poor', tier: 'danger' };
}

/**
 * Index a dataset: precompute Lab once for every paint (perf budget, CLAUDE.md §6).
 * Returns a new object; the input is not mutated.
 */
export function indexDataset(dataset) {
  const paints = dataset.paints.map(p => ({ ...p, lab: hexToLab(p.hex) }));
  // Display-name disambiguation, derived at load like lab (never stored): brands reuse a name across
  // lines (Citadel "Dawnstone" is both a Layer and a Dry paint; Vallejo "Black" exists in 4 lines —
  // 118 such groups, all legitimate distinct products). Where (brand, name) collides, dname carries
  // the line — "Dawnstone (Layer)" — so every surface can render an unambiguous name without touching
  // the stored data (paint names are data and never change; dname is presentation).
  const nameCount = new Map();
  for (const p of paints) {
    const k = p.brand + '\u0000' + p.name.toLowerCase();
    nameCount.set(k, (nameCount.get(k) || 0) + 1);
  }
  for (const p of paints) {
    const ambiguous = nameCount.get(p.brand + '\u0000' + p.name.toLowerCase()) > 1;
    p.dname = ambiguous && p.line && p.line !== '—' ? `${p.name} (${p.line})` : p.name;
  }
  const byGroup = new Map();
  for (const p of paints) if (p.groupId) { let g = byGroup.get(p.groupId); if (!g) byGroup.set(p.groupId, g = []); g.push(p); }
  return { ...dataset, paints, byId: new Map(paints.map(p => [p.id, p])), byGroup };
}

/** Other paints in the same curated equivalence group (cross-brand "same colour", ΔE ≤ 1); [] if ungrouped. */
export function groupMembers(indexed, paint) {
  if (!paint || !paint.groupId || !indexed.byGroup) return [];
  return (indexed.byGroup.get(paint.groupId) || []).filter(p => p.id !== paint.id);
}
/** The curated group's metadata ({id, refHex, label}) for a paint, or null. */
export function groupOf(indexed, paint) {
  if (!paint || !paint.groupId) return null;
  return (indexed.groups || []).find(g => g.id === paint.groupId) || null;
}

/**
 * "Finish" types — paints that aren't flat opaque colour (washes/shades, inks, contrast, glazes,
 * effects/technical). They read very differently on the model, so they're excluded from harmony
 * *suggestions* by default (the live palette + role ladders) — but stay browsable in the picker,
 * the Shelf, and cross-brand Equivalents. `metal` is deliberately NOT here (the Metal role wants it).
 */
export const FINISH_TYPES = ['wash', 'shade', 'ink', 'contrast', 'glaze', 'effect', 'technical'];

/** Finish class, the same four the equivalence groups use (§5.2): a wash is never an equivalent of a flat
 *  that shares its hex, and a texture paint is not an equivalent of either. */
export const finishClass = t => t === 'metal' ? 'metal' : t === 'effect' || t === 'technical' ? 'effect'
  : FINISH_TYPES.includes(t) ? 'translucent' : 'flat';
/** Equivalents rank a paint of a DIFFERENT finish class as if it were this much ΔE further (ranking only;
 *  the reported ΔE stays true, §2/§7). The same size as the metal demotion for colour roles. Measured over
 *  the whole dataset: flat sources go from 78% to 99% same-finish matches for +0.27 mean ΔE. A strict
 *  same-finish-first tier (as metals use) was rejected: for washes it pulled in 293 matches over ΔE 10. */
export const FINISH_PENALTY = 4;

function passesFilter(p, { excludeId, excludeIds, brands, excludeBrands, ownedIds, types, excludeTypes } = {}) {
  if (excludeId && p.id === excludeId) return false;
  if (excludeIds && excludeIds.has(p.id)) return false;
  if (brands && !brands.has(p.brand)) return false;
  if (excludeBrands && excludeBrands.has(p.brand)) return false;
  if (ownedIds && !ownedIds.has(p.id)) return false;
  if (types && !types.has(p.type)) return false;
  if (excludeTypes && excludeTypes.has(p.type)) return false;
  return true;
}

/**
 * Soft "use what you own" preference (#6): rank owned paints as if they were `boostAmount` ΔE closer,
 * so a paint you already have can win over a marginally-better one you'd need to buy — but the reported
 * ΔE stays the TRUE distance (honesty, CLAUDE.md §2). Returns the *ranking* score, not the reported ΔE.
 * `ownedIds` (the hard filter) also counts as owned for this purpose.
 *
 * The mirror image, `demoteTypes`/`demoteAmount`: rank those types as if `demoteAmount` ΔE further —
 * used to keep metallics from beating flat paints for *colour* roles (a metallic reads very differently
 * on the model) while still letting a metal win when it's clearly the closest thing you have. In an
 * all-metal pool (the Metal role's type filter) every candidate is demoted equally, so it's a no-op.
 */
const rankScore = (d, p, { boostIds, boostAmount = 0, ownedIds, demoteTypes, demoteAmount = 0, preferIds }) => {
  // No floor on the boost: clamping to 0 collapsed every owned paint within boostAmount of the
  // target to the same score, letting dataset order pick an owned ΔE-5.8 paint over an owned
  // ΔE-0.3 one. A negative score is fine — it just means "owned and very close wins".
  let s = ((boostIds && boostIds.has(p.id)) || (ownedIds && ownedIds.has(p.id))) ? d - boostAmount : d;
  const preferred = preferIds && preferIds.has(p.id);
  // An explicit pick is EXEMPT from the type demote — otherwise picking any metallic paint would
  // lose its own slot to a flat within demoteAmount ΔE (review finding: 228/236 metals affected).
  if (demoteTypes && demoteTypes.has(p.type) && !preferred) s += demoteAmount;
  // Tie-break only (imperceptible epsilon): the paint the user explicitly PICKED wins exact ties —
  // e.g. Layer vs Dry "Dawnstone" share a hex (ΔE 0), and dataset order must not override the pick.
  if (preferred) s -= 0.001;
  return s;
};

/**
 * Is this paint one the user owns? `knownOwnedIds` is decoration-only and is supplied on EVERY
 * search; `boostIds`/`ownedIds` are the ranking sets and imply ownership when they're in play.
 * Ownership is a fact about the shelf, not a ranking mode — reading it only off the ranking sets
 * meant the default "use my collection: off" reported every match as unowned (§2 honesty).
 */
const isOwnedMatch = (p, { boostIds, ownedIds, knownOwnedIds }) =>
  !!((knownOwnedIds && knownOwnedIds.has(p.id)) || (boostIds && boostIds.has(p.id)) || (ownedIds && ownedIds.has(p.id)));

/** Decorate a match with owned + adjust-direction info when ownership is known (else leave it plain). */
function decorate(m, targetHex, opts) {
  if (!opts.boostIds && !opts.ownedIds && !opts.knownOwnedIds) return m;   // no ownership context → unchanged shape
  const owned = isOwnedMatch(m.paint, opts);
  return { ...m, owned, adjust: owned && m.deltaE > 1.5 ? adjustDirection(targetHex, m.paint.hex) : null };
}

/**
 * Candidate pool for a search: paints passing the filter. Over PREFILTER_OVER, prune to the KEEP
 * nearest by *cheap* squared-Lab (Euclidean) distance before the expensive ΔE2000 — a big dataset
 * would otherwise do thousands of ΔE2000s per live-palette frame (§6 perf). The ΔE2000 winner is, in
 * practice, always within the Euclidean top-KEEP, so the reported ΔE2000 result doesn't drift (§7).
 * Boosted (owned) paints are always kept so the soft owned-boost (#6) can't be pruned out.
 */
function candidatePool(indexed, target, opts) {
  const [L, A, B] = target;
  // opts.keep widens the prefilter for searches that return a LIST rather than a winner: the top-1 by
  // ΔE2000 is always inside the Euclidean top-64, but the 5th-8th are not always, and a short pool
  // let a marginally worse paint take a tail slot (measured: rank 1 never moved, ranks 2-8 by ≤1.3 ΔE).
  const KEEP = opts.keep || 64;
  // Allocation-free top-KEEP by cheap squared-Lab distance (no per-call sort / object array).
  const kd = new Float64Array(KEEP).fill(Infinity), kp = new Array(KEEP);
  let filled = 0, worst = Infinity, wi = 0;
  for (const p of indexed.paints) {
    if (!passesFilter(p, opts)) continue;
    const dl = L - p.lab[0], da = A - p.lab[1], db = B - p.lab[2], e = dl * dl + da * da + db * db;
    if (filled < KEEP) {
      kd[filled] = e; kp[filled] = p; filled++;
      if (filled === KEEP) { worst = -1; for (let i = 0; i < KEEP; i++) if (kd[i] > worst) { worst = kd[i]; wi = i; } }
    } else if (e < worst) {
      kd[wi] = e; kp[wi] = p; worst = -1; for (let i = 0; i < KEEP; i++) if (kd[i] > worst) { worst = kd[i]; wi = i; }
    }
  }
  const top = kp.slice(0, filled);
  // Rescue paints the raw-distance prune would drop even though ranking must still see them:
  //  • boosted (owned) paints — the soft owned-boost (#6) can't apply to a paint that isn't here;
  //  • FLOATED types (§7) — a metal source ranks metals strictly first, but the top-KEEP is chosen by
  //    distance alone, so a metal surrounded by near flats could have every metal pruned away and
  //    the guarantee would silently fail.
  if (filled === KEEP && (opts.boostIds || opts.floatTypes)) {
    const inTop = new Set(top);
    for (const p of indexed.paints) {
      if (inTop.has(p) || !passesFilter(p, opts)) continue;
      if ((opts.boostIds && opts.boostIds.has(p.id)) || (opts.floatTypes && opts.floatTypes.has(p.type))) top.push(p);
    }
  }
  return top;
}

/**
 * Nearest paint to a target hex by ΔE2000, honouring filters and the soft owned-boost (#6).
 * @returns {{paint:object, deltaE:number, quality:{label:string,tier:string}, owned?:boolean, adjust?:string|null}|null}
 */
export function nearestPaint(indexed, hex, opts = {}) {
  const target = hexToLab(hex);
  let best = null, bestD = Infinity, bestScore = Infinity;
  for (const p of candidatePool(indexed, target, opts)) {
    const d = deltaE2000(target, p.lab);
    const score = rankScore(d, p, opts);
    if (score < bestScore) { bestScore = score; bestD = d; best = p; }
  }
  return best ? decorate({ paint: best, deltaE: bestD, quality: matchQuality(bestD) }, hex, opts) : null;
}

/** Top-N nearest paints to a hex, ranked by the same owned-boost; reported ΔE stays true.
 *  `opts.floatTypes` (a Set) ranks those types strictly FIRST regardless of score — used when the
 *  target is inherently metallic (the Metal role's ideal): a flat paint can sit nearer in hex yet
 *  look nothing like it on the model, so true metallics always float up (§7). */
export function nearestPaints(indexed, hex, n = 5, opts = {}) {
  const target = hexToLab(hex);
  const tier = p => (opts.floatTypes && !opts.floatTypes.has(p.type)) ? 1 : 0;
  return candidatePool(indexed, target, opts)
    .map(p => { const deltaE = deltaE2000(target, p.lab); return { paint: p, deltaE, score: rankScore(deltaE, p, opts) }; })
    .sort((a, b) => tier(a.paint) - tier(b.paint) || a.score - b.score)
    .slice(0, n)
    .map(({ paint, deltaE }) => decorate({ paint, deltaE, quality: matchQuality(deltaE) }, hex, opts));
}

/** Cross-brand equivalents for a paint: nearest paints in OTHER brands. A metallic paint's true
 *  equivalents are other METALLICS — hex proximity says nothing about how a flat reads next to a
 *  metal on the model — so for a metal source, metals rank strictly first. Any other paint of a different
 *  finish class (a wash, a contrast or a texture paint for a flat source) ranks FINISH_PENALTY further.
 *  Reported ΔE stays true either way (§2). */
export function equivalents(indexed, paint, { n = 6 } = {}) {
  const lab = paint.lab || hexToLab(paint.hex);
  const isMetal = paint.type === 'metal';
  // Rank every paint of another brand, with no prefilter (candidatePool). The prefilter keeps the paints
  // nearest by plain Lab distance, and FINISH_PENALTY changes the order after that cut. So a paint after the
  // cut can belong in the list: for a wash, a wash that is further away than many flats. Measured on dataset
  // 1.6.0 (3,225 paints) against a full scan, a pool of 192 gave 13 paints a worse paint in their top 8, by
  // up to 1.34 ΔE of ranking score. It also put two paints with the same score in another order for 228
  // more (a full scan keeps dataset order). A call takes about 3 ms, and the Equivalents tab makes one
  // call per source-chip click (budget 16 ms, §6).
  const tier = isMetal ? (p => p.type === 'metal' ? 0 : 1) : () => 0;
  const cls = finishClass(paint.type);
  return indexed.paints.filter(p => p.brand !== paint.brand)
    .map(p => { const deltaE = deltaE2000(lab, p.lab); return { paint: p, deltaE, score: deltaE + (finishClass(p.type) === cls ? 0 : FINISH_PENALTY) }; })
    .sort((a, b) => tier(a.paint) - tier(b.paint) || a.score - b.score)
    .slice(0, n)
    .map(({ paint, deltaE }) => ({ paint, deltaE, quality: matchQuality(deltaE) }));
}

/**
 * Swaps for a pot that is not on the rack (PLAN §5 item 38; mockups/shopping-list.html, direction B): the
 * nearest paints from the brands the store carries, kept STRICTLY to the paint's own finish class. A wash's
 * swap is a wash, or there is none: a wash's hex is its colour on white, so a flat paint can look close to it
 * and still be no swap at all (a strict tier, not the Equivalents tab's penalty). Reported ΔE is true (§2).
 * @param opts.notCarried  brands the store does not carry (a Set): no swap comes from them
 * @returns {Array<{paint, deltaE, quality}>} best first, at most `n`
 */
export function storeSwaps(indexed, paint, { notCarried = new Set(), n = 3 } = {}) {
  const lab = paint.lab || hexToLab(paint.hex), cls = finishClass(paint.type);
  return indexed.paints.filter(p => p.id !== paint.id && !notCarried.has(p.brand) && finishClass(p.type) === cls)
    .map(p => ({ paint: p, deltaE: deltaE2000(lab, p.lab) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, n)
    .map(m => ({ ...m, quality: matchQuality(m.deltaE) }));
}

/** The paints closest to a typed colour, best first. They rank as the Equivalents tab ranks a flat colour:
 *  a paint of another finish class (a wash, a contrast, an effect, a metallic) ranks FINISH_PENALTY ΔE
 *  further, so it shows only when it is clearly closer. Each match reports its TRUE ΔE (§2, §7). The seed
 *  field lists these under "Seed: #…"; the Equivalents tab uses them for a role colour or a custom hex. */
export function closestPaints(indexed, hex, n = 6, { quick = false } = {}) {
  // Every paint is a candidate (keep). The cheap Euclidean prefilter ranks by Lab distance alone, but the
  // finish penalty moves washes and metallics down, so a flat paint ranked 79th by Lab distance (Raf Azure
  // Blue for #8899F4, ΔE 6.4) was cut before the ranking and two Poor matches took its place. A full pool
  // costs about 2 ms (about 12 ms on a slow phone): right for a keystroke or a tab render, too much for
  // every frame of a drag. `quick` takes the old pool of 192 for a drag frame; the caller then shows the
  // exact list once the drag stops.
  return nearestPaints(indexed, hex, n, { demoteTypes: new Set([...FINISH_TYPES, 'metal']), demoteAmount: FINISH_PENALTY, keep: quick ? 192 : indexed.paints.length });
}

/* ---- the paint search: ONE matcher for the seed field and the Shelf search ---- */

/** The finish word each type shows on a swatch's finish tag (ui.js finishTag reads these). A search for
 *  a finish word finds the paints that show it: "metallic" finds the metal type. */
export const FINISH_WORDS = { metal: 'metallic', contrast: 'contrast', wash: 'wash', shade: 'shade', ink: 'ink', glaze: 'glaze', effect: 'effect' };

/** Text for matching: no accents, lower case, no apostrophes, any other punctuation as a space.
 *  "Dawnstone (Layer)" → "dawnstone layer" · "Resedagrün" → "resedagrun" · "Tiger’s Eye" → "tigers eye". */
export const foldText = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’‘`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// The folded words of each paint, worked out once per paint object (a search runs on every keystroke).
// A WeakMap, so the paint objects keep their shape and nothing is stored with the data.
const folded = new WeakMap();
function foldOf(p) {
  let f = folded.get(p);
  if (!f) {
    const line = p.line && p.line !== '—' ? p.line : '';
    // Every word a swatch or a row shows: name, display name ("Dawnstone (Layer)"), brand, line, type and
    // the finish word. Spaces at both ends, so a word can be matched at the start of the text too.
    const name = foldText(p.name);
    // words: the name with a space before each word, so " w" finds a word that starts with w (no split per search)
    f = { hay: ` ${foldText(`${p.name} ${p.dname || ''} ${p.brand} ${line} ${p.type || ''} ${FINISH_WORDS[p.type] || ''}`)} `,
      name, dname: foldText(p.dname || p.name), words: ` ${name}` };
    folded.set(p, f);
  }
  return f;
}
const queryWords = q => foldText(q).split(' ').filter(Boolean);
/** Fold every paint now, so the first keystroke after the page loads does not pay for 3,225 folds. The app
 *  calls it when the browser is idle. */
export function warmPaintSearch(indexed) { for (const p of indexed.paints) foldOf(p); }

/** Does a paint match a search? Every word of the query must be in the paint's words (part of a word is
 *  enough: "stone" finds Dawnstone). "vallejo red", "citadel metallic" and "dawnstone (layer)" all narrow
 *  the list. In a query of two or more words, a one-letter word is not "part of any word": "D&D" folds to
 *  "d d", and two d's anywhere matched 1,885 paints. Returns a test for one paint, or null when the query has
 *  no words (no filter). */
export function paintMatcher(query) {
  const words = queryWords(query);
  if (!words.length) return null;
  // The hay has a space at each end, so " d " finds the whole word d and " b" a word that starts with b. A
  // one-letter word before the last is a whole word ("d&d"); the last one is the word being typed, so it
  // starts a word ("abaddon b" on the way to "abaddon black"); one letter alone matches inside words.
  const last = words.length - 1;
  const pats = words.map((w, i) => (w.length > 1 || !last ? w : i < last ? ` ${w} ` : ` ${w}`));
  return p => { const h = foldOf(p).hay; return pats.every(w => h.includes(w)); };
}

/** The seed field's search: the paints that match, best first. Four groups, in this order: the name or the
 *  display name is the query ("dawnstone (layer)"); the name starts with it; a word of the name starts with
 *  a word of the query; the rest. In each group, the paints in `ownedIds` come first, then A to Z by display
 *  name. [] for an empty query. */
export function searchPaints(indexed, query, { ownedIds } = {}) {
  const match = paintMatcher(query);
  if (!match) return [];
  const n = queryWords(query).join(' '), starts = n.split(' ').map(w => ' ' + w);
  const group = p => {
    const f = foldOf(p);
    if (f.name === n || f.dname === n) return 0;
    if (f.name.startsWith(n) || f.dname.startsWith(n)) return 1;
    return starts.some(w => f.words.includes(w)) ? 2 : 3;
  };
  const own = p => (ownedIds && ownedIds.has(p.id) ? 0 : 1);
  return indexed.paints.filter(match)
    .map(p => ({ p, g: group(p), o: own(p), name: p.dname || p.name }))
    .sort((a, b) => a.g - b.g || a.o - b.o || a.name.localeCompare(b.name))
    .map(x => x.p);
}

/* ---- the seed field's browse grid: the orders of its Sort control ---- */

/** The browse grid's orders, in the Sort control's order: colour wheel · closest to your pick · owned
 *  first · name. */
export const BROWSE_SORTS = ['hue', 'closest', 'owned', 'name'];
/** Below this Lab chroma a paint reads as grey, so the colour-wheel order puts it after the colours. Lower
 *  than the neutral-seed threshold (NEUTRAL_CHROMA, 10): the paints between 6 and 10 are blue-greys and
 *  olive drabs, and they read as tinted in a grid. */
export const GREY_CHROMA = 6;
/** The width of one hue band in the colour-wheel order (degrees of Lab hue). */
const HUE_BAND = 20;
/** Where the wheel starts (Lab hue). At 0° it opened on pinks; at 20° it opens on reds, and the pinks close it beside the purples. */
const HUE_START = 20;

// The colour-wheel order depends on the dataset only, so it is worked out once per dataset.
const wheelOrders = new WeakMap();
function wheelOrder(paints) {
  let order = wheelOrders.get(paints);
  if (!order) {
    // A plain hue sort put a dark red next to a pale pink next to a dark red: noise in a grid. So the
    // wheel is cut into 20° bands of Lab hue (the hue the eye sees, as the matching uses), and the bands
    // snake: light to dark in one, dark to light in the next, so where two bands meet the colours are close.
    // Greys have no hue to sort by: they come last, from light to dark. Measured on the 3,225 paints
    // (mean ΔE 2000 between neighbours · jumps over 25): raw HSL hue 22.8 · 1,165; 15° HSL bands, light to
    // dark 7.8 · 31; this order 7.2 · 4 (phone test, 2026-10-30).
    const keyed = paints.map(p => {
      const grey = Math.hypot(p.lab[1], p.lab[2]) < GREY_CHROMA;
      const h = (Math.atan2(p.lab[2], p.lab[1]) * 180 / Math.PI - HUE_START + 720) % 360;
      return { p, grey, band: grey ? 0 : Math.floor(h / HUE_BAND), light: p.lab[0] };
    });
    keyed.sort((a, b) => a.grey - b.grey || a.band - b.band
      || (!a.grey && a.band % 2 ? a.light - b.light : b.light - a.light));
    order = keyed.map(x => x.p);
    wheelOrders.set(paints, order);
  }
  return order;
}

/**
 * Every paint in a Sort order of the seed field's browse grid. A new array; the dataset is not changed.
 *   'hue'      the colour wheel: 20° bands of Lab hue, light to dark and dark to light by turns, then the greys
 *   'closest'  by ΔE 2000 to `pickHex` (the colour wheel order when there is no pick)
 *   'owned'    the paints in `ownedIds` first, then A to Z by display name
 *   'name'     A to Z by display name ("Dawnstone (Dry)" before "Dawnstone (Layer)")
 */
export function browseOrder(indexed, key = 'hue', { pickHex = null, ownedIds = null } = {}) {
  const ps = indexed.paints, name = p => p.dname || p.name;
  if (key === 'closest' && pickHex) {
    const t = hexToLab(pickHex);
    // decorate–sort–undecorate: one ΔE 2000 per paint, not one per comparison
    return ps.map(p => [deltaE2000(t, p.lab), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  if (key === 'owned') {
    const own = p => (ownedIds && ownedIds.has(p.id) ? 0 : 1);
    return ps.slice().sort((a, b) => own(a) - own(b) || name(a).localeCompare(name(b)));
  }
  if (key === 'name') return ps.slice().sort((a, b) => name(a).localeCompare(name(b)));
  return wheelOrder(ps).slice();
}

/** Fetch + index the dataset (browser). Tests use indexDataset() with a fixture instead. */
export async function loadDataset(url = './data/paints.json', { onProgress } = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load dataset: ${res.status}`);
  if (!onProgress || !res.body?.getReader) return indexDataset(await res.json());
  // Read it in pieces to report the real progress (the loader, §3.4). `total` is the file's size, or 0 when
  // it is not known: a compressed response's Content-Length counts the compressed bytes, not these.
  const total = res.headers.get('content-encoding') ? 0 : Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    onProgress(got, total);
  }
  const all = new Uint8Array(got);
  let at = 0;
  for (const part of parts) { all.set(part, at); at += part.length; }
  return indexDataset(JSON.parse(new TextDecoder().decode(all)));
}
