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

// background-color (not the `background` shorthand) so the metallic-sheen background-image can layer on top.
export const swatch = (hex, cls = '', extra = '') => `<span class="sw ${cls}" style="background-color:${safeColor(hex)};${extra}"></span>`;

// Finish VFX modifier class for a swatch (§2/§3.5 finish overlays — non-tinting, convey finish not colour):
//  metal → specular sheen · wash/ink/shade/glaze → translucent satin · contrast → softer translucent ·
//  curated p.fx (gloss/slime/texture) → bespoke wet-gloss / goopy / gritty-matte for technical paints.
const FX_BY_TYPE = { metal: 'metal', wash: 'fx-wash', ink: 'fx-wash', shade: 'fx-wash', glaze: 'fx-wash', contrast: 'fx-contrast' };
const fxCls = p => { if (!p) return ''; if (p.fx) return ' fx-' + p.fx; const c = FX_BY_TYPE[p.type]; return c ? ' ' + c : ''; };

// Finish-type glyphs (inline SVG so they inherit colour/size). Flat paints (base/layer/dry/primer) get none.
const GEM = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M3 6l5-4 5 4-5 8z"/></svg>';
const DROP = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M8 2c2.4 3.2 4 5.2 4 7.2A4 4 0 0 1 4 9.2C4 7.2 5.6 5.2 8 2z"/></svg>';
const STAR = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13 6.4 8.6 2 7l4.4-1.6z"/></svg>';
const FINISHES = { metal: ['metallic', GEM], contrast: ['contrast', DROP], wash: ['wash', DROP], shade: ['shade', DROP], ink: ['ink', DROP], glaze: ['glaze', DROP], effect: ['effect', STAR] };
/** Small finish pill (icon + label) flagging non-flat paints (metallic/contrast/wash/…); '' for flat paints. */
export const finishTag = type => { const f = FINISHES[type]; return f ? `<span class="finish finish-${type}">${f[1]}${f[0]}</span>` : ''; };

/** Picker list: each row pairs a focusable select button with a separate owned-toggle button.
 *  (Keeping the toggle a sibling — not nested in the option — makes it keyboard-operable.) */
export function pickerList(paints, selectedId, owned = new Set()) {
  if (!paints.length) return `<div style="padding:18px;color:var(--text-faint);font-size:13px">No paints match.</div>`;
  return paints.map(p => {
    const own = owned.has(p.id);
    return `<div class="paintrow" role="listitem">`
      + `<button class="paint" data-id="${esc(p.id)}" aria-current="${p.id === selectedId}">`
      + swatch(p.hex, fxCls(p).trim(), 'width:30px;height:30px')
      + `<span style="min-width:0;flex:1"><span class="nm">${esc(p.name)}</span><br>`
      + `<span class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</span></span>`
      + `</button>`
      + `<button class="own${own ? ' on' : ''}" data-own="${esc(p.id)}" aria-pressed="${own}" aria-label="Mark ${esc(p.name)} as owned" title="Mark as owned">${own ? '★' : '☆'}</button>`
      + `</div>`;
  }).join('');
}

/** Finder-style collection grid. Each cell is a square swatch (colour = paint data) with a corner
 *  state badge (owned ✓ / to-buy cart) and, on hover/focus, an overlaid name tooltip. Selection is an
 *  outline (interaction, §3.5) — never a border-width change, so neighbours never reflow (§3.4 no-jiggle).
 *  `markOf(id)` → 'owned'|'want'|'none'; `selected` is a Set of selected ids. */
export function shelfGrid(paints, markOf, selected = new Set()) {
  if (!paints.length) return `<div class="placeholder">No paints match this filter.</div>`;
  return paints.map(p => {
    const mark = markOf(p.id), sel = selected.has(p.id);
    const badge = markBadge(mark);
    const state = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned';
    return `<div class="cell${fxCls(p)}" role="option" data-id="${esc(p.id)}" data-mark="${mark}"`
      + ` aria-selected="${sel}" aria-label="${esc(p.name)}, ${esc(p.brand)} — ${state}"`
      + ` style="--cell:${safeColor(p.hex)}">`
      + `${badge}<span class="celltip">${esc(p.name)} · ${esc(p.brand)}</span>`
      + `</div>`;
  }).join('');
}

// Small cart glyph for the to-buy badge (inline SVG so it inherits the badge's --on-buy colour).
const cartGlyph = `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">`
  + `<path fill="currentColor" d="M1 1h2l.6 2H15l-1.7 6.2a1.4 1.4 0 0 1-1.35 1H5.4a1.4 1.4 0 0 1-1.36-1L2.2 2.4 1.9 1.3 1 1zm4.7 12.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>`;

