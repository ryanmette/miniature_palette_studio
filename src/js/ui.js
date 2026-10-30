// ui.js — pure render-to-string helpers. No DOM access, no globals (import-safe + testable).
// DOM wiring lives in app.js. Colour decisions come from the engine (color.js).

import { textOn, normHex, rgbToHsl, hexToRgb } from './color.js';
import { HARMONY_OFFSETS } from './harmony.js';
import { FINISH_WORDS } from './data.js';   // the finish words: the tag shows the word the search finds

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LABELS = { 'neutral-pop': 'Neutral + pop', 'warm-cool': 'Warm / cool' };   // neutral harmonies read as phrases
const label = t => LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1); // sentence case (§3.3)
/** A harmony's name as the strip shows it ("Split-complementary", "Neutral + pop"): for "Rolled: …". */
export const harmonyLabel = label;

// Defence-in-depth: any colour interpolated into an inline style must be a literal #hex.
// Inputs are already validated upstream (rgbToHex output, URL/-input regex, dataset QA), but we
// re-assert here so a future caller can't turn a swatch into a CSS/HTML-injection sink.
const safeColor = c => normHex(c) || '#000000';

// background-color (not the `background` shorthand) so the metallic-sheen background-image can layer on top.
export const swatch = (hex, cls = '', extra = '') => `<span class="sw ${cls}" style="background-color:${safeColor(hex)};${extra}"></span>`;

// Finish VFX modifier class for a swatch (§2/§3.5 finish overlays — non-tinting, convey finish not colour):
//  metal → specular sheen · wash/ink/shade/glaze → translucent satin · contrast → softer translucent ·
//  curated p.fx (gloss/slime/texture) → bespoke wet-gloss / goopy / gritty-matte for technical paints.
const FX_BY_TYPE = { metal: 'metal', wash: 'fx-wash', ink: 'fx-wash', shade: 'fx-wash', glaze: 'fx-wash', contrast: 'fx-contrast' };
export const fxCls = p => { if (!p) return ''; if (p.fx) return ' fx-' + p.fx; const c = FX_BY_TYPE[p.type]; return c ? ' ' + c : ''; };

// Finish-type glyphs (inline SVG so they inherit colour/size). Flat paints (base/layer/dry/primer) get none.
const GEM = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M3 6l5-4 5 4-5 8z"/></svg>';
const DROP = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M8 2c2.4 3.2 4 5.2 4 7.2A4 4 0 0 1 4 9.2C4 7.2 5.6 5.2 8 2z"/></svg>';
const STAR = '<svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13 6.4 8.6 2 7l4.4-1.6z"/></svg>';
const GLYPHS = { metal: GEM, contrast: DROP, wash: DROP, shade: DROP, ink: DROP, glaze: DROP, effect: STAR };
const FINISHES = Object.fromEntries(Object.entries(GLYPHS).map(([type, g]) => [type, [FINISH_WORDS[type], g]]));
/** Small finish pill (icon + label) flagging non-flat paints (metallic/contrast/wash/…); '' for flat paints. */
export const finishTag = type => { const f = FINISHES[type]; return f ? `<span class="finish finish-${type}">${f[1]}${f[0]}</span>` : ''; };
/** The finish icon alone (aria-hidden SVG), for a surface that names the finish in its own words. */
export const finishGlyph = type => (FINISHES[type] ? FINISHES[type][1] : '');

/** Display name for a dataset paint — dname carries the line when (brand, name) is ambiguous
 *  ("Dawnstone (Layer)" vs "Dawnstone (Dry)"). Use wherever the line isn't otherwise visible —
 *  a surface that falls back to p.name reintroduces the ambiguous-twin bug dname exists to fix. */
export const pname = p => p.dname || p.name;

/** The one spoken/labelled vocabulary for a paint's mark — aria-labels and live-region strings must
 *  not drift between surfaces (the seed list vs the Shelf vs announcements). */
export const markLabel = mark => (mark === 'owned' ? 'owned' : mark === 'want' ? 'on the shopping list' : 'not owned');

/** A paint's line, where it tells you something: not "—", and not the brand again. */
const lineOf = p => (p.line && p.line !== '—' && p.line !== p.brand ? p.line : '');
/** A paint's full name for a menu title: "Mephiston Red · Citadel Base". The line only when the display
 *  name has not got it already: "Dawnstone (Layer) · Citadel". The Shelf's menu and the seed list's. */
export const menuTitle = p => `${pname(p)} · ${p.brand}${pname(p) === p.name && lineOf(p) ? ' ' + lineOf(p) : ''}`;

/* ---- the seed field's list (§3.6; mockups/paints-picker.html "Recommended") ----
   Browse is a colour grid of tiles (role=gridcell); a search is a listbox of rows (role=option). Both are
   built from the same parts as the rest of the app (.sw + fxCls, finishTag, markBadge, pname), so a paint
   looks the same here as on the Shelf and in the Plan. The options never take focus: the field keeps it
   and points at the active option with aria-activedescendant (app.js picker.js). `t` is i18n.t, passed in
   so this module stays pure. */

/** What a screen reader hears for an option: "Leadbelcher, Citadel Base, metallic, owned, your current
 *  pick", and for a hex match its quality ("Good match, ΔE 2.4"). "Not owned" is left out: it is most paints. */
function pickSaid(p, { mark = 'none', current = false, match = null }, t) {
  return [`${pname(p)}, ${p.brand}${pname(p) === p.name && lineOf(p) ? ' ' + lineOf(p) : ''}`,
    FINISH_WORDS[p.type] || '', mark === 'none' ? '' : markLabel(mark), current ? t('pkCurrentSaid') : '',
    match ? t('pkMatchSaid', { label: match.quality.label, de: match.deltaE.toFixed(1) }) : '']
    .filter(Boolean).join(', ');
}

/** One tile of the browse grid: the swatch (finish overlay + owned / to-buy badge), the display name
 *  ("Dawnstone (Layer)": twins stay apart) and the brand, with the finish icon for a non-flat paint (§2).
 *  `current`: your pick, a ring inside the swatch (state); the keyboard cursor is the outer ring (.act). */
export function pickTile(p, { id, k, mark = 'none', current = false }, t = x => x) {
  return `<div class="pkt${current ? ' cur' : ''}" role="gridcell" id="${esc(id)}" data-k="${Number(k)}"`
    + ` aria-label="${esc(pickSaid(p, { mark, current }, t))}">`
    + `<span class="sw${fxCls(p)}" style="background-color:${safeColor(p.hex)}">${markBadge(mark)}</span>`
    + `<span class="pkn">${esc(pname(p))}</span>`
    + `<span class="pkb">${finishGlyph(p.type)}<span>${esc(p.brand)}</span></span></div>`;
}

/** One row of a search: the paint's name, then brand · line · its mark and the finish tag on the second
 *  line (the line keeps twins apart). With `match` (a hex search), its quality and the TRUE ΔE (§2). */
export function pickRow(p, { id, k, mark = 'none', current = false, match = null }, t = x => x) {
  const sub = [current ? `<span class="pkcur">${esc(t('pkCurrent'))}</span>` : '', esc(p.brand), esc(lineOf(p)),
    mark === 'none' ? '' : esc(markLabel(mark))].filter(Boolean).join(' · ');
  const de = match
    ? `<span class="pkde" aria-hidden="true"><span class="pkq"><span class="dot" style="background:${tier(match.quality.tier)}"></span>`
      + `${esc(match.quality.label)}</span><span class="badge">ΔE ${match.deltaE.toFixed(1)}</span></span>`
    : '';
  return `<div class="pko${current ? ' cur' : ''}" role="option" id="${esc(id)}" data-k="${Number(k)}" aria-selected="false"`
    + ` aria-label="${esc(pickSaid(p, { mark, current, match }, t))}">`
    + `<span class="sw${fxCls(p)}" style="background-color:${safeColor(p.hex)}">${markBadge(mark)}</span>`
    + `<span class="pktx"><b>${esc(p.name)}</b><span class="pksub">${sub} ${finishTag(p.type)}</span></span>${de}</div>`;
}

