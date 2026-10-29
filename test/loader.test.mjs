// loader.js — the Molten Harmonics loader (§3.4). A fake canvas context records what a frame draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loaderRoles, drawLoader, LOADER_TOKENS } from '../src/js/loader.js';
import { roleIdeals } from '../src/js/scheme.js';

function fakeCtx() {
  const ops = [];
  const ctx = { ops, fills: [], texts: [], globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '' };
  for (const m of ['fillRect', 'beginPath', 'moveTo', 'arcTo', 'arc', 'closePath', 'stroke', 'save', 'restore', 'clip']) ctx[m] = (...a) => ops.push([m, ...a]);
  ctx.fill = () => { ops.push(['fill']); ctx.fills.push(ctx.fillStyle); };
  ctx.fillText = (t, x, y) => ctx.texts.push({ t, x, y, color: ctx.fillStyle, alpha: ctx.globalAlpha });
  return ctx;
}
const colors = { bg: '#141110', ring: '#4D4138', text: '#A8998A', accent: '#C2912F', well: '#251F1A' };

test('loaderRoles: the four Recipe roles for the colour and harmony, with their hues', () => {
  const r = loaderRoles('#9A1115', 'triadic');
  assert.deepEqual(r.map(x => x.name), ['Primary', 'Secondary', 'Accent', 'Metal']);
  assert.deepEqual(r.map(x => x.hex), roleIdeals('#9A1115', 'triadic').map(x => x.idealHex), 'the wells end on the scheme’s own targets');
  for (const x of r) assert.ok(x.hue >= 0 && x.hue < 360);
  assert.equal(loaderRoles('nonsense', 'triadic', '#0B6371')[0].hex, '#0B6371', 'a bad colour falls back');
  assert.equal(loaderRoles('#9A1115', 'not-a-harmony').length, 4, 'an unknown harmony still gives four wells');
});

test('drawLoader: the first frame is a drop on the page colour; the progress line is empty', () => {
  const ctx = fakeCtx(), roles = loaderRoles('#9A1115', 'complementary');
  drawLoader(ctx, 400, 400, 0, { roles, colors });
  assert.deepEqual(ctx.ops[0], ['fillRect', 0, 0, 400, 400]);
  assert.equal(ctx.fills[0], roles[0].hex, 'the drop is the starting colour');
  assert.ok(!ctx.fills.includes(colors.accent), 'no progress at 0');
  assert.equal(ctx.texts.length, 0, 'no labels yet');
});

test('drawLoader: the last frame is the finished palette — four filled wells, their names, a full line', () => {
  const ctx = fakeCtx(), roles = loaderRoles('#9A1115', 'complementary');
  drawLoader(ctx, 400, 400, 1, { roles, colors, font: 'IBM Plex Sans' });
  for (const r of roles) assert.ok(ctx.fills.includes(r.hex), `${r.name} well filled`);
  assert.deepEqual(ctx.texts.map(x => x.t), ['Primary', 'Secondary', 'Accent', 'Metal']);
  assert.ok(ctx.texts.every(x => x.color === colors.text && x.alpha === 1));
  assert.ok(ctx.fills.includes(colors.accent), 'the progress line is drawn in the accent');
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  assert.equal(ctx.globalAlpha, 1, 'the context is left as it was found');
  // labels sit under the wells, left to right, inside the canvas
  for (let i = 1; i < ctx.texts.length; i++) assert.ok(ctx.texts[i].x > ctx.texts[i - 1].x);
  for (const x of ctx.texts) assert.ok(x.x > 0 && x.x < 400 && x.y < 400);
});

test('drawLoader: progress is clamped, and only the dark theme uses additive light', () => {
  const roles = loaderRoles('#2D567C', 'triadic');
  const a = fakeCtx(), b = fakeCtx();
  drawLoader(a, 300, 300, 2, { roles, colors }); drawLoader(b, 300, 300, 1, { roles, colors });
  assert.deepEqual(a.ops, b.ops);
  const seen = new Set(), light = fakeCtx(), dark = fakeCtx();
  const spy = c => { let v = 'source-over'; Object.defineProperty(c, 'globalCompositeOperation', { get: () => v, set: x => { v = x; seen.add(x); } }); return c; };
  drawLoader(spy(light), 300, 300, 0.2, { roles, colors });
  assert.ok(!seen.has('lighter'));
  drawLoader(spy(dark), 300, 300, 0.2, { roles, colors, dark: true });
  assert.ok(seen.has('lighter'));
});

test('LOADER_TOKENS names only §3.1 tokens', () => {
  for (const v of Object.values(LOADER_TOKENS)) assert.match(v, /^--[a-z0-9-]+$/);
});

test('drawLoader: `bar` draws the progress line apart from the frame (reduced motion: the finished palette, the real progress)', () => {
  const roles = loaderRoles('#9A1115'), ctx = fakeCtx();
  drawLoader(ctx, 400, 400, 1, { roles, colors, bar: 0, labelPx: 14 });
  assert.ok(!ctx.fills.includes(colors.accent), 'no progress drawn at bar 0');
  assert.equal(ctx.texts.length, 4, 'the finished palette is there');
  assert.match(ctx.font, /^500 14px/);
});
