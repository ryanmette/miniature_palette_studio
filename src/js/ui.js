// ui.js — pure render-to-string helpers. No DOM access, no globals (import-safe + testable).
// DOM wiring lives in app.js. Colour decisions come from the engine (color.js).

// textOn(hex) → the legible ink colour (black/white) to place over a given swatch colour.
import { textOn } from './color.js';
// HARMONY_OFFSETS[type] → the hue-rotation angles a harmony uses; here it feeds the little geometry glyphs.
import { HARMONY_OFFSETS } from './harmony.js';

// esc: HTML-escape a value before it goes into a template literal (a backtick string with ${...} slots that
// gets assembled into HTML). Replacing & < > " with entities means a paint name or user-typed hex can never
// break out of the markup or inject HTML/attributes. Every dynamic value below is wrapped in esc(...) for this.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Harmony ids that shouldn't be shown by just capitalising the slug — spell these two out as readable phrases.
const LABELS = { 'neutral-pop': 'Neutral + pop', 'warm-cool': 'Warm / cool' };   // neutral harmonies read as phrases
// label: human-friendly harmony name — use the phrase table if present, else Capitalise the first letter.
const label = t => LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1); // sentence case (§3.3)

// Defence-in-depth: any colour interpolated into an inline style must be a literal #hex.
// Inputs are already validated upstream (rgbToHex output, URL/-input regex, dataset QA), but we
// re-assert here so a future caller can't turn a swatch into a CSS/HTML-injection sink.
// safeColor: return c only if it is an exact 6-digit #hex, else fall back to black — the allow-list gate.
const safeColor = c => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

// swatch: the reusable coloured square (`.sw`). `hex` is paint *data* (never a design token); `cls` adds
// finish-overlay/size classes; `extra` appends raw inline style. Uses background-color (not the `background`
// shorthand) so the CSS metallic-sheen background-image can layer on top without being overwritten.
export const swatch = (hex, cls = '', extra = '') => `<span class="sw ${cls}" style="background-color:${safeColor(hex)};${extra}"></span>`;

// Finish VFX modifier class for a swatch (§2/§3.5 finish overlays — non-tinting, convey finish not colour):
//  metal → specular sheen · wash/ink/shade/glaze → translucent satin · contrast → softer translucent ·
//  curated p.fx (gloss/slime/texture) → bespoke wet-gloss / goopy / gritty-matte for technical paints.
// Map a paint's *type* to its finish-overlay CSS class (the visual effect layered on the swatch).
const FX_BY_TYPE = { metal: 'metal', wash: 'fx-wash', ink: 'fx-wash', shade: 'fx-wash', glaze: 'fx-wash', contrast: 'fx-contrast' };
// fxCls: leading-space-prefixed finish class for a paint (safe to concatenate into a class list). A curated
// per-paint `p.fx` (gloss/slime/texture technical effect) wins; otherwise fall back to the type map; else ''.
const fxCls = p => { if (!p) return ''; if (p.fx) return ' fx-' + p.fx; const c = FX_BY_TYPE[p.type]; return c ? ' ' + c : ''; };

// Finish-type glyphs (inline SVG so they inherit colour/size via currentColor). Flat paints (base/layer/dry/primer) get none.
// GEM = faceted diamond (metallic); DROP = teardrop (fluid: contrast/wash/shade/ink/glaze); STAR = burst (effect).
// aria-hidden="true" hides them from screen readers — they're decorative next to a text label.
const GEM = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M3 6l5-4 5 4-5 8z"/></svg>';
const DROP = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M8 2c2.4 3.2 4 5.2 4 7.2A4 4 0 0 1 4 9.2C4 7.2 5.6 5.2 8 2z"/></svg>';
const STAR = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13 6.4 8.6 2 7l4.4-1.6z"/></svg>';
// Per finish type: [label text, glyph]. Only non-flat types appear here; a missing type ⇒ no pill (flat paint).
const FINISHES = { metal: ['metallic', GEM], contrast: ['contrast', DROP], wash: ['wash', DROP], shade: ['shade', DROP], ink: ['ink', DROP], glaze: ['glaze', DROP], effect: ['effect', STAR] };
/** Small finish pill (icon + label) flagging non-flat paints (metallic/contrast/wash/…); '' for flat paints. */
// f = [label, glyph]; emit glyph then label inside a type-specific pill, or nothing when the type is flat.
export const finishTag = type => { const f = FINISHES[type]; return f ? `<span class="finish finish-${type}">${f[1]}${f[0]}</span>` : ''; };

/** Display name for a dataset paint — dname carries the line when (brand, name) is ambiguous
 *  ("Dawnstone (Layer)" vs "Dawnstone (Dry)"). Use wherever the line isn't otherwise visible. */