/** The row that seeds a typed hex: "Seed: #9A1115" while the field's live hex is the seed, else "Use
 *  #9A1115 as seed" (Enter, a tap or a click starts from it). `coarse`: a touch screen ("Tap"). */
export function pickUseRow(hex, { id, k, live = false, coarse = false }, t = x => x) {
  const h = safeColor(hex);
  const head = t(live ? 'pkSeedLive' : 'pkUseHex', { hex: h });
  const sub = t(live ? 'pkSeedLiveSub' : coarse ? 'pkUseHexTap' : 'pkUseHexClick');
  return `<div class="pko pkuse" role="option" id="${esc(id)}" data-k="${Number(k)}" aria-selected="false" aria-label="${esc(`${head}. ${sub}`)}">`
    + `<span class="sw" style="background-color:${h}"></span>`
    + `<span class="pktx"><b>${esc(head)}</b><span class="pksub">${esc(sub)}</span></span></div>`;
}

/** The Shelf with nothing to show (UX 4): a heading, one sentence and one action, outside the grid (a
 *  listbox holds only options). kind: 'owned' (the Owned filter, nothing owned yet) · 'want' (the shopping
 *  list is empty) · 'filter' (the search or filters match nothing). The action clears every filter. */
export function shelfEmpty(kind, q = '') {
  const [h, p] = kind === 'owned'
    ? ['No paints marked as owned yet', 'Show all paints, then tap or click a paint you own to mark it.']
    : kind === 'want'
      ? ['Your shopping list is empty', 'Add pots from a Recipe, or mark paints here.']
      : ['No paints match', q ? `Nothing on the shelf matches “${q}” with these filters.` : 'Nothing on the shelf matches these filters.'];
  const act = kind === 'filter' ? 'Clear the search and filters' : 'Show all paints';
  return `<h3>${esc(h)}</h3><p>${esc(p)}</p><button type="button" class="btn" data-shelfclear>${esc(act)}</button>`;
}

/** A labelled group of rows in the search listbox (the APG grouped listbox: the label is a presentation
 *  child the group points at). `inner` is markup from pickRow / pickUseRow. */
export const pickGroup = (id, title, inner) =>
  `<div role="group" aria-labelledby="${esc(id)}"><div class="pkhead" role="presentation" id="${esc(id)}">${esc(title)}</div>${inner}</div>`;

/** Finder-style collection grid. Each cell is a square swatch (colour = paint data) with a corner
 *  state badge (owned ✓ / to-buy cart) and, on hover/focus, an overlaid name tooltip. Selection is an
 *  outline (interaction, §3.5) — never a border-width change, so neighbours never reflow (§3.4 no-jiggle).
 *  `markOf(id)` → 'owned'|'want'|'none'; `selected` is a Set of selected ids. */
export function shelfGrid(paints, markOf, selected = new Set()) {
  if (!paints.length) return '';   // the grid stays empty; shelfEmpty() says why, outside the listbox
  return paints.map(p => {
    const mark = markOf(p.id), sel = selected.has(p.id);
    const badge = markBadge(mark);
    const state = markLabel(mark);
    return `<div class="cell${fxCls(p)}" role="option" data-id="${esc(p.id)}" data-mark="${mark}"`
      + ` aria-selected="${sel}" aria-label="${esc(pname(p))}, ${esc(p.brand)} — ${state}"`
      + ` style="--cell:${safeColor(p.hex)}">`
      + `${badge}<span class="celltip">${esc(pname(p))} · ${esc(p.brand)}</span>`
      + `</div>`;
  }).join('');
}

// Small cart glyph for the to-buy badge (inline SVG so it inherits the badge's --on-buy colour).
const cartGlyph = `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">`
  + `<path fill="currentColor" d="M1 1h2l.6 2H15l-1.7 6.2a1.4 1.4 0 0 1-1.35 1H5.4a1.4 1.4 0 0 1-1.36-1L2.2 2.4 1.9 1.3 1 1zm4.7 12.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>`;

