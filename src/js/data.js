// data.js — load + index the paint dataset and search it by perceptual distance.
// Pure search functions (testable); only loadDataset() touches the network.

import { hexToLab, deltaE2000, adjustDirection } from './color.js';

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
 *  metal on the model — so for a metal source, metals rank strictly first (reported ΔE stays true, §2). */
export function equivalents(indexed, paint, { n = 6 } = {}) {
  const lab = paint.lab || hexToLab(paint.hex);
  const isMetal = paint.type === 'metal';
  // Through the same cheap prefilter every other search uses (§6): this scanned + sorted the WHOLE
  // dataset — ~2,200 ΔE2000 calls and a 2,200-element sort — to return 6-8 rows, and the Equivalents
  // tab re-runs it on every source-chip click. candidatePool already understands excludeBrands, and
  // floatTypes keeps the metal tier below from being pruned out of existence.
  // keep=192, not the default 64: this returns a LIST, and a short pool let a marginally worse paint
  // take a tail slot. Measured over all 2,508 paints against a full-dataset reference — rank 1 is
  // identical either way; 192 cuts the differing tail rows from 94 to 10 (of ~20,000) and is still
  // ~5.5× faster than the full scan it replaces.
  const opts = { excludeBrands: new Set([paint.brand]), keep: 192, ...(isMetal ? { floatTypes: new Set(['metal']) } : {}) };
  const tier = isMetal ? (p => p.type === 'metal' ? 0 : 1) : () => 0;
  return candidatePool(indexed, lab, opts)
    .map(p => ({ paint: p, deltaE: deltaE2000(lab, p.lab) }))
    .sort((a, b) => tier(a.paint) - tier(b.paint) || a.deltaE - b.deltaE)
    .slice(0, n)
    .map(m => ({ ...m, quality: matchQuality(m.deltaE) }));
}

/** Fetch + index the dataset (browser). Tests use indexDataset() with a fixture instead. */
export async function loadDataset(url = './data/paints.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load dataset: ${res.status}`);
  return indexDataset(await res.json());
}
