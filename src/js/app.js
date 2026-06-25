// app.js — application state, dataset loading, entry modes, tabs, conveniences, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/scheme/a11y/ui.

import { HARMONY_TYPES, isHarmony, HARMONY_OFFSETS } from './harmony.js';
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, rotateHue } from './color.js';
import { simulateCvd, wcag, minPairDelta } from './a11y.js';
import { loadDataset, equivalents, nearestPaints, nearestPaint } from './data.js';
import { buildScheme, shoppingList } from './scheme.js';
import * as ui from './ui.js';

const $ = sel => document.querySelector(sel);
const state = {
  idx: null, scheme: null,
  baseId: null, customHex: null,
  harmony: 'complementary',
  q: '', brand: '', seedRole: 'main', tab: 'plan', theme: 'light',
  owned: new Set(), ownedOnly: false, compareA: null, wheelL: null,
};

const baseHex = () => state.customHex || state.idx.byId.get(state.baseId)?.hex;
/** Entry mode C: when the seed is the *accent*, build the scheme around its complement. */
const schemeBase = () => (state.seedRole === 'accent' ? rotateHue(baseHex(), 180) : baseHex());
const matchOpts = () => (state.ownedOnly && state.owned.size ? { ownedIds: state.owned } : {});

function baseInfo() {
  if (state.customHex) return { hex: state.customHex, name: 'Custom ' + state.customHex, custom: true };
  const p = state.idx.byId.get(state.baseId);
  return { hex: p.hex, name: p.name, brand: p.brand, line: p.line, type: p.type, approx: p.approx };
}
function basePaint() { return state.customHex ? null : state.idx.byId.get(state.baseId); }
function currentScheme() { return buildScheme(state.idx, schemeBase(), state.harmony, matchOpts()); }

function filteredPaints() {
  const q = state.q.toLowerCase();
  return state.idx.paints.filter(p =>
    (!state.brand || p.brand === state.brand) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)));
}

