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

test('Primary flags an honest substitution when filters replace the picked paint', () => {
  // "only owned" pool that does NOT include the picked paint
  const owned = new Set(['c-teal']);
  const s = buildScheme(fx, '#9A1115', 'complementary', { ownedIds: owned, seed: { id: 'c-red', name: 'Mephiston Red', hex: '#9A1115' } });
  const primary = s.roles.find(r => r.role === 'Primary');
  assert.ok(primary.substituted, 'substitution flagged');
  assert.equal(primary.substituted.name, 'Mephiston Red');
  assert.equal(primary.substituted.why, 'not owned');
  // no filters → the pick matches itself → no flag
  const clean = buildScheme(fx, '#9A1115', 'complementary', { seed: { id: 'c-red', name: 'Mephiston Red', hex: '#9A1115' } });
  assert.equal(clean.roles.find(r => r.role === 'Primary').substituted, null);
});

test('a picked metallic is exempt from the colour-role demote (keeps its own slot)', () => {
  const midx = indexDataset({ version: 't', paints: [
    { id: 'pick-metal', brand: 'T', line: 'L', name: 'Elven Armour', hex: '#2D567C', type: 'metal' },
    { id: 'near-flat', brand: 'T', line: 'L', name: 'Blue', hex: '#2E577D', type: 'layer' },
  ] });
  const s = buildScheme(midx, '#2D567C', 'complementary',
    { demoteTypes: new Set(['metal']), demoteAmount: 4, seed: { id: 'pick-metal', name: 'Elven Armour', hex: '#2D567C' } });
  const primary = s.roles.find(r => r.role === 'Primary');
  assert.equal(primary.match.paint.id, 'pick-metal');   // the pick wins despite the demote
  assert.equal(primary.substituted, null);
});

test('accent-seed mode: the Accent slot gets the tie-break + honesty note too', () => {
  // base = complement of the pick → the Accent ideal IS the pick hex
  const twins = indexDataset({ version: 't', paints: [
    { id: 'dry-twin', brand: 'C', line: 'Dry', name: 'Hoeth Blue', hex: '#4C78AF', type: 'dry' },
    { id: 'layer-pick', brand: 'C', line: 'Layer', name: 'Hoeth Blue', hex: '#4C78AF', type: 'layer' },
    { id: 'far', brand: 'C', line: 'Base', name: 'Far Red', hex: '#9A1115', type: 'base' },
  ] });
  const base = '#AF834C';   // rotateHue('#4C78AF', 180)
  const tie = buildScheme(twins, base, 'complementary', { seed: { id: 'layer-pick', name: 'Hoeth Blue (Layer)', hex: '#4C78AF' } });
  assert.equal(tie.roles.find(r => r.role === 'Accent').match.paint.id, 'layer-pick');   // pick wins the twin tie
  const only = buildScheme(twins, base, 'complementary',
    { ownedIds: new Set(['far']), seed: { id: 'layer-pick', name: 'Hoeth Blue (Layer)', hex: '#4C78AF' } });
  const acc = only.roles.find(r => r.role === 'Accent');
  assert.ok(acc.substituted && acc.substituted.why === 'not owned');   // honest note on the accent path
});

test('Metal role carries an NMM ladder of flat paints (no metallics, no finishes)', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary');
  const metal = s.roles.find(r => r.role === 'Metal');
  assert.ok(Array.isArray(metal.nmm) && metal.nmm.length === 3);
  assert.deepEqual(metal.nmm.map(x => x.key), ['shadow', 'mid', 'highlight']);
  for (const st of metal.nmm) if (st.match) assert.notEqual(st.match.paint.type, 'metal');
  assert.equal(s.roles.find(r => r.role === 'Primary').nmm, null);   // NMM is metal-only
});

test('neutral roles lead with the temperature ladder (Cool · base · warm); hue roles do not', () => {
  const s = buildScheme(fx, '#1B1B1F', 'neutral-pop', { pop: '#9C1626' });
  const primary = s.roles.find(r => r.role === 'Primary');
  assert.equal(primary.ladders[0].style, 'temp');
  assert.deepEqual(primary.ladders[0].steps.map(x => x.key), ['cool', 'base', 'warm']);
  assert.ok(primary.ladders.length >= 2);   // the selected value ladder still follows
  const accent = s.roles.find(r => r.role === 'Accent');   // the pop is saturated → no temp ladder
  assert.notEqual(accent.ladders[0].style, 'temp');
  const hue = buildScheme(fx, '#9A1115', 'complementary');
  assert.notEqual(hue.roles.find(r => r.role === 'Primary').ladders[0].style, 'temp');
});

