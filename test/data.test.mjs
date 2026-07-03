// Unit tests for the dataset layer (src/js/data.js): indexing, nearest-paint search, cross-brand
// equivalents, and match-quality labelling. Run under `node --test` with `node:assert/strict`. A small
// hand-built `fixture` dataset stands in for the real paints.json so results are predictable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexDataset, nearestPaint, nearestPaints, equivalents, matchQuality, FINISH_TYPES, groupMembers, groupOf } from '../src/js/data.js';

const fixture = {
  version: 'test',
  paints: [
    { id: 'citadel-red', brand: 'Citadel', line: 'Base', name: 'Mephiston Red', hex: '#9A1115', type: 'base' },
    { id: 'vallejo-red', brand: 'Vallejo', line: 'Game Color', name: 'Bloody Red', hex: '#A01418', type: 'layer' },
    { id: 'citadel-blue', brand: 'Citadel', line: 'Base', name: 'Macragge Blue', hex: '#2D567C', type: 'base' },
    { id: 'army-teal', brand: 'Army Painter', line: 'Warpaints', name: 'Hydra Turquoise', hex: '#1E939C', type: 'layer' },
  ],
};
const idx = indexDataset(fixture);

// indexDataset precomputes each paint's Lab (for fast matching) and a byId lookup, WITHOUT mutating the
// caller's input object (the original fixture keeps no `lab` field). This is the performance + purity contract.
test('indexDataset precomputes Lab, builds byId, leaves input intact', () => {
  assert.ok(Array.isArray(idx.paints[0].lab));
  assert.equal(fixture.paints[0].lab, undefined);
  assert.equal(idx.byId.get('citadel-red').name, 'Mephiston Red');
});

// nearestPaint returns the closest paint by ΔE; excludeId removes a candidate (so the runner-up wins); and
// the result carries a quality tier — here a very close match lands in the "success" band.
test('nearestPaint finds closest and respects excludeId', () => {
  assert.equal(nearestPaint(idx, '#9B1216').paint.id, 'citadel-red');
  assert.equal(nearestPaint(idx, '#9B1216', { excludeId: 'citadel-red' }).paint.id, 'vallejo-red');
  assert.equal(nearestPaint(idx, '#9B1216').quality.tier, 'success');
});

// Search can be scoped to a brand allow-list (`brands`) or brand exclude-list (`excludeBrands`) — both here
// force the match away from the closest Citadel paint to the Vallejo one.
test('brand allow/exclude filters', () => {
  assert.equal(nearestPaint(idx, '#9B1216', { brands: new Set(['Vallejo']) }).paint.brand, 'Vallejo');
  assert.equal(nearestPaint(idx, '#9B1216', { excludeBrands: new Set(['Citadel']) }).paint.brand, 'Vallejo');
});

// equivalents finds a paint's cross-brand matches: it never returns the paint's own brand, and results are
// sorted nearest-first (ascending ΔE) — this powers the Equivalents tab.
test('equivalents: other-brand only, ascending ΔE', () => {
  const eq = equivalents(idx, idx.byId.get('citadel-red'), { n: 3 });
  assert.ok(eq.every(e => e.paint.brand !== 'Citadel'));
  assert.equal(eq[0].paint.id, 'vallejo-red');
  assert.ok(eq[0].deltaE <= eq[1].deltaE);
});

// nearestPaints (plural) returns the top N candidates, sorted nearest-first.
test('nearestPaints returns N sorted', () => {
  const top = nearestPaints(idx, '#2D567C', 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].paint.id, 'citadel-blue');
  assert.ok(top[0].deltaE <= top[1].deltaE);
});

// The owned-boost lets a paint the user owns win the ranking even if a non-owned paint is slightly closer —
// but the honesty rule (§2) means the REPORTED ΔE is still the owned paint's true distance, not a boosted one.
test('owned-boost prefers an owned paint over a slightly-closer unowned one, but reports the TRUE ΔE', () => {
  const target = '#9B1216';                                  // citadel-red is the closest paint
  const plain = nearestPaint(idx, target);
  assert.equal(plain.paint.id, 'citadel-red');
  // boost vallejo-red (which the user "owns"): with a big enough boost it should win the ranking…
  const boosted = nearestPaint(idx, target, { boostIds: new Set(['vallejo-red']), boostAmount: 6 });
  assert.equal(boosted.paint.id, 'vallejo-red');
  assert.equal(boosted.owned, true);
  // …but the reported ΔE is vallejo-red's real distance (honesty), i.e. larger than the closest match's.
  assert.ok(boosted.deltaE > plain.deltaE);
  assert.ok(typeof boosted.adjust === 'string' || boosted.adjust === null);
});

