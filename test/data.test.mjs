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

test('knownOwnedIds reports ownership WITHOUT touching the ranking', () => {
  // The default "use my collection: off" passes no boost/filter set. Ownership is still a fact about
  // the shelf: without this the ✓ owned badge vanished and the export told you to buy what you own.
  const owned = nearestPaint(idx, '#9B1216', { knownOwnedIds: new Set(['citadel-red']) });
  assert.equal(owned.paint.id, 'citadel-red');
  assert.equal(owned.owned, true);
  // Marking a DIFFERENT paint owned must not promote it — decoration only, never a boost.
  const other = nearestPaint(idx, '#9B1216', { knownOwnedIds: new Set(['vallejo-red']) });
  assert.equal(other.paint.id, 'citadel-red');
  assert.equal(other.owned, false);
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

test('equivalents from a METAL source float true metallics above nearer flats, ΔE stays true (§7)', () => {
  // The flat ochre sits nearer the gold's hex than the rival brand's gold — the metal must still lead.
  const fx = indexDataset({ version: 't', paints: [
    { id: 'c-gold', brand: 'Citadel', line: 'Base', name: 'Retributor Armour', hex: '#C8A13A', type: 'metal' },
    { id: 'v-ochre', brand: 'Vallejo', line: 'Model Color', name: 'Ochre', hex: '#C7A23B', type: 'layer' },
    { id: 'v-gold', brand: 'Vallejo', line: 'Metal Color', name: 'Gold', hex: '#D0A845', type: 'metal' },
  ] });
  const eq = equivalents(fx, fx.byId.get('c-gold'), { n: 2 });
  assert.equal(eq[0].paint.id, 'v-gold');                       // metal first, despite larger ΔE
  assert.equal(eq[1].paint.id, 'v-ochre');
  assert.ok(eq[0].deltaE > eq[1].deltaE);                       // reported distances untouched (honesty)
  // a FLAT source keeps pure ΔE order — no metal preference
  const flat = equivalents(fx, fx.byId.get('v-ochre'), { n: 2 });
  assert.equal(flat[0].paint.id, 'c-gold');                     // nearest by hex, type irrelevant
});

test('nearestPaints floatTypes ranks the floated type strictly first, then by score', () => {
  const fx = indexDataset({ version: 't', paints: [
    { id: 'ochre', brand: 'A', line: '—', name: 'Ochre', hex: '#C7A23B', type: 'layer' },
    { id: 'gold-far', brand: 'B', line: '—', name: 'Old Gold', hex: '#D8B055', type: 'metal' },
    { id: 'gold-near', brand: 'C', line: '—', name: 'Gold', hex: '#D0A845', type: 'metal' },
  ] });
  const top = nearestPaints(fx, '#C8A13A', 3, { floatTypes: new Set(['metal']) });
  assert.deepEqual(top.map(m => m.paint.id), ['gold-near', 'gold-far', 'ochre']);
  // without the flag, pure distance order
  const plain = nearestPaints(fx, '#C8A13A', 3);
  assert.equal(plain[0].paint.id, 'ochre');
});

test('equivalents: a metal source keeps metals first, even behind hundreds of nearer flats', () => {
  // A prefilter keeps the N nearest by cheap Euclidean distance. Here it once pruned every metal before
  // the metal-first tier (§7) could apply. equivalents() now ranks every paint, with no prefilter. The
  // dataset stays larger than a pool, so a prefilter that comes back must still keep the metals.
  const paints = [{ id: 'src', brand: 'Citadel', line: 'Base', name: 'Gold', hex: '#C8A13A', type: 'metal' }];
  for (let i = 0; i < 400; i++)   // a dense cloud of FLATS right next to the source hex
    paints.push({ id: 'flat' + i, brand: 'Vallejo', line: 'Game', name: 'Flat ' + i,
      hex: '#C' + (8 + i % 2) + 'A1' + (0x3A + i % 8).toString(16).padStart(2, '0'), type: 'layer' });
  // ...and one genuinely distant metal, far outside the Euclidean top-N.
  paints.push({ id: 'far-metal', brand: 'Vallejo', line: 'Game', name: 'Far Silver', hex: '#8894A0', type: 'metal' });
  const big = indexDataset({ version: 't', paints });

  const eq = equivalents(big, big.byId.get('src'), { n: 5 });
  assert.equal(eq[0].paint.type, 'metal', 'a metal must lead the list for a metal source');
  assert.equal(eq[0].paint.id, 'far-metal');
  assert.ok(eq.every(e => e.paint.brand !== 'Citadel'), 'never returns the source brand');
  // reported ΔE stays the TRUE distance even though the metal was floated (§2)
  assert.ok(eq[0].deltaE > eq[1].deltaE, 'the floated metal is genuinely further than the near flats');
});

test('equivalents: a flat source keeps pure ΔE order (no tier), ascending', () => {
  const eq = equivalents(idx, idx.byId.get('citadel-red'), { n: 3 });
  assert.ok(eq.every(e => e.paint.brand !== 'Citadel'));
  for (let i = 1; i < eq.length; i++) assert.ok(eq[i].deltaE >= eq[i - 1].deltaE, 'ascending ΔE');
});

test('equivalents: the top 8 equal a full scan of the real dataset (§6, §7)', async () => {
  // FINISH_PENALTY changes the order after a nearest-by-Lab cut, so a cut can drop a paint that belongs
  // in the list. With a pool of 192, 241 of the 3,225 paints (dataset 1.6.0) got a different top 8.
  // The reference ranks every other-brand paint, with the same metal tier and the same penalty.
  const { readFileSync } = await import('node:fs');
  const { finishClass, FINISH_PENALTY } = await import('../src/js/data.js');
  const { deltaE2000 } = await import('../src/js/color.js');
  const real = indexDataset(JSON.parse(readFileSync(new URL('../src/data/paints.json', import.meta.url), 'utf8')));
  const fullScan = src => real.paints.filter(p => p.brand !== src.brand)
    .map(p => {
      const deltaE = deltaE2000(src.lab, p.lab);
      return { paint: p, deltaE, tier: src.type === 'metal' && p.type !== 'metal' ? 1 : 0,
        score: deltaE + (finishClass(p.type) === finishClass(src.type) ? 0 : FINISH_PENALTY) };
    })
    .sort((a, b) => a.tier - b.tier || a.score - b.score)
    .slice(0, 8);
  // Every 40th paint, plus the 13 paints where the pool of 192 put a WORSE paint in the list (not only
  // two equal scores in another order). If a later dataset drops one of these ids, the stride sample stays.
  const worse = ['scale75-fx-electric-blue', 'scale75-fx-acid-pink', 'scale75-fx-psychedelic-purple',
    'army-painter-speedpaint-maggot-skin', 'citadel-shade-biel-tan-green', 'citadel-contrast-space-wolves-grey',
    'citadel-contrast-snakebite-leather', 'ak-interactive-3rd-gen-ink-purple', 'army-painter-wash-radiation-glow',
    'two-thin-coats-wave-3-fire-opal', 'army-painter-speedpaint-algae-green', 'vallejo-xpress-iceberg-grey',
    'reaper-wash-flesh-wash'];
  const sources = real.paints.filter((p, i) => i % 40 === 0);
  for (const id of worse) if (real.byId.has(id)) sources.push(real.byId.get(id));
  assert.equal(new Set(sources.map(p => finishClass(p.type))).size, 4, 'the sample has all four finish classes');
  for (const src of sources) {
    const got = equivalents(real, src, { n: 8 }), want = fullScan(src);
    assert.deepEqual(got.map(e => e.paint.id), want.map(e => e.paint.id), `top 8 for ${src.id}`);
    assert.deepEqual(got.map(e => e.deltaE), want.map(e => e.deltaE), `true ΔE for ${src.id}`);
  }
});

test('finishClass: the four classes the equivalence groups use (§5.2)', async () => {
  const { finishClass } = await import('../src/js/data.js');
  assert.deepEqual(['base', 'layer', 'dry'].map(finishClass), ['flat', 'flat', 'flat']);
  assert.deepEqual(['wash', 'shade', 'ink', 'contrast', 'glaze'].map(finishClass), Array(5).fill('translucent'));
  assert.equal(finishClass('effect'), 'effect');
  assert.equal(finishClass('metal'), 'metal');
});

test('equivalents: a different finish ranks FINISH_PENALTY further; reported ΔE stays true (§7)', async () => {
  const { FINISH_PENALTY } = await import('../src/js/data.js');
  const { hexToLab, deltaE2000 } = await import('../src/js/color.js');
  const src = '#9A1115', d = h => deltaE2000(hexToLab(src), hexToLab(h));
  const fx = indexDataset({ version: 't', paints: [
    { id: 'src', brand: 'Citadel', line: 'Base', name: 'Mephiston Red', hex: src, type: 'base' },
    { id: 'wash-near', brand: 'A', line: 'Wash', name: 'Red Wash', hex: '#9B1216', type: 'wash' },
    { id: 'texture-near', brand: 'B', line: 'FX', name: 'Red Texture', hex: '#9A1216', type: 'effect' },
    { id: 'flat-mid', brand: 'C', line: 'Layer', name: 'Bloody Red', hex: '#A01418', type: 'layer' },
  ] });
  // preconditions: the finishes are nearer than the flat, but by less than the penalty
  assert.ok(d('#9B1216') < d('#A01418') && d('#A01418') - d('#9B1216') < FINISH_PENALTY);
  const eq = equivalents(fx, fx.byId.get('src'), { n: 3 });
  assert.equal(eq[0].paint.id, 'flat-mid', 'a flat source lists the flat first');
  assert.ok(eq[0].deltaE > eq[1].deltaE, 'the ΔE shown is the true distance, not the ranking score');
  // with NO same-finish candidate, every row carries the same penalty: plain ΔE order, nothing hidden
  const fromWash = equivalents(fx, fx.byId.get('wash-near'), { n: 3 });
  assert.equal(fromWash.length, 3);
  for (let i = 1; i < fromWash.length; i++) assert.ok(fromWash[i].deltaE >= fromWash[i - 1].deltaE, 'ascending ΔE');
});

test('equivalents: a different finish still wins when it is more than FINISH_PENALTY closer', async () => {
  const { FINISH_PENALTY } = await import('../src/js/data.js');
  const { hexToLab, deltaE2000 } = await import('../src/js/color.js');
  const src = '#9A1115', d = h => deltaE2000(hexToLab(src), hexToLab(h));
  const fx = indexDataset({ version: 't', paints: [
    { id: 'src', brand: 'Citadel', line: 'Base', name: 'Mephiston Red', hex: src, type: 'base' },
    { id: 'wash-near', brand: 'A', line: 'Wash', name: 'Red Wash', hex: '#9B1216', type: 'wash' },
    { id: 'flat-far', brand: 'C', line: 'Layer', name: 'Brick', hex: '#B4402F', type: 'layer' },
  ] });
  assert.ok(d('#B4402F') - d('#9B1216') > FINISH_PENALTY, 'precondition: the flat is far');
  const eq = equivalents(fx, fx.byId.get('src'), { n: 2 });
  assert.equal(eq[0].paint.id, 'wash-near', 'a much closer different-finish paint is not hidden');
});

test('equivalents: a wash source lists washes before flats that are only slightly nearer', async () => {
  const fx = indexDataset({ version: 't', paints: [
    { id: 'src', brand: 'Citadel', line: 'Shade', name: 'Red Shade', hex: '#5A1A1A', type: 'shade' },
    { id: 'flat-near', brand: 'A', line: 'Layer', name: 'Dark Red', hex: '#5B1A1B', type: 'layer' },
    { id: 'wash-mid', brand: 'B', line: 'Wash', name: 'Red Wash', hex: '#621E1C', type: 'wash' },
  ] });
  const eq = equivalents(fx, fx.byId.get('src'), { n: 2 });
  assert.equal(eq[0].paint.id, 'wash-mid');
  assert.ok(eq[0].deltaE > eq[1].deltaE);
});

/* ---- the shared paint search (the seed field + the Shelf search) ---- */
import { readFileSync } from 'node:fs';
import { paintMatcher, searchPaints, foldText, closestPaints, warmPaintSearch, FINISH_WORDS, FINISH_PENALTY } from '../src/js/data.js';
import { deltaE2000Hex } from '../src/js/color.js';

const real = indexDataset(JSON.parse(readFileSync(new URL('../src/data/paints.json', import.meta.url), 'utf8')));
const ids = list => list.map(p => p.id);

test('foldText: no accents, lower case, no apostrophes, punctuation as spaces', () => {
  assert.equal(foldText('Dawnstone (Layer)'), 'dawnstone layer');
  assert.equal(foldText('Ral 6011 Resedagrün'), 'ral 6011 resedagrun');
  assert.equal(foldText('Tiger’s Eye Skin'), 'tigers eye skin');
  assert.equal(foldText("Tiger's Eye Skin"), 'tigers eye skin');
  assert.equal(foldText('  Green-grey  '), 'green grey');
});

test('search "metallic": the finish word finds every metal paint', () => {
  const res = searchPaints(real, 'metallic');
  const metals = real.paints.filter(p => p.type === 'metal');
  assert.ok(metals.length > 100);
  const got = new Set(ids(res));
  for (const p of metals) assert.ok(got.has(p.id), p.id);
  // and nothing that does not say "metallic" somewhere
  for (const p of res) assert.ok(p.type === 'metal' || /metallic/i.test(`${p.name} ${p.line} ${p.brand}`), p.id);
});

test('search "citadel metallic": every word narrows the list (Citadel is a search word for Warhammer Colour)', () => {
  const res = searchPaints(real, 'citadel metallic');
  assert.ok(res.length > 10);
  for (const p of res) assert.equal(p.brand, 'Warhammer Colour', p.id);
  for (const p of res) assert.equal(p.type, 'metal', p.id);
  assert.ok(ids(res).includes('citadel-base-leadbelcher'));
});

test('search "dawnstone (layer)": the display name finds one twin, first', () => {
  const res = searchPaints(real, 'dawnstone (layer)');
  assert.deepEqual(ids(res), ['citadel-layer-dawnstone']);
  // "dawnstone" finds both twins, A to Z by display name: Dawnstone (Dry), then Dawnstone (Layer)
  assert.deepEqual(ids(searchPaints(real, 'dawnstone')), ['citadel-dry-dawnstone', 'citadel-layer-dawnstone']);
});

test('search: in each group, the paints you own come first', () => {
  const owned = new Set(['citadel-layer-dawnstone']);
  assert.deepEqual(ids(searchPaints(real, 'dawnstone', { ownedIds: owned })), ['citadel-layer-dawnstone', 'citadel-dry-dawnstone']);
});

test('search "Abaddon Black": the paint, first (never a colour)', () => {
  assert.equal(searchPaints(real, 'Abaddon Black')[0].id, 'citadel-base-abaddon-black');
  assert.equal(searchPaints(real, 'abaddon')[0].id, 'citadel-base-abaddon-black');
});

test('search "decade": the names that start with it come first', () => {
  const res = searchPaints(real, 'decade');
  assert.ok(res.length >= 1);
  assert.ok(foldText(res[0].name).startsWith('decade'), res[0].name);
});

test('search "vallejo red": one brand, and names with a "red" word first', () => {
  const res = searchPaints(real, 'vallejo red');
  assert.ok(res.length > 5);
  for (const p of res) assert.equal(p.brand, 'Vallejo', p.id);
  assert.ok(foldText(res[0].name).split(' ').some(w => w.startsWith('red')), res[0].name);
});

test('search "stone": a word that starts with it comes before "stone" inside a word', () => {
  const res = searchPaints(real, 'stone');
  const wordStart = p => (' ' + foldText(p.name)).includes(' stone');
  const firstInside = res.findIndex(p => !wordStart(p));
  assert.ok(firstInside > 0, 'some names have a word that starts with "stone"');
  assert.ok(res.slice(firstInside).every(p => !wordStart(p)), 'no word start after the first match inside a word');
  assert.ok(ids(res).includes('citadel-layer-dawnstone'));   // inside a word still matches
});

test('warmPaintSearch: folding ahead of time does not change a result', () => {
  const before = ids(searchPaints(real, 'r'));
  const fresh = indexDataset(JSON.parse(readFileSync(new URL('../src/data/paints.json', import.meta.url), 'utf8')));
  warmPaintSearch(fresh);
  assert.deepEqual(ids(searchPaints(fresh, 'r')), before);
});

test('search: accents and apostrophes fold the same way in the query and the name', () => {
  assert.deepEqual(ids(searchPaints(real, 'resedagrün')), ids(searchPaints(real, 'resedagrun')));
  const tigers = searchPaints(real, "tiger's eye");
  assert.ok(tigers.length >= 2);   // the dataset spells it with ' and with ’
});

test('search "d&d": a one-letter word in a longer query is a whole word', () => {
  // "D&D" folds to "d d"; as parts of words, two d's matched 1,885 paints
  for (const q of ['d&d', 'army painter d&d', 'D & D']) {
    const res = searchPaints(real, q);
    assert.equal(res.length, 20, q);
    for (const p of res) assert.equal(p.line, 'D&D', `${q}: ${p.id}`);
  }
  // one letter alone still matches inside words, on the way to a longer word
  assert.ok(searchPaints(real, 'd').some(p => p.id === 'citadel-layer-dawnstone'));
});

test('search as you type: every paint is found by every prefix of its own name', () => {
  // a one-letter last word is the word being typed: "abaddon b" must still find Abaddon Black
  let misses = 0, first = '';
  for (const p of real.paints) {
    const name = p.dname || p.name;
    for (let i = 1; i <= name.length; i++) {
      const m = paintMatcher(name.slice(0, i));
      if (m && !m(p)) { misses++; if (!first) first = `${p.id} at "${name.slice(0, i)}"`; }
    }
  }
  assert.equal(misses, 0, first);
  for (const q of ['abaddon b', 'army p', 'citadel b', 'vallejo m', 'dawnstone (l'])
    assert.ok(searchPaints(real, q).length > 0, q);
});

test('paintMatcher: no words, no filter; the Shelf finds the display name too', () => {
  assert.equal(paintMatcher(''), null);
  assert.equal(paintMatcher('  ( ) '), null);
  assert.deepEqual(searchPaints(real, ''), []);
  const m = paintMatcher('dawnstone (layer)');
  assert.equal(m(real.byId.get('citadel-layer-dawnstone')), true);
  assert.equal(m(real.byId.get('citadel-dry-dawnstone')), false);
  assert.equal(paintMatcher('stone')(real.byId.get('citadel-dry-dawnstone')), true);   // part of a word is enough
});

test('FINISH_WORDS: the finish tag shows the word the search finds', async () => {
  const { finishTag } = await import('../src/js/ui.js');
  for (const [type, word] of Object.entries(FINISH_WORDS)) assert.ok(finishTag(type).endsWith(`${word}</span>`), type);
});

test('closestPaints: ranks a flat colour as Equivalents does, and reports the TRUE ΔE', () => {
  const fx = indexDataset({ paints: [
    { id: 'wash', brand: 'A', line: 'Shade', name: 'Red wash', hex: '#9A1216', type: 'wash' },     // nearest
    { id: 'flat', brand: 'B', line: 'Base', name: 'Red flat', hex: '#A2181C', type: 'base' },      // a little further
    { id: 'far', brand: 'C', line: 'Base', name: 'Blue', hex: '#2D567C', type: 'base' },
  ] });
  const res = closestPaints(fx, '#9A1115', 3);
  const dWash = deltaE2000Hex('#9A1115', '#9A1216'), dFlat = deltaE2000Hex('#9A1115', '#A2181C');
  assert.ok(dWash < dFlat && dFlat < dWash + FINISH_PENALTY);   // the fixture is the case the penalty decides
  assert.deepEqual(res.map(m => m.paint.id), ['flat', 'wash', 'far']);
  assert.ok(Math.abs(res[1].deltaE - dWash) < 1e-9);            // the wash's own ΔE, not ΔE + 4
  assert.equal(res[0].quality.label, matchQuality(dFlat).label);
});

test('closestPaints: the same list as a full scan with the same rule (no paint is cut by the prefilter)', () => {
  // The rule: ΔE 2000, plus FINISH_PENALTY for a finish or a metallic. A cheap Lab-distance prefilter of 64
  // cut Raf Azure Blue (ΔE 6.4, a flat layer) for #8899F4 and showed two Poor matches in its place.
  const demoted = new Set([...FINISH_TYPES, 'metal']);
  const score = (hex, p, d = deltaE2000Hex(hex, p.hex)) => +(d + (demoted.has(p.type) ? FINISH_PENALTY : 0)).toFixed(6);
  assert.equal(closestPaints(real, '#8899F4', 6)[1].paint.name, 'Raf Azure Blue');
  for (let i = 0; i < 61; i++) {
    const hex = i === 0 ? '#8899F4' : '#' + (((i * 2654435761) >>> 8) & 0xFFFFFF).toString(16).padStart(6, '0');
    const full = real.paints.map(p => score(hex, p)).sort((a, b) => a - b).slice(0, 6);
    // compare the scores, not the ids: twins share a hex, and either order of a tie is right
    assert.deepEqual(closestPaints(real, hex, 6).map(m => score(hex, m.paint, m.deltaE)), full, hex);
  }
});

/* ---- the seed field's browse orders (its Sort control) ---- */
import { browseOrder, BROWSE_SORTS, GREY_CHROMA } from '../src/js/data.js';
import { rgbToHsl, hexToRgb } from '../src/js/color.js';

test('browseOrder: every paint, once, in each order; the dataset is not changed', () => {
  const first = real.paints[0].id;
  for (const key of BROWSE_SORTS) {
    const res = browseOrder(real, key, { pickHex: '#9A1115', ownedIds: new Set([first]) });
    assert.equal(res.length, real.paints.length, key);
    assert.equal(new Set(ids(res)).size, real.paints.length, key);
  }
  assert.equal(real.paints[0].id, first);
  assert.deepEqual(BROWSE_SORTS, ['hue', 'closest', 'owned', 'name']);   // the Sort control's order
});

test('browseOrder "hue": 20° bands of Lab hue that snake (light to dark, then dark to light), the greys last', () => {
  const res = browseOrder(real, 'hue');
  const chroma = p => Math.hypot(p.lab[1], p.lab[2]);
  const firstGrey = res.findIndex(p => chroma(p) < GREY_CHROMA);
  assert.ok(firstGrey > 0);
  assert.ok(res.slice(firstGrey).every(p => chroma(p) < GREY_CHROMA));        // no colour after the greys
  const band = p => Math.floor(((Math.atan2(p.lab[2], p.lab[1]) * 180 / Math.PI - 20 + 720) % 360) / 20);   // from 20°: reds first
  const colours = res.slice(0, firstGrey);
  for (let i = 1; i < colours.length; i++) {
    const a = colours[i - 1], b = colours[i];
    const inBand = band(a) % 2 ? a.lab[0] <= b.lab[0] : a.lab[0] >= b.lab[0];   // odd bands run dark to light
    assert.ok(band(a) < band(b) || (band(a) === band(b) && inBand), `${a.id} → ${b.id}`);
  }
  const greys = res.slice(firstGrey);
  for (let i = 1; i < greys.length; i++) assert.ok(greys[i - 1].lab[0] >= greys[i].lab[0]);
});

test('browseOrder "hue" is smooth: neighbours are close (the phone test found the Shelf\'s hue sort jumpy)', () => {
  const res = browseOrder(real, 'hue');
  let sum = 0, big = 0;
  for (let i = 1; i < res.length; i++) { const d = deltaE2000Hex(res[i - 1].hex, res[i].hex); sum += d; if (d > 25) big++; }
  assert.ok(sum / (res.length - 1) < 7.5, `mean ΔE ${(sum / (res.length - 1)).toFixed(2)}`);
  assert.ok(big <= 10, `${big} jumps over ΔE 25`);
});

test('browseOrder "closest": by ΔE 2000 to the pick, the pick itself first', () => {
  const pick = real.paints.find(p => p.name === 'Mephiston Red');
  const res = browseOrder(real, 'closest', { pickHex: pick.hex });
  assert.equal(deltaE2000Hex(pick.hex, res[0].hex), 0);
  for (let i = 1; i < 50; i++) assert.ok(deltaE2000Hex(pick.hex, res[i - 1].hex) <= deltaE2000Hex(pick.hex, res[i].hex) + 1e-9);
  // no pick: the colour-wheel order
  assert.deepEqual(ids(browseOrder(real, 'closest')), ids(browseOrder(real, 'hue')));
});

test('browseOrder "owned" and "name": owned first, then A to Z by display name (twins apart)', () => {
  const owned = new Set(real.paints.filter(p => p.brand === 'Warhammer Colour').slice(0, 3).map(p => p.id));
  const res = browseOrder(real, 'owned', { ownedIds: owned });
  assert.deepEqual(new Set(ids(res.slice(0, 3))), owned);
  const byName = browseOrder(real, 'name').map(p => p.dname || p.name);
  for (let i = 1; i < byName.length; i++) assert.ok(byName[i - 1].localeCompare(byName[i]) <= 0);
  assert.ok(byName.indexOf('Dawnstone (Dry)') < byName.indexOf('Dawnstone (Layer)'));
});

test('storeSwaps (item 38): same finish class only, carried brands only, true ΔE, best first', async () => {
  const { storeSwaps } = await import('../src/js/data.js');
  const sx = indexDataset({ version: 't', paints: [
    { id: 'cit-red', brand: 'Citadel', line: 'Base', name: 'Red', hex: '#9A1115', type: 'base' },
    { id: 'val-red', brand: 'Vallejo', line: 'MC', name: 'Carmine', hex: '#97211F', type: 'base' },
    { id: 'ap-red', brand: 'Army Painter', line: 'W', name: 'Crimson', hex: '#9C1A1D', type: 'layer' },
    { id: 'val-wash', brand: 'Vallejo', line: 'W', name: 'Red Wash', hex: '#9A1216', type: 'wash' },
    { id: 'cit-wash', brand: 'Citadel', line: 'Shade', name: 'Carroburg', hex: '#5A1A22', type: 'shade' },
    { id: 'ap-wash', brand: 'Army Painter', line: 'Q', name: 'Red Tone', hex: '#7A1A1E', type: 'wash' },
  ] });
  const red = sx.byId.get('cit-red');
  const all = storeSwaps(sx, red);
  assert.deepEqual(all.map(m => m.paint.id), ['ap-red', 'val-red'], 'the flat red never gets a wash, even the nearest');
  assert.ok(all[0].deltaE <= all[1].deltaE);
  assert.equal(all[0].quality.label, matchQuality(all[0].deltaE).label);
  assert.deepEqual(storeSwaps(sx, red, { notCarried: new Set(['Army Painter']) }).map(m => m.paint.id), ['val-red']);
  const wash = sx.byId.get('cit-wash');
  assert.deepEqual(storeSwaps(sx, wash).map(m => m.paint.id).sort(), ['ap-wash', 'val-wash'], 'a wash or shade swaps for a wash');
  assert.deepEqual(storeSwaps(sx, wash, { notCarried: new Set(['Vallejo', 'Army Painter']) }), [], 'none: an empty list, never a flat');
  assert.equal(storeSwaps(sx, red, { n: 1 }).length, 1);
  assert.deepEqual(storeSwaps(sx, red, { except: new Set(['ap-red']) }).map(m => m.paint.id), ['val-red'], 'except: the pot that is not on the rack');
});

test('storeSwaps (item 71): another kind in the class ranks 2 ΔE further, with its true ΔE; an effect keeps its fx', async () => {
  const { storeSwaps, swapKind, SWAP_KIND_PENALTY } = await import('../src/js/data.js');
  assert.equal(SWAP_KIND_PENALTY, 2);
  assert.equal(swapKind({ type: 'wash' }), swapKind({ type: 'shade' }), 'a wash and a shade are one product');
  assert.equal(swapKind({ type: 'base' }), swapKind({ type: 'layer' }));
  for (const [a, b] of [['wash', 'contrast'], ['wash', 'ink'], ['contrast', 'glaze'], ['layer', 'dry']]) assert.notEqual(swapKind({ type: a }), swapKind({ type: b }), a + ' / ' + b);
  assert.notEqual(swapKind({ type: 'effect', fx: 'gloss' }), swapKind({ type: 'effect', fx: 'texture' }));
  assert.equal(swapKind({ type: 'effect' }), swapKind({ type: 'technical' }), 'no fx: one kind');
  const sx = indexDataset({ version: 't', paints: [
    { id: 'wash', brand: 'A', line: 'W', name: 'Brown Wash', hex: '#5A3A22', type: 'wash' },
    { id: 'con-near', brand: 'B', line: 'C', name: 'Brown Contrast', hex: '#5C3B22', type: 'contrast' },
    { id: 'shade-near', brand: 'C', line: 'S', name: 'Brown Shade', hex: '#603D24', type: 'shade' },
    { id: 'shade-far', brand: 'D', line: 'S', name: 'Red Shade', hex: '#8A2A22', type: 'shade' },
    { id: 'blood', brand: 'A', line: 'T', name: 'Blood', hex: '#7A0A0A', type: 'effect', fx: 'gloss' },
    { id: 'rust', brand: 'B', line: 'T', name: 'Rust', hex: '#7B0C0B', type: 'effect', fx: 'texture' },
    { id: 'blood2', brand: 'C', line: 'T', name: 'Thick Blood', hex: '#6A1010', type: 'effect', fx: 'gloss' },
    { id: 'slime', brand: 'A', line: 'T', name: 'Rot', hex: '#8A9A2A', type: 'effect', fx: 'slime' },
  ] });
  const m = storeSwaps(sx, sx.byId.get('wash'));
  assert.deepEqual(m.map(x => x.paint.id), ['shade-near', 'con-near', 'shade-far'], 'the shade first, although the Contrast paint is nearer');
  assert.ok(m[1].deltaE < m[0].deltaE && m[0].deltaE - m[1].deltaE < SWAP_KIND_PENALTY, 'the ΔE shown is the true one, not the rank score');
  assert.ok(m[2].deltaE > m[1].deltaE + SWAP_KIND_PENALTY, 'a penalty, not a tier: a far shade stays after a near Contrast paint');
  assert.deepEqual(storeSwaps(sx, sx.byId.get('blood')).map(x => x.paint.id), ['blood2'], 'wet blood never gets the rust texture, even the nearest');
  assert.deepEqual(storeSwaps(sx, sx.byId.get('slime')), [], 'the one slime paint: no swap, said as none');
});

test('swapQuality (item 68): an ink, Contrast or glaze swap never says more than Good; the ΔE stays true', async () => {
  const { storeSwaps, swapQuality } = await import('../src/js/data.js');
  for (const d of [0, 0.8, 1.9, 2]) assert.equal(swapQuality(d, 'translucent').label, 'Good', 'ΔE ' + d);
  for (const d of [2.1, 3.5, 4.2, 7, 12]) assert.deepEqual(swapQuality(d, 'translucent'), matchQuality(d), 'no change over 2');
  for (const cls of ['flat', 'metal', 'effect']) for (const d of [0.5, 1.5, 3, 6]) assert.deepEqual(swapQuality(d, cls), matchQuality(d), cls);
  const sx = indexDataset({ version: 't', paints: [
    { id: 'i1', brand: 'A', line: 'I', name: 'Black Ink', hex: '#000103', type: 'ink' },
    { id: 'i2', brand: 'B', line: 'I', name: 'Black Ink', hex: '#010101', type: 'ink' },
    { id: 'f1', brand: 'A', line: 'L', name: 'Black', hex: '#000103', type: 'layer' },
    { id: 'f2', brand: 'B', line: 'L', name: 'Black', hex: '#010101', type: 'layer' },
  ] });
  const w = storeSwaps(sx, sx.byId.get('i1'))[0], f = storeSwaps(sx, sx.byId.get('f1'))[0];
  assert.ok(w.deltaE < 1 && w.deltaE === f.deltaE, 'the same true ΔE');
  assert.equal(w.quality.label, 'Good'); assert.equal(f.quality.label, 'Indistinguishable');
  assert.equal(w.gap, undefined, 'an ink is compared by ΔE, not by the gap');
});

test('storeSwaps (item 68, way C): a wash ranks its swaps by the gap, whatever the coat each maker recorded', async () => {
  const { storeSwaps, gapQuality, WASH_GAP_CLOSE, WASH_GAP_NEAR, WASH_GAP_TIE, WEAK_ABSORB, SWAP_KIND_PENALTY } = await import('../src/js/data.js');
  assert.deepEqual([WASH_GAP_CLOSE, WASH_GAP_NEAR, WEAK_ABSORB], [4, 8, 0.5]);
  assert.deepEqual([0, 4, 4.1, 8, 8.1, 40].map(g => gapQuality(g).label), ['Close colour', 'Close colour', 'Near colour', 'Near colour', 'Other colour', 'Other colour']);
  assert.deepEqual([2, 6, 20].map(g => gapQuality(g).tier), ['success', 'warning', 'danger']);
  // The real values: Shadow Wash and Dark Tone hold the liquid in the pot, Nuln Oil and Agrax Earthshade a thin
  // coat on white. By ΔE, Nuln Oil is 50 from Shadow Wash, and it never showed.
  const sx = indexDataset({ version: 't', paints: [
    { id: 'shadow', brand: 'Army Painter', line: "Nolzur's", name: 'Shadow Wash', hex: '#000103', type: 'wash' },
    { id: 'nuln', brand: 'Warhammer Colour', line: 'Shade', name: 'Nuln Oil', hex: '#9E9A98', type: 'shade' },
    { id: 'agrax', brand: 'Warhammer Colour', line: 'Shade', name: 'Agrax Earthshade', hex: '#A99D8D', type: 'shade' },
    { id: 'druchii', brand: 'Warhammer Colour', line: 'Shade', name: 'Druchii Violet', hex: '#8F6592', type: 'shade' },
    { id: 'strong', brand: 'Army Painter', line: 'Wash', name: 'Strong Tone', hex: '#211913', type: 'wash' },
    { id: 'dark', brand: 'Army Painter', line: 'Wash', name: 'Dark Tone', hex: '#0C060E', type: 'wash' },
    { id: 'blue', brand: 'Army Painter', line: 'Wash', name: 'Blue Tone', hex: '#0D2540', type: 'wash' },
    { id: 'leviadon', brand: 'Warhammer Colour', line: 'Contrast', name: 'Leviadon Blue', hex: '#000A13', type: 'contrast' },
    { id: 'white', brand: 'Vallejo', line: 'Wash', name: 'White', hex: '#FFFFFF', type: 'wash' },
    { id: 'flat', brand: 'Vallejo', line: 'MC', name: 'Black', hex: '#000103', type: 'layer' },
  ] });
  const of = (id, o) => storeSwaps(sx, sx.byId.get(id), { n: 9, ...o });
  const shadow = of('shadow');
  assert.deepEqual(shadow.slice(0, 2).map(m => m.paint.id), ['dark', 'nuln'], 'the black wash gets the black wash, then the black shade');
  const nuln = shadow[1];
  assert.ok(nuln.deltaE > 45, 'although its true ΔE is about 50');
  assert.ok(nuln.gap < 2); assert.equal(nuln.quality.label, 'Close colour');
  const lev = shadow.find(m => m.paint.id === 'leviadon');
  assert.ok(lev.deltaE < 5 && shadow.indexOf(lev) > 1, 'the blue Contrast paint was second by ΔE; it is after the shade now');
  assert.ok(!shadow.some(m => m.paint.id === 'white'), 'a white wash hardly absorbs: no swap by the gap');
  assert.ok(!shadow.some(m => m.paint.id === 'flat'), 'the finish class stays strict');
  assert.equal(of('agrax')[0].paint.id, 'strong', 'the brown shade (a thin coat) gets the brown wash (the pot)');
  assert.ok(of('strong').find(m => m.paint.id === 'agrax').gap < of('strong').find(m => m.paint.id === 'blue').gap, 'and a brown wash is nearer to the brown shade than to a blue wash');
  // the order is the gap, with a little of the true ΔE to part two washes at the same gap
  const dr = of('druchii'), scores = dr.filter(m => m.paint.type !== 'contrast').map(m => m.gap + WASH_GAP_TIE * m.deltaE);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
  assert.equal(WASH_GAP_TIE, 0.02);
  assert.equal(gapQuality(dr.find(m => m.paint.id === 'nuln').gap).tier, 'danger', 'a violet shade and a black one: Other colour');
  // the white wash as the paint to buy: no direction, so ΔE as before, with ΔE's words
  const white = of('white');
  assert.ok(white.length && white.every(m => m.gap === undefined));
  // a wash you own goes first when it is a Close colour, and only then
  assert.equal(of('shadow', { ownedIds: new Set(['nuln']) })[0].paint.id, 'nuln', 'owned and a Close colour: before the nearer Dark Tone');
  assert.equal(of('shadow', { ownedIds: new Set(['blue']) })[0].paint.id, 'dark', 'owned but an Other colour: its own place');
  // the kind penalty is in the score's unit, here degrees
  assert.equal(SWAP_KIND_PENALTY, 2);
});

test('storeSwaps (item 72): a pot you own goes first when it is Good or better, and only then', async () => {
  const { storeSwaps, SWAP_OWNED_MAX } = await import('../src/js/data.js');
  assert.equal(SWAP_OWNED_MAX, 3.5, 'the Good limit');
  assert.equal(matchQuality(SWAP_OWNED_MAX).label, 'Good');
  const sx = indexDataset({ version: 't', paints: [
    { id: 'want', brand: 'A', line: 'L', name: 'Green', hex: '#5A8A2A', type: 'layer' },
    { id: 'near', brand: 'B', line: 'L', name: 'Near Green', hex: '#5B8B2B', type: 'layer' },
    { id: 'good', brand: 'C', line: 'L', name: 'Good Green', hex: '#618C33', type: 'layer' },
    { id: 'loose', brand: 'D', line: 'L', name: 'Loose Green', hex: '#6F9A4A', type: 'layer' },
    { id: 'far', brand: 'E', line: 'L', name: 'Far Green', hex: '#3A6A1A', type: 'layer' },
  ] });
  const want = sx.byId.get('want'), ids = o => storeSwaps(sx, want, o).map(m => m.paint.id);
  const plain = storeSwaps(sx, want);
  assert.deepEqual(plain.map(m => m.paint.id), ['near', 'good', 'loose']);
  assert.ok(plain[1].deltaE <= SWAP_OWNED_MAX && plain[2].deltaE > SWAP_OWNED_MAX && plain[2].deltaE < 10, 'the fixture: one Good, one looser');
  assert.deepEqual(ids({ ownedIds: new Set(['good']) }), ['good', 'near', 'loose'], 'owned and Good: first, although another is nearer');
  assert.deepEqual(ids({ ownedIds: new Set(['loose']) }), ['near', 'good', 'loose'], 'owned but looser: its own place');
  assert.equal(storeSwaps(sx, want, { ownedIds: new Set(['good']) })[0].deltaE, plain[1].deltaE, 'the ΔE shown is the true one');
  assert.deepEqual(ids({ notCarried: new Set(['C']) }), ['near', 'loose', 'far'], 'a brand that is off gives no swap');
  assert.deepEqual(ids({ ownedIds: new Set(['good']), notCarried: new Set(['C']) }), ['good', 'near', 'loose'], 'but a pot on your shelf needs no rack');
  assert.deepEqual(ids({ ownedIds: new Set(['good']), except: new Set(['good']) }), ['near', 'loose', 'far'], 'except still holds');
});

/* ---- the random first scheme (PLAN §5 item 55) ---- */
import { startPaints, randomStartPaint, START_TYPES, START_L } from '../src/js/data.js';
import { NEUTRAL_EXIT } from '../src/js/color.js';

test('startPaints: flat, opaque, on sale, with a clear hue and a mid lightness', () => {
  const sx = indexDataset({ version: 'test', paints: [
    { id: 'red', brand: 'A', line: 'Base', name: 'Red', hex: '#9A1115', type: 'base' },
    { id: 'blue', brand: 'B', line: 'Layer', name: 'Blue', hex: '#2D567C', type: 'layer' },
    { id: 'grey', brand: 'A', line: 'Base', name: 'Grey', hex: '#808080', type: 'base' },          // no hue
    { id: 'black', brand: 'A', line: 'Base', name: 'Black', hex: '#1A0505', type: 'base' },        // too dark
    { id: 'pale', brand: 'A', line: 'Layer', name: 'Pale', hex: '#FBE3E3', type: 'layer' },        // too light
    { id: 'wash', brand: 'A', line: 'Shade', name: 'Wash', hex: '#9A1115', type: 'shade' },        // a finish
    { id: 'gold', brand: 'A', line: 'Base', name: 'Gold', hex: '#B08A2E', type: 'metal' },         // a metallic
    { id: 'old', brand: 'A', line: 'Base', name: 'Old', hex: '#9A1115', type: 'base', discontinued: true },
  ] });
  assert.deepEqual(startPaints(sx).map(p => p.id), ['red', 'blue']);
  assert.equal(randomStartPaint(sx, () => 0).id, 'red');
  assert.equal(randomStartPaint(sx, () => 0.5).id, 'blue');
  assert.equal(randomStartPaint(sx, () => 0.9999999).id, 'blue', 'the top of [0, 1) is the last paint');
  assert.equal(randomStartPaint(indexDataset({ version: 'test', paints: [] }), () => 0), null, 'no paint fits: null');
});

test('startPaints on the real dataset: a big pool from every brand, each one in hue mode', () => {
  const pool = startPaints(real);
  assert.ok(pool.length > 1000, `pool ${pool.length}`);
  assert.equal(new Set(pool.map(p => p.brand)).size, new Set(real.paints.map(p => p.brand)).size, 'every brand can start');
  for (const p of pool) {
    assert.ok(START_TYPES.includes(p.type) && !p.discontinued, p.id);
    assert.ok(Math.hypot(p.lab[1], p.lab[2]) >= NEUTRAL_EXIT, `${p.id} has a hue`);
    assert.ok(p.lab[0] >= START_L[0] && p.lab[0] <= START_L[1], `${p.id} mid lightness`);
  }
  // Many draws give many paints, never one outside the pool
  const ids = new Set(pool.map(p => p.id)), seen = new Set();
  // an even sweep of [0, 1): each step picks a different paint, and none is outside the pool
  for (let i = 0; i < 200; i++) { const p = randomStartPaint(real, () => (i + 0.5) / 200); assert.ok(ids.has(p.id)); seen.add(p.id); }
  assert.equal(seen.size, 200, `${seen.size} different paints in 200 steps`);
});

/* ---- Citadel Colour is Warhammer Colour (PLAN §5 item 56; Ryan, 2026-11-03) ---- */
import { BRAND_WORDS, paintMatcher as matcher56 } from '../src/js/data.js';

test('the rename keeps every id: Warhammer Colour paints are still citadel-…, and no paint says Citadel', () => {
  const wc = real.paints.filter(p => p.brand === 'Warhammer Colour');
  assert.equal(wc.length, 409, '259 from upstream + 150 Tone Pro (dataset 1.8.0)');
  assert.ok(wc.every(p => p.id.startsWith('citadel-')), 'ids never change (saved shelves and links hold them)');
  assert.equal(real.paints.filter(p => p.brand === 'Citadel').length, 0);
  // the starter paints and the light theme's accent pot are still there under their ids
  for (const id of ['citadel-base-mephiston-red', 'citadel-base-macragge-blue', 'citadel-base-caliban-green',
    'citadel-base-retributor-armour', 'citadel-layer-sotek-green']) assert.ok(real.byId.has(id), id);
});

test('the six names are the maker\'s spelling, and each keeps its former name', () => {
  const fixed = {
    'citadel-base-bugman-glow': ["Bugman's Glow", 'Bugman Glow'],
    'citadel-layer-emperor-children': ["Emperor's Children", 'Emperor Children'],
    'citadel-layer-gehenna-gold': ["Gehenna's Gold", 'Gehenna Gold'],
    'citadel-technical-nurgles-rot': ["Nurgle's Rot", 'Nurgles Rot'],
    'citadel-shade-cassandora-yellow': ['Casandora Yellow', 'Cassandora Yellow'],
    'two-thin-coats-wave-1-rc-flesh-wash': ['Orc Flesh Wash', 'RC Flesh Wash'],   // dataset 1.10.0: Two Thin Coats' own chart
  };
  for (const [id, [name, old]] of Object.entries(fixed)) {
    const p = real.byId.get(id);
    assert.equal(p.name, name, id);
    assert.deepEqual(p.formerly, [old], id);
  }
  assert.equal(real.paints.filter(p => p.formerly).length, 6, 'no other paint has a former name');
  assert.equal(real.byId.get('citadel-technical-nurgles-rot').fx, 'slime', 'the fixed name keeps its finish');
  assert.equal(ids(searchPaints(real, 'rc flesh wash'))[0], 'two-thin-coats-wave-1-rc-flesh-wash', 'the old spelling still finds it');
  assert.equal(ids(searchPaints(real, 'orc flesh wash'))[0], 'two-thin-coats-wave-1-rc-flesh-wash');
});

// ---- dataset 1.10.0 (PLAN §5 item 73): three corrections from the makers' own pages, no hex changed ----
test('Army Painter: the 14 Fanatic Effects are effects, not washes; the 18 Fanatic Washes stay washes', () => {
  const effects = ['Brush-On Primer', 'Dark Rust', 'Data System Glow', 'Disgusting Slime', 'Dry Blood', 'Fresh Rust', 'Lens Flare Glow',
    'Oil Stains', 'Oozing Vomit', 'Plasma Coil Glow', 'Power Node Glow', 'Radiation Glow', 'True Blood', 'Verdigris'];
  const line = real.paints.filter(p => p.brand === 'Army Painter' && p.line === 'Wash');
  assert.equal(line.length, 34, 'the line and the ids stay as they were');
  assert.deepEqual(line.filter(p => p.type === 'effect').map(p => p.name).sort(), effects);
  assert.ok(line.filter(p => p.type !== 'effect').every(p => p.type === 'wash'));
  for (const n of ['Dark Tone', 'Strong Tone', 'Soft Tone', 'Blue Tone', 'Military Shade']) assert.equal(line.find(p => p.name === n).type, 'wash', n);
  assert.ok(real.byId.has('army-painter-wash-brush-on-primer'), 'the id does not change');
  const fx = n => line.find(p => p.name === n).fx;
  assert.deepEqual([fx('True Blood'), fx('Dry Blood'), fx('Disgusting Slime'), fx('Fresh Rust'), fx('Verdigris')], ['gloss', 'gloss', 'slime', 'texture', undefined]);
});

test('Warhammer Colour: the four Gloss Shades are discontinued, and no other paint is', () => {
  const gone = real.paints.filter(p => p.discontinued);
  assert.deepEqual(gone.map(p => p.id).sort(), ['citadel-shade-agrax-earthshade-gloss', 'citadel-shade-cryptek-armourshade-gloss',
    'citadel-shade-nuln-oil-gloss', 'citadel-shade-reikland-fleshshade-gloss']);
  assert.ok(gone.every(p => p.type === 'shade' && p.brand === 'Warhammer Colour'));
});

test('storeSwaps: a paint that is no longer made is no swap, unless it is on your shelf', async () => {
  const { storeSwaps } = await import('../src/js/data.js');
  const nuln = real.byId.get('citadel-shade-nuln-oil'), gloss = 'citadel-shade-nuln-oil-gloss';
  const only = { notCarried: new Set(real.paints.map(p => p.brand).filter(b => b !== 'Warhammer Colour')), n: 20 };
  assert.ok(!storeSwaps(real, nuln, only).some(m => m.paint.discontinued), 'a store cannot have it');
  assert.ok(storeSwaps(real, nuln, { ...only, ownedIds: new Set([gloss]) }).some(m => m.paint.id === gloss), 'a pot you own is still a swap');
  // the primer and the effect paints are out of a black wash's swaps
  const shadow = storeSwaps(real, real.byId.get('army-painter-nolzurs-shadow-wash'), { n: 40 });
  assert.ok(shadow.length && shadow.every(m => m.paint.type !== 'effect' && m.paint.name !== 'Brush-On Primer'));
});

test('search: "citadel", "games workshop" and a former spelling still find the paints', () => {
  assert.match(BRAND_WORDS['Warhammer Colour'], /Citadel/);
  const wc = real.paints.filter(matcher56('citadel'));
  assert.ok(wc.length >= 409 && wc.filter(p => p.brand === 'Warhammer Colour').length === 409);
  assert.ok(real.paints.filter(matcher56('games workshop')).every(p => p.brand === 'Warhammer Colour'));
  assert.ok(ids(searchPaints(real, 'warhammer colour mephiston')).includes('citadel-base-mephiston-red'));
  assert.equal(ids(searchPaints(real, 'cassandora'))[0], 'citadel-shade-cassandora-yellow', 'the old spelling');
  assert.equal(ids(searchPaints(real, 'casandora'))[0], 'citadel-shade-cassandora-yellow', "GW's spelling");
  assert.equal(ids(searchPaints(real, "bugman's glow"))[0], 'citadel-base-bugman-glow');
});

// ---- Warhammer Tone Pro (dataset 1.8.0; docs/TONE_PRO.md, PLAN §5 item 57) ----
const TONE_PRO = JSON.parse(readFileSync(new URL('../scripts/tone-pro.json', import.meta.url), 'utf8'));
const tonePro = real.paints.filter(p => p.line === 'Tone Pro');

test('Tone Pro: 30 colours × 5 tones, each an opaque layer paint from GW\'s own chart', () => {
  assert.equal(TONE_PRO.colours.length, 30);
  assert.equal(tonePro.length, 150);
  for (const p of tonePro) {
    assert.equal(p.brand, 'Warhammer Colour', p.id);
    assert.equal(p.type, 'layer', `${p.id}: opaque, so a flat colour (TONE_PRO.md §4)`);
    assert.equal(p.source, 'manufacturer', p.id);
    assert.equal(p.approx, true, `${p.id}: a chart is not an official value (CLAUDE.md §5.2)`);
    assert.equal(p.sourceUrl, TONE_PRO.source.url, p.id);
    assert.match(p.id, /^citadel-tone-pro-[a-z0-9-]+-[1-5]$/, 'the brand key stays citadel (§5.2)');
    assert.match(p.name, / [1-5]$/, 'the tone is part of the name: "Ultramar Blue 3"');
  }
  // every value in the input file reaches the data, under its family name and tone number
  for (const c of TONE_PRO.colours) c.tones.forEach((hex, i) => {
    const p = tonePro.find(q => q.name === `${c.name} ${i + 1}`);
    assert.ok(p, `${c.name} ${i + 1}`);
    assert.equal(p.hex, hex, p.name);
  });
});

test('Tone Pro: tone 1 is the darkest end and tone 5 the lightest, in every family', () => {
  const fams = {};
  for (const p of tonePro) (fams[p.name.replace(/ \d$/, '')] ||= [])[+p.name.slice(-1) - 1] = p;
  assert.equal(Object.keys(fams).length, 30);
  for (const [name, ps] of Object.entries(fams)) {
    const L = ps.map(p => p.lab[0]);
    assert.ok(L[0] < L[4], `${name}: tone 1 (L* ${L[0].toFixed(0)}) is darker than tone 5 (L* ${L[4].toFixed(0)})`);
  }
  // GW's chart draws Carmine Blades 2 lighter than 3 (a grey-brown and a crimson). Kept as drawn, not reordered:
  // the test fails if a rebuild changes it, so the note in SOURCES.md stays true.
  assert.ok(fams['Carmine Blades'][1].lab[0] > fams['Carmine Blades'][2].lab[0]);
});

test('Tone Pro: search finds the line, a family and one tone', () => {
  const line = real.paints.filter(matcher56('tone pro'));
  assert.ok(tonePro.every(p => line.includes(p)), '"tone pro" finds all 150');
  assert.deepEqual(searchPaints(real, 'ultramar blue').slice(0, 5).map(p => p.name),
    ['Ultramar Blue 1', 'Ultramar Blue 2', 'Ultramar Blue 3', 'Ultramar Blue 4', 'Ultramar Blue 5']);
  assert.equal(ids(searchPaints(real, 'ultramar blue 3'))[0], 'citadel-tone-pro-ultramar-blue-3');
  assert.equal(ids(searchPaints(real, 'citadel ultramar blue 3'))[0], 'citadel-tone-pro-ultramar-blue-3', 'the old brand word');
});

test('Tone Pro: every earlier paint keeps its id (saved shelves and links hold ids)', () => {
  for (const id of ['citadel-base-macragge-blue', 'citadel-layer-sotek-green', 'citadel-shade-cassandora-yellow'])
    assert.ok(real.byId.has(id), id);
  assert.equal(real.paints.length, 3375);
  assert.equal(new Set(real.paints.map(p => p.id)).size, real.paints.length, 'no id is used twice');
});

// ---- Tone Pro families (dataset 1.9.0; docs/TONE_LADDERS.md §6) ----
import { familyOf } from '../src/js/data.js';
test('Tone Pro families: 30 families of 5, tones 1–5 in order, named without the number', () => {
  const fams = new Set(tonePro.map(p => p.family));
  assert.equal(fams.size, 30);
  for (const p of tonePro) {
    assert.match(p.family, /^citadel-tone-pro-[a-z0-9-]+$/, p.id);
    assert.equal(p.tone, +p.name.slice(-1), `${p.id}: the tone is the name's number`);
  }
  const f = familyOf(real, real.byId.get('citadel-tone-pro-ultramar-blue-3'));
  assert.equal(f.name, 'Ultramar Blue');
  assert.deepEqual(f.tones.map(p => p.tone), [1, 2, 3, 4, 5]);
  assert.equal(familyOf(real, real.byId.get('citadel-base-macragge-blue')), null, 'a paint in no family');
  assert.equal(real.paints.filter(p => p.family).length, 150, 'only Tone Pro has families so far');
});
