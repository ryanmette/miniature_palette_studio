// wheel.js — the interactive harmony wheel: the HSV disc, its nodes, and every way to move them
// (pointer drag, keyboard nudge, the lightness slider, Generate). Canvas rendering and hit-testing
// only; it owns no scheme state.
//
// The wheel works entirely in the SCHEME frame (seed.js): its base node is schemeBase(), not the
// pick, and a drag writes back through pickForSchemeBase() so accent-seed mode stays 180° coherent.
//
// Everything it needs from the app is injected, so this file has no opinion about how state is
// stored or what else re-renders: `setupWheel(ctx)` binds the canvas once and returns its `draw`,
// which the app calls for discrete changes (picker, hex field, harmony).

import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, rotateHue, textOn } from './color.js';
import { HARMONY_OFFSETS, isHueHarmony, isNeutralHarmony, POP_MIN_S } from './harmony.js';
import { pickForSchemeBase } from './seed.js';
import { nearestPaint } from './data.js';
import * as ui from './ui.js';

const $ = sel => document.querySelector(sel);

/**
 * Bind the wheel canvas. `ctx` supplies the app's state and the operations the wheel triggers:
 *   state · render(reason) · schemeBase() · activePop() · matchOpts() · basePaint()
 *   wheelRoleGlyphs() · addFreeNode() · removeFreeNode() · collapseBanner() · setDragging(bool)
 * `setDragging` exists because the app gates mid-drag history snapshots on it — a drag must produce
 * ONE undo entry, not one per frame.
 * @returns {() => void} the canvas redraw
 */