// The boost is bounded (a fixed subtraction, not a free pass): an owned paint that's wildly far away still
// loses to a near unowned one — a blue can't win a red slot just by being owned.
test('owned-boost is bounded: a far-off owned paint does NOT beat a near unowned match', () => {
  const target = '#9B1216';
  const boosted = nearestPaint(idx, target, { boostIds: new Set(['citadel-blue']), boostAmount: 6 });
  assert.equal(boosted.paint.id, 'citadel-red');             // blue is way too far; boost can't rescue it
  assert.equal(boosted.owned, false);
});

// When no ownership context is passed, the result stays "plain" — no `owned`/`adjust` keys are added. Callers
// that don't care about collection state get a minimal shape.
test('no ownership context leaves the match shape plain (no owned/adjust keys)', () => {
  const m = nearestPaint(idx, '#9B1216');
  assert.equal('owned' in m, false);
});

// Finishes (washes, contrast, etc.) are excluded from harmony suggestions via excludeTypes. Unfiltered, the
// closest paint is a wash; excluding FINISH_TYPES falls back to the flat layer; selectively re-including
// "contrast" lets a contrast paint win again — proving the exclusion set is honoured per-type.
test('excludeTypes keeps finish paints (washes/contrast) out of suggestions', () => {
  const fx = indexDataset({ version: 'test', paints: [
    { id: 'wash-near', brand: 'Citadel', line: 'Shade', name: 'Reikland Fleshshade', hex: '#9B1216', type: 'wash' },
    { id: 'contrast-near', brand: 'Citadel', line: 'Contrast', name: 'Flesh Tearers Red', hex: '#9A1217', type: 'contrast' },
    { id: 'layer-far', brand: 'Citadel', line: 'Layer', name: 'Evil Sunz Scarlet', hex: '#C8202A', type: 'layer' },
  ] });
  const target = '#9B1216';
  assert.equal(nearestPaint(fx, target).paint.id, 'wash-near');                       // unfiltered → the wash wins
  const ex = new Set(FINISH_TYPES);
  assert.equal(nearestPaint(fx, target, { excludeTypes: ex }).paint.id, 'layer-far'); // finishes excluded → flat layer
  ex.delete('contrast');                                                              // "Include Contrast"
  assert.equal(nearestPaint(fx, target, { excludeTypes: ex }).paint.id, 'contrast-near');
});

// The curated equivalence groups (build-seeded clusters of near-identical paints): groupMembers lists a
// paint's fellow members EXCLUDING itself, groupOf returns the group record, and an ungrouped paint yields none.
test('curated equivalence groups: groupMembers (excl. self) + groupOf', () => {
  const fx = indexDataset({ version: 't', groups: [{ id: 'deep-red-01', refHex: '#9A1115', label: 'deep red' }], paints: [
    { id: 'a', brand: 'Citadel', line: 'Base', name: 'Mephiston Red', hex: '#9A1115', type: 'base', groupId: 'deep-red-01' },
    { id: 'b', brand: 'Vallejo', line: 'Game Color', name: 'Bloody Red', hex: '#9B1216', type: 'layer', groupId: 'deep-red-01' },
    { id: 'c', brand: 'Citadel', line: 'Base', name: 'Macragge Blue', hex: '#2D567C', type: 'base' },
  ] });
  const mem = groupMembers(fx, fx.byId.get('a'));
  assert.equal(mem.length, 1);
  assert.equal(mem[0].id, 'b');
  assert.equal(groupOf(fx, fx.byId.get('a')).label, 'deep red');
  assert.deepEqual(groupMembers(fx, fx.byId.get('c')), []);   // ungrouped → none
});

