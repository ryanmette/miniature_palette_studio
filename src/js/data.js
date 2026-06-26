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
 */
const rankScore = (d, p, { boostIds, boostAmount = 0, ownedIds }) =>
  ((boostIds && boostIds.has(p.id)) || (ownedIds && ownedIds.has(p.id))) ? Math.max(0, d - boostAmount) : d;

/** Is this paint one the user owns (per either the boost set or the hard-filter set)? */
const isOwnedMatch = (p, { boostIds, ownedIds }) => !!((boostIds && boostIds.has(p.id)) || (ownedIds && ownedIds.has(p.id)));

/** Decorate a match with owned + adjust-direction info when ownership is in play (else leave it plain). */
function decorate(m, targetHex, opts) {
  if (!opts.boostIds && !opts.ownedIds) return m;       // no ownership context → unchanged shape
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
const KEEP = 64;
function candidatePool(indexed, target, opts) {
  const [L, A, B] = target;
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
  // Always keep boosted (owned) paints so the soft owned-boost (#6) can never be pruned.
  if (opts.boostIds && filled === KEEP) {
    const inTop = new Set(top);
    for (const p of indexed.paints) if (opts.boostIds.has(p.id) && passesFilter(p, opts) && !inTop.has(p)) top.push(p);
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

/** Top-N nearest paints to a hex, ranked by the same owned-boost; reported ΔE stays true. */
export function nearestPaints(indexed, hex, n = 5, opts = {}) {
  const target = hexToLab(hex);
  return candidatePool(indexed, target, opts)
    .map(p => { const deltaE = deltaE2000(target, p.lab); return { paint: p, deltaE, score: rankScore(deltaE, p, opts) }; })
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map(({ paint, deltaE }) => decorate({ paint, deltaE, quality: matchQuality(deltaE) }, hex, opts));
}

/** Cross-brand equivalents for a paint: nearest paints in OTHER brands. */
export function equivalents(indexed, paint, { n = 6 } = {}) {
  const lab = paint.lab || hexToLab(paint.hex);
  return indexed.paints
    .filter(p => p.brand !== paint.brand)
    .map(p => ({ paint: p, deltaE: deltaE2000(lab, p.lab) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, n)
    .map(m => ({ ...m, quality: matchQuality(m.deltaE) }));
}

/** Fetch + index the dataset (browser). Tests use indexDataset() with a fixture instead. */
export async function loadDataset(url = './data/paints.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load dataset: ${res.status}`);
  return indexDataset(await res.json());
}