/** State badge for a paint's mark — owned ✓ / to-buy cart / nothing. Shared by the grid + in-place updates. */
export const markBadge = mark =>
  mark === 'owned' ? `<span class="cbadge owned" aria-hidden="true">✓</span>`
    : mark === 'want' ? `<span class="cbadge want" aria-hidden="true">${cartGlyph}</span>`
      : '';

/** Brand filter chips for the shelf. `active` is the selected brand ('' = all). */
export function brandChips(brands, active = '') {
  const chip = (val, lbl) => `<button class="chip" data-brand="${esc(val)}" aria-pressed="${val === active}">${esc(lbl)}</button>`;
  return chip('', 'All') + brands.map(b => chip(b, b)).join('');
}

/** Shelf action bar: fixed-height row (reserved space → no reflow when it fills, §3.4). Empty until a
 *  selection exists, then shows "N selected" + mark actions. The persistent how-to hint lives up top. */
export function shelfBar(count) {
  if (!count) return '';
  return `<span class="barcount">${count} selected</span>`
    + `<span class="baracts">`
    + `<button class="btn sm" data-act="owned">Mark owned</button>`
    + `<button class="btn sm" data-act="want">Mark to buy</button>`
    + `<button class="btn sm" data-act="none">Clear</button>`
    + `<button class="btn sm ghost" data-act="deselect">Deselect</button>`
    + `</span>`;
}

/** Compare two schemes side by side. a/b: { base, harmony, colors:[ideal hexes] }. */
export function compareBar(a, b) {
  const row = (g, lbl) => `<div class="cmprow"><span class="cmplab">${esc(lbl)} · ${esc(g.harmony)} · <span class="mono">${esc(g.base)}</span></span>`
    + `<div class="cmppal">${g.colors.map(c => `<span style="background:${safeColor(c)}"></span>`).join('')}</div></div>`;
  return `<div class="compare"><div class="cmphead">Compare</div>${row(a, 'A')}${row(b, 'B · current')}</div>`;
}

/** Owned/to-buy affordance for a real paint chip — owned tick or a buy toggle. `mark` ∈ owned|want|none. */
const ownOrBuy = (id, mark) => mark === 'owned'
  ? '<span class="owntag">✓ owned</span>'
  : buyBtn(id, mark);

