import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livePalette, roleSlots, shelfEmpty, shelfGrid, matchChip, holdControls, holdNote, potRows, segmented, hero, pickTile, pickRow, pickUseRow, pickGroup, menuTitle, popChips, matchNote, planControls } from '../src/js/ui.js';

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
  assert.match(html, /class="lctag">Extra</);     // free/extra colour keeps its node tag
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

// the seed field's list (picker.js): the tiles of the browse grid, the rows of a search, the hex row
const tk = (k, v) => (v ? `${k}:${Object.values(v).join('|')}` : k);   // a stand-in for i18n.t: shows the key
const RED = { id: 'a', hex: '#9A1115', name: 'Red', dname: 'Red', brand: 'Citadel', line: 'Base', type: 'base' };
const TWIN = { id: 'd', hex: '#697068', name: 'Dawnstone', dname: 'Dawnstone (Layer)', brand: 'Citadel', line: 'Layer', type: 'layer' };
const LEAD = { id: 'm', hex: '#969696', name: 'Leadbelcher', dname: 'Leadbelcher', brand: 'Citadel', line: 'Base', type: 'metal' };

test('pickTile: a grid cell with the swatch, the display name, the brand and the mark badge', () => {
  const html = pickTile(TWIN, { id: 'pko3', k: 3, mark: 'owned' }, tk);
  assert.match(html, /^<div class="pkt" role="gridcell" id="pko3" data-k="3"/);
  assert.match(html, /class="pkn">Dawnstone \(Layer\)</);   // twins stay apart: the name carries the line
  assert.match(html, /cbadge owned/);
  // the display name already has the line, so the spoken name does not say it twice
  assert.match(html, /aria-label="Dawnstone \(Layer\), Citadel, owned"/);
  assert.doesNotMatch(html, /aria-selected/);   // only the active option gets aria-selected (picker.js)
});

test('pickTile: your pick has the pick ring and says so; a metallic has its overlay and finish icon', () => {
  const cur = pickTile(RED, { id: 'pko0', k: 0, current: true }, tk);
  assert.match(cur, /class="pkt cur"/);
  assert.match(cur, /aria-label="Red, Citadel Base, pkCurrentSaid"/);   // "not owned" is left out: it is most paints
  const metal = pickTile(LEAD, { id: 'pko1', k: 1, mark: 'want' }, tk);
  assert.match(metal, /class="sw metal"/);
  assert.match(metal, /class="pkb"><svg/);                  // the finish icon before the brand (§2)
  assert.match(metal, /Leadbelcher, Citadel Base, metallic, on the shopping list/);
  assert.match(metal, /cbadge want/);
});

test('pickRow: an option row with brand · line · mark and the finish tag; a hex match shows the TRUE ΔE', () => {
  const plain = pickRow(TWIN, { id: 'pko5', k: 5, mark: 'want' }, tk);
  assert.match(plain, /role="option" id="pko5" data-k="5" aria-selected="false"/);
  assert.match(plain, /<b>Dawnstone<\/b><span class="pksub">Citadel · Layer · on the shopping list /);   // the row shows the line
  assert.doesNotMatch(plain, /pkde/);
  const m = { deltaE: 2.44, quality: { label: 'Good', tier: 'success' } };
  const hex = pickRow(LEAD, { id: 'pko6', k: 6, current: true, match: m }, tk);
  assert.match(hex, /class="pkcur">pkCurrent</);
  assert.match(hex, /class="finish finish-metal"/);
  assert.match(hex, /<span class="badge">ΔE 2\.4<\/span>/);
  assert.match(hex, /aria-label="Leadbelcher, Citadel Base, metallic, pkCurrentSaid, pkMatchSaid:Good\|2\.4"/);
});