export function setupWheel(app) {
  const { state, render, schemeBase, activePop, matchOpts, basePaint,
          wheelRoleGlyphs, addFreeNode, removeFreeNode, collapseBanner, setDragging } = app;
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
  state.wheelL = rgbToHsl(hexToRgb(schemeBase()))[2];
  $('#wl').value = Math.round(state.wheelL * 100);
  const pos = (h, s) => [cx + Math.sin(h * Math.PI / 180) * s * R, cy - Math.cos(h * Math.PI / 180) * s * R];
  const disc = document.createElement('canvas');   // offscreen filled HSV disc, rasterised once per (size, lightness)
  let discKey = '';
  function buildDisc() {                            // hue = angle, saturation = radius, lightness = the wheel slider
    const key = W + ':' + Math.round(state.wheelL * 100);   // colour data only → theme-independent; cached
    if (key === discKey) return;
    discKey = key;
    // Rasterise at HALF resolution and let drawImage upscale: the disc is smooth gradients so the
    // difference is invisible, and a lightness-slider drag re-rasterises EVERY frame (the cache key
    // changes per tick) — full-res was ~200k hslToRgb calls per frame, well past the 16ms budget (§6).
    const DW = Math.ceil(W / 2), DH = Math.ceil(H / 2), dcx = cx / 2, dcy = cy / 2, dR = R / 2;
    disc.width = DW; disc.height = DH;
    const dctx = disc.getContext('2d'), img = dctx.createImageData(DW, DH), data = img.data, L = state.wheelL;
    for (let j = 0; j < DH; j++) {
      const dy = j - dcy;
      for (let i = 0; i < DW; i++) {
        const dx = i - dcx, dist = Math.sqrt(dx * dx + dy * dy), idx = (j * DW + i) * 4;
        if (dist > dR + 0.5) { data[idx + 3] = 0; continue; }   // outside the disc → transparent
        const [r, g, bl] = hslToRgb([(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, dist >= dR ? 1 : dist / dR, L]);
        // feather the rim alpha over the last px — a hard cutoff upscales into a stair-stepped edge
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = Math.round(255 * Math.max(0, Math.min(1, dR + 0.5 - dist)));
      }
    }
    dctx.putImageData(img, 0, 0);
  }
  function draw() {
    const b = schemeBase();
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
    if (popNodeOn()) {   // neutral mode: the pop node is the wheel's draggable accent (the seed sits at the hueless centre)
      const pop = activePop(), [ph, psat] = rgbToHsl(hexToRgb(pop)), [px, py] = pos(ph, psat);
      spokeTo(ph, psat);
      ctx.fillStyle = pop; ctx.beginPath(); ctx.arc(px, py, NODE.base, 0, 7); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = accent; ctx.stroke();
    }
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
        const nh = nodeHex(n).toUpperCase();
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
      if (nodeHex(n).toUpperCase() === state.hiHex) { ctx.beginPath(); ctx.arc(n.x, n.y, NODE.base + 5, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = accent; ctx.stroke(); }
    }
  }
  /** A node's drawn hex, matching how it's filled — the single mapping for badges/link rings/announce. */
  const nodeHex = n => n.kind === 'base' ? schemeBase() : n.kind === 'pop' ? activePop()
    : n.kind === 'partner' ? rotateHue(schemeBase(), n.deg)
    : rgbToHex(hslToRgb([n.h, n.s, state.extraNodes[n.idx]?.l ?? state.wheelL]));
  /** One live wheel frame — coalescing, the output tabs and the debounced URL/speech all live in
   *  render('drag') now, so the wheel no longer keeps its own (divergent) idea of what to repaint. */
  const commit = () => render('drag');
  /** True when the wheel's draggable accent node is the neutral-mode pop (pop-bearing schemes only). */
  const popNodeOn = () => isNeutralHarmony(state.harmony) && state.harmony !== 'warm-cool';
  /** Drag/nudge the pop: hue + saturation from the wheel, lightness preserved (POP_MIN_S keeps it a pop). */
  function setPop(h, s) {
    const l = rgbToHsl(hexToRgb(activePop()))[2];
    state.popHex = rgbToHex(hslToRgb([((h % 360) + 360) % 360, Math.max(POP_MIN_S, Math.min(1, s)), l]));
    commit();   // drawStudio() repaints the pop chips — no separate renderPops() call needed
  }
  function setBase(h, s) {
    // Adobe-style: moving the base moves everything. Partners are derived (they already follow);
    // free nodes are absolute, so rotate them by the base's hue delta to keep their relationship.
    const dh = ((h - rgbToHsl(hexToRgb(schemeBase()))[0]) % 360 + 360) % 360;
    if (dh && state.extraNodes.length) state.extraNodes = state.extraNodes.map(n => n.locked ? n : { ...n, h: ((n.h + dh) % 360 + 360) % 360 });
    // The wheel drags in the SCHEME frame, so store the PICK that puts the scheme base under the
    // pointer — in accent-seed mode that's 180° away, and writing the raw colour made the whole
    // scheme jump the moment you grabbed a node.
    state.customHex = pickForSchemeBase(rgbToHex(hslToRgb([h, s, state.wheelL])), state.seedRole);
    $('#hex').value = state.customHex.replace('#', '');
    commit();
  }
  const pointerXY = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const pointerPolar = e => { const [px, py] = pointerXY(e), dx = px - cx, dy = py - cy; return [(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, Math.max(0, Math.min(1, Math.hypot(dx, dy) / R))]; };
  function hitNodes() {                  // every grabbable node: kind, its hue/sat, and screen position
    const [h, s] = rgbToHsl(hexToRgb(schemeBase())), [bx, by] = pos(h, s);
    const ns = [{ kind: 'base', h, s, x: bx, y: by }];
    if (isHueHarmony(state.harmony)) HARMONY_OFFSETS[state.harmony].forEach(o => { if (state.dropOffsets.includes(o)) return; const ph = ((h + o) % 360 + 360) % 360, [x, y] = pos(ph, s); ns.push({ kind: 'partner', deg: o, h: ph, s, x, y }); });
    if (popNodeOn()) { const [ph, psat] = rgbToHsl(hexToRgb(activePop())), [x, y] = pos(ph, psat); ns.push({ kind: 'pop', h: ph, s: psat, x, y }); }
    state.extraNodes.forEach((o, i) => { const [x, y] = pos(o.h, o.s); ns.push({ kind: 'free', idx: i, h: o.h, s: o.s, x, y }); });
    return ns;
  }
  function pickNode(e) {                 // nearest node within the touch-safe hit radius (free > partner > base on a tie)
    const [px, py] = pointerXY(e);
    let best = null;
    hitNodes().forEach((n, i) => {
      const d = Math.hypot(n.x - px, n.y - py); if (d > NODE.hit) return;
      const pri = n.kind === 'free' || n.kind === 'pop' ? 0 : n.kind === 'partner' ? 1 : 2;
      if (!best || d < best.d - 4 || (d < best.d + 4 && pri < best.pri)) best = { ...n, d, pri, index: i };
    });
    return best;
  }
  let active = null, dragging = false, activeIdx = 0, focused = false;
  function applyDrag(e) {                // route the drag to whichever node was grabbed
    const [ph, ps] = pointerPolar(e);
    if (active && active.kind === 'partner') setBase((ph - active.deg + 360) % 360, ps);   // rotate the whole harmony rigidly
    // spread, don't replace: a free node may carry an explicit lightness and a locked flag —
    // a drag must move its hue/sat WITHOUT unpinning it or snapping its colour to the wheel slider
    else if (active && active.kind === 'free') { state.extraNodes[active.idx] = { ...state.extraNodes[active.idx], h: ph, s: ps }; commit(); }
    else if (active && active.kind === 'pop') setPop(ph, ps);   // neutral mode: the pop is the draggable accent
    else setBase(ph, ps);               // base node, or empty space → move the base
  }
  cv.addEventListener('pointerdown', e => { collapseBanner(); dragging = true; setDragging(true); active = pickNode(e); activeIdx = active ? active.index : 0; cv.style.cursor = 'grabbing'; cv.setPointerCapture(e.pointerId); applyDrag(e); });   // interacting with the wheel dismisses the explainer — it must never block a drag
  cv.addEventListener('pointermove', e => { if (dragging) applyDrag(e); });
  // pointercancel too: a touch drag the OS takes over (gesture/scroll) never fires pointerup, and
  // without this the wheel stays in dragging mode, chasing every later no-button pointermove.
  const endDrag = () => { if (!dragging) return; dragging = false; setDragging(false); active = null; cv.style.cursor = 'grab'; render('settle'); };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  // --- keyboard operability (WCAG): focus the wheel, then arrows adjust the active node, [ ] cycle, +/- add/remove ---
  function announceActive() {
    const ns = hitNodes(); if (!ns.length) return;
    const n = ns[Math.min(activeIdx, ns.length - 1)];
    const label = n.kind === 'base' ? 'Base' : n.kind === 'free' ? 'Added colour' : n.kind === 'pop' ? 'Pop accent' : `Partner ${Math.round(n.deg)} degrees`;
    // announce the node's DRAWN colour (nodeHex) — a free node with its own lightness is NOT at
    // wheelL, and the spoken hex / nearest paint must match what the eye (and live palette) sees
    const hex = nodeHex(n).toUpperCase();
    const rgl = wheelRoleGlyphs()[hex];                          // name the role for non-visual users
    const role = rgl === 'P' ? 'Primary, ' : rgl === 'A' ? 'Accent, ' : rgl === '2' ? 'Secondary, ' : '';
    const sp = basePaint();   // the pick wins exact ties in the announcement too (must agree with the Plan)
    const aOpts = sp && hex.toUpperCase() === sp.hex.toUpperCase() ? { ...matchOpts(), preferIds: new Set([sp.id]) } : matchOpts();
    const m = nearestPaint(state.idx, hex, aOpts);
    $('#status').textContent = m ? `${role}${label}, ${hex}, nearest ${ui.pname(m.paint)}, ΔE ${m.deltaE.toFixed(1)}.` : `${role}${label}, ${hex}, no close paint.`;
  }
  function nudgeActive(dh, ds) {
    const ns = hitNodes(); activeIdx = Math.min(activeIdx, ns.length - 1);
    const n = ns[activeIdx];
    const nh = ((n.h + dh) % 360 + 360) % 360, nsv = Math.max(0, Math.min(1, n.s + ds));
    if (n.kind === 'free') { state.extraNodes[n.idx] = { ...state.extraNodes[n.idx], h: nh, s: nsv }; commit(); }
    else if (n.kind === 'pop') setPop(nh, nsv);
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
  $('#wl').addEventListener('input', e => { state.wheelL = +e.target.value / 100; const [h, s] = rgbToHsl(hexToRgb(schemeBase())); setBase(h, s); });
  $('#wrand').addEventListener('click', () => setBase(Math.random() * 360, 0.5 + Math.random() * 0.45));
  measure();
  draw();
  let rtimer = 0;   // re-measure + redraw when the responsive canvas box changes (resize / orientation / stack)
  window.addEventListener('resize', () => { clearTimeout(rtimer); rtimer = setTimeout(() => { measure(); draw(); }, 150); });
  return draw;   // the app calls this for discrete base/harmony changes (picker, hex, harmony)
}