/* ---- per-tab renderers ---- */
function renderPlan() {
  state.scheme = currentScheme();
  const cur = { base: schemeBase(), harmony: state.harmony, colors: state.scheme.roles.map(r => r.idealHex) };
  const cmp = state.compareA ? ui.compareBar(state.compareA, cur) : '';
  $('#panel-plan').innerHTML = cmp + ui.paletteOverview(state.scheme)
    + '<div class="micro" style="margin:14px 0 0">Each role: ideal colour → nearest real paint (ΔE 2000), plus a derived wash + highlight</div>'
    + ui.roleSlots(state.scheme);
}
function renderMini() { $('#mini').innerHTML = ui.miniRoles(currentScheme()); }
function renderExplore() {
  $('#panel-explore').innerHTML = `<div class="wheelwrap">
    <div class="wheelcol">
      <canvas id="wheel" class="wcanvas" width="280" height="280" role="img" aria-label="Harmony wheel — drag the centre node to change the base colour"></canvas>
      <div class="wctrl"><span class="micro">Light</span><input id="wl" type="range" min="6" max="94" step="1" aria-label="Lightness" style="flex:1" /><button class="btn" id="wrand" style="height:32px;padding:0 12px">↻ Shuffle</button></div>
    </div>
    <div class="miniwrap"><div class="micro" style="margin-bottom:8px">Live scheme → nearest paint</div><div id="mini"></div></div>
  </div>`;
  setupWheel();
  renderMini();
}
function setupWheel() {
  const cv = $('#wheel'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W / 2 - 16;
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];
  $('#wl').value = Math.round(state.wheelL * 100);
  const pos = (h, s) => [cx + Math.sin(h * Math.PI / 180) * s * R, cy - Math.cos(h * Math.PI / 180) * s * R];
  function draw() {
    const b = baseHex();
    const [h, s] = rgbToHsl(hexToRgb(b));
    ctx.clearRect(0, 0, W, H);
    for (let a = 0; a < 360; a += 6) { const [x, y] = pos(a, 1); ctx.fillStyle = rgbToHex(hslToRgb([a, 0.7, 0.5])); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
    const offs = HARMONY_OFFSETS[state.harmony];
    ctx.strokeStyle = 'rgba(128,128,128,.35)'; ctx.lineWidth = 1.5;
    for (const o of offs) { const [x, y] = pos(h + o, s); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); }
    for (const o of offs) { const [x, y] = pos(h + o, s); ctx.fillStyle = rotateHue(b, o); ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    const [bx, by] = pos(h, s); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(bx, by, 11, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  let raf = 0;
  function setBase(h, s) {
    state.customHex = rgbToHex(hslToRgb([h, s, state.wheelL]));
    $('#hex').value = state.customHex.replace('#', '');
    // Coalesce the heavy redraw (≈12 nearest-paint scans + canvas) to one per frame, and
    // debounce the history write — a drag fires pointermove far faster than WebKit's
    // ~100-calls-per-30s replaceState limit, which would otherwise throw mid-drag.
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); renderMini(); renderHero(); announce(); });
    scheduleUrlUpdate();
  }
  function fromPointer(e) {
    const r = cv.getBoundingClientRect();
    const dx = (e.clientX - r.left) * (W / r.width) - cx, dy = (e.clientY - r.top) * (H / r.height) - cy;
    setBase((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, Math.max(0, Math.min(1, Math.hypot(dx, dy) / R)));
  }
  let dragging = false;
  cv.addEventListener('pointerdown', e => { dragging = true; cv.style.cursor = 'grabbing'; cv.setPointerCapture(e.pointerId); fromPointer(e); });
  cv.addEventListener('pointermove', e => { if (dragging) fromPointer(e); });
  cv.addEventListener('pointerup', () => { dragging = false; cv.style.cursor = 'grab'; updateUrl(); });
  $('#wl').addEventListener('input', e => { state.wheelL = +e.target.value / 100; const [h, s] = rgbToHsl(hexToRgb(baseHex())); setBase(h, s); });
  $('#wrand').addEventListener('click', () => setBase(Math.random() * 360, 0.5 + Math.random() * 0.45));
  draw();
}
function renderEquiv() {
  const p = basePaint();
  if (p) $('#panel-equiv').innerHTML = ui.equivalentsPanel(`${p.name} (${p.brand})`, equivalents(state.idx, state.idx.byId.get(p.id), { n: 8 }));
  else $('#panel-equiv').innerHTML = ui.equivalentsPanel(`your colour ${baseHex()}`, nearestPaints(state.idx, baseHex(), 8));
}
function renderA11y() {
  const s = state.scheme = currentScheme();
  const colors = s.roles.map(r => r.idealHex);
  const names = s.roles.map(r => r.role);
  const sims = [
    { label: 'Normal', colors },
    { label: 'Deuteranopia', colors: colors.map(c => simulateCvd(c, 'deuteranopia')) },
    { label: 'Protanopia', colors: colors.map(c => simulateCvd(c, 'protanopia')) },
    { label: 'Tritanopia', colors: colors.map(c => simulateCvd(c, 'tritanopia')) },
  ];
  const mk = (a, b, la, lb) => { const w = wcag(a, b); return { a, b, labelA: la, labelB: lb, ratio: w.ratio, passAAText: w.passAAText, passAALarge: w.passAALarge }; };
  const contrasts = [mk(colors[0], colors[2], 'Body', 'Accent'), mk(colors[0], '#FFFFFF', 'Body', 'white'), mk(colors[0], '#000000', 'Body', 'black')];
  const col = minPairDelta(colors, 'deuteranopia');
  let collision = null;
  if (col.delta < 10) {
    const [i, j] = col.pair;
    collision = { roles: [names[i], names[j]], delta: col.delta };
    // Shift whichever of the *colliding* roles is least disruptive to move — the old code
    // always rotated the Accent, so it couldn't fix e.g. a Body/Secondary collision.
    const freedom = { Accent: 0, Secondary: 1, Metal: 2, Body: 3 };
    const shiftIdx = (freedom[names[i]] ?? 9) <= (freedom[names[j]] ?? 9) ? i : j;
    let bestMin = col.delta, best = null;
    for (const d of [25, -25, 40, -40, 55, -55]) {
      const trial = colors.slice();
      trial[shiftIdx] = rotateHue(colors[shiftIdx], d);
      const m = minPairDelta(trial, 'deuteranopia').delta;
      if (m > bestMin + 1) { bestMin = m; best = trial[shiftIdx]; }
    }
    if (best) collision.suggestion = { role: names[shiftIdx], hex: best, match: nearestPaint(state.idx, best, matchOpts()) };
  }
  $('#panel-a11y').innerHTML = ui.a11yPanel({ names, sims, contrasts, collision });
}
const renderers = { plan: renderPlan, explore: renderExplore, equiv: renderEquiv, a11y: renderA11y };
function renderActive() { renderers[state.tab](); }

/* ---- chrome ---- */
function renderList() {
  const items = filteredPaints();
  $('#list').innerHTML = ui.pickerList(items, state.customHex ? null : state.baseId, state.owned);
  $('#count').textContent = `${items.length} of ${state.idx.paints.length} paints${state.owned.size ? ` · ${state.owned.size} owned` : ''}`;
}
function renderHero() {
  $('#hero').innerHTML = ui.hero(baseInfo());
  $('#baseLabel').textContent = `Base colour · ${state.seedRole}`;
}
function announce() { $('#status').textContent = `${baseInfo().name}, ${state.harmony} scheme, ${state.tab} view.`; }
let urlTimer = null;
function updateUrl() {
  if (urlTimer) { clearTimeout(urlTimer); urlTimer = null; }
  const p = new URLSearchParams();
  p.set('c', baseHex().replace('#', ''));
  p.set('h', state.harmony);
  if (state.tab !== 'plan') p.set('v', state.tab);
  if (state.seedRole === 'accent') p.set('r', 'accent');
  if (state.theme === 'dark') p.set('t', 'dark');
  history.replaceState(null, '', '?' + p.toString());
}
/** Debounced URL write for rapid-fire updates (wheel/slider drag); see setBase(). */
function scheduleUrlUpdate() {
  if (urlTimer) clearTimeout(urlTimer);
  urlTimer = setTimeout(updateUrl, 250);
}
function renderAll() { renderList(); renderHero(); renderActive(); announce(); updateUrl(); }

function setTheme(t) {
  state.theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  try { localStorage.setItem('ps-theme', state.theme); } catch { /* private mode */ }
}
function selectPaint(id) { state.baseId = id; state.customHex = null; $('#hex').value = baseHex().replace('#', ''); renderAll(); }
function syncTabs(focusActive = false) {
  for (const b of $('#tabs').children) {
    const sel = b.dataset.tab === state.tab;
    b.setAttribute('aria-selected', String(sel));
    b.tabIndex = sel ? 0 : -1;        // roving tabindex (WAI-ARIA tabs pattern)
    if (sel && focusActive) b.focus();
  }
  for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== state.tab;
}
function setTab(tab, focusActive = false) {
  state.tab = tab;
  syncTabs(focusActive);
  renderActive(); announce(); updateUrl();
}
function toggleOwned(id) {
  if (state.owned.has(id)) state.owned.delete(id); else state.owned.add(id);
  try { localStorage.setItem('ps-owned', JSON.stringify([...state.owned])); } catch { /* */ }
  renderList();
  document.querySelector(`[data-own="${CSS.escape(id)}"]`)?.focus(); // keep keyboard place after re-render
  if (state.ownedOnly) renderActive();
}
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; d.setAttribute('role', 'status');
  document.body.appendChild(d); setTimeout(() => d.remove(), 1700);
}
function doExport() {
  const s = currentScheme();
  let t = `Palette Studio for Miniatures — shopping list\nBase ${s.base} · ${s.harmony} scheme\n\n`;
  for (const r of shoppingList(s)) t += `${r.role.padEnd(20)} ${r.name} (${r.brand}${r.line && r.line !== '—' ? ' ' + r.line : ''}) ${r.hex}  ΔE ${r.deltaE}\n`;
  t += '\nHex values are approximate; ΔE = perceptual distance to the ideal colour.\n';
  const a = document.createElement('a');
  const href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }));
  a.href = href; a.download = 'palette-shopping-list.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 0); // revoke after the click's download starts
  if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
  toast('Shopping list exported');
}
function doShare() {
  const url = location.href;
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Share link copied')).catch(() => toast('Copy the URL from the address bar'));
  else toast('Copy the URL from the address bar');
}