/** An icon from the sprite in index.html (§3.5): decoration only, so always aria-hidden. */
export const icon = id => `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;

/** State badge for a paint's mark — owned ✓ / to-buy cart / nothing. Shared by the grid + in-place updates. */
export const markBadge = mark =>
  mark === 'owned' ? `<span class="cbadge owned" aria-hidden="true">${icon('check')}</span>`
    : mark === 'want' ? `<span class="cbadge want" aria-hidden="true">${cartGlyph}</span>`
      : '';

/** Shelf action bar: fixed-height row (reserved space → no reflow when it fills, §3.4). Empty until a
 *  selection exists, then shows "N selected" + mark actions. The persistent how-to hint lives up top. */
export function shelfBar(count) {
  if (!count) return '';
  // On touch and phones this is a sheet at the bottom, as the Filters sheet (app.css): the count and Deselect are its
  // head (Deselect where Filters has Reset), the three marks its body. With a mouse it is the bar under the grid.
  return `<span class="barhead"><span class="barcount">${count} selected</span>`
    + `<button class="btn sm ghost bardesel" data-act="deselect">Deselect</button></span>`
    + `<span class="baracts">`
    + `<button class="btn sm" data-act="owned">Mark owned</button>`
    + `<button class="btn sm" data-act="want">Add to shopping list</button>`
    + `<button class="btn sm" data-act="none">Clear</button>`
    + `</span>`;
}

/** What the Shelf's filters are doing, for the phone handle chip and the Filters badge. The chip is
 *  always there ("⌕ Search" when nothing is on) so search is findable while the panel is tucked away.
 *  `sheet` counts only what lives in the Filters sheet (brand, type); sort is an order, not a filter. */
export function shelfFilterSummary({ q = '', mark = '', brand = '', type = '' } = {}) {
  const query = q.trim();
  const filters = [mark, brand, type].filter(Boolean).length;
  const text = `${query ? `“${query}”` : 'Search'}` + (filters ? ` · ${filters} filter${filters === 1 ? '' : 's'}` : '');
  return { text, filters, sheet: [brand, type].filter(Boolean).length, any: !!query || filters > 0 };
}

/** Phone Shelf dock: tuck on a small scroll down, reveal only after a real scroll up. A small scroll up
 *  is usually someone looking for a paint they just passed — revealing on every upward pixel would
 *  cover the rows they want. `acc` sums movement in one direction; dy > 0 is down. */
export const DOCK_TUCK = 8, DOCK_REVEAL = 60;
export function dockStep({ acc = 0, open = true }, dy) {
  if (!dy) return { acc, open };
  acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy;   // a change of direction starts a new run
  if (open && acc > DOCK_TUCK) return { acc: 0, open: false };
  if (!open && acc < -DOCK_REVEAL) return { acc: 0, open: true };
  return { acc, open };
}

/** Compare two schemes side by side. a/b: { base, harmony, colors:[ideal hexes] }. */
export function compareBar(a, b) {
  const row = (g, lbl) => `<div class="cmprow"><span class="cmplab">${esc(lbl)} · ${esc(g.harmony)} · <span class="mono">${esc(g.base)}</span></span>`
    + `<div class="cmppal">${g.colors.map(c => `<span style="background:${safeColor(c)}"></span>`).join('')}</div></div>`;
  return `<div class="compare"><div class="cmphead">Compare</div>${row(a, 'A')}${row(b, 'B · current')}</div>`;
}

/** Owned/to-buy affordance for a real paint chip — owned tick or a buy toggle. `mark` ∈ owned|want|none. */
const ownOrBuy = (id, mark) => mark === 'owned'
  ? `<span class="owntag">${icon('check')}owned</span>`
  : buyBtn(id, mark);

/** Base-paint hero — a single compact identity line: swatch chip · name · hex · seed-role pill · meta · buy.
 *  `base`: { id?, hex, name, brand?, line?, type?, approx?, custom? }. markOf adds owned/buy.
 *  `seedRole` ('main'|'accent') shows the role the *picked paint* plays (the hero always shows your pick,
 *  so this reads true in both seed modes). Condensed from the old tall block to reclaim space above the wheel. */
export function hero(base, animate = true, markOf, seedRole = '', neutral = false) {
  const meta = base.custom ? 'typed hex'
    : `${esc(base.brand || '')}${base.line && base.line !== '—' ? ' · ' + esc(base.line) : ''}${base.type ? ' · ' + esc(base.type) : ''}`
      + (base.approx ? ' · <span class="approx">approx</span>' : '');
  const seed = seedRole ? `<span class="seedbadge seed-${esc(seedRole)}">${esc(seedRole)}</span>` : '';
  const ntag = neutral ? '<span class="ntag" title="No usable hue — the scheme is built for neutrals">neutral</span>' : '';
  const own = (!base.custom && base.id && markOf) ? `<span class="herobuy">${ownOrBuy(base.id, markOf(base.id))}</span>` : '';
  // The swatch opens the scheme large (PLAN §5 item 47): the starting paint and the scheme's pots, one tap away.
  return `<button type="button" class="herobig" data-herobig aria-haspopup="dialog" aria-label="See the scheme large" title="See the scheme large">`
    + swatch(base.hex, 'herochip' + (animate ? ' pop' : '') + fxCls(base)) + `</button>`
    + `<h2 class="heroname">${esc(base.name)}</h2>`
    + `<button type="button" class="hexline" data-copy="${esc(base.hex)}" title="Copy ${esc(base.hex)}" aria-label="Copy hex ${esc(base.hex)}">${esc(base.hex)}</button>`
    + seed + ntag
    + `<span class="herometa">${meta}</span>`
    + own;
}

/** Suggestive glyph angles for the neutral harmonies (they have no HARMONY_OFFSETS — the pop/tints
 *  aren't base rotations). Purely decorative (aria-hidden), so a hint is enough. */
const NEUTRAL_GLYPH_ANGLES = { 'neutral-pop': [180], duotone: [150, 210], 'warm-cool': [90, 270] };

/** Tiny line-art glyph of a harmony's geometry, generated from HARMONY_OFFSETS so it can't drift. */
const harmonyGlyph = type => {
  const angles = [0, ...(HARMONY_OFFSETS[type] || NEUTRAL_GLYPH_ANGLES[type] || [])];
  const cx = 11, cy = 11, r = 7;
  const pt = a => [cx + Math.sin(a * Math.PI / 180) * r, cy - Math.cos(a * Math.PI / 180) * r];
  const lines = angles.map(a => { const [x, y] = pt(a); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const dots = angles.map((a, i) => { const [x, y] = pt(a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 0 ? 2.4 : 1.7}"/>`; }).join('');
  return `<svg class="hglyph" viewBox="0 0 22 22" aria-hidden="true">${lines}${dots}</svg>`;
};

/** Segmented control for harmony types — each option shows a glyph of its geometry + label.
 *  `opts.disabled` (Set) greys chips out in place — visible with the why in their tooltip, never
 *  removed (no reflow, §3.4); `opts.disabledReason` is that tooltip. */
export const segmented = (types, active, opts = {}) => {
  const dis = opts.disabled || new Set();
  return types.map(t => {
    const d = dis.has(t);
    return `<button data-h="${esc(t)}" aria-pressed="${t === active}"`
      + (d ? ` aria-disabled="true" title="${esc(opts.disabledReason || '')}"` : '')
      + `>${harmonyGlyph(t)}<span class="hlbl">${esc(label(t))}</span></button>`;
  }).join('');
};

/** <option> list for the brand filter. */
export const brandOptions = brands => brands.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');

/** Quick-pop chips for neutral mode — shortcuts that move the wheel's pop node (not a second system).
 *  `pops`: [{hex, name}]; `active` = the current pop hex (a chip is "on" when it IS the pop). */
export const popChips = (pops, active) =>
  '<span class="micro">Quick pops</span>' + pops.map(p =>
    `<button type="button" class="pop${p.hex.toUpperCase() === (active || '').toUpperCase() ? ' on' : ''}"`
    + ` data-pop="${esc(p.hex)}" aria-pressed="${p.hex.toUpperCase() === (active || '').toUpperCase()}"`
    + ` title="Use ${esc(p.name)} as the pop accent">${swatch(p.hex)}${esc(p.name)}</button>`).join('');

// A quality tier's colour: the base token for the dot (a graphic, 3:1), the *-text token for its label (4.5:1).
const tier = t => `var(--${t})`;
const tierText = t => `var(--${t}-text)`;

/** A per-paint "to-buy" toggle (#5). Hidden for paints already owned. `mark` ∈ 'owned'|'want'|'none'. */
const buyBtn = (id, mark) => mark === 'owned' ? '' :
  `<button type="button" class="buybtn${mark === 'want' ? ' on' : ''}" data-buy="${esc(id)}" aria-pressed="${mark === 'want'}"`
  + ` title="${mark === 'want' ? 'On the shopping list — click to remove' : 'Add to the shopping list'}">`
  + `${mark === 'want' ? `${icon('check')}On the list` : `${icon('plus')}Add`}</button>`;

/** Render a nearest-paint match (or a graceful empty state). `markOf(id)` adds owned/adjust + a buy toggle. */
export function matchChip(m, markOf) {
  if (!m) return '<div class="poornote"><strong>No pot is close.</strong> Mix it from the nearest paints, or see Other brands.</div>';
  const p = m.paint, q = m.quality;
  const mark = markOf ? markOf(p.id) : 'none';
  // "Boost owned, but honest" (#6): flag what you own + how to nudge it, never hiding the ΔE gap.
  const ownTag = mark === 'owned'
    ? `<div class="ownline"><span class="owntag">${icon('check')}owned</span>${m.adjust ? `<span class="adjust">${esc(m.adjust)}</span>` : ''}</div>`
    : '';
  return swatch(p.hex, 'act' + fxCls(p))
    + `<div style="min-width:0"><div class="ttl">${m.chosen ? 'Chosen pot' : 'Nearest pot'}</div>`
    + `<div class="nm">${esc(p.name)}</div>`
    + `<div class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}</div>`
    + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span>`
    + `<span style="color:${tierText(q.tier)}">${esc(q.label)}</span>`
    + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></div>`
    // Poor (over ΔE 10, §3.2): say what that means and what to do, not only the tag (UX 4)
    // (not for a chosen pot: the painter picked it on purpose; the hold note says how far it is)
    + (m.deltaE > 10 && !m.chosen ? `<div class="poornote"><strong>No pot within ΔE 10.</strong> A mix or a glaze gets closer, or see Other brands.</div>` : '')
    + ownTag + buyBtn(p.id, mark) + `</div>`;
}

/** Plan-tab controls (#5/#7): tone-ladder style · Include Contrast · "add gaps to buy". Use my paints
 *  (off · prefer · only) is in ⋯ now: it changes more than the Plan (the live palette too), and the
 *  matching note under the live palette shows it while it is on (matchNote). */
