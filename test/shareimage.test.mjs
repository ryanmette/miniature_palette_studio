import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutShareImage, paintShareImage, shareView, shareText, shareFileName, fitText, finishKind,
  FINISH_FX, SHARE_TOKENS, SHARE_SIZE } from '../src/js/shareimage.js';
import { indexDataset, FINISH_TYPES } from '../src/js/data.js';
import { buildScheme } from '../src/js/scheme.js';
import { contrastRatio } from '../src/js/color.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

/* A fake measure: every character is 0.56 em wide. Wider than IBM Plex Sans on average, so a layout that
   fits here fits with the real fonts too (the mockup measured the real fonts: no overlap, all inside). */
const measure = (font, text) => String(text).length * 0.56 * Number(/(\d+)px/.exec(font)[1]);

/* The two themes' tokens, read from tokens.css (var() references resolved), keyed as SHARE_TOKENS. */
function themeTokens(selector) {
  const css = read('../src/styles/tokens.css');
  const block = name => { const i = css.indexOf(name); return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)); };
  const vars = {};
  for (const sel of ['[data-theme="light"]', selector]) {
    for (const [, k, v] of block(sel).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[k] = v.trim();
  }
  const resolve = v => (v.startsWith('var(') ? resolve(vars[/var\((--[\w-]+)\)/.exec(v)[1]]) : v);
  return Object.fromEntries(Object.entries(SHARE_TOKENS).map(([key, prop]) => [key, resolve(vars[prop])]));
}
const LIGHT = themeTokens('[data-theme="light"]'), DARK = themeTokens('[data-theme="dark"]');

const WORDS = { from: 'From {name}', yourPaint: 'Your paint', noPot: 'No close pot', footer: 'ΔE 2000 · colours are approximate',
  finish: { metal: 'metallic', contrast: 'contrast', wash: 'wash', shade: 'shade', ink: 'ink', glaze: 'glaze', effect: 'effect' } };

/* Real schemes from the real engine, with the app's default match options (app.js matchOpts). */
const idx = indexDataset(JSON.parse(read('../src/data/paints.json')));
const OPTS = { ladder: 'wash', excludeTypes: new Set(FINISH_TYPES), demoteTypes: new Set(['metal']), demoteAmount: 4 };
function viewFor(id, harmony, label) {
  const p = idx.byId.get(id);
  const scheme = buildScheme(idx, p.hex, harmony, { ...OPTS, seed: { id: p.id, hex: p.hex, name: p.name } });
  return shareView(scheme, { seed: { id: p.id, name: p.dname || p.name }, harmony: label, words: WORDS });
}
const longest = [...idx.paints].sort((a, b) => b.name.length - a.name.length)[0];
const CASES = [
  viewFor('citadel-base-mephiston-red', 'split-complementary', 'Split-complementary'),
  viewFor('citadel-base-abaddon-black', 'neutral-pop', 'Neutral + pop'),
  viewFor('citadel-base-caliban-green', 'square', 'Square'),
  viewFor('citadel-base-retributor-armour', 'complementary', 'Complementary'),
  viewFor(longest.id, 'analogous', 'Analogous'),
];
const texts = L => L.ops.filter(o => o.t === 'text');
const right = o => (o.align === 'right' ? o.x : o.x + measure(o.font, o.text));
const left = o => (o.align === 'right' ? o.x - measure(o.font, o.text) : o.x);

test('fitText: wraps, cuts with an ellipsis, and breaks a word wider than the box', () => {
  const f = '400 10px x';   // 5.6 px a character
  assert.deepEqual(fitText(measure, f, 'Mephiston Red', 200, 2), { lines: ['Mephiston Red'], cut: false });
  assert.deepEqual(fitText(measure, f, 'Mephiston Red', 60, 2).lines, ['Mephiston', 'Red']);
  const cut = fitText(measure, f, 'one two three four five six', 60, 2);
  assert.equal(cut.cut, true); assert.equal(cut.lines.length, 2); assert.match(cut.lines[1], /…$/);
  const word = fitText(measure, f, 'Zashchitniy', 30, 3);
  for (const ln of word.lines) assert.ok(measure(f, ln) <= 30, ln);
});

