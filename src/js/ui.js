// ui.js — pure render-to-string helpers. No DOM access, no globals (import-safe + testable).
// DOM wiring lives in app.js. Colour decisions come from the engine (color.js).

import { textOn } from './color.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = t => t.charAt(0).toUpperCase() + t.slice(1); // sentence case (§3.3)

export const swatch = (hex, cls = '', extra = '') => `<span class="sw ${cls}" style="background:${hex};${extra}"></span>`;

/** Picker list of paints (each row is a focusable option button). */
export function pickerList(paints, selectedId, owned = new Set()) {
  if (!paints.length) return `<div style="padding:18px;color:var(--text-faint);font-size:13px">No paints match.</div>`;
  return paints.map(p => {
    const own = owned.has(p.id);
    return `<button class="paint" role="option" data-id="${esc(p.id)}" aria-selected="${p.id === selectedId}">`
      + swatch(p.hex, '', 'width:30px;height:30px')
      + `<span style="min-width:0;flex:1"><span class="nm">${esc(p.name)}</span><br>`
      + `<span class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''}</span></span>`
      + `<span class="own${own ? ' on' : ''}" data-own="${esc(p.id)}" role="checkbox" aria-checked="${own}" title="Mark as owned">${own ? '★' : '☆'}</span>`
      + '</button>';
  }).join('');
}

/** Compare two schemes side by side. a/b: { base, harmony, colors:[ideal hexes] }. */
export function compareBar(a, b) {
  const row = (g, lbl) => `<div class="cmprow"><span class="cmplab">${esc(lbl)} · ${esc(g.harmony)} · <span class="mono">${esc(g.base)}</span></span>`
    + `<div class="cmppal">${g.colors.map(c => `<span style="background:${c}"></span>`).join('')}</div></div>`;
  return `<div class="compare"><div class="cmphead">Compare</div>${row(a, 'A')}${row(b, 'B · current')}</div>`;
}

/** Base-paint hero. `base`: { hex, name, brand?, line?, type?, approx?, custom? }. */
export function hero(base) {
  const meta = base.custom ? 'typed hex' : `${esc(base.brand || '')}${base.line ? ' · ' + esc(base.line) : ''}`;
  const tags = base.custom
    ? '<span class="tag">custom</span>'
    : `<span class="tag">${esc(base.type || 'paint')}</span>${base.approx ? '<span class="tag approx">approx hex</span>' : ''}`;
  return swatch(base.hex, 'big')
    + `<div><h2>${esc(base.name)}</h2>`
    + `<div style="color:var(--text-muted);font-size:13px;margin-top:2px">${meta}</div>`
    + `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${tags}</div>`
    + `<div class="hexline">${esc(base.hex)}</div></div>`;
}

/** Ideal-colour strip for a harmony scheme ([{hex, deg}], base first). */
export function harmonyStrip(scheme) {
  return scheme.map(c => {
    const t = textOn(c.hex);
    const pill = t === '#FFFFFF' ? 'rgba(0,0,0,.38)' : 'rgba(255,255,255,.72)';
    return `<div style="background:${c.hex}"><span class="lbl" style="background:${pill};color:${t}">${esc(c.hex)}</span></div>`;
  }).join('');
}

/** Segmented control for harmony types. */
export const segmented = (types, active) =>
  types.map(t => `<button data-h="${esc(t)}" aria-pressed="${t === active}">${esc(label(t))}</button>`).join('');

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
  `<div class="palette">${scheme.roles.map(r => `<div style="background:${r.idealHex}"></div>`).join('')}</div>`;

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

export const placeholder = msg => `<div class="placeholder">${esc(msg)}</div>`;

/** Compact live scheme rows for the Explore wheel: ideal → nearest paint + ΔE. */
export function miniRoles(scheme) {
  return `<div class="mini">${scheme.roles.map(r => {
    const m = r.match;
    return `<div class="mrow">${swatch(r.idealHex, '', 'width:24px;height:24px')}<span class="arr">→</span>`
      + (m ? swatch(m.paint.hex, '', 'width:24px;height:24px') : '')
      + `<span class="mn">${esc(r.role)}: ${m ? esc(m.paint.name) : '—'}</span>`
      + (m ? `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span>` : '') + '</div>';
  }).join('')}</div>`;
}

/** Accessibility panel. model: { names, sims:[{label,colors}], contrasts:[{a,b,labelA,labelB,ratio,passAAText,passAALarge}], collision }. */
export function a11yPanel(model) {
  const strip = cols => `<div class="cstrip">${cols.map(c => `<span class="sw" style="flex:1;height:30px;background:${c}"></span>`).join('')}</div>`;
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
      + (s ? ` Try a shifted accent ${swatch(s.hex, '', 'width:16px;height:16px;display:inline-block;vertical-align:-2px')}${s.match ? ' — nearest paint ' + esc(s.match.paint.name) + ' (' + esc(s.match.paint.brand) + ')' : ''}.` : '')
      + '</div>';
  } else {
    coll = '<div class="collide ok">No major colour-blindness collisions in this scheme.</div>';
  }
  return `<div class="micro" style="margin:14px 0 8px">Colour-blindness simulation (role colours)</div>${simRows}`
    + `<div class="micro" style="margin:18px 0 8px">Contrast (WCAG 2.1)</div><div class="ctr">${ctr}</div>${coll}`;
}

