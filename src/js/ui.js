// ui.js — pure render-to-string helpers. No DOM access, no globals (import-safe + testable).
// DOM wiring lives in app.js. Colour decisions come from the engine (color.js).

import { textOn } from './color.js';
import { HARMONY_OFFSETS } from './harmony.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = t => t.charAt(0).toUpperCase() + t.slice(1); // sentence case (§3.3)

// Defence-in-depth: any colour interpolated into an inline style must be a literal #hex.
// Inputs are already validated upstream (rgbToHex output, URL/-input regex, dataset QA), but we
// re-assert here so a future caller can't turn a swatch into a CSS/HTML-injection sink.
const safeColor = c => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

export const swatch = (hex, cls = '', extra = '') => `<span class="sw ${cls}" style="background:${safeColor(hex)};${extra}"></span>`;

/** Picker list: each row pairs a focusable select button with a separate owned-toggle button.
 *  (Keeping the toggle a sibling — not nested in the option — makes it keyboard-operable.) */
export function pickerList(paints, selectedId, owned = new Set()) {
  if (!paints.length) return `<div style="padding:18px;color:var(--text-faint);font-size:13px">No paints match.</div>`;
  return paints.map(p => {
    const own = owned.has(p.id);
    return `<div class="paintrow" role="listitem">`
      + `<button class="paint" data-id="${esc(p.id)}" aria-current="${p.id === selectedId}">`
      + swatch(p.hex, '', 'width:30px;height:30px')
      + `<span style="min-width:0;flex:1"><span class="nm">${esc(p.name)}</span><br>`
      + `<span class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''}</span></span>`
      + `</button>`
      + `<button class="own${own ? ' on' : ''}" data-own="${esc(p.id)}" aria-pressed="${own}" aria-label="Mark ${esc(p.name)} as owned" title="Mark as owned">${own ? '★' : '☆'}</button>`
      + `</div>`;
  }).join('');
}

/** Compare two schemes side by side. a/b: { base, harmony, colors:[ideal hexes] }. */
export function compareBar(a, b) {
  const row = (g, lbl) => `<div class="cmprow"><span class="cmplab">${esc(lbl)} · ${esc(g.harmony)} · <span class="mono">${esc(g.base)}</span></span>`
    + `<div class="cmppal">${g.colors.map(c => `<span style="background:${safeColor(c)}"></span>`).join('')}</div></div>`;
  return `<div class="compare"><div class="cmphead">Compare</div>${row(a, 'A')}${row(b, 'B · current')}</div>`;
}

/** Base-paint hero. `base`: { hex, name, brand?, line?, type?, approx?, custom? }. */
export function hero(base, animate = true) {
  const meta = base.custom ? 'typed hex' : `${esc(base.brand || '')}${base.line ? ' · ' + esc(base.line) : ''}`;
  const tags = base.custom
    ? '<span class="tag">custom</span>'
    : `<span class="tag">${esc(base.type || 'paint')}</span>${base.approx ? '<span class="tag approx">approx hex</span>' : ''}`;
  return swatch(base.hex, animate ? 'big pop' : 'big')
    + `<div><h2>${esc(base.name)}</h2>`
    + `<div style="color:var(--text-muted);font-size:13px;margin-top:2px">${meta}</div>`
    + `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${tags}</div>`
    + `<button type="button" class="hexline" data-copy="${esc(base.hex)}" title="Copy ${esc(base.hex)}" aria-label="Copy hex ${esc(base.hex)}">${esc(base.hex)}</button></div>`;
}

