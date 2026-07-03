// Unit tests for collection import/export (src/js/collection-io.js): parsing paintRack-style CSV files and
// matching their rows to real paints (by brand+name) to produce owned/want marks, plus the reverse export.
// Run under `node --test`. A tiny `idx` dataset provides the paints to match against.
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

// The CSV parser reads a header row and maps columns by name, so column ORDER doesn't matter — it normalises
// each row to {brand, name, status} regardless of layout.
test('parsePaintRackCsv reads a headered file, any column order', () => {
  const rows = parsePaintRackCsv('Name,Brand,Status\nMephiston Red,Citadel,owned\nBloody Red,Vallejo,wishlist\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { brand: 'Citadel', name: 'Mephiston Red', status: 'owned' });
  assert.equal(rows[1].status, 'wishlist');
});

// csvToMarks resolves each parsed row to a real paint id by brand+name and derives its mark from the status
// column ("owned" → owned, "wishlist" → want). It reports how many matched and which rows didn't.
test('csvToMarks matches by brand+name; status drives owned vs want', () => {
  const { marks, matched, unmatched } = csvToMarks(idx, 'Brand,Name,Status\nCitadel,Mephiston Red,owned\nVallejo,Bloody Red,wishlist\n');
  assert.equal(matched, 2);
  assert.equal(unmatched.length, 0);
  assert.deepEqual(marks.find(m => m.id === 'citadel-red'), { id: 'citadel-red', mark: 'owned' });
  assert.deepEqual(marks.find(m => m.id === 'vallejo-red'), { id: 'vallejo-red', mark: 'want' });
});

// Brand names are aliased (e.g. "Games Workshop" → Citadel) so common alternate spellings still match. Also:
// with no status column the file is treated as an inventory list, so rows default to "owned".
test('brand aliases resolve (Games Workshop → Citadel)', () => {
  const { marks } = csvToMarks(idx, 'Brand,Name\nGames Workshop,Mephiston Red\n');
  assert.equal(marks[0].id, 'citadel-red');
  assert.equal(marks[0].mark, 'owned');   // no status column → owned (it's an inventory list)
});

// If the brand is wrong/unknown, matching falls back to name-only (so a mislabelled row still resolves), and a
// row that matches nothing at all is returned in `unmatched` for the user to review.
test('name-only fallback + unmatched reporting', () => {
  const { marks, unmatched } = csvToMarks(idx, 'Brand,Name\nWrongBrand,Hydra Turquoise\nNobody,Made Up Paint\n');
  assert.equal(marks[0].id, 'army-teal');           // matched by name despite wrong brand
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].name, 'Made Up Paint');
});

// A header-less CSV is interpreted positionally as brand,name — supporting the simplest possible export.
test('positional CSV (no header) is treated as brand,name', () => {
  const { marks } = csvToMarks(idx, 'Citadel,Mephiston Red\n');
  assert.equal(marks[0].id, 'citadel-red');
});

// Full round-trip: exporting owned/want sets to CSV and re-importing reproduces the same owned/want marks —
// the export is lossless for collection state.
test('CSV round-trips: marksToCsv → csvToMarks preserves owned/want', () => {
  const csv = marksToCsv(idx, new Set(['citadel-red']), new Set(['vallejo-red']));
  const { marks } = csvToMarks(idx, csv);
  assert.equal(marks.find(m => m.id === 'citadel-red').mark, 'owned');
  assert.equal(marks.find(m => m.id === 'vallejo-red').mark, 'want');
});

// The parser honours standard CSV quoting: a quoted field may contain a comma without being split into two cells.
test('quoted fields with commas parse correctly', () => {
  const rows = parsePaintRackCsv('Brand,Name\nCitadel,"Red, Mephiston"\n');
  assert.equal(rows[0].name, 'Red, Mephiston');
});