function wire() {
  $('#q').addEventListener('input', e => { state.q = e.target.value; renderList(); });
  $('#brand').addEventListener('change', e => { state.brand = e.target.value; renderList(); });
  $('#list').addEventListener('click', e => {
    const own = e.target.closest('.own'); if (own) { e.stopPropagation(); toggleOwned(own.dataset.own); return; }
    const b = e.target.closest('.paint'); if (b) selectPaint(b.dataset.id);
  });
  $('#hex').addEventListener('input', e => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
    e.target.value = v;
    if (v.length === 6) { state.customHex = '#' + v; renderHero(); renderActive(); renderList(); announce(); updateUrl(); }
  });
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.harmony = b.dataset.h;
    for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));
    renderActive(); announce(); updateUrl();
  });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
  $('#tabs').addEventListener('keydown', e => {
    const tabs = [...$('#tabs').children];
    const i = tabs.findIndex(b => b.dataset.tab === state.tab);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j >= 0) { e.preventDefault(); setTab(tabs[j].dataset.tab, true); }
  });
  $('#seedRole').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.seedRole = b.dataset.role;
    for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === state.seedRole));
    renderHero(); renderActive(); announce(); updateUrl();
  });
  $('#owned').addEventListener('click', () => { state.ownedOnly = !state.ownedOnly; $('#owned').setAttribute('aria-pressed', String(state.ownedOnly)); renderActive(); });
  $('#compare').addEventListener('click', () => {
    if (state.compareA) { state.compareA = null; $('#compare').setAttribute('aria-pressed', 'false'); }
    else { const s = currentScheme(); state.compareA = { base: schemeBase(), harmony: state.harmony, colors: s.roles.map(r => r.idealHex) }; $('#compare').setAttribute('aria-pressed', 'true'); setTab('plan'); toast('Pinned A — change the scheme to compare'); }
    if (state.tab === 'plan') renderPlan();
  });
  $('#export').addEventListener('click', doExport);
  $('#share').addEventListener('click', doShare);
  $('#theme').addEventListener('click', () => { setTheme(state.theme === 'dark' ? 'light' : 'dark'); updateUrl(); });
}