test('wash step prefers real wash/shade/ink media; falls back flagged "dilute" when none close', () => {
  const withWash = indexDataset({ version: 't', paints: [
    { id: 'base-red', brand: 'T', line: 'L', name: 'Red', hex: '#9A1115', type: 'base' },
    { id: 'red-shade', brand: 'T', line: 'S', name: 'Crimson Shade', hex: '#5E0A0D', type: 'shade' },
  ] });
  const s1 = buildScheme(withWash, '#9A1115', 'complementary');
  const w1 = s1.roles.find(r => r.role === 'Primary').ladders.find(l => l.style === 'wash').steps.find(st => st.key === 'wash');
  assert.equal(w1.match.paint.id, 'red-shade');   // the real shading medium wins the wash step
  assert.equal(w1.media, 'wash');
  assert.ok(!w1.dilute);

  const noWash = indexDataset({ version: 't', paints: [
    { id: 'base-red', brand: 'T', line: 'L', name: 'Red', hex: '#9A1115', type: 'base' },
    { id: 'far-shade', brand: 'T', line: 'S', name: 'Blue Shade', hex: '#0A0D5E', type: 'shade' },   // way off
  ] });
  const s2 = buildScheme(noWash, '#9A1115', 'complementary');
  const w2 = s2.roles.find(r => r.role === 'Primary').ladders.find(l => l.style === 'wash').steps.find(st => st.key === 'wash');
  assert.ok(w2.dilute, 'no close medium → watered-down fallback');
  assert.notEqual(w2.match.paint.type, 'shade');  // fallback is the darkened-base match, not the far medium
});

test('shared-paint differentiate points the PAINT toward the role ideal (arg order)', async () => {
  const { adjustDirection } = await import('../src/js/color.js');
  // One flat paint + one metal, colour roles metal-excluded → every colour role shares the red.
  const pool = indexDataset({ version: 't', paints: [
    { id: 'only-red', brand: 'A', line: '—', name: 'Only Red', hex: '#8A1010', type: 'layer' },
    { id: 'steel', brand: 'A', line: '—', name: 'Steel', hex: '#8A8F94', type: 'metal' },
  ] });
  const s = buildScheme(pool, '#8A1010', 'shades', { excludeTypes: new Set(['metal']) });
  const shared = s.roles.find(r => r.shared && r.differentiate);
  assert.ok(shared, 'a shared colour role with advice exists');
  // The hint is the direction to move the REUSED PAINT toward this role's ideal — reversed args
  // (the old bug) invert it (says darken when the painter should lighten).
  assert.equal(shared.differentiate, adjustDirection(shared.idealHex, shared.match.paint.hex));
  assert.notEqual(adjustDirection(shared.idealHex, shared.match.paint.hex),
    adjustDirection(shared.match.paint.hex, shared.idealHex));   // fixture must distinguish the orders
});

test('ladder base rung reuses the headline match; shopping list includes it', () => {
  // Primary takes the nearest red; Secondary's headline is the distinct second-nearest. The ladder's
  // un-adjusted base rung must show that SAME paint (a re-search without excludeIds used to resolve
  // back to Primary's paint), and the exported list must include the headline paint.
  // red1 is strictly nearest to Secondary's ideal too (ΔE 12.5 vs 16.7) — so the old code's
  // un-excluded base-rung re-search resolved to red1 while the headline showed red2.
  const pool = indexDataset({ version: 't', paints: [
    { id: 'red1', brand: 'A', line: '—', name: 'Red One', hex: '#9A1115', type: 'layer' },
    { id: 'red2', brand: 'A', line: '—', name: 'Red Two', hex: '#B8323B', type: 'layer' },
  ] });
  const s = buildScheme(pool, '#9A1115', 'monochromatic', { ladder: 'wash' });
  const secondary = s.roles.find(r => r.role === 'Secondary');
  assert.equal(secondary.match.paint.id, 'red2');            // headline: distinct assignment
  assert.equal(secondary.shared, false);
  const base = secondary.ladders.at(-1).steps.find(st => st.key === 'base');
  assert.equal(base.match.paint.id, 'red2');                 // base rung agrees with the card headline
  assert.ok(shoppingList(s).some(row => row.name === 'Red Two'),
    'export includes the Secondary card headline paint');
});

test('a wash step with NO eligible fallback renders as no-paint, never "watered down"', () => {
  // Owned-only pool containing a single metallic, metals excluded from colour roles: the wash-media
  // search AND the fallback both come up empty — dilute:true here told the user to thin a paint
  // that doesn't exist.
  const pool = indexDataset({ version: 't', paints: [
    { id: 'steel', brand: 'A', line: '—', name: 'Steel', hex: '#8A8F94', type: 'metal' },
  ] });
  const s = buildScheme(pool, '#9A1115', 'complementary',
    { ladder: 'wash', ownedIds: new Set(['steel']), excludeTypes: new Set(['metal']) });
  const primary = s.roles.find(r => r.role === 'Primary');
  const wash = primary.ladders.at(-1).steps.find(st => st.key === 'wash');
  assert.equal(wash.match, null);
  assert.ok(!wash.dilute, 'no dilute tag without a paint to dilute');
});
