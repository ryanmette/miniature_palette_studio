import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteOverview, livePalette, segmented, hero } from '../src/js/ui.js';

// paletteOverview: each role block must carry data-hex so the colour-link highlight (app.js
// linkHighlight) can ring the matching wheel node + live-palette column on the left.
test('paletteOverview tags each role block with its ideal hex (data-hex)', () => {
  const scheme = { roles: [
    { role: 'Primary', idealHex: '#9A1115' },
    { role: 'Accent', idealHex: '#11979A' },
  ] };
  const html = paletteOverview(scheme);
  assert.match(html, /data-hex="#9A1115"/);
  assert.match(html, /data-hex="#11979A"/);
  // data-copy stays too — the block still copies on click.
  assert.match(html, /data-copy="#9A1115"/);
});

const vm = [
  { id: 'p0', kind: 'base', deg: 0, hex: '#9A1115', match: null },
  { id: 'p1', kind: 'partner', deg: 180, hex: '#11979A', match: null },
  { id: 'x0', kind: 'free', deg: null, hex: '#445566', match: null },
];

test('livePalette tags every column with its ideal hex (data-hex), linkable both ways', () => {
  const html = livePalette(vm, 'ideal');
  assert.match(html, /data-hex="#9A1115"/);
  assert.match(html, /data-hex="#11979A"/);
  assert.match(html, /data-hex="#445566"/);
});

// The Main/Accent role badge lives on the HERO swatch (your picked paint) — true in both seed modes,
// unlike the live-palette "Base" column which is always the scheme's main.
test('hero badges the picked paint with its seed role (main/accent)', () => {
  const base = { id: 'c-red', hex: '#9A1115', name: 'Mephiston Red', brand: 'Citadel', line: 'Base', type: 'base' };
  assert.match(hero(base, false, () => 'none', 'main'), /class="seedbadge seed-main">main</);
  assert.match(hero(base, false, () => 'none', 'accent'), /class="seedbadge seed-accent">accent</);
  // no seedRole → no badge (back-compatible default)
  assert.doesNotMatch(hero(base, false, () => 'none'), /seedbadge/);
});

test('segmented marks exactly one harmony active', () => {
  const html = segmented(['complementary', 'analogous', 'triadic'], 'analogous');
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /data-h="analogous"[^>]*aria-pressed="true"/);
});