export function planControls(ladder, includeContrast, gapCount) {
  const lad = [['wash', 'Wash · base · highlight'], ['tone', 'Shadow · mid · highlight'], ['both', 'Both']]
    .map(([v, l]) => `<button data-ladder="${v}" aria-pressed="${v === ladder}">${esc(l)}</button>`).join('');
  return `<div class="planctl">`
    + `<div class="ctlgrp"><span class="micro">Tone ladder</span><div class="seg ladsel" role="group" aria-label="Tone ladder">${lad}</div></div>`
    + `<button class="btn sm incl-contrast" id="inclContrast" aria-pressed="${!!includeContrast}" title="Washes, shades and effects are kept out of suggestions; tick to include Contrast paints (used as one-coat base colours)">Include Contrast</button>`
    + (gapCount > 0
      ? `<button class="btn sm primary" id="addGaps">+ Add ${gapCount} to the shopping list</button>`
      : `<span class="micro nogaps">Everything for this scheme is owned or on the list</span>`)
    + `</div>`;
}

/**
 * The matching note under the live palette (mockups/collection-setting.html, direction A + the
 * critique): ONE LINE PER SETTING THAT IS ON, each a full-width button that goes to its control.
 *  - Use my paints (prefer/only) opens ⋯ (data-note="ump"); with no owned paints, the line says so
 *    and opens the Shelf instead (data-note="shelf"), where you mark them.
 *  - Include Contrast goes to its control in the Plan tab (data-note="contrast"). It wears the Contrast
 *    finish icon, not ✓: it adds a paint type, it does not limit the matches.
 * Which lines show depends on the settings only, so a mark change elsewhere can change a line's words
 * (the count) but never add or remove a line. '' when both are off: nothing shows, nothing moves.
 * The accessible name is the visible words; the dash before the target word is for screen readers.
 * `t` is i18n.t, passed in so this module stays pure.
 */
export function matchNote({ collection = 'off', owned = 0, contrast = false, expanded = false } = {}, t = k => k) {
  const go = word => `<span class="ngo"><span class="sr-only"> — </span>${esc(word)}</span>`;
  const lines = [];
  if (collection === 'prefer' || collection === 'only') {
    // The "·" ends the head, held to it by a no-break space: when the explanation wraps on a phone, the
    // second line starts with words, not with the dot.
    const head = `<b>${esc(t('noteUmp', { mode: t(collection === 'only' ? 'umpOnly' : 'umpPrefer') }))}</b>\u00a0·`;
    if (!owned) {
      lines.push(`<button type="button" class="mnote" data-note="shelf"><span class="nk off" aria-hidden="true">${icon('empty')}</span>`
        + `<span class="ntx">${head} <span class="mt">${esc(t('noteUmpEmpty'))}</span></span>${go(t('openShelf'))}</button>`);
    } else {
      const why = collection === 'only' ? t('noteUmpOnly', { n: owned }) : t('noteUmpPrefer');
      lines.push(`<button type="button" class="mnote" data-note="ump" aria-haspopup="dialog" aria-controls="settingsMenu" aria-expanded="${!!expanded}">`
        + `<span class="nk" aria-hidden="true">${icon('check')}</span><span class="ntx">${head} <span class="mt">${esc(why)}</span></span>${go(t('change'))}</button>`);
    }
  }
  if (contrast) {
    lines.push(`<button type="button" class="mnote" data-note="contrast"><span class="nk nk-contrast" aria-hidden="true">${finishGlyph('contrast')}</span>`
      + `<span class="ntx"><b>${esc(t('noteContrast'))}</b></span>${go(t('notePlan'))}</button>`);
  }
  return lines.join('');
}

/** Role slots: each role's ideal → nearest real paint, plus the selected tone ladder(s) (#7). Each slot
 *  carries `data-hex` so hovering/focusing it rings the same colour's wheel node + live-palette column —
 *  the colour link that ties this detail tab to the wheel (app.js linkHighlight; §3.5). */
/** The hold controls on a Recipe role card (mockups/hold-flow.html, direction A). `holdable`: this role can
 *  be held (not Primary, not the starting paint's role). Lock colour is a toggle with one fixed name; a
 *  chosen pot shows as a filled tag (state), with Change pot and Release. */
export function holdControls(r, holdable) {
  if (!holdable) return '';
  const role = esc(r.role);
  if (r.hold === 'pot') {
    // a store swap (item 38) names the pot it replaced in one muted line (state as words, §3.5), with the way back
    const was = r.swappedFrom;
    return `<div class="holdrow"><span class="holdchip">${icon('pin')}Pot chosen</span>`
      + `<button type="button" class="textact" data-hold-pot="${role}" aria-haspopup="dialog" aria-label="Change the ${role} pot">Change pot</button>`
      + `<button type="button" class="textact" data-hold-release="${role}" aria-label="Release the ${role} pot">Release</button></div>`
      + (was ? `<p class="swapnote">${swatch(was.hex, 'swapsw' + fxCls(was))}<span>Swapped in the store for ${esc(pname(was))}</span>`
        + `<button type="button" class="textact" data-hold-original="${role}" aria-label="Use the original pot, ${esc(pname(was))}, for ${role}">Use the original</button></p>` : '');
  }
  const locked = r.hold === 'lock';
  return `<div class="holdrow">`
    + `<button type="button" class="btn sm holdlock${locked ? ' on' : ''}" data-hold-lock="${role}" aria-pressed="${locked}"`
    + ` title="Keep this colour when you roll or change the harmony">${icon(locked ? 'lock' : 'unlock')}Lock colour</button>`
    + `<button type="button" class="btn sm" data-hold-pot="${role}" aria-haspopup="dialog">${icon('pin')}Choose pot…</button></div>`;
}

/** Rows of the pot chooser: each paint with its distance from the role's target. `items`: [{paint, deltaE, quality}]. */
export function potRows(items, markOf = () => 'none', currentId = null) {
  if (!items.length) return '<li class="potnone">No paint matches. Try a brand, a colour word, or a shorter name.</li>';
  return items.map(m => {
    const p = m.paint, mark = markOf(p.id), cur = p.id === currentId;
    return `<li><button type="button" class="potrow" data-potid="${esc(p.id)}"${cur ? ' aria-current="true"' : ''}>`
      + `${swatch(p.hex, fxCls(p).trim())}`
      + `<span class="potname">${esc(pname(p))}${cur ? ' <span class="potcur">· chosen</span>' : ''}`
      + `<span class="br">${esc(p.brand)}${p.line && p.line !== '—' ? ' · ' + esc(p.line) : ''} ${finishTag(p.type)}${mark === 'owned' ? ` <span class="ownmini">${icon('check')}owned</span>` : ''}</span></span>`
      + `<span class="de"><span class="dot" style="background:${tier(m.quality.tier)}"></span><span style="color:${tierText(m.quality.tier)}">${esc(m.quality.label)}</span><span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></span>`
      + `</button></li>`;
  }).join('');
}

/** The hold note under the live palette: what is held, Release all, and a line for each held role that is
 *  Poor (over ΔE 10) against the scheme — which hold, and by how much (Solver's Feasibility Report, Onshape's
 *  red constraint). `held`: [{role, kind, name, deltaE, poor}] in role order. '' when nothing is held. */
