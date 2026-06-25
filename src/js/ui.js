// ui.js — pure render-to-string helpers. No DOM access, no globals (import-safe + testable).
// DOM wiring lives in app.js. Colour decisions come from the engine (color.js).

import { textOn } from './color.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = t => t.charAt(0).toUpperCase() + t.slice(1); // sentence case (§3.3)

export const swatch = (hex, cls = '', extra = '') => `<span class="sw ${cls}" style="background:${hex};${extra}"></span>`;

/** Picker list of paints (each row is a focusable option button). */
export function pickerList(paints, selectedId) {
  if (!paints.length) return `<div style="padding:18px;color:var(--text-faint);font-size:13px">No paints match.</div>`;
  return paints.map(p => `<button class="paint" role="option" data-id="${esc(p.id)}" aria-selected="${p.id === selectedId}">`
    + swatch(p.hex, '', 'width:30px;height:30px')
    + `<span style="min-width:0"><span class="nm">${esc(p.name)}</span><br>`
    + `<span class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''}</span></span></button>`).join('');
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
