// app.js — application state, dataset loading, entry modes, tabs, conveniences, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/scheme/a11y/ui.

import { HARMONY_TYPES, isHarmony, isHueHarmony, HARMONY_OFFSETS, harmonize } from './harmony.js';
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, rotateHue, textOn, hexToLab, deltaE2000 } from './color.js';
import { simulateCvd, wcag, minPairDelta } from './a11y.js';
import { loadDataset, equivalents, nearestPaints, nearestPaint, FINISH_TYPES, groupMembers, groupOf } from './data.js';
import { buildScheme, shoppingList, schemeGaps, roleIdeals } from './scheme.js';
import { csvToMarks, marksToCsv } from './collection-io.js';   // collection portability (#27)
import * as ui from './ui.js';
import * as store from './store.js';   // versioned, portable collection + prefs persistence (the only storage chokepoint)
import * as i18n from './i18n.js';      // lightweight UI-string localization (chrome only; paint names never translate)

const $ = sel => document.querySelector(sel);
const state = {
  idx: null, scheme: null,
  baseId: null, customHex: null,
  harmony: 'complementary',
  q: '', brand: '', ptype: '', psort: '', seedRole: 'main', tab: 'plan', theme: 'light',
  compareA: null, wheelL: null, hiHex: null,   // hiHex = the colour link-highlighted across wheel/plan/live palette

  extraNodes: [], showReal: false,   // editable swatches [{h,s,l?,locked?}] (S5); live-palette ideal↔real fill
  dropOffsets: [],                   // harmony offsets "detached" by lock/edit so the rule stops regenerating them
  mode: 'studio', shelfBrand: '', shelfMark: '', shelfQ: '', shelfType: '', shelfSort: '', brands: [],   // Studio/Shelf mode; shelf brand · status · search · type · sort
  ladder: 'wash', collection: 'off',  // #7 tone-ladder style; how the collection drives matching: off | prefer (#6 boost) | only (hard filter)
  includeContrast: false,             // include Contrast paints in harmony suggestions (washes/shades stay excluded)
};
const OWNED_BOOST = 6;   // ΔE the soft owned-boost is "worth" — owned paints up to ~6 ΔE worse can still win (#6)

const baseHex = () => state.customHex || state.idx.byId.get(state.baseId)?.hex;
/** Entry mode C: when the seed is the *accent*, build the scheme around its complement. */
const schemeBase = () => (state.seedRole === 'accent' ? rotateHue(baseHex(), 180) : baseHex());
/** Match/scheme options from the single "use my collection" control: off · prefer (boost) · only (filter). */
function matchOpts() {
  const o = { ladder: state.ladder };
  const owned = store.ownedIds();
  if (state.collection === 'only' && owned.size) o.ownedIds = owned;
  else if (state.collection === 'prefer' && owned.size) { o.boostIds = owned; o.boostAmount = OWNED_BOOST; }
  // Keep finishes (washes/shades/contrast/effects) out of harmony suggestions; Contrast is opt-in.
  const ex = new Set(FINISH_TYPES);
  if (state.includeContrast) ex.delete('contrast');
  o.excludeTypes = ex;
  return o;
}

function baseInfo() {
  if (state.customHex) return { hex: state.customHex, name: 'Custom ' + state.customHex, custom: true };
  const p = state.idx.byId.get(state.baseId);
  return { id: p.id, hex: p.hex, name: p.name, brand: p.brand, line: p.line, type: p.type, approx: p.approx };
}
function basePaint() { return state.customHex ? null : state.idx.byId.get(state.baseId); }
function currentScheme() { return buildScheme(state.idx, schemeBase(), state.harmony, matchOpts()); }

function filteredPaints() {
  const q = state.q.toLowerCase();
  const list = state.idx.paints.filter(p =>
    (!state.brand || p.brand === state.brand) &&
    (!state.ptype || p.type === state.ptype) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)));
  return sortPaints(list);
}
/** Sort a paint list by `key` (stable copy; '' keeps dataset order). Shared by the picker (state.psort)
 *  and the shelf (state.shelfSort). */
function sortPaints(list, key = state.psort) {
  const hsl = p => rgbToHsl(hexToRgb(p.hex));
  switch (key) {
    case 'name': return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    case 'brand': return list.slice().sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
    case 'hue': return list.slice().sort((a, b) => hsl(a)[0] - hsl(b)[0]);
    case 'light': return list.slice().sort((a, b) => hsl(a)[2] - hsl(b)[2]);
    case 'de': { const bl = hexToLab(baseHex()); return list.slice().sort((a, b) => deltaE2000(bl, a.lab) - deltaE2000(bl, b.lab)); }
    case 'owned': return list.slice().sort((a, b) => (store.isOwned(b.id) - store.isOwned(a.id)) || a.name.localeCompare(b.name));
    default: return list;   // dataset order
  }
}

/* ---- per-tab renderers ---- */
function renderPlan() {
  state.scheme = currentScheme();
  const cur = { base: schemeBase(), harmony: state.harmony, colors: state.scheme.roles.map(r => r.idealHex) };
  const cmp = state.compareA ? ui.compareBar(state.compareA, cur) : '';
  // Gaps = paints this scheme needs that you don't own and haven't already flagged to buy (#5).
  const gaps = schemeGaps(state.scheme, store.ownedIds());
  const addable = gaps.filter(g => store.markOf(g.paint.id) !== 'want').length;
  // No overview colour bar here — the role-labelled live palette (beside the wheel) is now the single
  // scheme summary; this tab is its detail (ideal→nearest paint + tone ladders), linked by hover (data-hex).
  $('#panel-plan').innerHTML = cmp + ui.planControls(state.ladder, state.collection, state.includeContrast, addable)
    + '<div class="micro" style="margin:14px 0 0">Each role: ideal colour → nearest real paint (ΔE 2000), plus the selected tone ladder</div>'
    + ui.roleSlots(state.scheme, store.markOf);
}
let wheelDraw = () => {};   // set by setupWheel(); lets discrete base/harmony changes redraw the promoted wheel
/** node ideal-hex (UPPER) → role glyph (P/A/2) for the current scheme. Keyed off schemeBase() so it's
 *  correct in accent-seed mode (the base node is then the Accent); Metal has no wheel node. */
function wheelRoleGlyphs() {
  const m = {};
  // The wheel draws its nodes off baseHex(); the scheme's roles are off schemeBase(). In accent-seed mode
  // those frames are 180° apart, so the wheel nodes don't map to the scheme roles (they'd mislabel/vanish).
  // Only badge roles when the two frames coincide (main mode); the live palette + Plan still carry roles.
  if (state.seedRole === 'accent') return m;
  for (const d of roleIdeals(schemeBase(), state.harmony)) {
    if (d.metal) continue;
    m[d.idealHex.toUpperCase()] = d.role === 'Primary' ? 'P' : d.role === 'Accent' ? 'A' : '2';
  }
  return m;
}
/** Derived palette: harmony-rule colours (never stored) + any free/added nodes. Feeds wheel + live palette. */
function paletteNodes() {
  const base = schemeBase();
  const drop = new Set(state.dropOffsets);
  const hueH = isHueHarmony(state.harmony);   // value harmonies (shades/mono) can't be uniquely detached by hue
  const rule = harmonize(base, state.harmony)
    .map((n, i) => ({ id: 'p' + i, kind: i ? 'partner' : 'base', hex: n.hex, deg: n.deg, detachable: i > 0 && hueH }))
    .filter(n => n.kind === 'base' || !drop.has(n.deg));   // a detached (locked/edited) partner is now a free swatch
  const free = state.extraNodes.map((o, i) => ({ id: 'x' + i, kind: 'free', deg: null, locked: !!o.locked,
    hex: rgbToHex(hslToRgb([o.h, o.s, o.l ?? state.wheelL])) }));
  return [...rule, ...free];
}
/** Render the variable live palette: one column per harmony/free colour → nearest paint (ideal/real fill). */
function renderLive() {
  const el = $('#livepal'); if (!el) return;
  const opts = matchOpts();
  // Role map (Primary/Secondary/Accent/Metal) so each column reads in the Plan's language — see livePalette.
  const ideals = roleIdeals(schemeBase(), state.harmony);
  const roleByHex = {};
  for (const d of ideals) roleByHex[d.idealHex.toUpperCase()] = d.role;
  const vm = paletteNodes().map(n => ({ ...n, match: nearestPaint(state.idx, n.hex, opts) }));
  // Metal has no wheel node, so it rides along as a display-only column → the live palette is the complete
  // scheme summary (one bar, all four roles), letting the Plan drop its duplicate overview strip.
  const metal = ideals.find(d => d.metal);
  vm.push({ id: 'metal', kind: 'metal', hex: metal.idealHex, match: nearestPaint(state.idx, metal.idealHex, { ...opts, types: new Set(['metal']) }) });
  el.innerHTML = ui.livePalette(vm, state.showReal ? 'real' : 'ideal', roleByHex);
  applyLinkHighlight();   // re-assert any active hover-link after the columns are rebuilt
}
/** Cross-surface colour link (§3 "one instrument"): hovering/focusing a role block (Plan, right) or a
 *  live-palette column (left) rings the *same colour* wherever it appears — both DOM surfaces + the wheel
 *  node — so the wheel and the plan read as one tool. Transient interaction → outline ring (§3.5), never a
 *  border-width change (no reflow, §3.4). hex=null clears. */
