import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexDataset } from '../src/js/data.js';
import { buildScheme, metalIdeal, shoppingList, schemeGaps, roleIdeals } from '../src/js/scheme.js';

const fx = indexDataset({
  version: 'test',
  paints: [
    { id: 'c-red', brand: 'Citadel', line: 'Base', name: 'Mephiston Red', hex: '#9A1115', type: 'base' },
    { id: 'v-red', brand: 'Vallejo', line: 'Game Color', name: 'Bloody Red', hex: '#A01418', type: 'layer' },
    { id: 'c-teal', brand: 'Citadel', line: 'Layer', name: 'Sotek Green', hex: '#0B6371', type: 'layer' },
    { id: 'c-blue', brand: 'Citadel', line: 'Base', name: 'Macragge Blue', hex: '#2D567C', type: 'base' },
    { id: 'c-gold', brand: 'Citadel', line: 'Base', name: 'Auric Armour Gold', hex: '#C8A13A', type: 'metal' },
    { id: 'c-silver', brand: 'Citadel', line: 'Layer', name: 'Runefang Steel', hex: '#C2C8CC', type: 'metal' },
    { id: 'c-darkred', brand: 'Citadel', line: 'Base', name: 'Khorne Red', hex: '#650001', type: 'base' },
    { id: 'c-pink', brand: 'Citadel', line: 'Layer', name: 'Pink Horror', hex: '#8E2757', type: 'layer' },
  ],
});

test('buildScheme yields 4 roles; Primary = base; nearest is itself', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary');
  assert.equal(s.roles.length, 4);
  assert.deepEqual(s.roles.map(r => r.role), ['Primary', 'Secondary', 'Accent', 'Metal']);
  assert.equal(s.roles[0].idealHex, '#9A1115');
  assert.equal(s.roles[0].match.paint.id, 'c-red');
});

test('custom harmony (no partners) still yields 4 roles without crashing', () => {
  const s = buildScheme(fx, '#9A1115', 'custom');
  assert.equal(s.roles.length, 4);
  assert.equal(s.roles[0].idealHex, '#9A1115');
  assert.ok(s.roles[2].idealHex && s.roles[2].idealHex !== s.roles[0].idealHex);  // accent falls back to a rotation, not undefined
});

test('default ladder is wash·base·highlight, each step matched', () => {
  const s = buildScheme(fx, '#2D567C', 'triadic');
  assert.equal(s.ladder, 'wash');
  for (const r of s.roles) {
    assert.equal(r.ladders.length, 1);
    assert.deepEqual(r.ladders[0].steps.map(x => x.key), ['wash', 'base', 'highlight']);
    for (const st of r.ladders[0].steps) assert.ok(st.idealHex && st.match);
  }
  // the 'base' step's ideal is the role ideal itself (unadjusted)
  assert.equal(s.roles[0].ladders[0].steps[1].idealHex, s.roles[0].idealHex);
});

test('tone ladder = shadow·mid·highlight; both = two ladders', () => {
  const tone = buildScheme(fx, '#2D567C', 'triadic', { ladder: 'tone' });
  assert.equal(tone.ladder, 'tone');
  assert.deepEqual(tone.roles[0].ladders[0].steps.map(x => x.key), ['shadow', 'mid', 'highlight']);
  const both = buildScheme(fx, '#2D567C', 'triadic', { ladder: 'both' });
  assert.deepEqual(both.roles[0].ladders.map(l => l.style), ['wash', 'tone']);
});

test('metal slot resolves to a metal-typed paint', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary');
  assert.equal(s.roles[3].match.paint.type, 'metal');
});

test('metalIdeal heuristic (warm→gold, cool→silver)', () => {
  assert.equal(metalIdeal('#9A1115'), '#C8A13A');
  assert.equal(metalIdeal('#2D567C'), '#B5B5BD');
});

test('owned filter restricts matches', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary', { ownedIds: new Set(['v-red', 'c-gold']) });
  assert.equal(s.roles[0].match.paint.id, 'v-red');
  assert.equal(s.roles[3].match.paint.id, 'c-gold');
});