test('every text and swatch stays inside the 72 px margin, in both themes, for every stress case', () => {
  for (const tokens of [LIGHT, DARK]) for (const v of CASES) {
    const L = layoutShareImage(v, tokens, measure);
    assert.equal(L.W, SHARE_SIZE); assert.equal(L.H, SHARE_SIZE);
    for (const o of texts(L)) {
      assert.ok(left(o) >= 72 - 0.5 && right(o) <= SHARE_SIZE - 72 + 0.5, `${v.seed.name}: "${o.text}" leaves the margin`);
      assert.ok(o.y <= SHARE_SIZE - 40, `"${o.text}" is too low`);
    }
    for (const o of L.ops.filter(x => x.t === 'swatch')) assert.ok(o.x >= 72 && o.x + o.w <= SHARE_SIZE - 72);
  }
});

test('no text runs into its neighbour: each role column keeps its own text, also with a wide fallback font', () => {
  // 0.8 em a character: wider than any system fallback, so the ΔE tag must drop under its number
  const wide = (font, text) => String(text).length * 0.8 * Number(/(\d+)px/.exec(font)[1]);
  for (const [v, m] of CASES.flatMap(c => [[c, measure], [c, wide]])) {
    const L = layoutShareImage(v, LIGHT, m);
    const right = o => (o.align === 'right' ? o.x : o.x + m(o.font, o.text));
    const left = o => (o.align === 'right' ? o.x - m(o.font, o.text) : o.x);
    const colW = (SHARE_SIZE - 2 * 72 - 40) / 2;
    for (const o of texts(L).filter(x => x.y > 210 && x.y < SHARE_SIZE - 100)) {
      const col = left(o) < 72 + colW + 20 ? 0 : 1, x0 = 72 + col * (colW + 40);
      assert.ok(right(o) <= x0 + colW + 0.5, `"${o.text}" runs out of its column`);
    }
    for (const o of L.ops.filter(x => x.t === 'rect' && x.stroke)) {
      const col = o.x < 72 + colW + 20 ? 0 : 1, x0 = 72 + col * (colW + 40);
      assert.ok(o.x + o.w <= x0 + colW + 0.5, 'a tag runs out of its column');
    }
  }
});

test('text sizes: paint names 44 px (about 10 px in a Messages bubble), nothing under 26 px', () => {
  const L = layoutShareImage(CASES[0], LIGHT, measure);
  assert.ok(texts(L).filter(o => o.kind === 'name').every(o => o.px === 44));
  assert.ok(Math.min(...texts(L).map(o => o.px)) >= 26);
});

test('every text passes WCAG AA (4.5:1) on its ground, in both themes (§3.5, §7)', () => {
  for (const tokens of [LIGHT, DARK]) for (const v of CASES) {
    for (const o of texts(layoutShareImage(v, tokens, measure))) {
      const r = contrastRatio(o.fill, o.ground);
      assert.ok(r >= 4.5, `"${o.text}" ${o.fill} on ${o.ground} is ${r.toFixed(2)}:1`);
    }
  }
});

test('§2: each match shows ΔE with its label; the picked paint says "Your paint"; the swatch is the pot\'s own hex', () => {
  const v = CASES[0], L = layoutShareImage(v, LIGHT, measure), all = texts(L).map(o => o.text);
  assert.equal(all.filter(s => s === 'Your paint').length, 1);
  for (const r of v.roles.filter(x => x.pot && x.pot.id !== v.seed.id)) {
    assert.ok(all.includes(`ΔE ${r.pot.dE.toFixed(1)}`), r.role);
    assert.ok(all.includes(r.pot.label), r.pot.label);
  }
  const sw = L.ops.filter(o => o.t === 'swatch');
  assert.deepEqual(sw.map(o => o.hex), v.roles.map(r => r.pot.hex));
  assert.deepEqual(sw.map(o => o.band), v.roles.map(r => r.ideal));   // the target band: the gap shows
  assert.ok(all.includes('ΔE 2000 · colours are approximate'));
});