async function init() {
  const url = new URLSearchParams(location.search);
  let theme = url.get('t');
  if (!theme) { try { theme = localStorage.getItem('ps-theme'); } catch { /* */ } }
  if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme);
  try { state.owned = new Set(JSON.parse(localStorage.getItem('ps-owned') || '[]')); } catch { state.owned = new Set(); }

  state.idx = await loadDataset('./data/paints.json');
  const brands = [...new Set(state.idx.paints.map(p => p.brand))].sort();
  $('#brand').insertAdjacentHTML('beforeend', ui.brandOptions(brands));

  const h = url.get('h'); if (h && isHarmony(h)) state.harmony = h;
  const v = url.get('v'); if (v && renderers[v]) state.tab = v;
  if (url.get('r') === 'accent') { state.seedRole = 'accent'; for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === 'accent')); }
  const c = url.get('c');
  if (c && /^[0-9a-fA-F]{6}$/.test(c)) state.customHex = '#' + c.toUpperCase();
  else state.baseId = state.idx.paints[0].id;

  $('#seg').innerHTML = ui.segmented(HARMONY_TYPES, state.harmony);
  $('#hex').value = baseHex().replace('#', '');
  syncTabs();
  wire();
  renderAll();
}

init().catch(err => {
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${err.message}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