export function holdNote(held) {
  if (!held.length) return '';
  const list = held.map(h => `${esc(h.role)} (${h.kind === 'pot' ? esc(h.name) : 'colour'})`).join(' · ');
  const warn = held.filter(h => h.poor).map(h => `<p class="hnwarn">${icon('warning')}<span><b>${esc(h.role)}:</b> `
    + (h.kind === 'pot'
      ? `${esc(h.name)} is ΔE ${h.deltaE.toFixed(1)} from this scheme's ${esc(h.role.toLowerCase())} (Poor).`
      : `your locked colour has no pot within ΔE 10 (the nearest is ΔE ${h.deltaE.toFixed(1)}).`)
    + ` <button type="button" class="textact" data-hold-pot="${esc(h.role)}" aria-haspopup="dialog">Show pots</button></span></p>`).join('');
  const rel = held.length === 1 ? 'Release it' : held.length === 2 ? 'Release both' : `Release all ${held.length}`;
  return `<div class="holdnote"><p class="hnsum">${icon('pin')}<span><b>Held:</b> ${list}. `
    + `<button type="button" class="textact" data-hold-releaseall>${rel}</button></span></p>${warn}</div>`;
}

export function roleSlots(scheme, markOf, holdable = new Set()) {
  // Ladder rows show the SHORT paint name — long display names ("Brainmatter Beige (Warpaints
  // Fanatic)") used to blow the three-column row past the card edge on phones. The full identity
  // (disambiguated name · brand) lives in the same clamped tooltip the Shelf uses (hover / focus /
  // tap via sticky hover) and in the step's aria-label, so nothing is lost — just not always-on.
  const step = s => {
    const p = s.match && s.match.paint;
    // The chip shows the POT, the paint named under it, with its finish overlay (§2): a painter reads the
    // ladder as "these three pots". With no pot (none close enough), it shows the target colour.
    return `<div class="step"${p ? ` tabindex="0" aria-label="${esc(s.key)}: ${esc(pname(p))}, ${esc(p.brand)}"` : ''}>${p ? swatch(p.hex, fxCls(p).trim()) : swatch(s.idealHex, '')}<div class="cap">${esc(s.key)}</div>`
      + `<div class="pn">${p ? esc(p.name) : '—'}</div>`
      + (p ? `<span class="celltip">${esc(pname(p))} · ${esc(p.brand)}</span>` : '')
      // wash-step honesty: a real wash/shade/ink shows its finish pill; no close medium → "watered down"
      + (s.media === 'wash' && p ? `<div class="steptag media">${finishTag(p.type)}</div>` : '')
      + (s.dilute ? `<div class="steptag dilute" title="No bottled wash lands close enough — thin (water down) this base paint into the recesses instead">watered down</div>` : '')
      + `</div>`;
  };
  // When a limited collection forces two roles onto the same paint, say so + how to separate / what to buy.
  const sharedNote = r => r.shared
    ? `<div class="sharednote"><span class="warnpill">shared paint</span> reused for another role — ${esc(r.differentiate)} to separate`
      + (r.buy ? `, or buy <strong>${esc(pname(r.buy.paint))}</strong> <span class="br">(${esc(r.buy.paint.brand)} · ΔE ${r.buy.deltaE.toFixed(1)})</span> ${buyBtn(r.buy.paint.id, markOf ? markOf(r.buy.paint.id) : 'none')}` : '') + `.</div>`
    : '';
  // Honesty (§2): your picked paint was filtered out of this slot — name it and say why.
  const subNote = r => r.substituted
    ? `<div class="sharednote"><span class="warnpill">pick replaced</span> <strong>${esc(r.substituted.name)}</strong> is ${esc(r.substituted.why)} — nearest eligible paint shown.</div>`
    : '';
  return `<div class="slots">${scheme.roles.map(r => `<div class="slot${r.shared ? ' is-shared' : ''}${r.hold ? ' held' : ''}" data-hex="${safeColor(r.hold === 'pot' ? r.match.paint.hex : r.idealHex)}">`
    + `<div class="shead"><span class="role">${esc(r.role)}</span>`
    +   `<span class="sheadr"><button type="button" class="eqjump" data-goequiv="${safeColor(r.idealHex)}" title="Show this colour in other brands" aria-label="Show other brands for ${esc(r.role)}">${icon('swap')}Other brands</button><span class="wt">${esc(r.weight)}</span></span></div>`
    + holdControls(r, holdable.has(r.role))
    + `<div class="ivsa">${swatch(r.idealHex, 'ideal', `color:${textOn(r.idealHex)}`)}<span class="arr">→</span>${matchChip(r.match, markOf)}</div>`
    + subNote(r)
    + sharedNote(r)
    + r.ladders.map(lad => (r.ladders.length > 1 ? `<div class="ladcap">${esc(lad.label)}</div>` : '')
      + `<div class="ladder">${lad.steps.map(step).join('')}</div>`).join('')
    // Metal's second voice: the true metallic above is what most painters expect, but NMM (non-
    // metallic metal) paints the metal ILLUSION with flat paints — offer both, honestly labelled.
    + (r.nmm ? `<div class="ladcap nmmcap" title="Non-metallic metal: paint the metal illusion with flat paints — deep shadow, mid tone, near-white ping">NMM · non-metallic metal (flats)</div>`
      + `<div class="ladder">${r.nmm.map(step).join('')}</div>` : '')
    + `</div>`).join('')}</div>`;
}

/** Equivalents source picker (§3.6 mobile fix): one chip per scheme colour, labelled by role.
 *  The desktop column-click drill-down stays; these chips are the same selection, IN the tab it
 *  affects — the only entry point a phone can actually see. cols: [{hex, label}]. */