function applyLinkHighlight() {
  const h = state.hiHex;
  for (const el of document.querySelectorAll('[data-hex]'))
    el.classList.toggle('linkhi', h != null && el.dataset.hex.toUpperCase() === h);
}
function linkHighlight(hex) {
  const h = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;
  if (state.hiHex === h) return;
  state.hiHex = h;
  applyLinkHighlight();
  wheelDraw();   // redraw so the matching wheel node gains/loses its ring
}
/** Redraw the always-visible studio (wheel + live palette) after a discrete base/harmony change. */
function refreshStudio() {
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);
  wheelDraw(); renderLive();
}
const MAX_FREE = 6;   // bounds URL length + per-frame nearest-paint scans (S5 micro-decision)
/** Add a colour "along the line": extend the base's value ramp (alternating lighter/darker tints &
 *  shades, stepping outward) rather than inventing a new hue. New swatches are draggable + editable. */
function addFreeNode() {
  if (state.extraNodes.length >= MAX_FREE) return;
  const [bh, bs, bl] = rgbToHsl(hexToRgb(baseHex()));
  const k = state.extraNodes.length, dir = k % 2 === 0 ? 1 : -1, mag = 0.12 + 0.10 * Math.floor(k / 2);
  const l = Math.min(0.94, Math.max(0.06, bl + dir * mag));
  state.extraNodes.push({ h: bh, s: bs, l });
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
/** Current hex of an addressable swatch key ('base' | 'p:<deg>' | 'x:<idx>'). */
function swatchHex(sw) {
  if (sw.startsWith('p:')) return rotateHue(baseHex(), +sw.slice(2));
  if (sw.startsWith('x:')) { const o = state.extraNodes[+sw.slice(2)]; if (o) return rgbToHex(hslToRgb([o.h, o.s, o.l ?? state.wheelL])); }
  return baseHex();
}
/** Detach a harmony partner into the editable free-swatch list (so lock/edit can pin it independently). */
function detachPartner(deg, extra) {
  if (state.extraNodes.length >= MAX_FREE) return false;
  const [bh, bs] = rgbToHsl(hexToRgb(baseHex()));
  if (!state.dropOffsets.includes(deg)) state.dropOffsets.push(deg);
  state.extraNodes.push({ h: ((bh + deg) % 360 + 360) % 360, s: bs, l: state.wheelL, ...extra });
  return true;
}
/** Lock toggle for a swatch — locked swatches survive Generate + harmony changes. The base can't be locked. */
function lockSwatch(sw) {
  if (sw === 'base') return;
  if (sw.startsWith('p:')) detachPartner(+sw.slice(2), { locked: true });
  else if (sw.startsWith('x:')) { const o = state.extraNodes[+sw.slice(2)]; if (o) o.locked = !o.locked; }
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
/** Set an arbitrary hex on a swatch (the base re-seeds; any other swatch becomes a pinned free swatch). */
function editSwatch(sw, hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  if (sw === 'base') { seedFromHex(hex); return; }
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (sw.startsWith('p:')) detachPartner(+sw.slice(2), { h, s, l });
  else if (sw.startsWith('x:')) { const i = +sw.slice(2); if (state.extraNodes[i]) state.extraNodes[i] = { ...state.extraNodes[i], h, s, l }; }
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
let swEditTarget = null;   // swatch key being edited via the native colour picker
/** Open the per-swatch colour editor (native picker), seeded with the swatch's current colour. */
function openSwatchEditor(sw) { const inp = $('#swEdit'); if (!inp) return; swEditTarget = sw; inp.value = swatchHex(sw); inp.click(); }
/** Move an added swatch within the free list (drag-reorder). */
function moveFreeNode(from, to) {
  const a = state.extraNodes;
  if (!(from >= 0 && from < a.length && to >= 0 && to < a.length) || from === to) return;
  const [m] = a.splice(from, 1); a.splice(to, 0, m);
  wheelDraw(); renderLive(); updateUrl();
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
  const disc = document.createElement('canvas');   // offscreen filled HSV disc, rasterised once per (size, lightness)
  let discKey = '';
  function buildDisc() {                            // hue = angle, saturation = radius, lightness = the wheel slider
    const key = W + ':' + Math.round(state.wheelL * 100);   // colour data only → theme-independent; cached
    if (key === discKey) return;
    discKey = key; disc.width = W; disc.height = H;
    const dctx = disc.getContext('2d'), img = dctx.createImageData(W, H), data = img.data, L = state.wheelL;
    for (let j = 0; j < H; j++) {
      const dy = j - cy;
      for (let i = 0; i < W; i++) {
        const dx = i - cx, dist = Math.sqrt(dx * dx + dy * dy), idx = (j * W + i) * 4;
        if (dist > R + 0.5) { data[idx + 3] = 0; continue; }   // outside the disc → transparent
        const [r, g, bl] = hslToRgb([(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, dist >= R ? 1 : dist / R, L]);
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;
      }
    }
    dctx.putImageData(img, 0, 0);
  }
  function draw() {
    const b = baseHex();
    const [h, s] = rgbToHsl(hexToRgb(b));
    // Chrome (spokes/rings/halo) reads from the §3 token set (re-read each draw so a theme toggle is
    // reflected); the HSV disc + node fills are colour *data*. Node outlines use a per-node contrast
    // (textOn) so they stay visible on any colour in both the light and forge-dark themes (§3.1/§10).
    const cs = getComputedStyle(document.documentElement);
    const spoke = cs.getPropertyValue('--border-strong').trim() || '#888';
    ctx.clearRect(0, 0, W, H);
    buildDisc(); ctx.drawImage(disc, 0, 0, W, H);   // filled HSV colour field (replaces the dotted hue ring)
    const offs = HARMONY_OFFSETS[state.harmony];
    const hueH = isHueHarmony(state.harmony);   // value harmonies (shades/mono) have no ring partners to draw
    ctx.strokeStyle = spoke; ctx.lineWidth = 1.5;
    const spokeTo = (hh, ss) => { const [x, y] = pos(hh, ss); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); };
    spokeTo(h, s);                                          // base — a spoke to every colour (Adobe-style)
    if (hueH) for (const o of offs) if (!state.dropOffsets.includes(o)) spokeTo(h + o, s);   // hue partners (skip detached)
    for (const o of state.extraNodes) spokeTo(o.h, o.s);   // free/added
    if (hueH) for (const o of offs) { if (state.dropOffsets.includes(o)) continue; const [x, y] = pos(h + o, s), ph = rotateHue(b, o); ctx.fillStyle = ph; ctx.beginPath(); ctx.arc(x, y, NODE.part, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = textOn(ph); ctx.stroke(); }
    const accent = cs.getPropertyValue('--accent').trim() || '#7C3AED';
    for (const o of state.extraNodes) { const [fx, fy] = pos(o.h, o.s); ctx.fillStyle = rgbToHex(hslToRgb([o.h, o.s, o.l ?? state.wheelL])); ctx.beginPath(); ctx.arc(fx, fy, NODE.part, 0, 7); ctx.fill(); ctx.lineWidth = o.locked ? 3.5 : 2.5; ctx.strokeStyle = accent; ctx.stroke(); }
    const [bx, by] = pos(h, s); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(bx, by, NODE.base, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = textOn(b); ctx.stroke();
    if (focused && !dragging) { const ns = hitNodes(), n = ns[Math.min(activeIdx, ns.length - 1)]; if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, NODE.base + 6, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = accent; ctx.stroke(); } }
    // Role badges: stamp P / A / 2 on the node that plays each role, so the wheel says which is the
    // Primary/Accent/Secondary (legend below decodes it). Token pair (--accent / --on-accent + --surface
    // ring) → legible on any node colour in both themes; clamped inside the disc so a rim node's badge
    // can't fall off the edge. The map is keyed by drawn hex, so it's correct in accent-seed mode too.
    const rg = wheelRoleGlyphs();
    if (Object.keys(rg).length) {
      const surf = cs.getPropertyValue('--surface').trim() || '#fff';
      const onAcc = cs.getPropertyValue('--on-accent').trim() || '#fff';
      const r = COARSE ? 10 : 8.5;
      for (const n of hitNodes()) {
        const nh = (n.kind === 'base' ? b : n.kind === 'partner' ? rotateHue(b, n.deg) : rgbToHex(hslToRgb([n.h, n.s, state.extraNodes[n.idx]?.l ?? state.wheelL]))).toUpperCase();
        const g = rg[nh]; if (!g) continue;
        let bxr = n.x + 12, byr = n.y - 12;
        const vx = bxr - cx, vy = byr - cy, dd = Math.hypot(vx, vy), lim = R - r - 1;
        if (dd > lim) { bxr = cx + vx / dd * lim; byr = cy + vy / dd * lim; }
        ctx.beginPath(); ctx.arc(bxr, byr, r, 0, 7); ctx.fillStyle = accent; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = surf; ctx.stroke();
        ctx.fillStyle = onAcc; ctx.font = '700 ' + (COARSE ? 12 : 10) + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g, bxr, byr);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';   // reset so later canvas text is unaffected
      }
    }
    // Colour link (hover a role/column elsewhere): ring whichever node is that same colour — recomputing
    // each node's drawn hex the way it's filled, so the match is exact (no wheelL/rounding drift).
    if (state.hiHex) for (const n of hitNodes()) {
      const nh = n.kind === 'base' ? b : n.kind === 'partner' ? rotateHue(b, n.deg)
        : rgbToHex(hslToRgb([n.h, n.s, state.extraNodes[n.idx]?.l ?? state.wheelL]));
      if (nh.toUpperCase() === state.hiHex) { ctx.beginPath(); ctx.arc(n.x, n.y, NODE.base + 5, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = accent; ctx.stroke(); }
    }
  }
  wheelDraw = draw;          // expose the redraw for discrete base/harmony changes (picker, hex, harmony)
  let raf = 0;
  function commit() {
    // Coalesce the heavy redraw (≈nearest-paint scans + canvas) to one per frame, and debounce the
    // history write + aria-live — a drag fires pointermove far faster than WebKit's ~100-calls-per-30s
    // replaceState limit (which would throw mid-drag) and faster than a screen reader can speak.
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); renderLive(); renderHero(false); });   // no pop during a live drag
    scheduleUrlUpdate(); scheduleAnnounce();
  }
  function setBase(h, s) {
    // Adobe-style: moving the base moves everything. Partners are derived (they already follow);
    // free nodes are absolute, so rotate them by the base's hue delta to keep their relationship.
    const dh = ((h - rgbToHsl(hexToRgb(baseHex()))[0]) % 360 + 360) % 360;
    if (dh && state.extraNodes.length) state.extraNodes = state.extraNodes.map(n => n.locked ? n : { ...n, h: ((n.h + dh) % 360 + 360) % 360 });
    state.customHex = rgbToHex(hslToRgb([h, s, state.wheelL]));
    $('#hex').value = state.customHex.replace('#', '');
    commit();
  }
  const pointerXY = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const pointerPolar = e => { const [px, py] = pointerXY(e), dx = px - cx, dy = py - cy; return [(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, Math.max(0, Math.min(1, Math.hypot(dx, dy) / R))]; };
  function hitNodes() {                  // every grabbable node: kind, its hue/sat, and screen position
    const [h, s] = rgbToHsl(hexToRgb(baseHex())), [bx, by] = pos(h, s);
    const ns = [{ kind: 'base', h, s, x: bx, y: by }];
    if (isHueHarmony(state.harmony)) HARMONY_OFFSETS[state.harmony].forEach(o => { if (state.dropOffsets.includes(o)) return; const ph = ((h + o) % 360 + 360) % 360, [x, y] = pos(ph, s); ns.push({ kind: 'partner', deg: o, h: ph, s, x, y }); });
    state.extraNodes.forEach((o, i) => { const [x, y] = pos(o.h, o.s); ns.push({ kind: 'free', idx: i, h: o.h, s: o.s, x, y }); });
    return ns;
  }
  function pickNode(e) {                 // nearest node within the touch-safe hit radius (free > partner > base on a tie)
    const [px, py] = pointerXY(e);
    let best = null;
    hitNodes().forEach((n, i) => {
      const d = Math.hypot(n.x - px, n.y - py); if (d > NODE.hit) return;
      const pri = n.kind === 'free' ? 0 : n.kind === 'partner' ? 1 : 2;
      if (!best || d < best.d - 4 || (d < best.d + 4 && pri < best.pri)) best = { ...n, d, pri, index: i };
    });
    return best;
  }
  let active = null, dragging = false, activeIdx = 0, focused = false;
  function applyDrag(e) {                // route the drag to whichever node was grabbed
    const [ph, ps] = pointerPolar(e);
    if (active && active.kind === 'partner') setBase((ph - active.deg + 360) % 360, ps);   // rotate the whole harmony rigidly
    else if (active && active.kind === 'free') { state.extraNodes[active.idx] = { h: ph, s: ps }; commit(); }
    else setBase(ph, ps);               // base node, or empty space → move the base
  }
  cv.addEventListener('pointerdown', e => { dragging = true; active = pickNode(e); activeIdx = active ? active.index : 0; cv.style.cursor = 'grabbing'; cv.setPointerCapture(e.pointerId); applyDrag(e); });
  cv.addEventListener('pointermove', e => { if (dragging) applyDrag(e); });
  cv.addEventListener('pointerup', () => { dragging = false; active = null; cv.style.cursor = 'grab'; updateUrl(); announce(); });
  // --- keyboard operability (WCAG): focus the wheel, then arrows adjust the active node, [ ] cycle, +/- add/remove ---
  function announceActive() {
    const ns = hitNodes(); if (!ns.length) return;
    const n = ns[Math.min(activeIdx, ns.length - 1)];
    const label = n.kind === 'base' ? 'Base' : n.kind === 'free' ? 'Added colour' : `Partner ${Math.round(n.deg)} degrees`;
    const hex = rgbToHex(hslToRgb([n.h, n.s, state.wheelL]));
    const b = baseHex();
    const dhex = (n.kind === 'base' ? b : n.kind === 'partner' ? rotateHue(b, n.deg) : hex).toUpperCase();
    const rgl = wheelRoleGlyphs()[dhex];                         // name the role for non-visual users
    const role = rgl === 'P' ? 'Primary, ' : rgl === 'A' ? 'Accent, ' : rgl === '2' ? 'Secondary, ' : '';
    const m = nearestPaint(state.idx, hex, matchOpts());
    $('#status').textContent = m ? `${role}${label}, ${hex}, nearest ${m.paint.name}, ΔE ${m.deltaE.toFixed(1)}.` : `${role}${label}, ${hex}, no close paint.`;
  }
  function nudgeActive(dh, ds) {
    const ns = hitNodes(); activeIdx = Math.min(activeIdx, ns.length - 1);
    const n = ns[activeIdx];
    const nh = ((n.h + dh) % 360 + 360) % 360, nsv = Math.max(0, Math.min(1, n.s + ds));
    if (n.kind === 'free') { state.extraNodes[n.idx] = { h: nh, s: nsv }; commit(); }
    else setBase(n.kind === 'partner' ? ((nh - n.deg) % 360 + 360) % 360 : nh, nsv);
  }
  cv.addEventListener('focus', () => { focused = true; const ns = hitNodes(); activeIdx = Math.min(activeIdx, ns.length - 1); announceActive(); draw(); });
  cv.addEventListener('blur', () => { focused = false; draw(); });
  cv.addEventListener('keydown', e => {
    const len = hitNodes().length, big = e.shiftKey ? 5 : 1;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': nudgeActive(-2 * big, 0); break;
      case 'ArrowRight': nudgeActive(2 * big, 0); break;
      case 'ArrowUp': nudgeActive(0, 0.04 * big); break;
      case 'ArrowDown': nudgeActive(0, -0.04 * big); break;
      case '[': activeIdx = (activeIdx - 1 + len) % len; announceActive(); draw(); break;
      case ']': activeIdx = (activeIdx + 1) % len; announceActive(); draw(); break;
      case '+': case '=': addFreeNode(); activeIdx = hitNodes().length - 1; announceActive(); draw(); break;
      case '-': case '_': removeFreeNode(); activeIdx = Math.min(activeIdx, hitNodes().length - 1); announceActive(); draw(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });
  $('#wl').addEventListener('input', e => { state.wheelL = +e.target.value / 100; const [h, s] = rgbToHsl(hexToRgb(baseHex())); setBase(h, s); });
  $('#wrand').addEventListener('click', () => setBase(Math.random() * 360, 0.5 + Math.random() * 0.45));
  measure();
  draw();
  let rtimer = 0;   // re-measure + redraw when the responsive canvas box changes (resize / orientation / stack)
  window.addEventListener('resize', () => { clearTimeout(rtimer); rtimer = setTimeout(() => { measure(); draw(); }, 150); });
}
function renderEquiv() {
  const p = basePaint();
  if (p) {
    const self = state.idx.byId.get(p.id);
    const members = groupMembers(state.idx, self);                 // curated equivalents (ΔE ≤ 1)
    const memberIds = new Set(members.map(m => m.id));
    const label = groupOf(state.idx, self)?.label || 'this colour';
    const eq = equivalents(state.idx, self, { n: 8 }).filter(e => !memberIds.has(e.paint.id));   // avoid dupes
    $('#panel-equiv').innerHTML = ui.equivGroup(label, members, store.markOf)
      + ui.equivalentsPanel(`${p.name} (${p.brand})`, eq, store.markOf);
  } else {
    $('#panel-equiv').innerHTML = ui.equivalentsPanel(`your colour ${baseHex()}`, nearestPaints(state.idx, baseHex(), 8), store.markOf);
  }
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
  const contrasts = [mk(colors[0], colors[2], 'Primary', 'Accent'), mk(colors[0], '#FFFFFF', 'Primary', 'white'), mk(colors[0], '#000000', 'Primary', 'black')];
  const col = minPairDelta(colors, 'deuteranopia');
  let collision = null;
  if (col.delta < 10) {
    const [i, j] = col.pair;
    collision = { roles: [names[i], names[j]], delta: col.delta };
    // Shift whichever of the *colliding* roles is least disruptive to move — the old code
    // always rotated the Accent, so it couldn't fix e.g. a Primary/Secondary collision.
    const freedom = { Accent: 0, Secondary: 1, Metal: 2, Primary: 3 };
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

/* ---- shelf (collection) — Finder-style bulk stocking, wired to store.setMark ---- */
const COARSE = matchMedia('(pointer:coarse)').matches;   // touch = tap-to-cycle; mouse = multi-select (locked decisions)
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');   // ⌘ vs Ctrl for select-toggle
const shelf = { sel: new Set(), anchor: null, cursor: null, hover: null, selectMode: false };   // ids; selection is transient (not persisted)
const shelfPaints = () => {
  const q = state.shelfQ.trim().toLowerCase();
  const list = state.idx.paints.filter(p =>
    (!state.shelfBrand || p.brand === state.shelfBrand) &&
    (!state.shelfMark || store.markOf(p.id) === state.shelfMark) &&   // status filter: '' (all) | owned | want
    (!state.shelfType || p.type === state.shelfType) &&               // type filter (base/layer/shade/metal/…)
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
       || (p.line && p.line !== '—' && p.line.toLowerCase().includes(q))));
  return sortPaints(list, state.shelfSort);
};
const cellEl = id => document.getElementById('sc-' + id);
const gridCols = () => { const g = $('#shelfGrid'); return Math.max(1, getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length); };

function shelfHint() {
  if (COARSE) return shelf.selectMode
    ? 'Select mode: tap swatches, then Owned / To buy / Clear below. Long-press a swatch for the menu.'
    : 'Tap a swatch to cycle owned → to buy → clear · “Select” for multi · long-press for the menu.';
  return 'Click to select · ⇧ or ⌘ for many · drag a box · then P (owned) · U (to buy) · X (clear). Right-click for options.';
}
function renderShelfStats() {
  const c = store.counts(), total = state.idx.paints.length;
  $('#shelfStats').innerHTML = `<span class="s-owned">${c.owned} owned</span> · <span class="s-want">${c.want} to buy</span> · ${total} total`;
}
function renderShelfBar() {
  $('#shelfBar').innerHTML = ui.shelfBar(shelf.sel.size);
}
function renderShelf() {
  $('#shelfHint').textContent = shelfHint();   // persistent how-to, up under the stats (mockup feedback)
  for (const b of $('#shelfMarkSeg').children) b.setAttribute('aria-pressed', String(b.dataset.mark === state.shelfMark));
  $('#brandChips').innerHTML = ui.brandChips(state.brands, state.shelfBrand);
  $('#shelfGrid').innerHTML = ui.shelfGrid(shelfPaints(), store.markOf, shelf.sel);
  // tag each cell with a DOM id for aria-activedescendant (keyboard cursor)
  for (const c of $('#shelfGrid').children) c.id = 'sc-' + c.dataset.id;
  renderShelfStats(); renderShelfBar();
}
/** A shelf filter (brand/status/type/search) changed → membership changes, so drop the selection
 *  (its ids may no longer be visible) and re-render. Sorting uses renderShelf directly (keeps selection). */
function shelfFilterChanged() { setSelection([], { anchor: null, cursor: null }); renderShelf(); }
function announceShelf(msg) { $('#status').textContent = msg; }

/* selection primitives — outline only (CSS), so no reflow (§3.4) */
function paintSelected() {
  for (const c of $('#shelfGrid').children) c.setAttribute('aria-selected', String(shelf.sel.has(c.dataset.id)));
}
function setSelection(ids, { anchor, cursor } = {}) {
  shelf.sel = new Set(ids);
  if (anchor !== undefined) shelf.anchor = anchor;
  if (cursor !== undefined) shelf.cursor = cursor;
  paintSelected(); setCursor(shelf.cursor); renderShelfBar();
}
function setCursor(id) {
  shelf.cursor = id;
  const g = $('#shelfGrid');
  for (const c of g.children) c.classList.toggle('cursor', c.dataset.id === id);
  if (id) g.setAttribute('aria-activedescendant', 'sc-' + id); else g.removeAttribute('aria-activedescendant');
}
function rangeIds(aId, bId) {
  const list = shelfPaints().map(p => p.id);
  let i = list.indexOf(aId), j = list.indexOf(bId);
  if (i < 0) i = j; if (i < 0 || j < 0) return bId ? [bId] : [];
  if (i > j) [i, j] = [j, i];
  return list.slice(i, j + 1);
}
/** Apply a mark ('owned'|'want'|'none') to the current selection (or the cursor/hover cell as a fallback). */
function applyMark(mark) {
  let ids = [...shelf.sel];
  if (!ids.length) { const f = shelf.cursor || shelf.hover; if (f) ids = [f]; }
  if (!ids.length) return;
  for (const id of ids) {
    store.setMark(id, mark);
    const c = cellEl(id); if (c) { updateCell(c, mark); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
  }
  renderShelfStats();
  const verb = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'cleared';
  announceShelf(`${ids.length} ${ids.length === 1 ? 'paint' : 'paints'} marked ${verb}.`);
  // If a status filter is active and these paints no longer match it, drop them from view.
  if (state.shelfMark && state.shelfMark !== mark) { setSelection([], { anchor: null, cursor: null }); renderShelf(); }
}
function updateCell(c, mark) {
  c.dataset.mark = mark;
  c.querySelector('.cbadge')?.remove();
  const html = ui.markBadge(mark);
  if (html) c.querySelector('.celltip').insertAdjacentHTML('beforebegin', html);
  const st = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned';
  c.setAttribute('aria-label', c.getAttribute('aria-label').replace(/—.*$/, '— ' + st));
}

/* mouse: click-select + marquee drag (mouse only; touch uses tap-to-cycle) */
function setupShelf() {
  const grid = $('#shelfGrid');
  grid.addEventListener('pointerover', e => { const c = e.target.closest('.cell'); shelf.hover = c ? c.dataset.id : null; });
  grid.addEventListener('pointerout', e => { if (!e.relatedTarget || !grid.contains(e.relatedTarget)) shelf.hover = null; });

  if (COARSE) {                                  // touch: tap-to-cycle, or Select-mode multi-select; long-press → menu
    let lpTimer = null, sx = 0, sy = 0, suppressTap = false;
    const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    grid.addEventListener('pointerdown', e => {
      const c = e.target.closest('.cell'); if (!c) return;
      sx = e.clientX; sy = e.clientY; suppressTap = false;
      lpTimer = setTimeout(() => {               // long-press → context menu for this cell (any mode)
        lpTimer = null; suppressTap = true;
        if (!shelf.sel.has(c.dataset.id)) setSelection([c.dataset.id], { anchor: c.dataset.id, cursor: c.dataset.id });
        openMenu(e.clientX, e.clientY);
      }, 500);
    });
    grid.addEventListener('pointermove', e => { if (lpTimer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancelLP(); });
    grid.addEventListener('pointerup', cancelLP);
    grid.addEventListener('pointercancel', cancelLP);
    grid.addEventListener('click', e => {
      const c = e.target.closest('.cell'); if (!c) return;
      if (suppressTap) { suppressTap = false; return; }   // long-press already handled this tap
      if (shelf.selectMode) {                    // tap toggles selection (bulk-mark via the action bar)
        const s = new Set(shelf.sel); s.has(c.dataset.id) ? s.delete(c.dataset.id) : s.add(c.dataset.id);
        setSelection(s, { anchor: c.dataset.id, cursor: c.dataset.id });
      } else {                                    // tap cycles this swatch's mark (approach C)
        const next = { none: 'owned', owned: 'want', want: 'none' }[c.dataset.mark || 'none'];
        store.setMark(c.dataset.id, next); updateCell(c, next);
        c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
        renderShelfStats();
        if (state.shelfMark && state.shelfMark !== next) renderShelf();   // dropped out of the active status filter
      }
    });
    return;
  }

  let down = null, marquee = null, base = null, moved = false, dragRects = null;
  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;                   // left button only (right-click → context menu)
    // On macOS, Ctrl+click IS the system secondary-click (fires contextmenu) — so use ⌘ (meta) as the
    // multi-select toggle there, and Ctrl elsewhere. Avoids a Ctrl+click both toggling AND opening the menu.
    const toggle = IS_MAC ? e.metaKey : e.ctrlKey;
    const c = e.target.closest('.cell');
    down = { x: e.clientX, y: e.clientY, id: c ? c.dataset.id : null, shift: e.shiftKey, meta: toggle };
    base = (down.shift || down.meta) ? new Set(shelf.sel) : new Set();
    moved = false; dragRects = null; grid.setPointerCapture(e.pointerId);
  });
  grid.addEventListener('pointermove', e => {
    if (!down) return;
    if (!moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return;   // movement threshold → drag
    moved = true;
    const r = grid.getBoundingClientRect();
    if (!marquee) {
      marquee = document.createElement('div'); marquee.className = 'marquee'; grid.appendChild(marquee);
      // snapshot cell rects once — they don't move during a captured drag, so we avoid a 554× layout read per move
      dragRects = [...grid.children].filter(el => el !== marquee).map(el => ({ id: el.dataset.id, b: el.getBoundingClientRect() }));
    }
    const x0 = Math.min(down.x, e.clientX), y0 = Math.min(down.y, e.clientY), x1 = Math.max(down.x, e.clientX), y1 = Math.max(down.y, e.clientY);
    marquee.style.left = (x0 - r.left) + 'px'; marquee.style.top = (y0 - r.top) + 'px';
    marquee.style.width = (x1 - x0) + 'px'; marquee.style.height = (y1 - y0) + 'px';
    const hit = new Set(base);
    for (const { id, b } of dragRects) {
      if (id && b.right > x0 && b.left < x1 && b.bottom > y0 && b.top < y1) hit.add(id);
    }
    shelf.sel = hit; paintSelected(); renderShelfBar();
  });
  grid.addEventListener('pointerup', e => {
    if (!down) return;
    if (marquee) { marquee.remove(); marquee = null; }
    if (!moved) {                                  // a click, not a drag → Finder selection rules
      const id = down.id;
      if (!id) setSelection([], { anchor: null, cursor: null });
      else if (down.shift && shelf.anchor) setSelection(rangeIds(shelf.anchor, id), { cursor: id });
      else if (down.meta) { const s = new Set(shelf.sel); s.has(id) ? s.delete(id) : s.add(id); setSelection(s, { anchor: id, cursor: id }); }
      else setSelection([id], { anchor: id, cursor: id });
    } else {
      shelf.anchor = down.id || shelf.anchor; setCursor(down.id || shelf.cursor); renderShelfBar();
    }
    down = null; base = null;
  });

  // right-click context menu → mark the selection (selecting the target first if it's outside the selection)
  grid.addEventListener('contextmenu', e => {
    const c = e.target.closest('.cell'); if (!c) return;
    e.preventDefault();
    if (!shelf.sel.has(c.dataset.id)) setSelection([c.dataset.id], { anchor: c.dataset.id, cursor: c.dataset.id });
    openMenu(e.clientX, e.clientY);
  });
}

let menuOpen = false;
function openMenu(x, y) {
  const m = $('#shelfMenu'); m.hidden = false; menuOpen = true;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, innerWidth - w - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  m.querySelector('button')?.focus();
}
function closeMenu() { if (menuOpen) { $('#shelfMenu').hidden = true; menuOpen = false; $('#shelfGrid').focus(); } }

/** Lightroom-style keyboard triage; active only in shelf mode, ignored while typing in a field. */
function shelfKeydown(e) {
  if (state.mode !== 'shelf') return;
  const ae = document.activeElement;
  // act only when the grid (or nothing) has focus — never hijack keys from chips, nav, or a text field
  if (ae && ae !== document.body && ae.id !== 'shelfGrid' && !ae.closest('#shelfGrid')) return;
  const k = e.key.toLowerCase();
  if (k === 'p') { applyMark('owned'); e.preventDefault(); }
  else if (k === 'u') { applyMark('want'); e.preventDefault(); }
  else if (k === 'x') { applyMark('none'); e.preventDefault(); }
  else if (e.key === 'Escape') { if (menuOpen) closeMenu(); else setSelection([], { anchor: null }); e.preventDefault(); }
  else if (e.key.startsWith('Arrow')) { moveCursor(e.key, e.shiftKey); e.preventDefault(); }
}
function moveCursor(key, extend) {
  const list = shelfPaints().map(p => p.id); if (!list.length) return;
  let i = shelf.cursor ? list.indexOf(shelf.cursor) : -1;
  if (i < 0) i = 0;
  else { const cols = gridCols(); i += key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : key === 'ArrowDown' ? cols : -cols; }
  i = Math.max(0, Math.min(list.length - 1, i));
  const id = list[i];
  if (extend && shelf.anchor) setSelection(rangeIds(shelf.anchor, id), { cursor: id });
  else setSelection([id], { anchor: id, cursor: id });
  cellEl(id)?.scrollIntoView({ block: 'nearest' });
  const p = state.idx.byId.get(id);
  announceShelf(`${p.name}, ${p.brand}, ${store.markOf(id) === 'owned' ? 'owned' : store.markOf(id) === 'want' ? 'to buy' : 'not owned'}.`);
}

/* ---- chrome ---- */
function renderList() {
  const items = filteredPaints();
  $('#list').innerHTML = ui.paintStrip(items, state.customHex ? null : state.baseId, store.markOf);
  $('#count').textContent = `${items.length} of ${state.idx.paints.length} paints${store.counts().owned ? ` · ${store.counts().owned} owned` : ''}`;
}
/* ---- paint drawer: the picker as a tray that drops from the seed toolbar (overlay → no reflow, §3.4) ---- */
let paintsOpen = false, paintMenuOpen = false, paintMenuId = null;
function openPaints() {
  paintsOpen = true;
  const d = $('#paintsDrawer'); d.hidden = false; void d.offsetWidth; d.classList.add('open');   // reflow → the CSS reveal runs
  $('#paintsBtn').setAttribute('aria-expanded', 'true');
  $('#q').focus();
}
function closePaints() {
  if (!paintsOpen) return;
  paintsOpen = false; closePaintMenu();
  const d = $('#paintsDrawer'); d.classList.remove('open'); d.hidden = true;   // exit is instant; the drop animates on open
  $('#paintsBtn').setAttribute('aria-expanded', 'false');
}
function togglePaints() { paintsOpen ? closePaints() : openPaints(); }
function openPaintMenu(x, y) {
  const m = $('#paintMenu'); m.hidden = false; paintMenuOpen = true;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, innerWidth - w - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  m.querySelector('button')?.focus();
}
function closePaintMenu() { if (paintMenuOpen) { $('#paintMenu').hidden = true; paintMenuOpen = false; } }
/** Mark a paint (owned/want/none) from the drawer's right-click menu or P/U/X; matches depend on the owned set. */
function markPaint(id, mark) {
  if (!['owned', 'want', 'none'].includes(mark)) return;
  store.setMark(id, mark);
  renderList(); renderLive(); renderActive();
  if (state.mode === 'shelf') renderShelf();
  const p = state.idx.byId.get(id);                  // announce the state change for screen readers (§3.5)
  if (p) $('#status').textContent = `${p.name}, ${mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned'}.`;
}
function paintListKeydown(e) {
  const chips = [...$('#list').querySelectorAll('.pchip')]; if (!chips.length) return;
  const cur = document.activeElement.closest ? document.activeElement.closest('.pchip') : null;
  let i = cur ? chips.indexOf(cur) : -1;
  const move = j => { j = Math.max(0, Math.min(chips.length - 1, j)); chips[j].focus(); chips[j].scrollIntoView({ inline: 'nearest', block: 'nearest' }); };
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { move(i < 0 ? 0 : i + 1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { move(i < 0 ? 0 : i - 1); e.preventDefault(); }
  else if (e.key === 'Home') { move(0); e.preventDefault(); }
  else if (e.key === 'End') { move(chips.length - 1); e.preventDefault(); }
  else if (e.key === 'Escape') { closePaints(); $('#paintsBtn').focus(); e.preventDefault(); }
  else if (cur && (k === 'p' || k === 'u' || k === 'x')) {
    const id = cur.dataset.id;
    markPaint(id, k === 'p' ? 'owned' : k === 'u' ? 'want' : 'none');
    $('#list').querySelector(`.pchip[data-id="${CSS.escape(id)}"]`)?.focus();   // keep keyboard place after re-render
    e.preventDefault();
  }
}
function renderHero(animate = true) {
  $('#hero').innerHTML = ui.hero(baseInfo(), animate, store.markOf, state.seedRole);   // animate=false during a live drag (no pop spam)
  const wk = document.querySelector('.wkey'); if (wk) wk.hidden = state.seedRole === 'accent';   // no role badges in accent mode → hide their legend
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
  if (state.mode === 'shelf') p.set('m', 'shelf');
  if (state.tab !== 'plan') p.set('v', state.tab);
  if (state.seedRole === 'accent') p.set('r', 'accent');
  if (state.theme === 'dark') p.set('t', 'dark');
  if (state.showReal) p.set('f', '1');
  if (state.extraNodes.length) p.set('x', state.extraNodes.map(n => `${Math.round(n.h)}.${Math.round(n.s * 100)}.${Math.round((n.l ?? state.wheelL) * 100)}${n.locked ? '!' : ''}`).join('-'));
  if (state.dropOffsets.length) p.set('d', state.dropOffsets.join('.'));
  history.replaceState(null, '', '?' + p.toString());
  pushHistory();
}

/* ---- undo / redo: snapshot the palette at each settled change (updateUrl is the single chokepoint) ---- */
const HIST = { stack: [], i: -1, busy: false };
function paletteSnap() {
  return JSON.stringify({
    customHex: state.customHex || null,
    baseId: state.customHex ? null : state.baseId,
    harmony: state.harmony, seedRole: state.seedRole, showReal: state.showReal,
    extraNodes: state.extraNodes.map(n => ({ h: Math.round(n.h * 10) / 10, s: Math.round(n.s * 1000) / 1000, l: n.l ?? null, locked: !!n.locked })),
    dropOffsets: [...state.dropOffsets],
  });
}
function pushHistory() {
  if (HIST.busy) return;
  const s = paletteSnap();
  if (HIST.stack[HIST.i] === s) return;            // view-only change (tab/theme) → no new palette entry
  HIST.stack.length = HIST.i + 1;                  // a fresh edit drops the redo branch
  HIST.stack.push(s); HIST.i++;
  if (HIST.stack.length > 100) { HIST.stack.shift(); HIST.i--; }
  syncHistBtns();
}
function applySnap(json) {
  const o = JSON.parse(json);
  state.customHex = o.customHex; state.baseId = o.baseId;
  state.harmony = isHarmony(o.harmony) ? o.harmony : state.harmony;
  state.seedRole = o.seedRole === 'accent' ? 'accent' : 'main';
  state.showReal = !!o.showReal;
  state.extraNodes = (o.extraNodes || []).map(n => ({ h: n.h, s: n.s, ...(n.l != null ? { l: n.l } : {}), ...(n.locked ? { locked: true } : {}) }));
  state.dropOffsets = [...(o.dropOffsets || [])];
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];
  $('#seg').innerHTML = ui.segmented(HARMONY_TYPES, state.harmony);
  scrollHarmonyActive();
  for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === state.seedRole));
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
  const hx = $('#hex'); if (hx) hx.value = baseHex().replace('#', '');
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);
  syncNodeBtns();
}
function undo() { if (HIST.i > 0) { HIST.i--; HIST.busy = true; applySnap(HIST.stack[HIST.i]); renderAll(); HIST.busy = false; syncHistBtns(); } }
function redo() { if (HIST.i < HIST.stack.length - 1) { HIST.i++; HIST.busy = true; applySnap(HIST.stack[HIST.i]); renderAll(); HIST.busy = false; syncHistBtns(); } }
function syncHistBtns() { const u = $('#undo'), r = $('#redo'); if (u) u.disabled = HIST.i <= 0; if (r) r.disabled = HIST.i >= HIST.stack.length - 1; }

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
  store.setPref('theme', state.theme);
  const seg = document.querySelector('#themeSeg');   // keep the settings-menu theme control in sync
  if (seg) for (const x of seg.children) x.setAttribute('aria-pressed', String(x.dataset.setTheme === state.theme));
}
function syncLocaleSeg() {                            // reflect the active locale in the settings-menu control
  const cur = i18n.getLocale(), seg = $('#localeSeg');
  if (seg) for (const x of seg.children) x.setAttribute('aria-pressed', String(x.dataset.locale === cur));
}
function setMode(mode) {
  state.mode = mode === 'shelf' ? 'shelf' : 'studio';
  const on = state.mode === 'shelf';
  closePaints();   // the paint drawer is a Studio control; never leave it open across a mode switch
  document.querySelector('main').dataset.mode = state.mode;
  document.querySelector('.workspace').hidden = on;
  $('#shelf').hidden = !on;
  for (const b of $('#modeNav').children) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  if (on) { renderShelf(); $('#shelfGrid').focus(); }
  else { renderList(); }   // refresh the drawer's owned state in case the shelf changed it
  updateUrl();
}
function selectPaint(id) { state.baseId = id; state.customHex = null; $('#hex').value = baseHex().replace('#', ''); renderAll(); }
/** Centre the active harmony chip in the scrollable strip — horizontal only (no page jump). */
function scrollHarmonyActive() {
  const seg = $('#seg'), el = seg && seg.querySelector('button[aria-pressed="true"]');
  if (el) seg.scrollLeft = el.offsetLeft - (seg.clientWidth - el.offsetWidth) / 2;
}
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
/** Toggle a paint on/off the to-buy list (#5). Owned paints have no buy control, but guard anyway. */
function toggleBuy(id) {
  if (store.isOwned(id)) return;
  store.setMark(id, store.isWant(id) ? 'none' : 'want');
  renderLive(); renderActive(); renderHero();   // hero may show the same paint's buy state
  if (state.mode === 'shelf') renderShelf();
}
/** One click: flag every paint this scheme needs (that you don't own) as to-buy (#5). */
function addGapsToBuy() {
  let n = 0;
  for (const g of schemeGaps(state.scheme, store.ownedIds())) {
    if (store.markOf(g.paint.id) !== 'want') { store.setMark(g.paint.id, 'want'); n++; }
  }
  toast(n ? `Added ${n} paint${n > 1 ? 's' : ''} to your buy list` : 'Nothing new to add');
  renderLive(); renderActive();
}
function setLadder(v) {                          // #7 — tone-ladder style (persisted)
  if (!['wash', 'tone', 'both'].includes(v)) return;
  state.ladder = v; store.setPref('ladder', v);
  renderActive();
}
function setCollection(v) {                      // #6 — off · prefer (boost) · only (filter); persisted
  if (!['off', 'prefer', 'only'].includes(v)) return;
  state.collection = v; store.setPref('collection', v);
  renderLive(); renderActive();
}
function toggleContrast() {                       // include Contrast paints in harmony suggestions (persisted)
  state.includeContrast = !state.includeContrast; store.setPref('contrast', state.includeContrast);
  renderLive(); renderActive();
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
  let t = `Palette Studio for Miniatures — shopping list\nBase ${s.base} · ${s.harmony} scheme · ${s.ladder} ladder\n\n`;
  for (const r of shoppingList(s)) t += `${r.role.padEnd(20)} ${r.name} (${r.brand}${r.line && r.line !== '—' ? ' ' + r.line : ''}) ${r.hex}  ΔE ${r.deltaE}${r.owned ? '  ✓ owned' : ''}\n`;
  // The accumulated to-buy collection (#5) — the SHOP output, independent of the current scheme.
  const want = [...store.wantIds()].map(id => state.idx.byId.get(id)).filter(Boolean);
  if (want.length) {
    t += `\nYour to-buy list (${want.length}):\n`;
    for (const p of want) t += `  ${p.name} (${p.brand}${p.line && p.line !== '—' ? ' ' + p.line : ''}) ${p.hex}\n`;
  }
  t += '\nHex values are approximate; ΔE = perceptual distance to the ideal colour.\n';
  const a = document.createElement('a');
  const href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }));
  a.href = href; a.download = 'palette-shopping-list.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 0); // revoke after the click's download starts
  toast('Shopping list exported');   // download is the artefact — no silent clipboard write (native-share direction)
}
/** Share the current scheme URL. Prefers the native share sheet (Web Share → OS sheet under Capacitor),
 *  then clipboard, then a visible-URL prompt. No silent clipboard side-effects. */
