import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexDataset } from '../src/js/data.js';
import { buildScheme, metalIdeal, shoppingList } from '../src/js/scheme.js';

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

test('buildScheme yields 4 roles; Body = base; nearest is itself', () => {
  const s = buildScheme(fx, '#9A1115', 'complementary');
  assert.equal(s.roles.length, 4);
  assert.deepEqual(s.roles.map(r => r.role), ['Body', 'Secondary', 'Accent', 'Metal']);
  assert.equal(s.roles[0].idealHex, '#9A1115');
  assert.equal(s.roles[0].match.paint.id, 'c-red');
});

test('each role carries wash + highlight ladders with matches', () => {
  const s = buildScheme(fx, '#2D567C', 'triadic');
  for (const r of s.roles) { assert.ok(r.wash.idealHex && r.highlight.idealHex); }
  assert.ok(s.roles[0].wash.match && s.roles[0].highlight.match);
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

test('shoppingList flattens roles + ladders', () => {
  const list = shoppingList(buildScheme(fx, '#9A1115', 'complementary'));
  assert.ok(list.length >= 4);
  assert.ok(list.every(r => r.name && r.brand && typeof r.deltaE === 'number'));
});
