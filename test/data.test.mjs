import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexDataset, nearestPaint, nearestPaints, equivalents, matchQuality } from '../src/js/data.js';

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

test('matchQuality boundary labels (CLAUDE.md §3.2)', () => {
  assert.equal(matchQuality(0.5).label, 'Indistinguishable');
  assert.equal(matchQuality(2).label, 'Excellent');
  assert.equal(matchQuality(3.5).label, 'Good');
  assert.equal(matchQuality(4).label, 'Fair');
  assert.equal(matchQuality(8).label, 'Loose');
  assert.equal(matchQuality(15).label, 'Poor');
});