async function doShare() {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: 'Palette Studio for Miniatures', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // user dismissed the sheet
  }
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(url); toast('Share link copied'); return; } catch { /* fall through */ }
  }
  toast('Copy the URL from the address bar');
}
function download(filename, text, type = 'text/plain') {
  const a = document.createElement('a');
  const href = URL.createObjectURL(new Blob([text], { type }));
  a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);   // revoke after the download starts
}
/** Export the collection as paintRack-compatible CSV (#27). */
function exportCollectionCsv() {
  const n = store.counts();
  if (!n.owned && !n.want) { toast('Your shelf is empty — nothing to export'); return; }
  download('my-paint-shelf.csv', marksToCsv(state.idx, store.ownedIds(), store.wantIds()), 'text/csv');
  toast(`Exported ${n.owned} owned · ${n.want} to buy`);
}
/** Import a paintRack CSV (merges) or a Palette Studio JSON backup (restores) (#27). */
function importCollectionFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    if (/\.json$/i.test(file.name) || /^\s*[{[]/.test(text)) {
      toast(store.importJSON(text) ? 'Collection restored from JSON backup' : 'Could not read that JSON file');
    } else {
      const { matched, unmatched } = applyCsv(text);
      toast(`Imported ${matched} paint${matched === 1 ? '' : 's'}${unmatched.length ? ` · ${unmatched.length} unmatched` : ''}`);
    }
    if (state.mode === 'shelf') renderShelf();
    renderList(); renderLive(); renderActive();
  };
  reader.onerror = () => toast('Could not read that file');
  reader.readAsText(file);
}
function applyCsv(text) {
  const res = csvToMarks(state.idx, text);
  res.marks.forEach(m => store.setMark(m.id, m.mark));   // merge onto the current shelf
  return res;
}