test('pickUseRow: "Seed:" while the live hex is the seed, else "Use … as seed"; the colour is re-minted', () => {
  assert.match(pickUseRow('#9a1115', { id: 'pko0', k: 0, live: true }, tk), /<b>pkSeedLive:#9A1115<\/b><span class="pksub">pkSeedLiveSub</);
  assert.match(pickUseRow('#DECADE', { id: 'pko9', k: 9, coarse: true }, tk), /pkUseHex:#DECADE.*pkUseHexTap/);
  assert.match(pickUseRow('#DECADE', { id: 'pko9', k: 9 }, tk), /pkUseHexClick/);
  // a hex that is not one cannot reach the inline style (safeColor)
  const bad = pickUseRow('red;background:url(x)', { id: 'x', k: 0 }, tk);
  assert.doesNotMatch(bad, /url\(x\)/);
  assert.match(bad, /background-color:#000000/);
});

test('pickGroup: an APG listbox group named by its presentation title; menuTitle names a paint once', () => {
  assert.equal(pickGroup('pkgC', 'Closest paints', '<i></i>'),
    '<div role="group" aria-labelledby="pkgC"><div class="pkhead" role="presentation" id="pkgC">Closest paints</div><i></i></div>');
  assert.equal(menuTitle(RED), 'Red · Citadel Base');
  assert.equal(menuTitle(TWIN), 'Dawnstone (Layer) · Citadel');
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

test('ladder steps show the pot: the matched paint\'s colour and finish, not the target', async () => {
  const { indexDataset } = await import('../src/js/data.js');
  const { buildScheme } = await import('../src/js/scheme.js');
  const { roleSlots } = await import('../src/js/ui.js');
  const idx = indexDataset({ version: 't', paints: [
    { id: 'c-layer-a', brand: 'Citadel', line: 'Layer', name: 'Pot A', hex: '#72766F', type: 'layer' },
    { id: 'c-shade-b', brand: 'Citadel', line: 'Shade', name: 'Wash B', hex: '#3A3C38', type: 'shade' },
  ] });
  const scheme = buildScheme(idx, '#70746D', 'shades', { ladder: 'wash' });
  const html = roleSlots(scheme, () => 'none');
  const steps = scheme.roles[0].ladders[0].steps.filter(s => s.match && s.match.paint);
  assert.ok(steps.length, 'the ladder has pots');
  for (const s of steps) {
    const p = s.match.paint;
    if (p.hex.toUpperCase() !== s.idealHex.toUpperCase())
      assert.ok(html.includes(`background-color:${p.hex}`), `the ${s.key} chip draws the pot ${p.hex}`);
  }
  assert.match(html, /class="sw fx-wash" style="background-color:#3A3C38/, 'a wash pot keeps its finish overlay');
});

test('seed docks: chip on the seeded role, switch dock on the other, reserved row everywhere', () => {
  const dockVm = [
    { id: 'p0', kind: 'base', deg: 0, hex: '#87146E', match: null, dock: { type: 'chip', name: 'Faerzress Purple', hex: '#87146E' } },
    { id: 'p1', kind: 'partner', deg: 180, hex: '#146E24', match: null, dock: { type: 'switch', target: 'accent' } },
    { id: 'metal', kind: 'metal', hex: '#C8A13A', match: null },
  ];
  const html = livePalette(dockVm, 'ideal', { '#87146E': 'Primary', '#146E24': 'Accent' });
  assert.match(html, /class="seedchip" title="Faerzress Purple is the starting paint[^"]*">[^<]*<svg[^>]*>.*?<\/svg>Starting paint</, 'the tag says Starting paint and names the paint in its title');
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

test('value-harmony columns get a tone label, not a meaningless "0°"', async () => {
  const { toneTag } = await import('../src/js/ui.js');
  const { rgbToHsl, hexToRgb, hslToRgb, rgbToHex } = await import('../src/js/color.js');
  // Build the partners the way the recipes actually do (§7), so the labels are tested against real
  // inputs: `shades` moves ONLY lightness, `monochromatic` moves mostly saturation.
  const BASE = '#9A1115';
  const [h, sat, l] = rgbToHsl(hexToRgb(BASE));
  const step = (ds, dl) => rgbToHex(hslToRgb([h, Math.max(0, sat + ds), Math.max(0, Math.min(1, l + dl))]));
  const lighter = step(0, 0.12), darker = step(0, -0.12), softer = step(-0.34, 0);

  assert.equal(toneTag(lighter, BASE), 'Lighter');
  assert.equal(toneTag(darker, BASE), 'Darker');
  assert.equal(toneTag(softer, BASE), 'Softer');   // monochromatic: saturation is what moved

  const valueVm = [
    { id: 'p0', kind: 'base', deg: 0, hex: BASE, match: null },
    { id: 'p1', kind: 'partner', deg: 0, hex: darker, match: null },
    { id: 'p2', kind: 'partner', deg: 0, hex: lighter, match: null },
  ];
  const html = livePalette(valueVm, 'ideal', { [BASE]: 'Primary' });
  assert.doesNotMatch(html, />0°</, 'no bare 0° tags');
  assert.match(html, /class="lctag">Darker</);
  assert.match(html, /class="lctag">Lighter</);
});

/* ---- the matching note under the live palette (CLAUDE.md §3.6) ---- */
const T = { noteUmp: 'Use my paints: {mode}', umpPrefer: 'Prefer', umpOnly: 'Only', noteUmpPrefer: 'yours win when close',
  noteUmpOnly: 'from the {n} you own', noteUmpEmpty: 'none marked as owned yet', change: 'Change', openShelf: 'Open Shelf',
  noteContrast: 'Contrast and speed paints included', notePlan: 'Plan' };
const tt = (k, v) => (T[k] || k).replace(/\{(\w+)\}/g, (m, x) => (v && x in v ? String(v[x]) : m));
/** The visible text of an HTML string. A character scan, not a regex replace: one pass of /<[^>]+>/ can
 *  leave a tag behind (`<scr<b>ipt>`), which CodeQL flags as incomplete sanitisation. */
const text = html => {
  let out = '', inTag = false;
  for (const ch of html) {
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
};
/** Each line's accessible name: its text without the aria-hidden glyph (the ✓, ○ or finish icon). */
const names = html => html.split('</button>').filter(Boolean)
  .map(b => text(b.replace(/<span[^>]*aria-hidden="true">.*?<\/span>/, '')));

test('matchNote: nothing at all when both settings are off', () => {
  assert.equal(matchNote({ collection: 'off', owned: 23, contrast: false }, tt), '');
});

test('matchNote: one line per active setting, each a button to its own control', () => {
  const html = matchNote({ collection: 'only', owned: 23, contrast: true, expanded: true }, tt);
  assert.equal((html.match(/<button /g) || []).length, 2);
  assert.match(html, /data-note="ump" aria-haspopup="dialog" aria-controls="settingsMenu" aria-expanded="true"/);
  assert.match(html, /data-note="contrast"/);
  assert.doesNotMatch(html.slice(html.indexOf('data-note="contrast"')), /aria-haspopup/);   // it goes to the Plan, not a dialog
  // the visible words ARE the accessible name; the dash before the target word is for screen readers only
  assert.deepEqual(names(html), ['Use my paints: Only · from the 23 you own — Change', 'Contrast and speed paints included — Plan']);
});

test('matchNote: Prefer says what it really does', () => {
  assert.deepEqual(names(matchNote({ collection: 'prefer', owned: 4 }, tt)), ['Use my paints: Prefer · yours win when close — Change']);
});

test('matchNote: an empty shelf says so and goes to the Shelf, not to ⋯', () => {
  const html = matchNote({ collection: 'prefer', owned: 0 }, tt);
  assert.match(html, /data-note="shelf"/);
  assert.doesNotMatch(html, /aria-haspopup/);
  assert.deepEqual(names(html), ['Use my paints: Prefer · none marked as owned yet — Open Shelf']);
});

test('matchNote: the Contrast line wears the Contrast finish icon, not the check', () => {
  const html = matchNote({ contrast: true }, tt);
  assert.match(html, /class="nk nk-contrast" aria-hidden="true"><svg/);
  assert.doesNotMatch(html, /#i-check/);
});

test('planControls: Use my paints is no longer in the Plan tab (it is in ⋯)', () => {
  const html = planControls('wash', false, 3);
  assert.doesNotMatch(html, /data-collection|Use my collection/);
  assert.match(html, /data-ladder="wash" aria-pressed="true"/);
  assert.match(html, /id="inclContrast" aria-pressed="false"/);
});

test('matchNote: the "·" ends the bold head (no-break space), so a wrapped explanation never starts with it', () => {
  for (const html of [matchNote({ collection: 'only', owned: 3 }, tt), matchNote({ collection: 'prefer', owned: 0 }, tt)]) {
    assert.match(html, /<\/b> · <span class="mt">[^·]/);
    assert.doesNotMatch(html, /class="mt">·/);
  }
});

test('empty states: a heading, one sentence, one action that clears the filters (UX 4)', () => {
  assert.equal(shelfGrid([], () => 'none'), '', 'an empty grid holds no fake option');
  for (const [kind, head] of [['owned', 'No paints marked as owned yet'], ['want', 'Your shopping list is empty'], ['filter', 'No paints match']]) {
    const html = shelfEmpty(kind, 'red');
    assert.ok(html.startsWith(`<h3>${head}</h3><p>`), `${kind}: heading first`);
    assert.equal((html.match(/data-shelfclear/g) || []).length, 1, `${kind}: one action`);
  }
  assert.match(shelfEmpty('filter', '<b>'), /&lt;b&gt;/, 'the search words are escaped');
});

test('a Poor match says what it means and what to do (UX 4)', () => {
  const m = d => ({ paint: { id: 'x', name: 'X', brand: 'B', line: 'L', hex: '#123456', type: 'layer' }, deltaE: d, quality: { label: d > 10 ? 'Poor' : 'Loose', tier: d > 10 ? 'danger' : 'warning' } });
  assert.match(matchChip(m(13.2)), /class="poornote"><strong>No pot within ΔE 10\.<\/strong>/);
  assert.doesNotMatch(matchChip(m(9.9)), /poornote/, 'Loose (ΔE 10 or less) gets no note');
  assert.match(matchChip(null), /class="poornote"><strong>No pot is close\.<\/strong>/);
});

test('livePalette: a held role column acts on the role; a chosen pot shows its tag (hold-flow, A)', () => {
  const pot = { paint: { id: 'bg', name: 'Balthasar Gold', brand: 'Citadel', line: 'Base', hex: '#A77353', type: 'metal' }, deltaE: 22.9, quality: { label: 'Poor', tier: 'danger' } };
  const html = livePalette([
    { id: 'p0', kind: 'base', hex: '#6D774D', role: 'Primary', holdable: false, match: null },
    { id: 'held-Secondary', kind: 'held', hex: '#2F4A6B', role: 'Secondary', holdable: true, hold: 'lock', match: null },
    { id: 'metal', kind: 'metal', hex: '#A77353', role: 'Metal', holdable: true, hold: 'pot', match: pot },
  ], 'ideal');
  assert.match(html, /data-lock="r:Secondary"[^>]*aria-pressed="true"/, 'the lock toggles the role hold and shows pressed');
  assert.match(html, /data-edit="r:Secondary"/, 'an edit becomes a lock on the role');
  assert.match(html, /class="holdchip"[^>]*>.*?Pot chosen</, 'a chosen pot is a filled tag');
  assert.doesNotMatch(html, /data-lock="r:Metal"/, 'a chosen pot is changed in the Recipe, not locked over');
  assert.doesNotMatch(html, /data-lock="r:Primary"|data-lock="base"/, 'Primary is never held');
});

test('holdControls: a lock toggle with one fixed name, and a pot chooser; a chosen pot can be changed or released', () => {
  assert.equal(holdControls({ role: 'Primary' }, false), '', 'a role that cannot be held has no controls');
  const free = holdControls({ role: 'Metal' }, true);
  assert.match(free, /data-hold-lock="Metal" aria-pressed="false"[^>]*>.*Lock colour</);
  assert.match(free, /data-hold-pot="Metal" aria-haspopup="dialog">.*Choose pot…</);
  assert.match(holdControls({ role: 'Metal', hold: 'lock' }, true), /aria-pressed="true"[^>]*>.*Lock colour</, 'the name stays; only the pressed state changes');
  const pot = holdControls({ role: 'Metal', hold: 'pot' }, true);
  assert.match(pot, /class="holdchip"/);
  assert.match(pot, /data-hold-pot="Metal"[^>]*aria-label="Change the Metal pot">Change pot</);
  assert.match(pot, /data-hold-release="Metal"/);
});

test('holdNote: lists the holds, names a Poor one and by how much; nothing held, nothing shown', () => {
  assert.equal(holdNote([]), '');
  const html = holdNote([{ role: 'Secondary', kind: 'lock', name: 'Abyss Blue', deltaE: 1.5, poor: false },
    { role: 'Metal', kind: 'pot', name: 'Balthasar Gold', deltaE: 22.94, poor: true }]);
  assert.match(html, /Secondary \(colour\) · Metal \(Balthasar Gold\)/);
  assert.match(html, />Release both</);
  assert.match(html, /<b>Metal:<\/b> Balthasar Gold is ΔE 22\.9 from this scheme's metal \(Poor\)/);
  assert.equal((html.match(/class="hnwarn"/g) || []).length, 1, 'only the Poor hold gets a line');
});

test('potRows: each paint with its ΔE; the chosen one is marked; an empty search says what to try', () => {
  const m = { paint: { id: 'bg', name: 'Balthasar Gold', brand: 'Citadel', line: 'Base', hex: '#A77353', type: 'metal' }, deltaE: 22.9, quality: { label: 'Poor', tier: 'danger' } };
  const html = potRows([m], () => 'owned', 'bg');
  assert.match(html, /data-potid="bg" aria-current="true"/);
  assert.match(html, /ΔE 22\.9/);
  assert.match(html, /owned/);
  assert.match(potRows([]), /No paint matches/);
});