/** Tiny line-art glyph of a harmony's geometry, generated from HARMONY_OFFSETS so it can't drift. */
const harmonyGlyph = type => {
  const angles = [0, ...(HARMONY_OFFSETS[type] || [])];
  const cx = 11, cy = 11, r = 7;
  const pt = a => [cx + Math.sin(a * Math.PI / 180) * r, cy - Math.cos(a * Math.PI / 180) * r];
  const lines = angles.map(a => { const [x, y] = pt(a); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const dots = angles.map((a, i) => { const [x, y] = pt(a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 ? 2.4 : 1.7}"/>`; }).join('');
  return `<svg class="hglyph" viewBox="0 0 22 22" aria-hidden="true">${lines}${dots}</svg>`;
};

/** Segmented control for harmony types — each option shows a glyph of its geometry + label. */
export const segmented = (types, active) =>
  types.map(t => `<button data-h="${esc(t)}" aria-pressed="${t === active}">${harmonyGlyph(t)}<span class="hlbl">${esc(label(t))}</span></button>`).join('');

/** <option> list for the brand filter. */
export const brandOptions = brands => brands.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

const tier = t => `var(--${t})`;

/** Render a nearest-paint match (or a graceful empty state). */
export function matchChip(m) {
  if (!m) return '<div class="br" style="color:var(--text-faint)">no close paint — consider mixing</div>';
  const p = m.paint, q = m.quality;
  return swatch(p.hex, 'act')
    + `<div style="min-width:0"><div class="ttl">Nearest real paint</div>`
    + `<div class="nm">${esc(p.name)}</div>`
    + `<div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''}</div>`
    + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span>`
    + `<span style="color:${tier(q.tier)}">${esc(q.label)}</span>`
    + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></div></div>`;
}

/** Small overview bar of the scheme's role ideal colours. */
export const paletteOverview = scheme =>
  `<div class="palette">${scheme.roles.map(r => {
    const hex = safeColor(r.idealHex);
    return `<button type="button" class="pblock" data-copy="${hex}" title="Copy ${hex}" aria-label="Copy ${esc(r.role)} colour ${hex}" style="background:${hex};color:${textOn(hex)}">`
      + `<span class="pbl"><span class="pbr">${esc(r.role)}</span><span class="pbh">${hex}</span></span></button>`;
  }).join('')}</div>`;

/** Role slots: each role's ideal → nearest real paint, plus a derived wash/highlight ladder. */
export function roleSlots(scheme) {
  const lad = (hex, m, cap) => `<div class="step">${swatch(hex, '')}<div class="cap">${cap}</div><div class="pn">${m ? esc(m.paint.name) : '—'}</div></div>`;
  return `<div class="slots">${scheme.roles.map(r => `<div class="slot">`
    + `<div class="shead"><span class="role">${esc(r.role)}</span><span class="wt">${esc(r.weight)}</span></div>`
    + `<div class="ivsa">${swatch(r.idealHex, 'ideal', `color:${textOn(r.idealHex)}`)}<span class="arr">→</span>${matchChip(r.match)}</div>`
    + `<div class="ladder">${lad(r.wash.idealHex, r.wash.match, 'wash')}${lad(r.idealHex, r.match, 'base')}${lad(r.highlight.idealHex, r.highlight.match, 'highlight')}</div>`
    + `</div>`).join('')}</div>`;
}

/** Cross-brand equivalents list (M6). `equivs`: [{paint, deltaE, quality}]. */
export function equivalentsPanel(name, equivs) {
  if (!equivs.length) return '<div class="placeholder">No other-brand matches in the dataset for this paint.</div>';
  return `<p class="hint" style="margin:14px 0 0">Closest matches to <strong>${esc(name)}</strong> in other ranges (ΔE 2000).</p>`
    + `<div class="eq">${equivs.map(e => {
      const p = e.paint, q = e.quality;
      return `<div class="eqc">${swatch(p.hex, '')}<div style="min-width:0">`
        + `<div class="nm">${esc(p.name)}</div><div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''}</div>`
        + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span><span style="color:${tier(q.tier)}">${esc(q.label)}</span>`
        + `<span class="badge">ΔE ${e.deltaE.toFixed(1)}</span></div></div></div>`;
    }).join('')}</div>`;
}

/** Variable live palette beside the wheel: one column per harmony/free colour → its nearest real paint.
 *  vm: [{ id, kind:'base'|'partner'|'free', deg, hex, match }]. `fill`: 'ideal' | 'real' (column fill).
 *  The nearest paint + ΔE + quality label stay visible in BOTH fill modes (honesty, §2/§3.2). */
export function livePalette(vm, fill) {
  if (!vm.length) return '';
  const real = fill === 'real';
  return `<div class="livepal">${vm.map(c => {
    const bg = safeColor(real && c.match ? c.match.paint.hex : c.hex);   // hex label + copy follow the fill
    const t = textOn(bg), m = c.match;
    const tag = c.kind === 'base' ? 'Base' : c.kind === 'free' ? 'Added' : `${c.deg > 0 ? '+' : ''}${c.deg}°`;
    const foot = m
      ? `<span class="lcname">${esc(m.paint.name)}</span>`
        + `<span class="de" style="margin:2px 0 0"><span class="dot" style="background:${tier(m.quality.tier)}"></span>`
        + `<span style="color:${tier(m.quality.tier)}">${esc(m.quality.label)}</span>`
        + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></span>`
      : `<span class="lcname">—</span><span class="br">no close paint</span>`;
    return `<button type="button" class="lcol" data-copy="${bg}" title="Copy ${bg}" aria-label="Copy ${esc(tag)} colour ${bg}">`
      + `<span class="lctop" style="background:${bg};color:${t}"><span class="lctag">${esc(tag)}${real ? ' · real' : ''}</span><span class="lchex">${bg}</span></span>`
      + `<span class="lcfoot">${foot}</span></button>`;
  }).join('')}</div>`;
}

/** Accessibility panel. model: { names, sims:[{label,colors}], contrasts:[{a,b,labelA,labelB,ratio,passAAText,passAALarge}], collision }. */
export function a11yPanel(model) {
  const strip = cols => `<div class="cstrip">${cols.map(c => `<span class="sw" style="flex:1;height:30px;background:${safeColor(c)}"></span>`).join('')}</div>`;
  const simRows = model.sims.map(s => `<div class="crow"><span class="clab">${esc(s.label)}</span>${strip(s.colors)}</div>`).join('');
  const verdict = c => c.passAAText ? ['Passes AA text', 'var(--success)'] : c.passAALarge ? ['Large/UI only', 'var(--warning)'] : ['Fails AA', 'var(--danger)'];
  const ctr = model.contrasts.map(c => {
    const [v, col] = verdict(c);
    return `<div class="ctrbox"><div class="ttl">${esc(c.labelA)} ↔ ${esc(c.labelB)}</div>`
      + `<div class="pair">${swatch(c.a, '', 'width:24px;height:24px')}${swatch(c.b, '', 'width:24px;height:24px')}</div>`
      + `<div class="ratio" style="color:${col}">${c.ratio.toFixed(1)}:1</div>`
      + `<div style="font-size:11.5px;color:${col};font-weight:500">${v}</div></div>`;
  }).join('');
  let coll;
  if (model.collision) {
    const s = model.collision.suggestion;
    coll = `<div class="collide"><strong>Heads-up:</strong> ${esc(model.collision.roles[0])} and ${esc(model.collision.roles[1])} look similar under deuteranopia (ΔE ${model.collision.delta.toFixed(1)}).`
      + (s ? ` Try a shifted ${esc(s.role.toLowerCase())} ${swatch(s.hex, '', 'width:16px;height:16px;display:inline-block;vertical-align:-2px')}${s.match ? ' — nearest paint ' + esc(s.match.paint.name) + ' (' + esc(s.match.paint.brand) + ')' : ''}.` : '')
      + '</div>';
  } else {
    coll = '<div class="collide ok">No major colour-blindness collisions in this scheme.</div>';
  }
  return `<div class="micro" style="margin:14px 0 8px">Colour-blindness simulation (role colours)</div>${simRows}`
    + `<div class="micro" style="margin:18px 0 8px">Contrast (WCAG 2.1)</div><div class="ctr">${ctr}</div>${coll}`;
}