/** Seed the scheme from an arbitrary hex (shared by the hex field + the photo eyedropper). */
function seedFromHex(hex) {
  state.customHex = hex.toUpperCase();
  $('#hex').value = state.customHex.replace('#', '');
  renderHero(); refreshStudio(); renderActive(); renderList(); announce(); updateUrl();
}

/** Photo eyedropper (#v2): pick a colour from a local image — drawn to a canvas, sampled (3×3 average),
 *  never uploaded. Single-pick → seeds the scheme. Uses a native <dialog> (focus-trap + Esc). */
function setupEyedropper() {
  const dlg = $('#eyedropper'), stage = $('#edStage'), cv = $('#edCanvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const loupe = $('#edLoupe'), lctx = loupe.getContext('2d'), chip = $('#edChip'), hexEl = $('#edHex'), useBtn = $('#edUse');
  let pick = null;                                     // the COMMITTED colour — only a click/tap (or drag) sets it
  const avg = (x, y) => {                              // 3×3 average around (x,y), clamped to the canvas
    const x0 = Math.max(0, Math.min(cv.width - 3, x - 1)), y0 = Math.max(0, Math.min(cv.height - 3, y - 1));
    const d = ctx.getImageData(x0, y0, 3, 3).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; return rgbToHex([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
  };
  const drawLoupe = (x, y, e) => {                     // zoomed crop with a centre-pixel marker, floated just above the cursor
    lctx.imageSmoothingEnabled = false; lctx.clearRect(0, 0, 72, 72);
    lctx.drawImage(cv, x - 4.5, y - 4.5, 9, 9, 0, 0, 72, 72);
    lctx.strokeStyle = '#fff'; lctx.lineWidth = 1; lctx.strokeRect(28, 28, 8, 8);
    const sr = stage.getBoundingClientRect(), L = 72, gap = 16;     // position relative to the (position:relative) stage
    const cxs = e.clientX - sr.left, cys = e.clientY - sr.top;
    loupe.style.left = Math.max(0, Math.min(sr.width - L, cxs - L / 2)) + 'px';   // centre on the cursor, clamped in-stage
    loupe.style.top = (cys - L - gap >= 0 ? cys - L - gap : cys + gap) + 'px';    // above the cursor, or below if no room
    loupe.style.display = 'block';
  };
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * (cv.width / r.width)), Math.round((e.clientY - r.top) * (cv.height / r.height))]; };
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cv.width && y < cv.height;
  const commit = (x, y) => {                           // lock the sampled colour in (what "Use as base colour" applies)
    pick = avg(x, y); chip.style.background = pick; hexEl.textContent = pick; useBtn.disabled = false;
  };
  const onMove = e => {                                // hover previews the loupe only — it never changes the locked colour
    const [x, y] = at(e); if (!inBounds(x, y)) return;
    drawLoupe(x, y, e);
    if (e.buttons & 1) commit(x, y);                   // …unless a press is held: mouse-drag / touch-drag selects live
  };
  const onDown = e => {                                // click / tap locks the colour so moving to the button keeps it
    const [x, y] = at(e); if (!inBounds(x, y)) return;
    commit(x, y); drawLoupe(x, y, e);
  };
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointerleave', () => { loupe.style.display = 'none'; });   // hide the loupe on exit; the locked colour stays
  $('#fromPhoto').addEventListener('click', () => $('#photoFile').click());
  $('#photoFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const s = Math.min(560 / img.width, 360 / img.height, 1);   // fit, never upscale
      cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
      ctx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(img.src);
      pick = null; useBtn.disabled = true; hexEl.textContent = '—'; chip.style.background = 'transparent'; loupe.style.display = 'none';
      if (!dlg.open) dlg.showModal();
    };
    img.onerror = () => toast("Couldn't read that image");
    img.src = URL.createObjectURL(f);
  });
  useBtn.addEventListener('click', () => { if (pick) { dlg.close(); seedFromHex(pick); toast(`Seeded from photo ${pick}`); } });
  $('#edClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // backdrop click
}

