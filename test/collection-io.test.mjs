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
  assert.deepEqual(rows[0], { brand: 'Citadel', name: 'Mephiston Red', status: 'owned', qty: '' });
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

test('headerless row containing a header TOKEN is not sniffed as a header', () => {
  // 'The Army Painter' contains the substring 'paint' — substring sniffing used to treat the first
  // data row as a header, dropping the paint and misreading every remaining row's columns.
  const { marks, matched, unmatched } = csvToMarks(idx, 'The Army Painter,Hydra Turquoise\n');
  assert.equal(matched, 1);
  assert.equal(unmatched.length, 0);
  assert.deepEqual(marks[0], { id: 'army-teal', mark: 'owned' });
});

test('brand+name twins round-trip through export → import (dname keys)', () => {
  const twins = indexDataset({ version: 't', paints: [
    { id: 'c-layer-dawnstone', brand: 'Citadel', line: 'Layer', name: 'Dawnstone', hex: '#70746D', type: 'layer' },
    { id: 'c-dry-dawnstone', brand: 'Citadel', line: 'Dry', name: 'Dawnstone', hex: '#70746D', type: 'dry' },
  ] });
  const csv = marksToCsv(twins, ['c-layer-dawnstone'], ['c-dry-dawnstone']);
  assert.ok(csv.includes('Dawnstone (Layer)') && csv.includes('Dawnstone (Dry)'),
    'export disambiguates twins');   // identical rows used to collapse to one paint on re-import
  const { marks, matched } = csvToMarks(twins, csv);
  assert.equal(matched, 2);
  assert.deepEqual(marks.find(m => m.id === 'c-layer-dawnstone'), { id: 'c-layer-dawnstone', mark: 'owned' });
  assert.deepEqual(marks.find(m => m.id === 'c-dry-dawnstone'), { id: 'c-dry-dawnstone', mark: 'want' });
});

test('v2: the CSV carries the count and the project; the count round-trips, the project is for people', () => {
  const csv = marksToCsv(idx, ['citadel-red'], ['vallejo-red', 'army-teal'], {
    qtyOf: id => (id === 'vallejo-red' ? 3 : 1),
    projectName: id => (id === 'vallejo-red' ? 'Plague Marine, again' : ''),
  });
  assert.equal(csv.split('\n')[0], 'brand,name,status,qty,project');
  assert.ok(csv.includes('Citadel,Mephiston Red,owned,,\n'), 'an owned paint has no count or project');
  assert.ok(csv.includes('Vallejo,Bloody Red,wishlist,3,"Plague Marine, again"\n'), 'a name with a comma is quoted');
  assert.ok(csv.includes('Army Painter,Hydra Turquoise,wishlist,1,\n'));
  const { marks } = csvToMarks(idx, csv);
  assert.deepEqual(marks.find(m => m.id === 'vallejo-red'), { id: 'vallejo-red', mark: 'want', qty: 3 });
  assert.deepEqual(marks.find(m => m.id === 'army-teal'), { id: 'army-teal', mark: 'want' }, 'one pot: no qty');
  assert.deepEqual(marks.find(m => m.id === 'citadel-red'), { id: 'citadel-red', mark: 'owned' });
});

test('v2: marksToCsv without the count and project functions writes one pot, no project', () => {
  const csv = marksToCsv(idx, [], ['vallejo-red']);
  assert.ok(csv.includes('Vallejo,Bloody Red,wishlist,1,\n'));
});

test('v2: a file whose only marker column is "qty" still reads it as the status, as before', () => {
  const rows = parsePaintRackCsv('Brand,Name,Qty\nCitadel,Mephiston Red,2\n');
  assert.equal(rows[0].status, '2');
  assert.equal(rows[0].qty, '', 'not read twice');
  const { marks } = csvToMarks(idx, 'Brand,Name,Qty\nCitadel,Mephiston Red,2\n');
  assert.deepEqual(marks[0], { id: 'citadel-red', mark: 'owned' });
});

test('v2: a count on an owned row, or one that is not a whole number, is ignored', () => {
  const { marks } = csvToMarks(idx, 'brand,name,status,qty\nCitadel,Mephiston Red,owned,4\nVallejo,Bloody Red,wishlist,2.5\nArmy Painter,Hydra Turquoise,wishlist,lots\n');
  assert.deepEqual(marks.map(m => m.qty), [undefined, undefined, undefined]);
});
