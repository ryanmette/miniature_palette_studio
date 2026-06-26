import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexDataset } from '../src/js/data.js';
import { parsePaintRackCsv, csvToMarks, marksToCsv } from '../src/js/collection-io.js';

const idx = indexDataset({
  version: 'test',
  paints: [
    { id: 'citadel-red', brand: 'Citadel', line: 'Base', name: 'Mephiston Red', hex: '#9A1115', type: 'base' },
    { id: 'vallejo-red', brand: 'Vallejo', line: 'Game Color', name: 'Bloody Red', hex: '#A01418', type: 'layer' },
    { id: 'army-teal', brand: 'Army Painter', line: 'Warpaints', name: 'Hydra Turquoise', hex: '#1E939C', type: 'layer' },
  ],
});

test('parsePaintRackCsv reads a headered file, any column order', () => {
  const rows = parsePaintRackCsv('Name,Brand,Status\nMephiston Red,Citadel,owned\nBloody Red,Vallejo,wishlist\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { brand: 'Citadel', name: 'Mephiston Red', status: 'owned' });
  assert.equal(rows[1].status, 'wishlist');
});

test('csvToMarks matches by brand+name; status drives owned vs want', () => {
  const { marks, matched, unmatched } = csvToMarks(idx, 'Brand,Name,Status\nCitadel,Mephiston Red,owned\nVallejo,Bloody Red,wishlist\n');
  assert.equal(matched, 2);
  assert.equal(unmatched.length, 0);
  assert.deepEqual(marks.find(m => m.id === 'citadel-red'), { id: 'citadel-red', mark: 'owned' });
  assert.deepEqual(marks.find(m => m.id === 'vallejo-red'), { id: 'vallejo-red', mark: 'want' });
});

test('brand aliases resolve (Games Workshop → Citadel)', () => {
  const { marks } = csvToMarks(idx, 'Brand,Name\nGames Workshop,Mephiston Red\n');
  assert.equal(marks[0].id, 'citadel-red');
  assert.equal(marks[0].mark, 'owned');   // no status column → owned (it's an inventory list)
});

test('name-only fallback + unmatched reporting', () => {
  const { marks, unmatched } = csvToMarks(idx, 'Brand,Name\nWrongBrand,Hydra Turquoise\nNobody,Made Up Paint\n');
  assert.equal(marks[0].id, 'army-teal');           // matched by name despite wrong brand
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].name, 'Made Up Paint');
});

test('positional CSV (no header) is treated as brand,name', () => {
  const { marks } = csvToMarks(idx, 'Citadel,Mephiston Red\n');
  assert.equal(marks[0].id, 'citadel-red');
});

test('CSV round-trips: marksToCsv → csvToMarks preserves owned/want', () => {
  const csv = marksToCsv(idx, new Set(['citadel-red']), new Set(['vallejo-red']));
  const { marks } = csvToMarks(idx, csv);
  assert.equal(marks.find(m => m.id === 'citadel-red').mark, 'owned');
  assert.equal(marks.find(m => m.id === 'vallejo-red').mark, 'want');
});

test('quoted fields with commas parse correctly', () => {
  const rows = parsePaintRackCsv('Brand,Name\nCitadel,"Red, Mephiston"\n');
  assert.equal(rows[0].name, 'Red, Mephiston');
});