/** Base-paint hero. `base`: { id?, hex, name, brand?, line?, type?, approx?, custom? }. markOf adds owned/buy. */
export function hero(base, animate = true, markOf) {
  const meta = base.custom ? 'typed hex' : `${esc(base.brand || '')}${base.line ? ' · ' + esc(base.line) : ''}`;
  const tags = base.custom
    ? '<span class="tag">custom</span>'
    : `<span class="tag">${esc(base.type || 'paint')}</span>${base.approx ? '<span class="tag approx">approx hex</span>' : ''}`;
  const own = (!base.custom && base.id && markOf) ? `<div class="ownline" style="margin-top:8px">${ownOrBuy(base.id, markOf(base.id))}</div>` : '';
  return swatch(base.hex, (animate ? 'big pop' : 'big') + fxCls(base))
    + `<div><h2>${esc(base.name)}</h2>`
    + `<div style="color:var(--text-muted);font-size:13px;margin-top:2px">${meta}</div>`
    + `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${tags}</div>`
    + `<button type="button" class="hexline" data-copy="${esc(base.hex)}" title="Copy ${esc(base.hex)}" aria-label="Copy hex ${esc(base.hex)}">${esc(base.hex)}</button>`
    + own + `</div>`;
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

/** A per-paint "to-buy" toggle (#5). Hidden for paints already owned. `mark` ∈ 'owned'|'want'|'none'. */
const buyBtn = (id, mark) => mark === 'owned' ? '' :
  `<button type="button" class="buybtn${mark === 'want' ? ' on' : ''}" data-buy="${esc(id)}" aria-pressed="${mark === 'want'}"`
  + ` title="${mark === 'want' ? 'On your buy list — click to remove' : 'Add to your buy list'}">`
  + `${mark === 'want' ? '✓ on buy list' : '+ buy'}</button>`;

/** Render a nearest-paint match (or a graceful empty state). `markOf(id)` adds owned/adjust + a buy toggle. */
export function matchChip(m, markOf) {
  if (!m) return '<div class="br" style="color:var(--text-faint)">no close paint — consider mixing</div>';
  const p = m.paint, q = m.quality;
  const mark = markOf ? markOf(p.id) : 'none';
  // "Boost owned, but honest" (#6): flag what you own + how to nudge it, never hiding the ΔE gap.
  const ownTag = mark === 'owned'
    ? `<div class="ownline"><span class="owntag">✓ owned</span>${m.adjust ? `<span class="adjust">${esc(m.adjust)}</span>` : ''}</div>`
    : '';
  return swatch(p.hex, 'act' + fxCls(p))
    + `<div style="min-width:0"><div class="ttl">Nearest real paint</div>`
    + `<div class="nm">${esc(p.name)}</div>`
    + `<div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</div>`
    + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span>`
    + `<span style="color:${tier(q.tier)}">${esc(q.label)}</span>`
    + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></div>`
    + ownTag + buyBtn(p.id, mark) + `</div>`;
}

/** Plan-tab controls (#5/#6/#7): tone-ladder style · how-to-use-collection tri-state · "add gaps to buy".
 *  `collection` ∈ 'off' | 'prefer' (soft boost) | 'only' (hard filter) — one control, no overlap. */
export function planControls(ladder, collection, includeContrast, gapCount) {
  const lad = [['wash', 'Wash · base · highlight'], ['tone', 'Shadow · mid · highlight'], ['both', 'Both']]
    .map(([v, l]) => `<button data-ladder="${v}" aria-pressed="${v === ladder}">${esc(l)}</button>`).join('');
  const col = [['off', 'Off'], ['prefer', 'Prefer owned'], ['only', 'Only owned']]
    .map(([v, l]) => `<button data-collection="${v}" aria-pressed="${v === collection}">${esc(l)}</button>`).join('');
  return `<div class="planctl">`
    + `<div class="ctlgrp"><span class="micro">Tone ladder</span><div class="seg ladsel" role="group" aria-label="Tone ladder">${lad}</div></div>`
    + `<div class="ctlgrp"><span class="micro">Use my collection</span><div class="seg colsel" role="group" aria-label="Use my collection" title="Off · prefer paints you own (boost, still honest) · only paints you own (filter)">${col}</div></div>`
    + `<button class="btn sm incl-contrast" id="inclContrast" aria-pressed="${!!includeContrast}" title="Washes, shades and effects are kept out of suggestions; tick to include Contrast paints (used as one-coat base colours)">Include Contrast</button>`
    + (gapCount > 0
      ? `<button class="btn sm primary" id="addGaps">+ Add ${gapCount} to buy</button>`
      : `<span class="micro nogaps">Nothing new to buy for this scheme</span>`)
    + `</div>`;
}

/** Small overview bar of the scheme's role ideal colours. */
export const paletteOverview = scheme =>
  `<div class="palette">${scheme.roles.map(r => {
    const hex = safeColor(r.idealHex);
    return `<button type="button" class="pblock" data-copy="${hex}" title="Copy ${hex}" aria-label="Copy ${esc(r.role)} colour ${hex}" style="background:${hex};color:${textOn(hex)}">`
      + `<span class="pbl"><span class="pbr">${esc(r.role)}</span><span class="pbh">${hex}</span></span></button>`;
  }).join('')}</div>`;

/** Role slots: each role's ideal → nearest real paint, plus the selected tone ladder(s) (#7). */
export function roleSlots(scheme, markOf) {
  const step = s => `<div class="step">${swatch(s.idealHex, '')}<div class="cap">${esc(s.key)}</div><div class="pn">${s.match ? esc(s.match.paint.name) : '—'}</div></div>`;
  // When a limited collection forces two roles onto the same paint, say so + how to separate / what to buy.
  const sharedNote = r => r.shared
    ? `<div class="sharednote"><span class="warnpill">shared paint</span> reused for another role — ${esc(r.differentiate)} to separate`
      + (r.buy ? `, or buy <strong>${esc(r.buy.paint.name)}</strong> <span class="br">(${esc(r.buy.paint.brand)} · ΔE ${r.buy.deltaE.toFixed(1)})</span> ${buyBtn(r.buy.paint.id, markOf ? markOf(r.buy.paint.id) : 'none')}` : '') + `.</div>`
    : '';
  return `<div class="slots">${scheme.roles.map(r => `<div class="slot${r.shared ? ' is-shared' : ''}">`
    + `<div class="shead"><span class="role">${esc(r.role)}</span><span class="wt">${esc(r.weight)}</span></div>`
    + `<div class="ivsa">${swatch(r.idealHex, 'ideal', `color:${textOn(r.idealHex)}`)}<span class="arr">→</span>${matchChip(r.match, markOf)}</div>`
    + sharedNote(r)
    + r.ladders.map(lad => (r.ladders.length > 1 ? `<div class="ladcap">${esc(lad.label)}</div>` : '')
      + `<div class="ladder">${lad.steps.map(step).join('')}</div>`).join('')
    + `</div>`).join('')}</div>`;
}

/** Curated equivalence group — interchangeable paints (ΔE ≤ 1) across brands. `members`: [paint]. */
export function equivGroup(label, members, markOf) {
  if (!members.length) return '';
  const brands = new Set(members.map(m => m.brand)).size;
  return `<div class="eqgroup"><p class="hint" style="margin:14px 0 6px">`
    + `Interchangeable — same colour (ΔE ≤ 1): <strong>${esc(label)}</strong> · ${members.length} paints across ${brands} brand${brands === 1 ? '' : 's'}.</p>`
    + `<div class="eq">${members.map(p => {
      const mark = markOf ? markOf(p.id) : 'none';
      return `<div class="eqc">${swatch(p.hex, fxCls(p).trim())}<div style="min-width:0">`
        + `<div class="nm">${esc(p.name)}</div><div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</div>`
        + `<div class="ownline" style="margin-top:6px">${ownOrBuy(p.id, mark)}</div></div></div>`;
    }).join('')}</div></div>`;
}

/** Cross-brand equivalents list (M6). `equivs`: [{paint, deltaE, quality}]. markOf adds owned/buy. */
export function equivalentsPanel(name, equivs, markOf) {
  if (!equivs.length) return '<div class="placeholder">No other-brand matches in the dataset for this paint.</div>';
  return `<p class="hint" style="margin:14px 0 0">Closest matches to <strong>${esc(name)}</strong> in other ranges (ΔE 2000).</p>`
    + `<div class="eq">${equivs.map(e => {
      const p = e.paint, q = e.quality;
      const mark = markOf ? markOf(p.id) : 'none';
      return `<div class="eqc">${swatch(p.hex, fxCls(p).trim())}<div style="min-width:0">`
        + `<div class="nm">${esc(p.name)}</div><div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</div>`
        + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span><span style="color:${tier(q.tier)}">${esc(q.label)}</span>`
        + `<span class="badge">ΔE ${e.deltaE.toFixed(1)}</span></div>`
        + `<div class="ownline" style="margin-top:6px">${ownOrBuy(p.id, mark)}</div></div></div>`;
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
    const fx = real && m ? fxCls(m.paint).trim() : '';   // finish overlay only when the column shows a real paint
    const foot = m
      ? `<span class="lcname">${esc(m.paint.name)}${m.owned ? ' <span class="ownmini">✓ owned</span>' : ''}</span>`
        + `<span class="de" style="margin:2px 0 0"><span class="dot" style="background:${tier(m.quality.tier)}"></span>`
        + `<span style="color:${tier(m.quality.tier)}">${esc(m.quality.label)}</span>`
        + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></span>${finishTag(m.paint.type)}`
      : `<span class="lcname">—</span><span class="br">no close paint</span>`;
    const isBase = c.kind === 'base', isFree = c.kind === 'free';
    const sw = isBase ? 'base' : isFree ? 'x:' + c.id.slice(1) : 'p:' + c.deg;   // addressable swatch key
    const canDetach = isFree || (c.kind === 'partner' && c.detachable);          // value-harmony partners can't be pinned uniquely
    const cHex = safeColor(c.hex);                         // the swatch's own (ideal) colour — what "use as base"/edit start from
    const lockOn = !!c.locked;
    return `<div class="lcol${lockOn ? ' locked' : ''}"${isFree ? ` draggable="true" data-dragidx="${c.id.slice(1)}"` : ''}>`
      + `<button type="button" class="lctop${fx ? ' ' + fx : ''}" data-copy="${bg}" title="Copy ${bg}" aria-label="Copy ${esc(tag)} colour ${bg}" style="background-color:${bg};color:${t}">`
      +   `<span class="lctag">${esc(tag)}${real ? ' · real' : ''}</span><span class="lchex">${bg}</span></button>`
      + `<div class="lcact">`
      +   ((isBase || canDetach) ? `<button type="button" class="lcbtn" data-edit="${sw}" title="Edit colour" aria-label="Edit ${esc(tag)} colour">✎</button>` : '')
      +   (canDetach ? `<button type="button" class="lcbtn${lockOn ? ' on' : ''}" data-lock="${sw}" title="${lockOn ? 'Unlock' : 'Lock'} colour" aria-label="${lockOn ? 'Unlock' : 'Lock'} ${esc(tag)}" aria-pressed="${lockOn}">${lockOn ? '🔒' : '🔓'}</button>` : '')
      +   `<button type="button" class="lcbtn" data-setbase="${cHex}" title="Use as base colour" aria-label="Use ${esc(tag)} as the base colour">◎</button>`
      +   (isFree ? `<button type="button" class="lcbtn" data-delnode="${c.id.slice(1)}" title="Remove this colour" aria-label="Remove ${esc(tag)}">✕</button>` : '')
      + `</div>`
      + `<span class="lcfoot">${foot}</span></div>`;
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

