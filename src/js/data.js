// data.js — load + index the paint dataset and search it by perceptual distance.
// Pure search functions (testable); only loadDataset() touches the network.

import { hexToLab, deltaE2000 } from './color.js';

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
  return { ...dataset, paints, byId: new Map(paints.map(p => [p.id, p])) };
}

function passesFilter(p, { excludeId, brands, excludeBrands, ownedIds, types } = {}) {
  if (excludeId && p.id === excludeId) return false;
  if (brands && !brands.has(p.brand)) return false;
  if (excludeBrands && excludeBrands.has(p.brand)) return false;
  if (ownedIds && !ownedIds.has(p.id)) return false;
  if (types && !types.has(p.type)) return false;
  return true;
}

/**
 * Nearest paint to a target hex by ΔE2000, honouring filters.
 * @returns {{paint:object, deltaE:number, quality:{label:string,tier:string}}|null}
 */
export function nearestPaint(indexed, hex, opts = {}) {
  const target = hexToLab(hex);
  let best = null, bestD = Infinity;
  for (const p of indexed.paints) {
    if (!passesFilter(p, opts)) continue;
    const d = deltaE2000(target, p.lab);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { paint: best, deltaE: bestD, quality: matchQuality(bestD) } : null;
}

/** Top-N nearest paints to a hex (ascending ΔE). */
export function nearestPaints(indexed, hex, n = 5, opts = {}) {
  const target = hexToLab(hex);
  return indexed.paints
    .filter(p => passesFilter(p, opts))
    .map(p => ({ paint: p, deltaE: deltaE2000(target, p.lab) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, n)
    .map(m => ({ ...m, quality: matchQuality(m.deltaE) }));
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