const pname = p => p.dname || p.name;

/** Horizontal paint strip for the header drawer (§3.6): each paint is a chip — swatch (with finish overlay
 *  + owned/to-buy state badge) over its name. Click to pick; right-click or P/U/X to mark (app.js). The
 *  swatch is a real `.sw` so it carries the finish overlays; `markBadge` shows owned ✓ / to-buy cart. */
export function paintStrip(paints, selectedId, markOf = () => 'none') {
  // Empty-search fallback so the strip never renders blank.
  if (!paints.length) return `<div class="placeholder">No paints match.</div>`;
  // Build one <button> chip per paint and join into a single HTML string (app.js sets it via innerHTML).
  return paints.map(p => {
    const mark = markOf(p.id);                                                    // 'owned' | 'want' | 'none'
    const state = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned';   // spoken state for the aria-label
    // data-* attributes (data-id / data-mark) are custom hooks app.js reads via event delegation; role="option"
    // + aria-selected mark this as a listbox item; the aria-label speaks name, brand, (line if unambiguous) + state.
    return `<button class="pchip" role="option" data-id="${esc(p.id)}" data-mark="${mark}" aria-selected="${p.id === selectedId}"`
      + ` aria-label="${esc(pname(p))}, ${esc(p.brand)}${p.line && p.line !== '—' && pname(p) === p.name ? ' · ' + esc(p.line) : ''} — ${state}">`
      + `<span class="sw${fxCls(p)}" style="background-color:${safeColor(p.hex)}">${markBadge(mark)}</span>`   // real .sw so it carries the finish overlay + corner state badge
      + `<span class="pchip-nm">${esc(pname(p))}</span>`                          // the paint name under the swatch
      + `</button>`;
  }).join('');
}

/** Finder-style collection grid. Each cell is a square swatch (colour = paint data) with a corner
 *  state badge (owned ✓ / to-buy cart) and, on hover/focus, an overlaid name tooltip. Selection is an
 *  outline (interaction, §3.5) — never a border-width change, so neighbours never reflow (§3.4 no-jiggle).
 *  `markOf(id)` → 'owned'|'want'|'none'; `selected` is a Set of selected ids. */
export function shelfGrid(paints, markOf, selected = new Set()) {
  // Empty-filter fallback so the grid never renders blank.
  if (!paints.length) return `<div class="placeholder">No paints match this filter.</div>`;
  // Build one square cell per paint and join into a single HTML string.
  return paints.map(p => {
    const mark = markOf(p.id), sel = selected.has(p.id);                          // mark = owned/want/none; sel = is it in the selection Set
    const badge = markBadge(mark);                                                // corner owned ✓ / to-buy cart
    const state = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned';   // spoken state for the aria-label
    // Colour is passed as the --cell CSS variable (CSS paints the square) rather than an inline background,
    // so selection can be an outline and toggling a mark never changes box size → no neighbour reflow (§3.4).
    return `<div class="cell${fxCls(p)}" role="option" data-id="${esc(p.id)}" data-mark="${mark}"`
      + ` aria-selected="${sel}" aria-label="${esc(pname(p))}, ${esc(p.brand)} — ${state}"`
      + ` style="--cell:${safeColor(p.hex)}">`
      + `${badge}<span class="celltip">${esc(pname(p))} · ${esc(p.brand)}</span>`  // badge + hover/focus name tooltip
      + `</div>`;
  }).join('');
}

// Small cart glyph for the to-buy badge (inline SVG so it inherits the badge's --on-buy colour via currentColor).
const cartGlyph = `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">`
  + `<path fill="currentColor" d="M1 1h2l.6 2H15l-1.7 6.2a1.4 1.4 0 0 1-1.35 1H5.4a1.4 1.4 0 0 1-1.36-1L2.2 2.4 1.9 1.3 1 1zm4.7 12.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>`;

/** State badge for a paint's mark — owned ✓ / to-buy cart / nothing. Shared by the grid + in-place updates. */
// One canonical badge so "owned" and "to-buy" look identical everywhere (§3.5 single-meaning state colours).
export const markBadge = mark =>
  mark === 'owned' ? `<span class="cbadge owned" aria-hidden="true">✓</span>`     // owned → tick
    : mark === 'want' ? `<span class="cbadge want" aria-hidden="true">${cartGlyph}</span>`   // to-buy → cart
      : '';                                                                        // unmarked → nothing