export function equivSourceChips(cols, activeHex) {
  const a = (activeHex || '').toUpperCase();
  return `<div class="micro" style="margin:12px 0 7px">Other brands for</div>`
    + `<div class="eqsrcrow" role="group" aria-label="Other brands for">`
    + cols.map(c => `<button type="button" class="eqchip" data-eqsrc="${safeColor(c.hex)}" aria-pressed="${c.hex.toUpperCase() === a}">`
      + `<span class="sw" style="background-color:${safeColor(c.hex)}"></span>${esc(c.label)}</button>`).join('')
    + `</div>`;
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
        + `<div class="de"><span class="dot" style="background:${tier(q.tier)}"></span><span style="color:${tierText(q.tier)}">${esc(q.label)}</span>`
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
/**
 * Label a value-harmony column by what actually VARIES. Shades/monochromatic partners rotate no hue,
 * so harmonyPartners gives them all `deg 0` — rendering that as a hue offset put a meaningless "0°"
 * on every one of them, identical across columns that differ in lightness or saturation.
 */
export function toneTag(hex, baseHex) {
  const a = rgbToHsl(hexToRgb(normHex(hex) || '#000000')), b = rgbToHsl(hexToRgb(normHex(baseHex) || '#000000'));
  const dl = a[2] - b[2], ds = a[1] - b[1];
  if (Math.abs(dl) >= Math.abs(ds)) return dl >= 0 ? 'Lighter' : 'Darker';
  return ds >= 0 ? 'Richer' : 'Softer';
}

export function livePalette(vm, roleByHex = {}) {
  if (!vm.length) return '';
  const baseCol = (vm.find(c => c.kind === 'base') || vm[0]).hex;   // reference for value-partner tone labels
  const freeCount = vm.filter(c => c.kind === 'free').length;   // added swatches are the reorderable ones
  return `<div class="livepal">${vm.map(c => {
    // Target on top, pot under it (§2: show the gap, never hide it). This replaced a Target / Pot toggle that
    // swapped one fill for the other: with a close match nothing changed, so the toggle read as broken.
    const bg = safeColor(c.hex);
    const t = textOn(bg), m = c.match;
    const isBase = c.kind === 'base', isFree = c.kind === 'free';
    const isMetal = c.kind === 'metal', isPin = c.kind === 'pin';   // pin = the accent-seed colour riding along (display-only, like Metal)
    const cHex = safeColor(c.hex);                         // the swatch's own (ideal) colour — what "use as base"/edit start from
    const role = c.role || roleByHex[cHex.toUpperCase()];   // unify with the Plan: show the role this colour plays
    // An added colour is a sketch colour: no role, so not in the Recipe (mockups/hold-flow.html, "Extra").
    // the pin: the starting paint as the accent, kept when no rule colour lands on it (PLAN §5 item 46)
    const tag = isPin ? (role ? `${role} · your paint` : 'Your accent (kept)')
      : role || (isBase ? 'Base' : isFree ? 'Extra' : isMetal ? 'Metal'
      : c.deg ? `${c.deg > 0 ? '+' : ''}${c.deg}°` : toneTag(c.hex, baseCol));   // deg 0 = a value partner, not a hue offset
    // Finish overlay: the pot band wears its paint's finish; the Metal target wears the metallic sheen
    // (a flat hex misrepresents metal — §2 finish overlays convey finish, not colour).
    const fx = isMetal ? 'metal' : '';
    const potHex = m ? safeColor(m.paint.hex) : null;
    const potBand = m
      ? `<span class="lcpot ${fxCls(m.paint).trim()}" style="background-color:${potHex};color:${textOn(potHex)}">`
        + `<span class="lcpotlbl">Pot</span><span class="lchex">${potHex}</span></span>`
      : `<span class="lcpot none"><span class="lcpotlbl">No close pot</span></span>`;
    const foot = m
      ? `<span class="lcname">${esc(pname(m.paint))}${m.owned ? ` <span class="ownmini">${icon('check')}owned</span>` : ''}</span>`
        + `<span class="de" style="margin:2px 0 0"><span class="dot" style="background:${tier(m.quality.tier)}"></span>`
        + `<span style="color:${tierText(m.quality.tier)}">${esc(m.quality.label)}</span>`
        + `<span class="badge">ΔE ${m.deltaE.toFixed(1)}</span></span>${finishTag(m.paint.type)}`
      : `<span class="lcname">—</span><span class="br">no close paint</span>`;
    const fi = isFree ? +c.id.slice(1) : -1;                                     // index among the added swatches
    const sw = isBase ? 'base' : isFree ? 'x:' + c.id.slice(1) : 'p:' + c.deg;   // addressable swatch key
    // A role the painter can hold (Secondary, Accent, Metal — not the starting paint's role): its lock and
    // edit act on the ROLE, so they reach the Recipe (direction A). Other columns keep the sketch controls.
    const roleKey = c.holdable ? 'r:' + role : null;
    const isPot = c.hold === 'pot';
    const canDetach = !roleKey && (isFree || (c.kind === 'partner' && c.detachable));   // value-harmony partners can't be pinned uniquely
    const lockKey = roleKey && !isPot ? roleKey : canDetach ? sw : null;
    // The pencil chooses a PAINT for the column (the pot dialog; a custom colour is its last row). It had
    // opened the system colour picker from a hidden input, which some browsers never show, and which
    // gave a hex, not a paint. On a held pot it changes the pot.
    const editKey = roleKey || ((isBase || canDetach) ? sw : null);
    const lockOn = roleKey ? c.hold === 'lock' : !!c.locked;
    // The pinned accent (the starting paint, in accent mode) is display-only; Metal has no wheel node, but
    // its colour can still be locked or edited, like any role's.
    const acts = isPin ? '' : `<div class="lcact">`
      +   (editKey ? `<button type="button" class="lcbtn" data-edit="${editKey}" title="Choose a paint" aria-label="Choose a paint for ${esc(tag)}">${icon('edit')}</button>` : '')
      +   (lockKey ? `<button type="button" class="lcbtn${lockOn ? ' on' : ''}" data-lock="${lockKey}" title="${lockOn ? 'Unlock' : 'Lock'} colour" aria-label="${lockOn ? 'Unlock' : 'Lock'} ${esc(tag)} colour" aria-pressed="${lockOn}">${icon(lockOn ? 'lock' : 'unlock')}</button>` : '')
      +   (isFree ? `<button type="button" class="lcbtn" data-move="${fi}:-1"${fi === 0 ? ' disabled' : ''} title="Move earlier" aria-label="Move ${esc(tag)} earlier">${icon('chevl')}</button>` : '')
      +   (isFree ? `<button type="button" class="lcbtn" data-move="${fi}:1"${fi === freeCount - 1 ? ' disabled' : ''} title="Move later" aria-label="Move ${esc(tag)} later">${icon('chevr')}</button>` : '')
      +   `<button type="button" class="lcbtn" data-setbase="${cHex}" title="Start from this colour" aria-label="Start from the ${esc(tag)} colour">${icon('target')}</button>`
      +   (isFree ? `<button type="button" class="lcbtn" data-delnode="${c.id.slice(1)}" title="Remove this colour" aria-label="Remove ${esc(tag)}">${icon('close')}</button>` : '')
      + `</div>`;
    // Swatch is a plain div now; copying moved to its own button beside the hex (so the swatch-click stays
    // free for the Equivalents drill-down). The drill-down makes the swatch a role="button" only on that tab
    // (app.js applyEquivSelect). The copy button's chip is tinted for the swatch's ink (light/dark).
    // Seed dock (§3.5): the Main|Accent control folded into the palette. The chip IS the state
    // ("my pick seeds this role"); the dashed dock on the other eligible column is the control.
    // Every column reserves the row so switching never changes the bar's height (§3.4).
    // A chosen pot is state, so it is a tag in the dock row (the column never takes the dock: see app.js).
    const dock = isPot ? `<span class="holdchip" title="You chose this pot for ${esc(tag)}. Change or release it on the ${esc(tag)} card in the Recipe.">${icon('pin')}Pot chosen</span>`
      : c.dock && c.dock.type === 'chip'
      // A tag, not the paint's name: the name is already in the column's footer (UX 7). The title keeps it.
      ? `<span class="seedchip" title="${esc(c.dock.name)} is the starting paint — it sets the ${esc(tag)} role">${icon('anchor')}Starting paint</span>`
      : c.dock && c.dock.type === 'switch'
        ? `<button type="button" class="dockbtn" data-seeddock="${c.dock.target}"${c.dock.disabled ? ` aria-disabled="true" title="${esc(c.dock.disabled)}"` : ` title="${c.dock.target === 'accent' ? 'Make the starting paint the accent: the scheme then starts from its opposite colour' : `Make the starting paint the ${esc(tag)} again`}"`} aria-label="Move the starting paint to ${esc(tag)}">${icon('anchor')}Move here</button>`
        : '';
    // A lock is STATE, so it is a badge on the tag line (§3.5), never a ring: rings mean hover (the colour
    // link) and the Equivalents selection. It had been an inset shadow that the colour block covered.
    const lockBadge = lockOn ? `<span class="lclock" title="Locked: it stays when you roll or change the harmony">${icon('lock')}<span class="sr-only"> locked</span></span>` : '';
    return `<div class="lcol${isMetal || isPin ? ' display' : ''}" data-hex="${cHex}"${isFree ? ` draggable="true" data-dragidx="${c.id.slice(1)}"` : ''}>`
      + `<div class="lctop${fx ? ' ' + fx : ''}" style="background-color:${bg};color:${t}">`
      +   `<span class="lctag">${esc(tag)}${lockBadge}</span>`
      +   `<span class="lchexrow"><span class="lchex">${bg}</span>`
      +     `<button type="button" class="lccopy${t === '#FFFFFF' ? ' light' : ''}" data-copy="${bg}" title="Copy ${bg}" aria-label="Copy ${esc(tag)} target ${bg}">${COPY_ICON}</button>`
      +   `</span>${potBand}</div>`
      + `<div class="lcdock">${dock}</div>`
      + acts
      + `<span class="lcfoot">${foot}</span></div>`;
  }).join('')}</div>`;
}

/** Accessibility panel. model: { names, sims:[{label,colors}], contrasts:[{a,b,labelA,labelB,ratio,passAAText,passAALarge}], collision }. */
export function a11yPanel(model) {
  const strip = cols => `<div class="cstrip">${cols.map(c => `<span class="sw" style="flex:1;height:30px;background:${safeColor(c)}"></span>`).join('')}</div>`;
  const simRows = model.sims.map(s => `<div class="crow"><span class="clab">${esc(s.label)}</span>${strip(s.colors)}</div>`).join('');
  const verdict = c => c.passAAText ? ['Passes AA text', 'var(--success-text)'] : c.passAALarge ? ['Large/UI only', 'var(--warning-text)'] : ['Fails AA', 'var(--danger-text)'];
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
    coll = `<div class="collide"><strong>Heads-up:</strong> ${esc(model.collision.roles[0])} and ${esc(model.collision.roles[1])} look similar under ${esc(model.collision.type || 'deuteranopia')} (ΔE ${model.collision.delta.toFixed(1)}).`
      + (s ? ` Try a shifted ${esc(s.role.toLowerCase())} ${swatch(s.hex, '', 'width:16px;height:16px;display:inline-block;vertical-align:-2px')}${s.match ? ' — nearest paint ' + esc(pname(s.match.paint)) + ' (' + esc(s.match.paint.brand) + ')' : ''}.` : '')
      + '</div>';
  } else {
    coll = '<div class="collide ok">No major colour-blindness collisions in this scheme.</div>';
  }
  return `<div class="micro" style="margin:14px 0 8px">Colour-blindness simulation (role colours)</div>${simRows}`
    + `<div class="micro" style="margin:18px 0 8px">Contrast (WCAG 2.1)</div><div class="ctr">${ctr}</div>${coll}`;
}