test('distinct role assignment: a tiny owned pool flags reuse as shared + offers a buy', () => {
  // Own only ONE red and the gold. Primary takes the red; Secondary/Accent can't get a distinct owned
  // colour → they reuse it but are flagged shared, with a differentiate hint + a nearest distinct buy.
  const s = buildScheme(fx, '#9A1115', 'complementary', { ownedIds: new Set(['c-red', 'c-gold']) });
  assert.equal(s.roles[0].match.paint.id, 'c-red');
  assert.equal(s.roles[0].shared, false);
  const shared = s.roles.slice(0, 3).filter(r => r.shared);   // 3 colour roles, only 2 owned → ≥1 reuse
  assert.ok(shared.length >= 1, 'a colour role is flagged shared when the owned pool is too small');
  for (const r of shared) {
    assert.equal(typeof r.differentiate, 'string');
    assert.ok(r.buy && r.buy.paint.id !== r.match.paint.id);  // a distinct paint to buy (full catalogue)
    if (r.role === 'Metal') assert.equal(r.buy.paint.type, 'metal');  // metal role's buy stays a metallic
  }
});

test('full pool assigns distinct paints per colour role (no accidental reuse)', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary');
  const colourIds = s.roles.slice(0, 3).map(r => r.match && r.match.paint.id).filter(Boolean);
  assert.equal(colourIds.length, new Set(colourIds).size);
  assert.ok(s.roles.slice(0, 3).every(r => !r.shared));
});

test('shoppingList flattens roles + ladders (deduped by paint)', () => {
  const list = shoppingList(buildScheme(fx, '#9A1115', 'complementary'));
  assert.ok(list.length >= 4);
  assert.ok(list.every(r => r.name && r.brand && typeof r.deltaE === 'number'));
  const ids = list.map(r => r.hex + r.name);
  assert.equal(ids.length, new Set(ids).size);   // no duplicate paints
});

test('schemeGaps lists distinct unowned paints; excludes owned', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary');
  const all = schemeGaps(s);
  assert.ok(all.length >= 1);
  const ownedOne = all[0].paint.id;
  const fewer = schemeGaps(s, new Set([ownedOne]));
  assert.ok(fewer.length < all.length);
  assert.ok(!fewer.some(g => g.paint.id === ownedOne));
});

test('roleIdeals: neutral seed + neutral-pop → Primary = seed, Accent = pop, gunmetal Metal', () => {
  const defs = roleIdeals('#1B1B1F', 'neutral-pop', '#9C1626');
  const by = Object.fromEntries(defs.map(d => [d.role, d.idealHex]));
  assert.equal(by.Primary, '#1B1B1F');       // the neutral holds Primary
  assert.equal(by.Accent, '#9C1626');        // the pop is the ΔE-furthest partner → Accent
  assert.notEqual(by.Secondary, by.Accent);  // bridge grey is distinct
  assert.equal(by.Metal, '#6E7177');         // a neutral has no hue temperature → always gunmetal
});

test('roleIdeals: pop default + hue path unchanged for a saturated seed', () => {
  const defs = roleIdeals('#1B1B1F', 'neutral-pop');            // no pop given → DEFAULT_POP
  assert.equal(defs.find(d => d.role === 'Accent').idealHex, '#9C1626');
  const hue = roleIdeals('#9A1115', 'complementary');           // saturated seed: existing behaviour intact
  assert.equal(hue.find(d => d.role === 'Primary').idealHex, '#9A1115');
  assert.notEqual(hue.find(d => d.role === 'Metal').idealHex, '#6E7177');  // warm seed → gold, not gunmetal
});

test('buildScheme threads opts.pop through to the roles', () => {
  const s = buildScheme(fx, '#1B1B1F', 'duotone', { pop: '#0F6B6E' });
  assert.equal(s.roles.find(r => r.role === 'Accent').idealHex, '#0F6B6E');
});