/** Brand filter chips for the shelf. `active` is the selected brand ('' = all). */
export function brandChips(brands, active = '') {
  // chip: one toggle button; data-brand carries the value app.js filters on; aria-pressed marks the active one.
  const chip = (val, lbl) => `<button class="chip" data-brand="${esc(val)}" aria-pressed="${val === active}">${esc(lbl)}</button>`;
  // Lead with an "All" chip (empty value), then one chip per brand.
  return chip('', 'All') + brands.map(b => chip(b, b)).join('');
}

/** Shelf action bar: fixed-height row (reserved space → no reflow when it fills, §3.4). Empty until a
 *  selection exists, then shows "N selected" + mark actions. The persistent how-to hint lives up top. */
export function shelfBar(count) {
  // No selection ⇒ empty content (the row keeps its reserved height in CSS, so filling it doesn't reflow, §3.4).
  if (!count) return '';
  // Count read-out + the four bulk actions; data-act tells app.js which mark/clear/deselect operation to run.
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
  // row: one scheme's line — a label + harmony name + base hex, then a strip of its ideal colour swatches.
  const row = (g, lbl) => `<div class="cmprow"><span class="cmplab">${esc(lbl)} · ${esc(g.harmony)} · <span class="mono">${esc(g.base)}</span></span>`
    + `<div class="cmppal">${g.colors.map(c => `<span style="background:${safeColor(c)}"></span>`).join('')}</div></div>`;
  // A = the stashed scheme, B = the current one, stacked under a "Compare" heading.
  return `<div class="compare"><div class="cmphead">Compare</div>${row(a, 'A')}${row(b, 'B · current')}</div>`;
}

/** Owned/to-buy affordance for a real paint chip — owned tick or a buy toggle. `mark` ∈ owned|want|none. */
// Already owned ⇒ a static "owned" tag (nothing to buy); otherwise the interactive buy toggle.
const ownOrBuy = (id, mark) => mark === 'owned'
  ? '<span class="owntag">✓ owned</span>'
  : buyBtn(id, mark);

/** Base-paint hero — a single compact identity line: swatch chip · name · hex · seed-role pill · meta · buy.
 *  `base`: { id?, hex, name, brand?, line?, type?, approx?, custom? }. markOf adds owned/buy.
 *  `seedRole` ('main'|'accent') shows the role the *picked paint* plays (the hero always shows your pick,
 *  so this reads true in both seed modes). Condensed from the old tall block to reclaim space above the wheel. */
export function hero(base, animate = true, markOf, seedRole = '', neutral = false) {
  // meta: the small print. Typed-hex seeds just say "typed hex"; dataset paints show brand · line · type,
  // with an "approx" tag when the hex is only an approximation of the physical paint (§2 honesty).
  const meta = base.custom ? 'typed hex'
    : `${esc(base.brand || '')}${base.line && base.line !== '—' ? ' · ' + esc(base.line) : ''}${base.type ? ' · ' + esc(base.type) : ''}`
      + (base.approx ? ' · <span class="approx">approx</span>' : '');
  // seed: a "main"/"accent" *state* pill showing what role your picked paint plays; empty when not a seed.
  const seed = seedRole ? `<span class="seedbadge seed-${esc(seedRole)}">${esc(seedRole)}</span>` : '';
  // ntag: flag that this seed is neutral (no usable hue) so the neutral-mode scheme makes sense.
  const ntag = neutral ? '<span class="ntag" title="No usable hue — the scheme is built for neutrals">neutral</span>' : '';
  // own: owned tag / buy toggle — only for a real dataset paint (has an id, not a custom hex) when markOf is given.
  const own = (!base.custom && base.id && markOf) ? `<span class="herobuy">${ownOrBuy(base.id, markOf(base.id))}</span>` : '';
  // Assemble the one-line identity strip: swatch chip (with pop animation + finish overlay) · name · copyable
  // hex button · seed/neutral pills · meta · owned/buy. `animate` adds the scale-bounce 'pop' class (§3.4 motion).
  return swatch(base.hex, 'herochip' + (animate ? ' pop' : '') + fxCls(base))
    + `<h2 class="heroname">${esc(base.name)}</h2>`
    + `<button type="button" class="hexline" data-copy="${esc(base.hex)}" title="Copy ${esc(base.hex)}" aria-label="Copy hex ${esc(base.hex)}">${esc(base.hex)}</button>`   // data-copy → app.js copies to clipboard
    + seed + ntag
    + `<span class="herometa">${meta}</span>`
    + own;
}

/** Suggestive glyph angles for the neutral harmonies (they have no HARMONY_OFFSETS — the pop/tints
 *  aren't base rotations). Purely decorative (aria-hidden), so a hint is enough. */
const NEUTRAL_GLYPH_ANGLES = { 'neutral-pop': [180], duotone: [150, 210], 'warm-cool': [90, 270] };

