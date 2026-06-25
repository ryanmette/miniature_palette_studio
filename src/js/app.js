// app.js — application state, dataset loading, entry modes, tabs, conveniences, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/scheme/a11y/ui.

import { HARMONY_TYPES, isHarmony, HARMONY_OFFSETS, harmonize } from './harmony.js';
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
  extraNodes: [], showReal: false,   // free/added wheel nodes [{h,s}] (S5); live-palette ideal↔real fill
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
let wheelDraw = () => {};   // set by setupWheel(); lets discrete base/harmony changes redraw the promoted wheel
/** Derived palette: harmony-rule colours (never stored) + any free/added nodes. Feeds wheel + live palette. */
function paletteNodes() {
  const base = schemeBase();
  const rule = harmonize(base, state.harmony).map((n, i) => ({ id: 'p' + i, kind: i ? 'partner' : 'base', hex: n.hex, deg: n.deg }));
  const free = state.extraNodes.map((o, i) => ({ id: 'x' + i, kind: 'free', deg: null, hex: rgbToHex(hslToRgb([o.h, o.s, state.wheelL])) }));
  return [...rule, ...free];
}
/** Render the variable live palette: one column per harmony/free colour → nearest paint (ideal/real fill). */
function renderLive() {
  const el = $('#livepal'); if (!el) return;
  const vm = paletteNodes().map(n => ({ ...n, match: nearestPaint(state.idx, n.hex, matchOpts()) }));
  el.innerHTML = ui.livePalette(vm, state.showReal ? 'real' : 'ideal');
}
/** Redraw the always-visible studio (wheel + live palette) after a discrete base/harmony change. */
function refreshStudio() {
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);
  wheelDraw(); renderLive();
}
const MAX_FREE = 6;   // bounds URL length + per-frame nearest-paint scans (S5 micro-decision)
/** Add a free/draggable colour node at the widest hue gap (free nodes share the lightness slider). */
function addFreeNode() {
  if (state.extraNodes.length >= MAX_FREE) return;
  const [bh] = rgbToHsl(hexToRgb(baseHex()));
  const hues = [bh, ...HARMONY_OFFSETS[state.harmony].map(o => ((bh + o) % 360 + 360) % 360), ...state.extraNodes.map(n => n.h)].sort((a, b) => a - b);
  let bestGap = -1, at = (bh + 90) % 360;
  for (let i = 0; i < hues.length; i++) {
    const lo = hues[i], hi = i + 1 < hues.length ? hues[i + 1] : hues[0] + 360, g = hi - lo;
    if (g > bestGap) { bestGap = g; at = ((lo + g / 2) % 360 + 360) % 360; }
  }
  state.extraNodes.push({ h: at, s: 0.6 });
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
/** Remove a free node (by index, or the last when omitted). */
function removeFreeNode(idx) {
  if (typeof idx === 'number' && idx >= 0) state.extraNodes.splice(idx, 1); else state.extraNodes.pop();
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
function syncNodeBtns() {
  const a = $('#addnode'), d = $('#delnode');
  if (a) a.disabled = state.extraNodes.length >= MAX_FREE;
  if (d) d.disabled = state.extraNodes.length === 0;
}
function setupWheel() {
  const cv = $('#wheel'), ctx = cv.getContext('2d');
  const COARSE = matchMedia('(pointer:coarse)').matches;
  const NODE = COARSE ? { base: 15, part: 12, hit: 26 } : { base: 11, part: 8, hit: 18 };  // hit: used in S4
  let W, H, cx, cy, R;
  function measure() {                          // size the buffer to the CSS box × DPR; geometry stays in CSS px
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(cv.getBoundingClientRect().width) || 280; H = W;   // square (aspect-ratio:1 in CSS)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);     // draw in CSS px → crisp on retina
    cx = W / 2; cy = H / 2; R = W / 2 - 16;
  }
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];
  $('#wl').value = Math.round(state.wheelL * 100);
  const pos = (h, s) => [cx + Math.sin(h * Math.PI / 180) * s * R, cy - Math.cos(h * Math.PI / 180) * s * R];
  function draw() {
    const b = baseHex();
    const [h, s] = rgbToHsl(hexToRgb(b));
    // Chrome reads from the §3 token set (re-read each draw so a theme toggle is reflected); the
    // hue ring and node fills stay colour *data*. Node bezel uses --surface so it reads as the
    // node punched out of the panel in both the light and the forge-dark theme (§3.1/§10).
    const cs = getComputedStyle(document.documentElement);
    const spoke = cs.getPropertyValue('--border-strong').trim() || '#888';
    const ring = cs.getPropertyValue('--surface').trim() || '#fff';
    ctx.clearRect(0, 0, W, H);
    for (let a = 0; a < 360; a += 6) { const [x, y] = pos(a, 1); ctx.fillStyle = rgbToHex(hslToRgb([a, 0.7, 0.5])); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
    const offs = HARMONY_OFFSETS[state.harmony];
    ctx.strokeStyle = spoke; ctx.lineWidth = 1.5;
    const spokeTo = (hh, ss) => { const [x, y] = pos(hh, ss); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); };
    spokeTo(h, s);                                          // base — a spoke to every colour (Adobe-style)
    for (const o of offs) spokeTo(h + o, s);               // partners
    for (const o of state.extraNodes) spokeTo(o.h, o.s);   // free/added
    for (const o of offs) { const [x, y] = pos(h + o, s); ctx.fillStyle = rotateHue(b, o); ctx.beginPath(); ctx.arc(x, y, NODE.part, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke(); }
    const accent = cs.getPropertyValue('--accent').trim() || '#7C3AED';
    for (const o of state.extraNodes) { const [fx, fy] = pos(o.h, o.s); ctx.fillStyle = rgbToHex(hslToRgb([o.h, o.s, state.wheelL])); ctx.beginPath(); ctx.arc(fx, fy, NODE.part, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = accent; ctx.stroke(); }
    const [bx, by] = pos(h, s); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(bx, by, NODE.base, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ring; ctx.stroke();
  }
  wheelDraw = draw;          // expose the redraw for discrete base/harmony changes (picker, hex, harmony)
  let raf = 0;
  function commit() {
    // Coalesce the heavy redraw (≈nearest-paint scans + canvas) to one per frame, and debounce the
    // history write + aria-live — a drag fires pointermove far faster than WebKit's ~100-calls-per-30s
    // replaceState limit (which would throw mid-drag) and faster than a screen reader can speak.
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); renderLive(); renderHero(); });
    scheduleUrlUpdate(); scheduleAnnounce();
  }
  function setBase(h, s) {
    state.customHex = rgbToHex(hslToRgb([h, s, state.wheelL]));
    $('#hex').value = state.customHex.replace('#', '');
    commit();
  }
  const pointerXY = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const pointerPolar = e => { const [px, py] = pointerXY(e), dx = px - cx, dy = py - cy; return [(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, Math.max(0, Math.min(1, Math.hypot(dx, dy) / R))]; };
  function hitNodes() {                  // screen positions of every grabbable node (base, partners, free)
    const [h, s] = rgbToHsl(hexToRgb(baseHex())), [bx, by] = pos(h, s);
    const ns = [{ kind: 'base', x: bx, y: by }];
    HARMONY_OFFSETS[state.harmony].forEach(o => { const [x, y] = pos(h + o, s); ns.push({ kind: 'partner', deg: o, x, y }); });
    state.extraNodes.forEach((o, i) => { const [x, y] = pos(o.h, o.s); ns.push({ kind: 'free', idx: i, x, y }); });
    return ns;
  }
  function pickNode(e) {                 // nearest node within the touch-safe hit radius (free > partner > base on a tie)
    const [px, py] = pointerXY(e);
    let best = null;
    for (const n of hitNodes()) {
      const d = Math.hypot(n.x - px, n.y - py); if (d > NODE.hit) continue;
      const pri = n.kind === 'free' ? 0 : n.kind === 'partner' ? 1 : 2;
      if (!best || d < best.d - 4 || (d < best.d + 4 && pri < best.pri)) best = { ...n, d, pri };
    }
    return best;
  }
  let active = null, dragging = false;
  function applyDrag(e) {                // route the drag to whichever node was grabbed
    const [ph, ps] = pointerPolar(e);
    if (active && active.kind === 'partner') setBase((ph - active.deg + 360) % 360, ps);   // rotate the whole harmony rigidly
    else if (active && active.kind === 'free') { state.extraNodes[active.idx] = { h: ph, s: ps }; commit(); }
    else setBase(ph, ps);               // base node, or empty space → move the base
  }
  cv.addEventListener('pointerdown', e => { dragging = true; active = pickNode(e); cv.style.cursor = 'grabbing'; cv.setPointerCapture(e.pointerId); applyDrag(e); });
  cv.addEventListener('pointermove', e => { if (dragging) applyDrag(e); });
  cv.addEventListener('pointerup', () => { dragging = false; active = null; cv.style.cursor = 'grab'; updateUrl(); announce(); });
  $('#wl').addEventListener('input', e => { state.wheelL = +e.target.value / 100; const [h, s] = rgbToHsl(hexToRgb(baseHex())); setBase(h, s); });
  $('#wrand').addEventListener('click', () => setBase(Math.random() * 360, 0.5 + Math.random() * 0.45));
  measure();
  draw();
  let rtimer = 0;   // re-measure + redraw when the responsive canvas box changes (resize / orientation / stack)
  window.addEventListener('resize', () => { clearTimeout(rtimer); rtimer = setTimeout(() => { measure(); draw(); }, 150); });
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
const renderers = { plan: renderPlan, equiv: renderEquiv, a11y: renderA11y };
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
let urlTimer = null, announceTimer = null;
function announce() {
  if (announceTimer) { clearTimeout(announceTimer); announceTimer = null; }
  $('#status').textContent = `${baseInfo().name}, ${state.harmony} scheme, ${state.tab} view.`;
}
function updateUrl() {
  if (urlTimer) { clearTimeout(urlTimer); urlTimer = null; }
  const p = new URLSearchParams();
  p.set('c', baseHex().replace('#', ''));
  p.set('h', state.harmony);
  if (state.tab !== 'plan') p.set('v', state.tab);
  if (state.seedRole === 'accent') p.set('r', 'accent');
  if (state.theme === 'dark') p.set('t', 'dark');
  if (state.showReal) p.set('f', '1');
  if (state.extraNodes.length) p.set('x', state.extraNodes.map(n => `${Math.round(n.h)}.${Math.round(n.s * 100)}`).join('-'));
  history.replaceState(null, '', '?' + p.toString());
}
/** Debounced URL write for rapid-fire updates (wheel/slider drag); see setBase(). */
function scheduleUrlUpdate() {
  if (urlTimer) clearTimeout(urlTimer);
  urlTimer = setTimeout(updateUrl, 250);
}
/** Debounced live-region announce — a per-frame announce() during a drag floods screen readers. */
function scheduleAnnounce() {
  if (announceTimer) clearTimeout(announceTimer);
  announceTimer = setTimeout(announce, 400);
}
function renderAll() { renderList(); renderHero(); refreshStudio(); renderActive(); announce(); updateUrl(); }

function setTheme(t) {
  state.theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  try { localStorage.setItem('ps-theme', state.theme); } catch { /* private mode */ }
}
function selectPaint(id) { state.baseId = id; state.customHex = null; $('#hex').value = baseHex().replace('#', ''); renderAll(); }
function syncTabs(focusActive = false) {
  const tabs = $('#tabs');
  for (const b of tabs.children) {
    const sel = b.dataset.tab === state.tab;
    b.setAttribute('aria-selected', String(sel));
    b.tabIndex = sel ? 0 : -1;        // roving tabindex (WAI-ARIA tabs pattern)
    if (sel && focusActive) b.focus();
    // On narrow screens the tab strip scrolls horizontally — keep the active tab in view.
    if (sel && tabs.scrollWidth > tabs.clientWidth) b.scrollIntoView({ inline: 'center', block: 'nearest' });
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
/** Click-to-copy for any [data-copy] element (hero hex, palette blocks). Best-effort + graceful fallback. */
function copyText(val) {
  if (navigator.clipboard) navigator.clipboard.writeText(val).then(() => toast(`Copied ${val}`)).catch(() => toast('Copy unavailable — select the value manually'));
  else toast('Copy unavailable — select the value manually');
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
  $('main').addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) copyText(c.dataset.copy); });
  $('#hex').addEventListener('input', e => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
    e.target.value = v;
    if (v.length === 6) { state.customHex = '#' + v; renderHero(); refreshStudio(); renderActive(); renderList(); announce(); updateUrl(); }
  });
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.harmony = b.dataset.h;
    for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));
    refreshStudio(); renderActive(); announce(); updateUrl();
  });
  $('#realtoggle').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.showReal = b.dataset.fill === 'real';
    for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
    renderLive(); scheduleAnnounce(); updateUrl();
  });
  $('#addnode').addEventListener('click', addFreeNode);
  $('#delnode').addEventListener('click', () => removeFreeNode());
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
    renderHero(); refreshStudio(); renderActive(); announce(); updateUrl();
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
  if (url.get('f') === '1') state.showReal = true;
  const xp = url.get('x');
  if (xp) state.extraNodes = xp.split('-').map(s => { const [hh, sa] = s.split('.'); const H = +hh, S = +sa / 100; return (Number.isFinite(H) && Number.isFinite(S)) ? { h: ((H % 360) + 360) % 360, s: Math.min(1, Math.max(0, S)) } : null; }).filter(Boolean).slice(0, MAX_FREE);
  if (url.get('r') === 'accent') { state.seedRole = 'accent'; for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === 'accent')); }
  const c = url.get('c');
  if (c && /^[0-9a-fA-F]{6}$/.test(c)) state.customHex = '#' + c.toUpperCase();
  else state.baseId = state.idx.paints[0].id;

  $('#seg').innerHTML = ui.segmented(HARMONY_TYPES, state.harmony);
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
  syncNodeBtns();
  $('#hex').value = baseHex().replace('#', '');
  syncTabs();
  wire();
  setupWheel();   // wheel is now always-visible static markup; bind it once
  renderAll();
}

init().catch(err => {
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${err.message}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