/* ---- saved schemes (PLAN §5 item 35; mockups/scheme-library.html, direction A) ---- */

/** The line above the hero that says whether the scheme on screen is kept. `o.kind`:
 *  'none'    — not saved: "Not saved" + Save
 *  'saved'   — the saved scheme, unchanged: its name + a Saved tag
 *  'changed' — the saved scheme, changed since: its name + a Changed tag + Save + Save as new
 *  The name is a landing spot for focus after a save (tabindex -1, no ring). The tag is state, so a
 *  tag (§3.5): Saved is success, Changed is warning (it needs an action, it is not an error). */
export function schemeBar(o, tr) {
  if (o.kind === 'none') {
    return `<span class="sbname sbnone" id="sbName" tabindex="-1">${esc(tr('notSaved'))}</span>`
      + `<span class="sbacts"><button type="button" class="btn sm" data-sb="save">${esc(tr('saveScheme'))}</button></span>`;
  }
  const tag = o.kind === 'changed'
    ? `<span class="tag warning">${esc(tr('changedTag'))}</span>`
    : `<span class="tag success">${esc(tr('savedTag'))}</span>`;
  const acts = o.kind === 'changed'
    ? `<span class="sbacts"><button type="button" class="btn sm" data-sb="update">${esc(tr('saveScheme'))}</button>`
      + `<button type="button" class="btn sm" data-sb="asnew">${esc(tr('saveAsNew'))}</button></span>`
    : '';
  // title: a long name ends in an ellipsis on a phone; the element's text is the whole name
  return `<span class="sbname" id="sbName" tabindex="-1" title="${esc(o.name)}">${esc(o.name)}</span>${tag}${acts}`;
}

/** A scheme's picture: its four roles' pots at their 60-30-10 weights, with the finish overlay (§2: the
 *  colours are paint data). `pots`: [{hex, paint?}] in role order. aria-hidden: the row's name says it. */
export function schemeStrip(pots) {
  return `<span class="scstrip" aria-hidden="true">${pots.map(p => swatch(p.hex, fxCls(p.paint).trim())).join('')}</span>`;
}

/**
 * One row of the Schemes page. `r`: { id, name, auto, saved, harmony, pots, owned, roles, toBuy, date,
 * renaming }. The row's main button opens the scheme; the actions under it are text actions, one tap
 * away (no menu to find). A project that was never saved has no name: it shows its automatic name in
 * italics, and Save in place of Rename.
 */
export function schemeRow(r, tr) {
  const name = r.name || r.auto;
  const facts = [esc(harmonyLabel(r.harmony)), esc(tr('ownedOf', { n: r.owned, of: r.roles }))].join(' · ')
    + (r.toBuy ? ` <span class="tag buy">${esc(tr('nToBuy', { n: r.toBuy }))}</span>` : '');
  const when = r.saved ? tr('savedOn', { date: r.date }) : tr('notSavedKept');
  const head = r.renaming
    ? `<span class="screname"><label class="sr-only" for="scRename">${esc(tr('schemeName'))}</label>`
      + `<input id="scRename" class="scinput" type="text" maxlength="80" value="${esc(name)}" autocomplete="off" data-scid="${esc(r.id)}">`
      + `<span class="schint">${esc(tr('renameKeys'))}</span></span>`
    : `<button type="button" class="scopen" data-scopen="${esc(r.id)}">`
      + `<span class="scname${r.name ? '' : ' auto'}">${esc(name)}</span>`
      + `<span class="scfacts">${facts}</span><span class="scwhen">${esc(when)}</span></button>`;
  const acts = r.renaming
    ? `<button type="button" class="textact" data-scdone="${esc(r.id)}">${esc(tr('done'))}</button>`
    : (r.saved
      ? `<button type="button" class="textact" data-screname="${esc(r.id)}" aria-label="${esc(tr('renameNamed', { name }))}">${esc(tr('rename'))}</button>`
      : `<button type="button" class="textact" data-scsave="${esc(r.id)}" aria-label="${esc(tr('saveNamed', { name }))}">${esc(tr('saveScheme'))}</button>`)
      // Take to the store (item 37): only for a scheme with paints to buy; it opens the panel on this project
      + (r.toBuy ? `<button type="button" class="textact" data-scstore="${esc(r.id)}" aria-haspopup="dialog" aria-label="${esc(tr('storeNamed', { name }))}">${esc(tr('takeToStoreShort'))}</button>` : '')
      + `<button type="button" class="textact" data-scshare="${esc(r.id)}" aria-label="${esc(tr('shareNamed', { name }))}">${esc(tr('shareLinkShort'))}</button>`
      + `<button type="button" class="textact" data-scdelete="${esc(r.id)}" aria-label="${esc(tr('deleteNamed', { name }))}">${esc(tr('deleteDots'))}</button>`;
  return `<li class="scrow" data-scrow="${esc(r.id)}">${schemeStrip(r.pots)}<div class="scmain">${head}<div class="scacts">${acts}</div></div></li>`;
}

/** The Schemes page body: the saved schemes newest first, then the projects that were never saved, or
 *  the empty state (§3.5: a heading, one sentence, one action). */
export function schemesList(rows, tr) {
  const saved = rows.filter(r => r.saved), proj = rows.filter(r => !r.saved);
  if (!rows.length) {
    return `<div class="scempty"><h3>${esc(tr('noSchemesTitle'))}</h3><p>${esc(tr('noSchemesBody'))}</p>`
      + `<button type="button" class="btn" data-scgo="studio">${esc(tr('goStudio'))}</button></div>`;
  }
  return (saved.length ? `<ul class="sclist" aria-label="${esc(tr('savedSchemes'))}">${saved.map(r => schemeRow(r, tr)).join('')}</ul>` : '')
    + (proj.length ? `<h3 class="micro scgroup">${esc(tr('projectsNotSaved'))}</h3><ul class="sclist" aria-label="${esc(tr('projectsNotSaved'))}">${proj.map(r => schemeRow(r, tr)).join('')}</ul>` : '');
}