/** Tiny line-art glyph of a harmony's geometry, generated from HARMONY_OFFSETS so it can't drift. */
const harmonyGlyph = type => {
  // The base sits at 0°; add the harmony's partner angles (real offsets, or the decorative neutral hint).
  const angles = [0, ...(HARMONY_OFFSETS[type] || NEUTRAL_GLYPH_ANGLES[type] || [])];
  const cx = 11, cy = 11, r = 7;                                                  // circle centre + radius in the 22×22 viewBox
  // pt: convert a clock angle (0° = up) to an [x,y] point on the ring — sin for x, -cos for y (screen y grows down).
  const pt = a => [cx + Math.sin(a * Math.PI / 180) * r, cy - Math.cos(a * Math.PI / 180) * r];
  // A spoke from centre to each angle...
  const lines = angles.map(a => { const [x, y] = pt(a); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  // ...and a dot at each angle; the first (base, i===0) is drawn slightly larger.
  const dots = angles.map((a, i) => { const [x, y] = pt(a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 ? 2.4 : 1.7}"/>`; }).join('');
  return `<svg class="hglyph" viewBox="0 0 22 22" aria-hidden="true">${lines}${dots}</svg>`;   // decorative → aria-hidden
};

/** Segmented control for harmony types — each option shows a glyph of its geometry + label.
 *  `opts.disabled` (Set) greys chips out in place — visible with the why in their tooltip, never
 *  removed (no reflow, §3.4); `opts.disabledReason` is that tooltip. */
export const segmented = (types, active, opts = {}) => {
  const dis = opts.disabled || new Set();                                         // set of harmony ids to grey out
  // One button per harmony: data-h carries the id (app.js reads it), aria-pressed marks the active one, a
  // disabled chip stays visible but gets aria-disabled + a why tooltip (never removed → no reflow, §3.4).
  return types.map(t => {
    const d = dis.has(t);
    return `<button data-h="${esc(t)}" aria-pressed="${t === active}"`
      + (d ? ` aria-disabled="true" title="${esc(opts.disabledReason || '')}"` : '')
      + `>${harmonyGlyph(t)}<span class="hlbl">${esc(label(t))}</span></button>`;   // geometry glyph + readable label
  }).join('');
};

/** <option> list for the brand filter. */
// One <option> per brand for a native <select>.
export const brandOptions = brands => brands.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

/** Quick-pop chips for neutral mode — shortcuts that move the wheel's pop node (not a second system).
 *  `pops`: [{hex, name}]; `active` = the current pop hex (a chip is "on" when it IS the pop). */
// A chip is "on" when its hex equals the active pop (case-insensitive compare); data-pop carries the hex app.js applies.
export const popChips = (pops, active) =>
  '<span class="micro">Quick pops</span>' + pops.map(p =>
    `<button type="button" class="pop${p.hex.toUpperCase() === (active || '').toUpperCase() ? ' on' : ''}"`
    + ` data-pop="${esc(p.hex)}" aria-pressed="${p.hex.toUpperCase() === (active || '').toUpperCase()}"`
    + ` title="Use ${esc(p.name)} as the pop accent"><span class="sw" style="background:${esc(p.hex)}"></span>${esc(p.name)}</button>`).join('');

// tier: turn a quality-tier token name (e.g. 'success') into a CSS var() reference so ΔE colours come from tokens (§3.2).
const tier = t => `var(--${t})`;

/** A per-paint "to-buy" toggle (#5). Hidden for paints already owned. `mark` ∈ 'owned'|'want'|'none'. */
// Owned paints show no buy button (nothing to buy). Otherwise a toggle: 'want' ⇒ pressed/"on buy list", else "+ buy".
// data-buy carries the paint id app.js toggles; aria-pressed + the .on class reflect current state.
const buyBtn = (id, mark) => mark === 'owned' ? '' :
  `<button type="button" class="buybtn${mark === 'want' ? ' on' : ''}" data-buy="${esc(id)}" aria-pressed="${mark === 'want'}"`
  + ` title="${mark === 'want' ? 'On your buy list — click to remove' : 'Add to your buy list'}">`
  + `${mark === 'want' ? '✓ on buy list' : '+ buy'}</button>`;

/** Render a nearest-paint match (or a graceful empty state). `markOf(id)` adds owned/adjust + a buy toggle. */
export function matchChip(m, markOf) {
  // No match found ⇒ graceful empty state instead of a broken chip.
  if (!m) return '<div class="br" style="color:var(--text-faint)">no close paint — consider mixing</div>';
  const p = m.paint, q = m.quality;                                              // the matched paint + its quality {tier, label}
  const mark = markOf ? markOf(p.id) : 'none';
  // "Boost owned, but honest" (#6): flag what you own (+ any adjust hint) but never hide the ΔE gap.
  const ownTag = mark === 'owned'
    ? `<div class="ownline"><span class="owntag">✓ owned</span>${m.adjust ? `<span class="adjust">${esc(m.adjust)}</span>` : ''}</div>`
    : '';
  // Render: swatch (with finish overlay) + a text block — heading, paint name, brand·line + finish pill, then the
  // ΔE line (a token-coloured dot + quality label + the raw ΔE badge, §3.2), then owned tag / buy toggle.
  return swatch(p.hex, 'act' + fxCls(p))
    + `<div style="min-width:0"><div class="ttl">Nearest real paint</div>`
    + `<div class="nm">${esc(p.name)}</div>`
    + `<div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</div>`
    + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span>`
    + `<span style="color:${tier(q.tier)}">${esc(q.label)}</span>`
    + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></div>`   // raw distance always shown (§2 never imply an exact match)
    + ownTag + buyBtn(p.id, mark) + `</div>`;
}

/** Plan-tab controls (#5/#6/#7): tone-ladder style · how-to-use-collection tri-state · "add gaps to buy".
 *  `collection` ∈ 'off' | 'prefer' (soft boost) | 'only' (hard filter) — one control, no overlap. */
export function planControls(ladder, collection, includeContrast, gapCount) {
  // Tone-ladder segmented control — three options; data-ladder carries the choice, aria-pressed marks the active one.
  const lad = [['wash', 'Wash · base · highlight'], ['tone', 'Shadow · mid · highlight'], ['both', 'Both']]
    .map(([v, l]) => `<button data-ladder="${v}" aria-pressed="${v === ladder}">${esc(l)}</button>`).join('');
  // Use-my-collection tri-state — off / prefer (soft boost) / only (hard filter); data-collection carries the choice.
  const col = [['off', 'Off'], ['prefer', 'Prefer owned'], ['only', 'Only owned']]
    .map(([v, l]) => `<button data-collection="${v}" aria-pressed="${v === collection}">${esc(l)}</button>`).join('');
  // Assemble the control bar: two labelled segmented groups (role="group" for screen readers), an Include-Contrast
  // toggle, then either an "add N to buy" primary button (when the scheme needs paints you lack) or a "nothing new" note.
  return `<div class="planctl">`
    + `<div class="ctlgrp"><span class="micro">Tone ladder</span><div class="seg ladsel" role="group" aria-label="Tone ladder">${lad}</div></div>`
    + `<div class="ctlgrp"><span class="micro">Use my collection</span><div class="seg colsel" role="group" aria-label="Use my collection" title="Off · prefer paints you own (boost, still honest) · only paints you own (filter)">${col}</div></div>`
    + `<button class="btn sm incl-contrast" id="inclContrast" aria-pressed="${!!includeContrast}" title="Washes, shades and effects are kept out of suggestions; tick to include Contrast paints (used as one-coat base colours)">Include Contrast</button>`
    + (gapCount > 0
      ? `<button class="btn sm primary" id="addGaps">+ Add ${gapCount} to buy</button>`
      : `<span class="micro nogaps">Nothing new to buy for this scheme</span>`)
    + `</div>`;
}

/** Role slots: each role's ideal → nearest real paint, plus the selected tone ladder(s) (#7). Each slot
 *  carries `data-hex` so hovering/focusing it rings the same colour's wheel node + live-palette column —
 *  the colour link that ties this detail tab to the wheel (app.js linkHighlight; §3.5). */
export function roleSlots(scheme, markOf) {
  // step: one rung of a tone ladder — ideal swatch, its label (s.key), and the nearest paint name (or '—').
  const step = s => `<div class="step">${swatch(s.idealHex, '')}<div class="cap">${esc(s.key)}</div>`
    + `<div class="pn">${s.match ? esc(pname(s.match.paint)) : '—'}</div>`
    // wash-step honesty: a real wash/shade/ink shows its finish pill; no close medium → "watered down"
    + (s.media === 'wash' && s.match ? `<div class="steptag media">${finishTag(s.match.paint.type)}</div>` : '')
    + (s.dilute ? `<div class="steptag dilute" title="No bottled wash lands close enough — thin (water down) this base paint into the recesses instead">watered down</div>` : '')
    + `</div>`;
  // sharedNote: when a limited collection forces two roles onto the same paint, say so + how to separate / what to buy.
  const sharedNote = r => r.shared
    ? `<div class="sharednote"><span class="warnpill">shared paint</span> reused for another role — ${esc(r.differentiate)} to separate`
      + (r.buy ? `, or buy <strong>${esc(pname(r.buy.paint))}</strong> <span class="br">(${esc(r.buy.paint.brand)} · ΔE ${r.buy.deltaE.toFixed(1)})</span> ${buyBtn(r.buy.paint.id, markOf ? markOf(r.buy.paint.id) : 'none')}` : '') + `.</div>`
    : '';
  // subNote — honesty (§2): your picked paint was filtered out of this slot — name it and say why.
  const subNote = r => r.substituted
    ? `<div class="sharednote"><span class="warnpill">pick replaced</span> <strong>${esc(r.substituted.name)}</strong> is ${esc(r.substituted.why)} — nearest eligible paint shown.</div>`
    : '';
  // One .slot per role. data-hex ties the slot to its wheel node + live-palette column (app.js colour link, §3.5).
  // Each slot: role name + weight header, the ideal→nearest "ivsa" row, any sub/shared honesty notes, then the
  // selected tone ladder(s), and finally an optional NMM ladder for the Metal role.
  return `<div class="slots">${scheme.roles.map(r => `<div class="slot${r.shared ? ' is-shared' : ''}" data-hex="${safeColor(r.idealHex)}">`
    + `<div class="shead"><span class="role">${esc(r.role)}</span><span class="wt">${esc(r.weight)}</span></div>`
    + `<div class="ivsa">${swatch(r.idealHex, 'ideal', `color:${textOn(r.idealHex)}`)}<span class="arr">→</span>${matchChip(r.match, markOf)}</div>`   // ideal swatch → arrow → nearest real paint
    + subNote(r)
    + sharedNote(r)
    // Render each selected ladder; when there's more than one, caption each with its label.
    + r.ladders.map(lad => (r.ladders.length > 1 ? `<div class="ladcap">${esc(lad.label)}</div>` : '')
      + `<div class="ladder">${lad.steps.map(step).join('')}</div>`).join('')
    // Metal's second voice: the true metallic above is what most painters expect, but NMM (non-
    // metallic metal) paints the metal ILLUSION with flat paints — offer both, honestly labelled.
    + (r.nmm ? `<div class="ladcap nmmcap" title="Non-metallic metal: paint the metal illusion with flat paints — deep shadow, mid tone, near-white ping">NMM · non-metallic metal (flats)</div>`
      + `<div class="ladder">${r.nmm.map(step).join('')}</div>` : '')
    + `</div>`).join('')}</div>`;
}

/** Curated equivalence group — interchangeable paints (ΔE ≤ 1) across brands. `members`: [paint]. */
export function equivGroup(label, members, markOf) {
  if (!members.length) return '';                                                // nothing to show for an empty group
  const brands = new Set(members.map(m => m.brand)).size;                        // distinct brand count (for the "across N brands" copy)
  // Heading line, then one card per member paint: swatch (finish overlay) + name + brand·line + finish pill + owned/buy.
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
  if (!equivs.length) return '<div class="placeholder">No other-brand matches in the dataset for this paint.</div>';   // graceful empty state
  // Heading, then one card per match: swatch + name + brand·line + finish pill + ΔE line (dot·label·badge) + owned/buy.
  return `<p class="hint" style="margin:14px 0 0">Closest matches to <strong>${esc(name)}</strong> in other ranges (ΔE 2000).</p>`
    + `<div class="eq">${equivs.map(e => {
      const p = e.paint, q = e.quality;                                          // matched paint + its quality {tier, label}
      const mark = markOf ? markOf(p.id) : 'none';
      return `<div class="eqc">${swatch(p.hex, fxCls(p).trim())}<div style="min-width:0">`
        + `<div class="nm">${esc(p.name)}</div><div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</div>`
        + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span><span style="color:${tier(q.tier)}">${esc(q.label)}</span>`
        + `<span class="badge">ΔE ${e.deltaE.toFixed(1)}</span></div>`
        + `<div class="ownline" style="margin-top:6px">${ownOrBuy(p.id, mark)}</div></div></div>`;
    }).join('')}</div>`;
}

/** Copy icon for the live-palette swatches (currentColor → inherits the swatch's legible ink). */
const COPY_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>';

/** Variable live palette beside the wheel: ONE row that doubles as the scheme summary — each column is a
 *  scheme colour → its nearest real paint, labelled by its **role** (Primary/Secondary/Accent/Metal) where
 *  it maps to one (via `roleByHex`), so it reads in the same language as the Plan. The Metal role has no
 *  wheel node, so it rides along as a **display-only** column (no edit/lock/drag). Added/free colours and
 *  unmatched value-ramp steps keep a node tag. `fill`: 'ideal' | 'real'; nearest paint + ΔE stay in both (§2). */
export function livePalette(vm, fill, roleByHex = {}) {
  if (!vm.length) return '';                                                     // nothing to render for an empty view-model
  const real = fill === 'real';                                                 // 'real' fills columns with the matched paint's hex; 'ideal' with the theoretical hex
  const freeCount = vm.filter(c => c.kind === 'free').length;   // added swatches are the reorderable ones
  // Build one .lcol column per view-model entry `c` and join into one HTML string.
  return `<div class="livepal">${vm.map(c => {
    const bg = safeColor(real && c.match ? c.match.paint.hex : c.hex);   // hex label + copy follow the fill
    const t = textOn(bg), m = c.match;                     // t = legible ink over bg; m = this column's nearest-paint match
    const isBase = c.kind === 'base', isFree = c.kind === 'free', isMetal = c.kind === 'metal';   // column kind flags
    const cHex = safeColor(c.hex);                         // the swatch's own (ideal) colour — what "use as base"/edit start from
    const role = roleByHex[cHex.toUpperCase()];            // unify with the Plan: show the role this colour plays
    // tag: the column label — a mapped role if any, else Base/Added/Metal, else the hue offset in degrees (+30° etc.).
    const tag = role || (isBase ? 'Base' : isFree ? 'Added' : isMetal ? 'Metal' : `${c.deg > 0 ? '+' : ''}${c.deg}°`);
    // Finish overlay: a real-fill column wears its matched paint's finish; the ideal Metal column wears the
    // metallic sheen (a flat hex misrepresents metal — §2 finish overlays convey finish, not colour).
    const fx = real && m ? fxCls(m.paint).trim() : (isMetal ? 'metal' : '');
    // foot: the under-swatch caption. With a match → paint name (+owned mini-tag) then the ΔE line + finish pill;
    // no match → an em dash + "no close paint".
    const foot = m
      ? `<span class="lcname">${esc(pname(m.paint))}${m.owned ? ' <span class="ownmini">✓ owned</span>' : ''}</span>`
        + `<span class="de" style="margin:2px 0 0"><span class="dot" style="background:${tier(m.quality.tier)}"></span>`
        + `<span style="color:${tier(m.quality.tier)}">${esc(m.quality.label)}</span>`
        + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></span>${finishTag(m.paint.type)}`
      : `<span class="lcname">—</span><span class="br">no close paint</span>`;
    const fi = isFree ? +c.id.slice(1) : -1;                                     // index among the added swatches
    const sw = isBase ? 'base' : isFree ? 'x:' + c.id.slice(1) : 'p:' + c.deg;   // addressable swatch key
    const canDetach = isFree || (c.kind === 'partner' && c.detachable);          // value-harmony partners can't be pinned uniquely
    const lockOn = !!c.locked;                                                   // is this column's colour pinned?
    // acts: the per-column control cluster. Metal is display-only (no wheel node to drive) → no controls. Others get,
    // conditionally: edit (base/detachable), lock toggle, move earlier/later (added only, disabled at the ends),
    // "use as base", and remove (added only). Each data-* attribute is the hook app.js acts on; every button has
    // an aria-label so it's screen-reader operable.
    const acts = isMetal ? '' : `<div class="lcact">`
      +   ((isBase || canDetach) ? `<button type="button" class="lcbtn" data-edit="${sw}" title="Edit colour" aria-label="Edit ${esc(tag)} colour">✎</button>` : '')
      +   (canDetach ? `<button type="button" class="lcbtn${lockOn ? ' on' : ''}" data-lock="${sw}" title="${lockOn ? 'Unlock' : 'Lock'} colour" aria-label="${lockOn ? 'Unlock' : 'Lock'} ${esc(tag)}" aria-pressed="${lockOn}">${lockOn ? '🔒' : '🔓'}</button>` : '')
      +   (isFree ? `<button type="button" class="lcbtn" data-move="${fi}:-1"${fi === 0 ? ' disabled' : ''} title="Move earlier" aria-label="Move ${esc(tag)} earlier">◂</button>` : '')
      +   (isFree ? `<button type="button" class="lcbtn" data-move="${fi}:1"${fi === freeCount - 1 ? ' disabled' : ''} title="Move later" aria-label="Move ${esc(tag)} later">▸</button>` : '')
      +   `<button type="button" class="lcbtn" data-setbase="${cHex}" title="Use as base colour" aria-label="Use ${esc(tag)} as the base colour">◎</button>`
      +   (isFree ? `<button type="button" class="lcbtn" data-delnode="${c.id.slice(1)}" title="Remove this colour" aria-label="Remove ${esc(tag)}">✕</button>` : '')
      + `</div>`;
    // Swatch is a plain div now; copying moved to its own button beside the hex (so the swatch-click stays
    // free for the Equivalents drill-down). The drill-down makes the swatch a role="button" only on that tab
    // (app.js applyEquivSelect). The copy button's chip is tinted for the swatch's ink (light/dark).
    // Column shell: .lcol (with locked/display modifiers + data-hex for the colour link; added columns are drag-
    // reorderable). Inside: the coloured .lctop (tag + hex + copy button), then the controls, then the caption.
    return `<div class="lcol${lockOn ? ' locked' : ''}${isMetal ? ' display' : ''}" data-hex="${cHex}"${isFree ? ` draggable="true" data-dragidx="${c.id.slice(1)}"` : ''}>`
      + `<div class="lctop${fx ? ' ' + fx : ''}" style="background-color:${bg};color:${t}">`
      +   `<span class="lctag">${esc(tag)}${real ? ' · real' : ''}</span>`   // role/offset label, "· real" appended in real-fill mode
      +   `<span class="lchexrow"><span class="lchex">${bg}</span>`   // the displayed hex (follows the fill mode)
      +     `<button type="button" class="lccopy${t === '#FFFFFF' ? ' light' : ''}" data-copy="${bg}" title="Copy ${bg}" aria-label="Copy ${esc(tag)} colour ${bg}">${COPY_ICON}</button>`   // ' light' tint when the ink is white
      +   `</span></div>`
      + acts
      + `<span class="lcfoot">${foot}</span></div>`;
  }).join('')}</div>`;
}

/** Accessibility panel. model: { names, sims:[{label,colors}], contrasts:[{a,b,labelA,labelB,ratio,passAAText,passAALarge}], collision }. */
export function a11yPanel(model) {
  // strip: a full-width row of equal-flex colour swatches (used to show a scheme under one CVD simulation).
  const strip = cols => `<div class="cstrip">${cols.map(c => `<span class="sw" style="flex:1;height:30px;background:${safeColor(c)}"></span>`).join('')}</div>`;
  // simRows: one labelled row per colour-blindness simulation (normal / protan / deutan / tritan).
  const simRows = model.sims.map(s => `<div class="crow"><span class="clab">${esc(s.label)}</span>${strip(s.colors)}</div>`).join('');
  // verdict: [text, token colour] for a contrast pair — passes AA text / large-UI only / fails AA (§3.2 thresholds).
  const verdict = c => c.passAAText ? ['Passes AA text', 'var(--success)'] : c.passAALarge ? ['Large/UI only', 'var(--warning)'] : ['Fails AA', 'var(--danger)'];
  // ctr: one box per contrast pair — the two role labels, a small swatch pair, the ratio, and the coloured verdict.
  const ctr = model.contrasts.map(c => {
    const [v, col] = verdict(c);
    return `<div class="ctrbox"><div class="ttl">${esc(c.labelA)} ↔ ${esc(c.labelB)}</div>`
      + `<div class="pair">${swatch(c.a, '', 'width:24px;height:24px')}${swatch(c.b, '', 'width:24px;height:24px')}</div>`
      + `<div class="ratio" style="color:${col}">${c.ratio.toFixed(1)}:1</div>`
      + `<div style="font-size:11.5px;color:${col};font-weight:500">${v}</div></div>`;
  }).join('');
  // coll: the colour-blindness collision heads-up. If two roles look confusable under deuteranopia, name them +
  // the ΔE, and (when available) suggest a shifted colour with a swatch and its nearest paint; else an all-clear.
  let coll;
  if (model.collision) {
    const s = model.collision.suggestion;
    coll = `<div class="collide"><strong>Heads-up:</strong> ${esc(model.collision.roles[0])} and ${esc(model.collision.roles[1])} look similar under ${esc(model.collision.type || 'deuteranopia')} (ΔE ${model.collision.delta.toFixed(1)}).`
      + (s ? ` Try a shifted ${esc(s.role.toLowerCase())} ${swatch(s.hex, '', 'width:16px;height:16px;display:inline-block;vertical-align:-2px')}${s.match ? ' — nearest paint ' + esc(pname(s.match.paint)) + ' (' + esc(s.match.paint.brand) + ')' : ''}.` : '')
      + '</div>';
  } else {
    coll = '<div class="collide ok">No major colour-blindness collisions in this scheme.</div>';
  }
  // Assemble: the CVD simulation section, then the WCAG contrast section, then the collision note.
  return `<div class="micro" style="margin:14px 0 8px">Colour-blindness simulation (role colours)</div>${simRows}`
    + `<div class="micro" style="margin:18px 0 8px">Contrast (WCAG 2.1)</div><div class="ctr">${ctr}</div>${coll}`;
}

