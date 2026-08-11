import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livePalette, roleSlots, segmented, hero, paintStrip, popChips } from '../src/js/ui.js';

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

test('ladder steps: short visible name; full identity in the tip + aria-label', async () => {
  const { indexDataset } = await import('../src/js/data.js');
  const { buildScheme } = await import('../src/js/scheme.js');
  const { roleSlots } = await import('../src/js/ui.js');
  const idx = indexDataset({ version: 't', paints: [
    { id: 'c-layer-dawnstone', brand: 'Citadel', line: 'Layer', name: 'Dawnstone', hex: '#70746D', type: 'layer' },
    { id: 'c-dry-dawnstone', brand: 'Citadel', line: 'Dry', name: 'Dawnstone', hex: '#70746D', type: 'dry' },
  ] });
  const html = roleSlots(buildScheme(idx, '#70746D', 'shades', { ladder: 'wash' }), () => 'none');
  // visible row label = the SHORT name (no "(Layer)") — long qualifiers used to shove the row off-card
  assert.ok(html.includes('<div class="pn">Dawnstone</div>'), 'short name shown');
  // the full disambiguated identity is one tap/hover/focus away, and always spoken
  assert.ok(html.includes('<span class="celltip">Dawnstone (Layer) · Citadel</span>'), 'tip carries dname + brand');
  assert.ok(/aria-label="[^"]*Dawnstone \(Layer\), Citadel"/.test(html), 'aria-label carries the full identity');
  assert.ok(html.includes('tabindex="0"'), 'steps are keyboard-reachable');
});

test('seed docks: chip on the seeded role, switch dock on the other, reserved row everywhere', () => {
  const dockVm = [
    { id: 'p0', kind: 'base', deg: 0, hex: '#87146E', match: null, dock: { type: 'chip', name: 'Faerzress Purple', hex: '#87146E' } },
    { id: 'p1', kind: 'partner', deg: 180, hex: '#146E24', match: null, dock: { type: 'switch', target: 'accent' } },
    { id: 'metal', kind: 'metal', hex: '#C8A13A', match: null },
  ];
  const html = livePalette(dockVm, 'ideal', { '#87146E': 'Primary', '#146E24': 'Accent' });
  assert.ok(html.includes('class="seedchip"') && html.includes('Faerzress Purple'), 'chip renders with the pick name');
  assert.ok(html.includes('data-seeddock="accent"'), 'switch dock targets the other role');
  assert.equal((html.match(/class="lcdock"/g) || []).length, 3, 'every column reserves the dock row (no-jiggle)');
  // disabled dock (neutral) carries the why and no live target semantics
  const disabledVm = [{ id: 'p1', kind: 'partner', deg: 180, hex: '#146E24', match: null, dock: { type: 'switch', target: 'accent', disabled: 'A neutral seed always holds Primary' } }];
  const dhtml = livePalette(disabledVm, 'ideal', { '#146E24': 'Accent' });
  assert.ok(dhtml.includes('aria-disabled="true"') && dhtml.includes('always holds Primary'), 'neutral dock disabled with the why');
});

test('equivalents source chips + the Plan-card jump carry the right hooks', async () => {
  const { equivSourceChips } = await import('../src/js/ui.js');
  const html = equivSourceChips([
    { hex: '#9A1115', label: 'Primary' }, { hex: '#094C96', label: 'Secondary' }, { hex: '#C8A13A', label: 'Metal' },
  ], '#094C96');
  assert.equal((html.match(/class="eqchip"/g) || []).length, 3);
  assert.ok(html.includes('data-eqsrc="#9A1115"'), 'chips carry the source hex');
  assert.ok(/data-eqsrc="#094C96" aria-pressed="true"/.test(html), 'active chip pressed');
  // the Plan card's jump: one per role, targeting the role's ideal
  const { indexDataset } = await import('../src/js/data.js');
  const { buildScheme } = await import('../src/js/scheme.js');
  const idx = indexDataset({ version: 't', paints: [{ id: 'r', brand: 'A', line: '—', name: 'Red', hex: '#9A1115', type: 'layer' }] });
  const slots = roleSlots(buildScheme(idx, '#9A1115', 'complementary'), () => 'none');
  assert.equal((slots.match(/data-goequiv=/g) || []).length, 4, 'every role card gets the jump');
  assert.ok(slots.includes('data-goequiv="#9A1115"'), 'jump targets the role ideal');
});

test('popChips routes its swatch through safeColor — no inline-style exception (§ui.js:11)', () => {
  const on = popChips([{ hex: '#9C1626', name: 'Crimson' }], '#9c1626');
  assert.match(on, /background-color:#9C1626;/);        // background-color, so finish overlays can layer
  assert.doesNotMatch(on, /style="background:/);
  assert.match(on, /aria-pressed="true"/);              // matching the active pop is case-insensitive
  // A colour that never came from rgbToHex/normHex must not escape into the STYLE block (it may
  // still appear escaped in data-pop — an attribute, not a CSS sink).
  const bad = popChips([{ hex: 'red;background-image:url(x)', name: 'Bad' }], null);
  assert.match(bad, /style="background-color:#000000;"/);
  assert.doesNotMatch(bad, /style="[^"]*background-image/);
});
