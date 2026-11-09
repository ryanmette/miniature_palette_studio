import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexDataset } from '../src/js/data.js';
import { hexToLab, labToHex, labToRgb, deltaE2000 } from '../src/js/color.js';
import { MAP_BANDS, MAP_ROWS, GREY, bandOf, rowOf, mapCells, mapSummary, cellTargets, fillPots, minimapXY, bandAtXY } from '../src/js/shelfmap.js';

const idx = indexDataset(JSON.parse(readFileSync(new URL('../src/data/paints.json', import.meta.url))));
const byName = n => idx.paints.find(p => p.name === n && p.brand === 'Warhammer Colour' && (p.line === 'Base' || p.line === 'Layer'));

test('labToHex is the way back of hexToLab (within one sRGB unit)', () => {
  for (const hex of ['#9A1115', '#0B6371', '#FFFFFF', '#000000', '#7F7F7F', '#C2912F', '#123456']) {
    const back = labToHex(hexToLab(hex));
    assert.ok(deltaE2000(hexToLab(back), hexToLab(hex)) < 0.5, `${hex} → ${back}`);
  }
  assert.equal(labToRgb([50, 0, 0]).inGamut, true);
  assert.equal(labToRgb([50, 0, -120]).inGamut, false, 'a blue no screen shows');
});

test('bands follow the Browse order: 18 hue bands of 20° from 20°, greys apart; 5 lightness rows', () => {
  assert.equal(MAP_BANDS.length, 18);
  assert.equal(GREY, 18);
  assert.equal(bandOf([50, 0, 0]), GREY);
  assert.equal(bandOf([50, 3, 3]), GREY, 'C* under 6 is grey');
  assert.equal(bandOf(hexToLab('#9A1115')), 0, 'Mephiston Red is a red');
  assert.equal(MAP_BANDS[bandOf(byName('Macragge Blue').lab)], 'royalBlue');
  assert.equal(MAP_BANDS[bandOf(byName('Averland Sunset').lab)], 'ochre');
  assert.equal(rowOf([10, 0, 0]), 0);
  assert.equal(rowOf([29.9, 0, 0]), 0);
  assert.equal(rowOf([30, 0, 0]), 1);
  assert.equal(rowOf([99, 0, 0]), MAP_ROWS.length - 1);
});

test('mapCells places owned and to-buy paints only; mapSummary counts the tones with no owned paint', () => {
  const red = byName('Mephiston Red'), blue = byName('Macragge Blue'), white = idx.paints.find(p => p.name === 'White Scar');
  const marks = { [red.id]: 'owned', [blue.id]: 'want', [white.id]: 'owned' };
  const map = mapCells(idx.paints, id => marks[id] || 'none');
  assert.equal(map.owned, 2); assert.equal(map.want, 1); assert.equal(map.total, 3);
  assert.deepEqual(map.cells[bandOf(red.lab)][rowOf(red.lab)].owned.map(p => p.id), [red.id]);
  assert.deepEqual(map.cells[bandOf(blue.lab)][rowOf(blue.lab)].want.map(p => p.id), [blue.id]);
  const sum = mapSummary(map);
  assert.equal(sum.cellCount, 95);
  assert.equal(sum.emptyCells, 93, 'a paint to buy does not fill a gap');
  assert.equal(sum.familyCount, 18);
  assert.equal(sum.emptyFamilies, 17, 'only the reds have a paint; the greys are not a family');
});

test('every cell has a target colour, and a gap offers up to 3 opaque pots in that tone, not on the shelf, by true ΔE', () => {
  const targets = cellTargets(idx);
  assert.equal(targets.length, 19);
  for (const col of targets) for (const t of col) assert.match(t.hex, /^#[0-9A-F]{6}$/);
  assert.equal(cellTargets(idx), targets, 'worked out once per dataset');
  const b = MAP_BANDS.indexOf('teal'), r = 1;
  const pots = fillPots(idx, b, r);
  assert.ok(pots.length > 0 && pots.length <= 3);
  for (const m of pots) {
    assert.ok(['base', 'layer'].includes(m.paint.type));
    assert.ok(!m.paint.discontinued);
    assert.equal(bandOf(m.paint.lab), b); assert.equal(rowOf(m.paint.lab), r);
    assert.equal(m.deltaE, deltaE2000(targets[b][r].lab, m.paint.lab), 'the reported ΔE is the true one');
  }
  for (let i = 1; i < pots.length; i++) assert.ok(pots[i - 1].deltaE <= pots[i].deltaE);
  const again = fillPots(idx, b, r, { onShelf: new Set([pots[0].paint.id]) });
  assert.ok(!again.some(m => m.paint.id === pots[0].paint.id), 'a pot on the shelf is not offered');
});

test('the minimap places a colour by hue and strength, and a tap finds its band', () => {
  const [x, y] = minimapXY([50, 45, 0]);
  assert.ok(Math.abs(x - 0.5) < 1e-9 && Math.abs(y) < 1e-9, 'a* to the right');
  const [, yy] = minimapXY([50, 0, 200]);
  assert.equal(yy, -1, 'b* up, clipped at the rim');
  for (const p of [byName('Mephiston Red'), byName('Macragge Blue'), byName('Caliban Green')]) {
    const [px, py] = minimapXY(p.lab);
    assert.equal(bandAtXY(px, py), bandOf(p.lab), p.name);
  }
});
