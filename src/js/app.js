// app.js — application state, dataset loading, entry modes, events, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/ui.

import { harmonize, HARMONY_TYPES, isHarmony } from './harmony.js';
import { loadDataset } from './data.js';
import * as ui from './ui.js';

const $ = sel => document.querySelector(sel);
const state = {
  idx: null,
  baseId: null,
  customHex: null,     // entry mode E: a typed hex overrides the picked paint
  harmony: 'complementary',
  q: '',
  brand: '',
  seedRole: 'main',    // entry modes B/C: is the seed the main colour or the accent?
  theme: 'light',
};

const baseHex = () => state.customHex || state.idx.byId.get(state.baseId)?.hex;

function baseInfo() {
  if (state.customHex) return { hex: state.customHex, name: 'Custom ' + state.customHex, custom: true };
  const p = state.idx.byId.get(state.baseId);
  return { hex: p.hex, name: p.name, brand: p.brand, line: p.line, type: p.type, approx: p.approx };
}

function filteredPaints() {
  const q = state.q.toLowerCase();
  return state.idx.paints.filter(p =>
    (!state.brand || p.brand === state.brand) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)));
}

function renderList() {
  const items = filteredPaints();
  $('#list').innerHTML = ui.pickerList(items, state.customHex ? null : state.baseId);
  $('#count').textContent = `${items.length} of ${state.idx.paints.length} paints`;
}
function renderHero() {
  $('#hero').innerHTML = ui.hero(baseInfo());
  $('#baseLabel').textContent = `Base colour · ${state.seedRole}`;
}
function renderStrip() {
  $('#strip').innerHTML = ui.harmonyStrip(harmonize(baseHex(), state.harmony));
}
function announce() {
  $('#status').textContent = `${baseInfo().name}, ${state.harmony} scheme as the ${state.seedRole} colour.`;
}
function updateUrl() {
  const p = new URLSearchParams();
  p.set('c', baseHex().replace('#', ''));
  p.set('h', state.harmony);
  if (state.theme === 'dark') p.set('t', 'dark');
  history.replaceState(null, '', '?' + p.toString());
}
function renderAll() { renderList(); renderHero(); renderStrip(); announce(); updateUrl(); }

function setTheme(t) {
  state.theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  try { localStorage.setItem('ps-theme', state.theme); } catch { /* private mode */ }
}

function selectPaint(id) {
  state.baseId = id; state.customHex = null;
  $('#hex').value = baseHex().replace('#', '');
  renderAll();
}

function wire() {
  $('#q').addEventListener('input', e => { state.q = e.target.value; renderList(); });
  $('#brand').addEventListener('change', e => { state.brand = e.target.value; renderList(); });
  $('#list').addEventListener('click', e => {
    const b = e.target.closest('.paint'); if (b) selectPaint(b.dataset.id);
  });
  $('#hex').addEventListener('input', e => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
    e.target.value = v;
    if (v.length === 6) { state.customHex = '#' + v; renderHero(); renderStrip(); renderList(); announce(); updateUrl(); }
  });
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.harmony = b.dataset.h;
    for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));
    renderStrip(); announce(); updateUrl();
  });
  $('#seedRole').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.seedRole = b.dataset.role;
    for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === state.seedRole));
    renderHero(); announce(); updateUrl();
  });
  $('#theme').addEventListener('click', () => { setTheme(state.theme === 'dark' ? 'light' : 'dark'); updateUrl(); });
}

async function init() {
  const url = new URLSearchParams(location.search);

  // theme: URL → localStorage → prefers-color-scheme
  let theme = url.get('t');
  if (!theme) { try { theme = localStorage.getItem('ps-theme'); } catch { /* */ } }
  if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme);

  state.idx = await loadDataset('./data/paints.json');

  // brand filter options
  const brands = [...new Set(state.idx.paints.map(p => p.brand))].sort();
  $('#brand').insertAdjacentHTML('beforeend', ui.brandOptions(brands));

  // seed from URL, else first paint
  const h = url.get('h'); if (h && isHarmony(h)) state.harmony = h;
  const c = url.get('c');
  if (c && /^[0-9a-fA-F]{6}$/.test(c)) state.customHex = '#' + c.toUpperCase();
  else state.baseId = state.idx.paints[0].id;

  $('#seg').innerHTML = ui.segmented(HARMONY_TYPES, state.harmony);
  $('#hex').value = baseHex().replace('#', '');
  wire();
  renderAll();
}

init().catch(err => {
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${err.message}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