function wire() {
  $('#q').addEventListener('input', e => { state.q = e.target.value; renderList(); });
  $('#brand').addEventListener('change', e => { state.brand = e.target.value; renderList(); });
  $('#ptype').addEventListener('change', e => { state.ptype = e.target.value; renderList(); });
  $('#psort').addEventListener('change', e => { state.psort = e.target.value; renderList(); });
  // Paint-list chips: click picks the paint (and closes the drawer); right-click / P·U·X mark it.
  $('#list').addEventListener('click', e => {
    const c = e.target.closest('.pchip'); if (!c) return;
    selectPaint(c.dataset.id); closePaints();
    if (e.detail === 0) $('#paintsBtn').focus();   // keyboard activation (Enter/Space) → return focus to the trigger
  });
  $('#list').addEventListener('contextmenu', e => {
    const c = e.target.closest('.pchip'); if (!c) return;
    e.preventDefault(); paintMenuId = c.dataset.id; openPaintMenu(e.clientX, e.clientY);
  });
  $('#list').addEventListener('keydown', paintListKeydown);
  $('#paintMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !paintMenuId) return;
    const id = paintMenuId;
    markPaint(id, b.dataset.act); closePaintMenu();
    $('#list').querySelector(`.pchip[data-id="${CSS.escape(id)}"]`)?.focus();   // return focus to the marked chip
  });
  $('#paintsBtn').addEventListener('click', e => { e.stopPropagation(); togglePaints(); });
  $('#importPaints').addEventListener('click', () => $('#importFile').click());
  $('#exportPaints').addEventListener('click', exportCollectionCsv);
  document.addEventListener('keydown', e => {                            // Esc closes the menu, then the drawer
    if (e.key !== 'Escape') return;
    if (paintMenuOpen) { closePaintMenu(); $('#list').focus(); }
    else if (paintsOpen) { closePaints(); $('#paintsBtn').focus(); }
  });
  document.addEventListener('pointerdown', e => {                        // click-outside closes the drawer / its menu
    if (paintMenuOpen && !e.target.closest('#paintMenu')) closePaintMenu();
    // the drawer's right-click menu lives outside #paintsDrawer — don't let interacting with it close the drawer
    if (paintsOpen && !e.target.closest('#paintsDrawer') && !e.target.closest('#paintsBtn') && !e.target.closest('#paintMenu')) closePaints();
  }, true);
  $('main').addEventListener('click', e => {
    const buy = e.target.closest('[data-buy]'); if (buy) { e.stopPropagation(); toggleBuy(buy.dataset.buy); return; }
    const lad = e.target.closest('[data-ladder]'); if (lad) { setLadder(lad.dataset.ladder); return; }
    const col = e.target.closest('[data-collection]'); if (col) { setCollection(col.dataset.collection); return; }
    const mv = e.target.closest('[data-move]'); if (mv) { e.stopPropagation(); const [i, dir] = mv.dataset.move.split(':').map(Number); moveFreeNode(i, i + dir); return; }  // reorder (keyboard/touch path)
    const lk = e.target.closest('[data-lock]'); if (lk) { e.stopPropagation(); lockSwatch(lk.dataset.lock); return; }              // lock / unlock a swatch
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); openSwatchEditor(ed.dataset.edit); return; }        // edit a swatch's hex
    const sb = e.target.closest('[data-setbase]'); if (sb) { e.stopPropagation(); seedFromHex(sb.dataset.setbase); return; }   // promote a swatch to the base colour
    const dn = e.target.closest('[data-delnode]'); if (dn) { e.stopPropagation(); removeFreeNode(+dn.dataset.delnode); return; }  // delete an added swatch
    if (e.target.closest('#inclContrast')) { toggleContrast(); return; }
    if (e.target.closest('#addGaps')) { addGapsToBuy(); return; }
    const c = e.target.closest('[data-copy]'); if (c) copyText(c.dataset.copy);
  });
  $('#hex').addEventListener('input', e => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
    e.target.value = v;
    if (v.length === 6) seedFromHex('#' + v);
  });
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.harmony = b.dataset.h;
    state.dropOffsets = [];   // new harmony → fresh partners; any locked/edited swatches persist as free nodes
    for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));
    scrollHarmonyActive();
    refreshStudio(); renderActive(); announce(); updateUrl();
  });
  // Cross-surface colour link: hover/focus a role block (Plan) or a live column → ring that colour everywhere.
  const ws = document.querySelector('.workspace');
  ws.addEventListener('mouseover', e => { const el = e.target.closest('[data-hex]'); linkHighlight(el ? el.dataset.hex : null); });
  ws.addEventListener('mouseleave', () => linkHighlight(null));
  ws.addEventListener('focusin', e => { const el = e.target.closest('[data-hex]'); linkHighlight(el ? el.dataset.hex : null); });
  ws.addEventListener('focusout', e => { if (!e.relatedTarget || !e.relatedTarget.closest('[data-hex]')) linkHighlight(null); });
  $('#realtoggle').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.showReal = b.dataset.fill === 'real';
    for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
    renderLive(); scheduleAnnounce(); updateUrl();
  });
  $('#addnode').addEventListener('click', addFreeNode);
  $('#delnode').addEventListener('click', () => removeFreeNode());
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#swEdit').addEventListener('change', e => { if (swEditTarget) { editSwatch(swEditTarget, e.target.value.toUpperCase()); swEditTarget = null; } });
  // drag-reorder the added swatches (delegated on #livepal so it survives re-renders)
  const lp = $('#livepal');
  lp.addEventListener('dragstart', e => { const col = e.target.closest('[data-dragidx]'); if (!col) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', col.dataset.dragidx); col.classList.add('dragging'); });
  lp.addEventListener('dragover', e => { if (e.target.closest('[data-dragidx]')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
  lp.addEventListener('drop', e => { const tgt = e.target.closest('[data-dragidx]'); if (!tgt) return; e.preventDefault(); moveFreeNode(+e.dataTransfer.getData('text/plain'), +tgt.dataset.dragidx); });
  lp.addEventListener('dragend', () => lp.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging')));
  document.addEventListener('keydown', e => {                                  // ⌘/Ctrl+Z undo · ⇧ or Ctrl+Y redo
    if (!(e.metaKey || e.ctrlKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
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
    renderHero(); refreshStudio(); renderActive(); announce(); updateUrl();
  });
  $('#compare').addEventListener('click', () => {
    if (state.compareA) { state.compareA = null; $('#compare').setAttribute('aria-pressed', 'false'); }
    else { const s = currentScheme(); state.compareA = { base: schemeBase(), harmony: state.harmony, colors: s.roles.map(r => r.idealHex) }; $('#compare').setAttribute('aria-pressed', 'true'); setTab('plan'); toast('Pinned A — change the scheme to compare'); }
    if (state.tab === 'plan') renderPlan();
  });
  $('#export').addEventListener('click', () => { doExport(); closeSettings(); });   // Export/Share live in the ⋯ menu now
  $('#share').addEventListener('click', () => { doShare(); closeSettings(); });

  // settings menu (theme lives here now) — toggle, theme control, click-outside / Esc close
  const sMenu = $('#settingsMenu'), sBtn = $('#settingsBtn');
  const openSettings = () => {
    sMenu.hidden = false; sBtn.setAttribute('aria-expanded', 'true');
    const r = sBtn.getBoundingClientRect();
    sMenu.style.left = Math.min(r.left, innerWidth - sMenu.offsetWidth - 8) + 'px';
    sMenu.style.top = (r.bottom + 6) + 'px';
  };
  const closeSettings = () => { sMenu.hidden = true; sBtn.setAttribute('aria-expanded', 'false'); };
  sBtn.addEventListener('click', e => { e.stopPropagation(); sMenu.hidden ? openSettings() : closeSettings(); });
  $('#themeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setTheme(b.dataset.setTheme); wheelDraw(); updateUrl(); });
  $('#localeSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    i18n.setLocale(b.dataset.locale);   // persists the pref + re-applies static [data-i18n] strings
    syncLocaleSeg();
    renderHero();                       // re-render JS-built strings that use i18n.t (e.g. the base label)
  });
  document.addEventListener('pointerdown', e => { if (!sMenu.hidden && !e.target.closest('#settingsMenu') && !e.target.closest('#settingsBtn')) closeSettings(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sMenu.hidden) { closeSettings(); sBtn.focus(); } });

  // shelf chrome
  $('#modeNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  $('#brandChips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.shelfBrand = b.dataset.brand;
    shelfFilterChanged();
  });
  $('#shelfQ').addEventListener('input', e => { state.shelfQ = e.target.value; shelfFilterChanged(); });
  $('#shelfMarkSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.shelfMark = b.dataset.mark;
    shelfFilterChanged();
  });
  $('#shelfType').addEventListener('change', e => { state.shelfType = e.target.value; shelfFilterChanged(); });
  // Sorting doesn't change which paints are shown, so keep the selection — just re-render in the new order.
  $('#shelfSort').addEventListener('change', e => { state.shelfSort = e.target.value; renderShelf(); });
  $('#shelfBar').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'deselect') setSelection([], { anchor: null });
    else applyMark(b.dataset.act);
  });
  $('#shelfMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) { applyMark(b.dataset.act); closeMenu(); } });
  $('#shelfSelect').addEventListener('click', () => {       // touch: toggle multi-select mode
    shelf.selectMode = !shelf.selectMode;
    $('#shelfSelect').setAttribute('aria-pressed', String(shelf.selectMode));
    if (!shelf.selectMode) setSelection([], { anchor: null });   // leaving select mode clears the selection
    $('#shelfHint').textContent = shelfHint();
  });
  $('#exportColl').addEventListener('click', exportCollectionCsv);
  $('#importColl').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importCollectionFile(f); e.target.value = ''; });
  document.addEventListener('pointerdown', e => { if (menuOpen && !e.target.closest('#shelfMenu')) closeMenu(); }, true);
  document.addEventListener('keydown', shelfKeydown);
  setupShelf();

  // About & data modal — native <dialog> handles Esc + focus trap; close on backdrop click.
  const about = $('#about');
  $('#aboutOpen').addEventListener('click', () => about.showModal());
  $('#aboutOpenMenu').addEventListener('click', () => { closeSettings(); about.showModal(); });   // second path from the ⋯ menu
  $('#aboutClose').addEventListener('click', () => about.close());
  about.addEventListener('click', e => { if (e.target === about) about.close(); });   // click outside the panel
}

async function init() {
  const url = new URLSearchParams(location.search);
  let theme = url.get('t');
  if (!theme) theme = store.getPref('theme');   // owned/to-buy + prefs are loaded by store.js on import
  if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme);

  state.idx = await loadDataset('./data/paints.json');
  state.brands = [...new Set(state.idx.paints.map(p => p.brand))].sort();
  $('#brand').insertAdjacentHTML('beforeend', ui.brandOptions(state.brands));
  const types = [...new Set(state.idx.paints.map(p => p.type))].sort();
  const typeOpts = types.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
  $('#ptype').insertAdjacentHTML('beforeend', typeOpts);
  $('#shelfType').insertAdjacentHTML('beforeend', typeOpts);

  const lp = store.getPref('ladder'); if (['wash', 'tone', 'both'].includes(lp)) state.ladder = lp;
  const cp = store.getPref('collection'); if (['off', 'prefer', 'only'].includes(cp)) state.collection = cp;
  state.includeContrast = !!store.getPref('contrast');

  const h = url.get('h'); if (h && isHarmony(h)) state.harmony = h;
  const v = url.get('v'); if (v && renderers[v]) state.tab = v;
  if (url.get('f') === '1') state.showReal = true;
  const xp = url.get('x');
  if (xp) state.extraNodes = xp.split('-').map(tok => {
    const locked = tok.endsWith('!'); const t = locked ? tok.slice(0, -1) : tok;
    const [hh, sa, la] = t.split('.'); const H = +hh, S = +sa / 100, L = +la / 100;
    if (!(Number.isFinite(H) && Number.isFinite(S))) return null;
    return { h: ((H % 360) + 360) % 360, s: Math.min(1, Math.max(0, S)),
      ...(Number.isFinite(L) ? { l: Math.min(1, Math.max(0, L)) } : {}), ...(locked ? { locked: true } : {}) };
  }).filter(Boolean).slice(0, MAX_FREE);
  const dp = url.get('d'); if (dp) state.dropOffsets = dp.split('.').map(Number).filter(Number.isFinite);
  if (url.get('r') === 'accent') { state.seedRole = 'accent'; for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === 'accent')); }
  const c = url.get('c');
  if (c && /^[0-9a-fA-F]{6}$/.test(c)) state.customHex = '#' + c.toUpperCase();
  else state.baseId = state.idx.paints[0].id;

  $('#seg').innerHTML = ui.segmented(HARMONY_TYPES, state.harmony);
  scrollHarmonyActive();
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
  syncNodeBtns();
  $('#hex').value = baseHex().replace('#', '');
  syncTabs();
  wire();
  i18n.apply();   // localize static chrome strings ([data-i18n] / placeholders)
  syncLocaleSeg();
  setupWheel();   // wheel is now always-visible static markup; bind it once
  setupEyedropper();
  renderAll();
  if (url.get('m') === 'shelf') setMode('shelf');   // deep-link / refresh stays on the shelf
}

init().catch(err => {
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${err.message}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
