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

test('indexDataset precomputes Lab, builds byId, leaves input intact', () => {
  assert.ok(Array.isArray(idx.paints[0].lab));
  assert.equal(fixture.paints[0].lab, undefined);
  assert.equal(idx.byId.get('citadel-red').name, 'Mephiston Red');
});

test('nearestPaint finds closest and respects excludeId', () => {
  assert.equal(nearestPaint(idx, '#9B1216').paint.id, 'citadel-red');
  assert.equal(nearestPaint(idx, '#9B1216', { excludeId: 'citadel-red' }).paint.id, 'vallejo-red');
  assert.equal(nearestPaint(idx, '#9B1216').quality.tier, 'success');
});

test('brand allow/exclude filters', () => {
  assert.equal(nearestPaint(idx, '#9B1216', { brands: new Set(['Vallejo']) }).paint.brand, 'Vallejo');
  assert.equal(nearestPaint(idx, '#9B1216', { excludeBrands: new Set(['Citadel']) }).paint.brand, 'Vallejo');
});

test('equivalents: other-brand only, ascending ΔE', () => {
  const eq = equivalents(idx, idx.byId.get('citadel-red'), { n: 3 });
  assert.ok(eq.every(e => e.paint.brand !== 'Citadel'));
  assert.equal(eq[0].paint.id, 'vallejo-red');
  assert.ok(eq[0].deltaE <= eq[1].deltaE);
});

test('nearestPaints returns N sorted', () => {
  const top = nearestPaints(idx, '#2D567C', 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].paint.id, 'citadel-blue');
  assert.ok(top[0].deltaE <= top[1].deltaE);
});

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

test('owned-boost is bounded: a far-off owned paint does NOT beat a near unowned match', () => {
  const target = '#9B1216';
  const boosted = nearestPaint(idx, target, { boostIds: new Set(['citadel-blue']), boostAmount: 6 });
  assert.equal(boosted.paint.id, 'citadel-red');             // blue is way too far; boost can't rescue it
  assert.equal(boosted.owned, false);
});

test('no ownership context leaves the match shape plain (no owned/adjust keys)', () => {
  const m = nearestPaint(idx, '#9B1216');
  assert.equal('owned' in m, false);
});

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

test('matchQuality boundary labels (CLAUDE.md §3.2)', () => {
  assert.equal(matchQuality(0.5).label, 'Indistinguishable');
  assert.equal(matchQuality(2).label, 'Excellent');
  assert.equal(matchQuality(3.5).label, 'Good');
  assert.equal(matchQuality(4).label, 'Fair');
  assert.equal(matchQuality(8).label, 'Loose');
  assert.equal(matchQuality(15).label, 'Poor');
});

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

test('owned-boost keeps true-ΔE order among owned paints (no score floor)', () => {
  // Both reds owned and both within the 6-ΔE boost of the target: the closer one must win
  // regardless of dataset order. The old Math.max(0, d - 6) floor collapsed both scores to 0
  // and let candidate-pool order pick the ΔE-5-ish paint over the near-exact one.
  const rev = indexDataset({ version: 't', paints: [
    { id: 'far-red', brand: 'A', line: '—', name: 'Far Red', hex: '#B0201F', type: 'layer' },   // earlier in the dataset, further from target
    { id: 'near-red', brand: 'B', line: '—', name: 'Near Red', hex: '#9B1216', type: 'layer' },
  ] });
  const m = nearestPaint(rev, '#9A1115', { boostIds: new Set(['far-red', 'near-red']), boostAmount: 6 });
  assert.equal(m.paint.id, 'near-red');
});
