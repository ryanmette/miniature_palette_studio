import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livePalette, roleSlots, segmented, hero, paintStrip } from '../src/js/ui.js';

const vm = [
  { id: 'p0', kind: 'base', deg: 0, hex: '#9A1115', match: null },
  { id: 'p1', kind: 'partner', deg: 180, hex: '#11979A', match: null },
  { id: 'x0', kind: 'free', deg: null, hex: '#445566', match: null },
  { id: 'metal', kind: 'metal', hex: '#C8A13A', match: null },
];

test('livePalette tags every column with its ideal hex (data-hex), linkable both ways', () => {
  const html = livePalette(vm, 'ideal');
  for (const hex of ['#9A1115', '#11979A', '#445566', '#C8A13A']) assert.match(html, new RegExp(`data-hex="${hex}"`));
});

test('livePalette labels columns by role when a roleByHex map is supplied (unified with the Plan)', () => {
  const roleByHex = { '#9A1115': 'Primary', '#11979A': 'Accent', '#C8A13A': 'Metal' };
  const html = livePalette(vm, 'ideal', roleByHex);
  assert.match(html, /class="lctag">Primary</);   // base column reads as its role, not "Base"
  assert.match(html, /class="lctag">Accent</);
  assert.match(html, /class="lctag">Metal</);
  assert.match(html, /class="lctag">Added</);     // free/extra colour keeps its node tag
});

test('livePalette Metal column is display-only (no edit/lock/add controls)', () => {
  const html = livePalette(vm, 'ideal', { '#C8A13A': 'Metal' });
  // the metal column carries the display class and no per-swatch action buttons
  assert.match(html, /class="lcol display"/);
  const metalCol = html.slice(html.indexOf('data-hex="#C8A13A"'));
  assert.doesNotMatch(metalCol.slice(0, metalCol.indexOf('</div>')), /data-edit|data-lock|data-setbase/);
});

test('roleSlots tags each role card with data-hex for the colour link', () => {
  const scheme = { roles: [
    { role: 'Primary', weight: '~60%', idealHex: '#9A1115', match: null, shared: false, ladders: [] },
    { role: 'Metal', weight: 'spot', idealHex: '#C8A13A', match: null, shared: false, ladders: [] },
  ] };
  const html = roleSlots(scheme, () => 'none');
  assert.match(html, /class="slot" data-hex="#9A1115"/);
  assert.match(html, /class="slot" data-hex="#C8A13A"/);
});

test('hero badges the picked paint with its seed role (main/accent)', () => {
  const base = { id: 'c-red', hex: '#9A1115', name: 'Mephiston Red', brand: 'Citadel', line: 'Base', type: 'base' };
  assert.match(hero(base, false, () => 'none', 'main'), /class="seedbadge seed-main">main</);
  assert.match(hero(base, false, () => 'none', 'accent'), /class="seedbadge seed-accent">accent</);
  assert.doesNotMatch(hero(base, false, () => 'none'), /seedbadge/);
});

test('paintStrip renders chips with id, selection, and owned/to-buy badges', () => {
  const paints = [
    { id: 'a', hex: '#9A1115', name: 'Red', brand: 'Citadel', line: 'Base', type: 'base' },
    { id: 'b', hex: '#11979A', name: 'Teal', brand: 'Vallejo', line: '—', type: 'layer' },
  ];
  const html = paintStrip(paints, 'a', id => (id === 'a' ? 'owned' : id === 'b' ? 'want' : 'none'));
  assert.match(html, /class="pchip"[^>]*data-id="a"[^>]*aria-selected="true"/);
  assert.match(html, /data-id="b"[^>]*aria-selected="false"/);
  assert.match(html, /cbadge owned/);    // owned state badge on a
  assert.match(html, /cbadge want/);     // to-buy state badge on b
  assert.match(html, /class="pchip-nm">Red</);
});

test('segmented marks exactly one harmony active', () => {
  const html = segmented(['complementary', 'analogous', 'triadic'], 'analogous');
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /data-h="analogous"[^>]*aria-pressed="true"/);
});