test('a long seed name is cut, and the harmony always shows', () => {
  const v = CASES[4], L = layoutShareImage(v, LIGHT, measure);
  const sub = texts(L).find(o => o.text.startsWith('From '));
  assert.match(sub.text, /… · Analogous$/);
  const names = texts(L).filter(o => o.kind === 'name');
  assert.ok(names.some(o => o.text.endsWith('…')), 'the long name is cut after two lines');
});

test('finish: a metallic pot gets the sheen, the icon and its word; a curated fx wins over the type', () => {
  const v = CASES[3], L = layoutShareImage(v, LIGHT, measure);
  assert.equal(L.ops.find(o => o.t === 'swatch').kind, 'metal');
  assert.ok(L.ops.some(o => o.t === 'glyph'));
  assert.ok(texts(L).some(o => o.text === 'metallic'));
  assert.equal(finishKind({ type: 'effect', fx: 'gloss' }), 'fx-gloss');
  assert.equal(finishKind({ type: 'shade' }), 'fx-wash');
  assert.equal(finishKind({ type: 'base' }), null);
});

test('the finish overlays are the same stops as app.css', () => {
  const css = read('../src/styles/app.css');
  for (const [kind, fx] of Object.entries(FINISH_FX)) {
    const sel = kind === 'metal' ? ':root' : `.sw.${kind}`;
    const line = css.split('\n').find(l => l.startsWith(sel) && l.includes('linear-gradient'));
    const g = /linear-gradient\((\d+)deg,\s*(.+?)\)\s*;?\s*\}?\s*$/.exec(line.replace(/\);?\s*\}\s*$/, ')'));
    assert.ok(g, `no gradient for ${kind}`);
    assert.equal(Number(g[1]), fx.deg, kind);
    const stops = g[2].match(/rgba\([^)]+\)(\s+[\d.]+%)?/g);
    assert.equal(stops.length, fx.stops.length, kind);
    stops.forEach((s, i) => {
      const [, color, pct] = /(rgba\([^)]+\))(?:\s+([\d.]+)%)?/.exec(s);
      const at = pct != null ? Number(pct) / 100 : i === 0 ? 0 : 1;
      assert.equal(color.replace(/\s/g, ''), fx.stops[i][1], `${kind} stop ${i}`);
      assert.equal(at, fx.stops[i][0], `${kind} stop ${i} position`);
    });
  }
});

test('a role with no pot says so and shows no ΔE', () => {
  const v = { ...CASES[0], roles: CASES[0].roles.map((r, i) => (i === 1 ? { ...r, pot: null } : r)) };
  const L = layoutShareImage(v, LIGHT, measure);
  assert.ok(texts(L).some(o => o.text === 'No close pot'));
  assert.equal(L.ops.filter(o => o.t === 'swatch')[1].hex, v.roles[1].ideal);
});

test('shareText names the paints and ends with the link; shareFileName is a plain slug', () => {
  const v = CASES[0], url = 'https://palette.ryanmette.com/?p=citadel-base-mephiston-red&h=split-complementary';
  const s = shareText(v, url);
  assert.ok(s.startsWith('From Mephiston Red · Split-complementary: Mephiston Red · '));
  assert.ok(s.endsWith('\n' + url));
  assert.equal(shareFileName(v), 'palette-studio-mephiston-red-split-complementary.png');
  assert.match(shareFileName(CASES[4]), /^palette-studio-[a-z0-9-]+\.png$/);
  assert.equal(shareFileName({ seed: { name: 'Custom #9A1115' }, harmony: 'Neutral + pop' }), 'palette-studio-custom-9a1115-neutral-pop.png');
});

test('paintShareImage draws every operation on the context it is given', () => {
  globalThis.Path2D ??= class { constructor(d) { this.d = d; } };
  const calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({ letterSpacing: '0px' }, {
    get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient'
      ? () => grad : (...a) => calls.push([k, ...a])),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  const L = layoutShareImage(CASES[3], DARK, measure);
  paintShareImage(ctx, L);
  const drawn = calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.deepEqual(drawn, texts(L).map(o => o.text));
});