// matchQuality maps a ΔE number to its plain-language label. This pins each boundary of the fixed §3.2 scale
// (≤1 Indistinguishable, ≤2 Excellent, ≤3.5 Good, ≤5 Fair, ≤10 Loose, >10 Poor).
test('matchQuality boundary labels (CLAUDE.md §3.2)', () => {
  assert.equal(matchQuality(0.5).label, 'Indistinguishable');
  assert.equal(matchQuality(2).label, 'Excellent');
  assert.equal(matchQuality(3.5).label, 'Good');
  assert.equal(matchQuality(4).label, 'Fair');
  assert.equal(matchQuality(8).label, 'Loose');
  assert.equal(matchQuality(15).label, 'Poor');
});

// dname is the display name derived at load: when one brand reuses a name across lines (Dawnstone as both
// Layer and Dry) it appends the line to disambiguate; unambiguous names are left bare.
test('dname disambiguates same-brand name collisions with the line (derived at load)', () => {
  const dup = indexDataset({ version: 't', paints: [
    { id: 'c-layer-dawnstone', brand: 'Citadel', line: 'Layer', name: 'Dawnstone', hex: '#697068', type: 'layer' },
    { id: 'c-dry-dawnstone', brand: 'Citadel', line: 'Dry', name: 'Dawnstone', hex: '#697068', type: 'dry' },
    { id: 'c-blue', brand: 'Citadel', line: 'Base', name: 'Macragge Blue', hex: '#2D567C', type: 'base' },
  ] });
  assert.equal(dup.byId.get('c-layer-dawnstone').dname, 'Dawnstone (Layer)');
  assert.equal(dup.byId.get('c-dry-dawnstone').dname, 'Dawnstone (Dry)');
  assert.equal(dup.byId.get('c-blue').dname, 'Macragge Blue');   // unambiguous names stay bare
});

// demoteTypes penalises certain types in the RANKING only (metallics read differently on the model, so they
// shouldn't win a colour role over a near flat paint). Key subtleties: an all-metal pool (the Metal role)
// demotes everyone equally so it's a no-op, and the reported ΔE is never inflated by the demote (§2 honesty).
test('demoteTypes ranks metals as further for colour roles, but reported ΔE stays true (§2)', () => {
  const mIdx = indexDataset({ version: 't', paints: [
    { id: 'metal-grey', brand: 'T', line: 'L', name: 'Iron', hex: '#6E7177', type: 'metal' },
    { id: 'flat-grey', brand: 'T', line: 'L', name: 'Stone', hex: '#6D7076', type: 'layer' },   // ~ΔE 1 from the target
  ] });
  const target = '#6E7177';                            // exactly the metal's hex
  assert.equal(nearestPaint(mIdx, target).paint.id, 'metal-grey');   // no demote → metal wins at ΔE 0
  const demoted = nearestPaint(mIdx, target, { demoteTypes: new Set(['metal']), demoteAmount: 4 });
  assert.equal(demoted.paint.id, 'flat-grey');         // demoted → the close flat grey wins the slot
  const still = nearestPaint(mIdx, target, { demoteTypes: new Set(['metal']), demoteAmount: 4, types: new Set(['metal']) });
  assert.equal(still.paint.id, 'metal-grey');          // all-metal pool (Metal role) → demote is a no-op
  assert.equal(still.deltaE, 0);                       // reported distance is never inflated
});

// preferIds is the picked-paint tie-break: when two paints share a hex (Layer vs Dry twins) and thus an exact
// ΔE, the paint the user explicitly picked wins the tie — without changing the reported distance.
test('preferIds breaks exact ΔE ties toward the picked paint (Layer vs Dry twins)', () => {
  const twins = indexDataset({ version: 't', paints: [
    { id: 'c-dry-dawnstone', brand: 'Citadel', line: 'Dry', name: 'Dawnstone', hex: '#697068', type: 'dry' },
    { id: 'c-layer-dawnstone', brand: 'Citadel', line: 'Layer', name: 'Dawnstone', hex: '#697068', type: 'layer' },
  ] });
  // dataset order would hand the tie to the Dry twin; the pick must win it instead
  assert.equal(nearestPaint(twins, '#697068').paint.id, 'c-dry-dawnstone');
  const preferred = nearestPaint(twins, '#697068', { preferIds: new Set(['c-layer-dawnstone']) });
  assert.equal(preferred.paint.id, 'c-layer-dawnstone');
  assert.equal(preferred.deltaE, 0);   // reported distance untouched
});