/* ---- the Shelf's list: the rack walk (PLAN §5 item 36; mockups/shopping-list.html, direction A) ---- */

const CHECK = '<svg viewBox="0 0 20 20" class="rkcheck" aria-hidden="true" focusable="false"><path d="M4 10.5l3.75 3.75L16 6"/></svg>';

/**
 * One row of the list. `r`: { paint, owned, countable, qty, countOpen, forName }.
 * - The tick is the row's one big control (a toggle, `aria-pressed` = owned): in a store, a tick is "bought".
 * - The count lives in a slot every countable row keeps, so "Add a count" turning into the stepper, and a
 *   tick that makes the paint owned, change no row height (§3.4). Owned, the slot keeps its height, empty.
 * - `forName` (rack order only): the scheme the paint is bought for, as a small label.
 */
export function rackRow(r, tr) {
  const p = r.paint, name = pname(p);
  const line = [esc(p.brand), esc(lineOf(p))].filter(Boolean).join(' · ');
  // Not on the rack? (item 38): a to-buy row that is not a swap already can open its swaps; the word hides on
  // a phone (the icon stays, the name says it all), so the stepper and the toggle share one --tap row
  const swapBtn = r.canSwap
    ? `<button type="button" class="textact rknot" data-rknot="${esc(p.id)}" aria-expanded="${!!r.swaps}" aria-controls="rks-${esc(p.id)}"`
      + ` aria-label="${esc(tr('notOnRackFor', { name }))}" title="${esc(tr('notOnRack'))}">${icon('swap')}<span class="rknotw">${esc(tr('notOnRack'))}</span></button>`
    : '';
  let slot = '';
  if (r.countable) {
    const inner = r.owned ? ''
      : r.countOpen
        ? `<span class="rkstep" role="group" aria-label="${esc(tr('potsOf', { name }))}">`
          + `<button type="button" class="btn sm" data-rkqty="-1" data-id="${esc(p.id)}" aria-label="${esc(tr('oneFewer'))}">−</button>`
          + `<output class="rkn">${esc(r.qty === 1 ? tr('onePot') : tr('nPots', { n: r.qty }))}</output>`
          + `<button type="button" class="btn sm" data-rkqty="1" data-id="${esc(p.id)}" aria-label="${esc(tr('oneMore'))}">+</button></span>`
        : `<button type="button" class="textact rkadd" data-rkcount="${esc(p.id)}" aria-label="${esc(tr('addCountFor', { name }))}">${esc(tr('addCount'))}</button>`;
    slot = `<span class="rkslot">${inner}${r.owned ? '' : swapBtn}</span>`;
  }
  // the line through the name is "ticked off the shopping list" (r.struck), not "owned": an owned paint has the filled tick
  return `<li class="rkrow${r.struck ? ' done' : ''}" data-rk="${esc(p.id)}">`
    + swatch(p.hex, 'rksw' + fxCls(p), '')
    // the plain name: the line is in the row (and the rack group) already; the tick's name keeps the full
    // display name, so twins (Dawnstone (Layer) / (Dry)) stay apart for a screen reader
    + `<span class="rkmain"><span class="rkname">${esc(p.name)}</span>`
    + `<span class="rkline">${line}${finishTag(p.type)}${r.forName ? ` <span class="rkfor">${esc(tr('forName', { name: r.forName }))}</span>` : ''}</span>`
    // a swap made in this visit says what it replaced; Undo only while it is still to buy (once ticked, it was bought)
    + (r.insteadOf ? `<span class="rkinst">${esc(tr('inPlaceOf', { name: pname(r.insteadOf) }))}`
      + (r.owned ? '' : ` <button type="button" class="textact" data-rkunswap="${esc(p.id)}" aria-label="${esc(tr('undoSwapFor', { name: pname(r.insteadOf) }))}">${esc(tr('undo'))}</button>`) + '</span>' : '')
    + slot + '</span>'
    + `<button type="button" class="rktick" data-rktick="${esc(p.id)}" aria-pressed="${r.owned}" aria-label="${esc(tr('ownedName', { name }))}">${CHECK}</button>`
    + (r.swaps ? rackSwaps(r, tr) : '')
    + '</li>';
}

/** The swaps under a row (item 38): the closest pots from the brands the store carries, in the paint's own
 *  finish class, each with its true ΔE and label (§2). `r.swaps`: { list: [{paint, deltaE, quality, owned}],
 *  notCarried: the row's brand is switched off }. */
function rackSwaps(r, tr) {
  const p = r.paint, s = r.swaps, name = pname(p);
  const best = s.list[0];
  let h = `<div class="rkswaps" id="rks-${esc(p.id)}" role="group" aria-label="${esc(tr('swapsFor', { name }))}">`;
  if (s.notCarried) h += `<p class="rksnote">${esc(tr('notCarried', { brand: p.brand }))}</p>`;
  if (!best) h += `<p class="rksnote">${esc(tr('noSwap'))}</p>`;
  else if (best.deltaE > 10) h += `<p class="rksnote">${esc(tr('noCloseSwap'))}</p>`;
  for (const m of s.list) {
    const q = m.paint, qn = pname(q);
    h += `<div class="rkswap">${swatch(q.hex, 'rkssw' + fxCls(q))}`
      + `<span class="rksmain"><span class="rksname">${esc(qn)}</span>`
      + `<span class="rkline">${[esc(q.brand), esc(lineOf(q))].filter(Boolean).join(' · ')}${finishTag(q.type)}`
      + ` <span class="mono">ΔE ${m.deltaE.toFixed(1)}</span> <span class="tag ${m.quality.tier}">${esc(m.quality.label)}</span>`
      + `${m.owned ? ` <span class="ownmini">${icon('check')}${esc(tr('ownedWord'))}</span>` : ''}</span></span>`
      + `<button type="button" class="btn sm" data-rkuse="${esc(q.id)}" data-for="${esc(p.id)}" aria-label="${esc(tr('useInPlace', { name: qn, was: name }))}">${esc(tr('useSwap'))}</button></div>`;
  }
  return h + '</div>';
}

/** "This store carries" (item 38): one toggle per brand on the list, all on at first. A brand switched off
 *  shows the closest pots from the others on each of its rows. A choice for this trip, not saved. */
export function storeCarries(brands, off, tr) {
  if (!brands.length) return '';
  // the count says how many brands the row holds, so a brand scrolled out of view is not missed (PLAN §5 item 42)
  const nOff = brands.filter(b => off.has(b)).length;
  return `<span class="micro" id="rkStoreLab">${esc(tr('storeCarries'))}<span class="rkcount"> · ${esc(tr(nOff ? 'storeBrandsOff' : 'storeBrands', { n: brands.length, off: nOff }))}</span></span>`
    + `<span class="rkchips" role="group" aria-labelledby="rkStoreLab">`
    + brands.map(b => `<button type="button" class="rkchip" data-rkbrand="${esc(b)}" aria-pressed="${!off.has(b)}">${icon('check')}${esc(b)}</button>`).join('')
    + '</span>';
}

/** The list body: one group per brand · line (rack order) or per scheme (by project), each a heading with
 *  its count and a list. `groups`: [{ key, title, rows }]. */
export function rackGroups(groups, tr) {
  return groups.map(g => `<section class="rkgroup" aria-label="${esc(g.title)}">`
    + `<h3 class="rkhead"><span>${esc(g.title)}</span><span class="rkcount">${g.rows.length}</span></h3>`
    + `<ul class="rklist">${g.rows.map(r => rackRow(r, tr)).join('')}</ul></section>`).join('');
}
