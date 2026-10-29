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

test('search "citadel metallic": every word narrows the list', () => {
  const res = searchPaints(real, 'citadel metallic');
  assert.ok(res.length > 10);
  for (const p of res) assert.equal(p.brand, 'Citadel', p.id);
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

test('browseOrder "hue": round the wheel in 15° bands, light to dark in a band, the greys last', () => {
  const res = browseOrder(real, 'hue');
  const chroma = p => Math.hypot(p.lab[1], p.lab[2]);
  const firstGrey = res.findIndex(p => chroma(p) < GREY_CHROMA);
  assert.ok(firstGrey > 0);
  assert.ok(res.slice(firstGrey).every(p => chroma(p) < GREY_CHROMA));        // no colour after the greys
  const band = p => Math.floor(rgbToHsl(hexToRgb(p.hex))[0] / 15);
  const colours = res.slice(0, firstGrey);
  for (let i = 1; i < colours.length; i++) {
    const a = colours[i - 1], b = colours[i];
    assert.ok(band(a) < band(b) || (band(a) === band(b) && a.lab[0] >= b.lab[0]), `${a.id} → ${b.id}`);
  }
  const greys = res.slice(firstGrey);
  for (let i = 1; i < greys.length; i++) assert.ok(greys[i - 1].lab[0] >= greys[i].lab[0]);
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
  const owned = new Set(real.paints.filter(p => p.brand === 'Citadel').slice(0, 3).map(p => p.id));
  const res = browseOrder(real, 'owned', { ownedIds: owned });
  assert.deepEqual(new Set(ids(res.slice(0, 3))), owned);
  const byName = browseOrder(real, 'name').map(p => p.dname || p.name);
  for (let i = 1; i < byName.length; i++) assert.ok(byName[i - 1].localeCompare(byName[i]) <= 0);
  assert.ok(byName.indexOf('Dawnstone (Dry)') < byName.indexOf('Dawnstone (Layer)'));
});
