// app.js — application state, dataset loading, entry modes, tabs, conveniences, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/scheme/a11y/ui.

// Imports pull pure logic from sibling ES modules. app.js owns the DOM + state; these stay DOM-free
// so they can be unit-tested (§4). Grouped by module:
// harmony.js — harmony definitions + generators (which hues/values partner the base for each scheme).
import { HARMONY_TYPES, isHarmony, isHueHarmony, HARMONY_OFFSETS, harmonize,
  isNeutralHarmony, neutralPartners, NEUTRAL_HARMONY_TYPES, DEFAULT_POP, POP_MIN_S } from './harmony.js';
// color.js — colour maths: sRGB↔HSL↔Lab, hue rotation, ΔE (perceptual "how different" distance),
// neutral detection by chroma + the neutral enter/exit thresholds (§7).
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, rotateHue, textOn, hexToLab, deltaE2000, isNeutral, labChroma, NEUTRAL_CHROMA, NEUTRAL_EXIT } from './color.js';
// a11y.js — colour-blindness simulation, WCAG contrast, and the min pairwise ΔE (collision) check.
import { simulateCvd, wcag, minPairDelta } from './a11y.js';
// data.js — load/index the dataset + nearest-paint search (map an ideal colour to a real buyable paint).
import { loadDataset, equivalents, nearestPaints, nearestPaint, FINISH_TYPES, groupMembers, groupOf } from './data.js';
// scheme.js — map a harmony onto miniature paint roles + ideal-vs-actual + tone ladders.
import { buildScheme, shoppingList, schemeGaps, roleIdeals } from './scheme.js';
import { csvToMarks, marksToCsv } from './collection-io.js';   // collection portability (#27)
import * as ui from './ui.js';
import * as store from './store.js';   // versioned, portable collection + prefs persistence (the only storage chokepoint)
import * as i18n from './i18n.js';      // lightweight UI-string localization (chrome only; paint names never translate)

const $ = sel => document.querySelector(sel);   // shorthand for document.querySelector, used throughout
// THE single source of truth. UI reads this, events mutate it, then re-render (§4). Anything that
// defines "what's on screen" lives here so it can be snapshotted (undo) and URL-encoded (share).
const state = {
  idx: null, scheme: null,           // idx = the loaded+indexed dataset; scheme = last-built role plan (cache)
  baseId: null, customHex: null,     // the SEED (picked colour): either a dataset paint id OR a raw #hex — never both
  harmony: 'complementary',          // active harmony rule (complementary/analogous/triadic/…; neutral schemes when neutral)
  // UI-position bits: picker search/brand/type/sort; seedRole = is the seed the scheme's Main or Accent
  // (entry mode C); tab = which output tab is showing; theme = light/dark colour set (§3).
  q: '', brand: '', ptype: '', psort: '', seedRole: 'main', tab: 'plan', theme: 'light',
  compareA: null, wheelL: null, hiHex: null,   // compareA = pinned scheme A; wheelL = wheel's lightness; hiHex = the colour link-highlighted across wheel/plan/live palette

  extraNodes: [], showReal: false,   // editable swatches [{h,s,l?,locked?}] (S5); live-palette ideal↔real fill
  dropOffsets: [],                   // harmony offsets "detached" by lock/edit so the rule stops regenerating them
  mode: 'studio', shelfBrand: '', shelfMark: '', shelfQ: '', shelfType: '', shelfSort: '', brands: [],   // Studio/Shelf mode; shelf brand · status · search · type · sort
  ladder: 'wash', collection: 'off',  // #7 tone-ladder style; how the collection drives matching: off | prefer (#6 boost) | only (hard filter)
  includeContrast: false,             // include Contrast paints in harmony suggestions (washes/shades stay excluded)
  popHex: null,                        // neutral mode's pop accent (null = DEFAULT_POP); drives the hue math when the seed is neutral
};
// Ranking tweaks (§7): they nudge which paint WINS, never the ΔE we report (§2 honesty).
const OWNED_BOOST = 6;   // ΔE the soft owned-boost is "worth" — owned paints up to ~6 ΔE worse can still win (#6)
const METAL_DEMOTE = 4;  // ΔE handicap on metallics for COLOUR roles (they read differently on the model); the
                         // Metal role's all-metal pool demotes every candidate equally, so it's unaffected (§7)

// The seed's hex: a raw customHex if the user typed/dropped one, else the picked paint's hex.
const baseHex = () => state.customHex || state.idx.byId.get(state.baseId)?.hex;
/** Entry mode C: when the seed is the *accent*, build the scheme around its complement. */
const schemeBase = () => (state.seedRole === 'accent' ? rotateHue(baseHex(), 180) : baseHex());

/* ---- neutral mode (CLAUDE.md §7 / PLAN v1.8): a neutral seed swaps the scheme engine ---- */
// Hysteresis (enter < NEUTRAL_CHROMA, exit > NEUTRAL_EXIT): a drag hovering on the boundary can't
// flip the mode per frame. ensureHarmonyMode is the only writer; everyone else reads the held mode.
let neutralMode = null;   // the HELD neutral flag (null until first computed); ensureHarmonyMode is its only writer
const neutralSeed = () => neutralMode ?? isNeutral(schemeBase());   // held flag if known, else compute from chroma
const activePop = () => state.popHex || DEFAULT_POP;   // the pop accent in force (user's choice or the default)
const validHarmony = t => isHarmony(t) || isNeutralHarmony(t);   // is `t` a real harmony id (hue OR neutral-native)?
/** Strip order in neutral mode: the neutral-native schemes first, then the disabled hue rotations. */
const NEUTRAL_OK = new Set(NEUTRAL_HARMONY_TYPES);   // fast membership test: which schemes work for a neutral seed
const NEUTRAL_STRIP = [...NEUTRAL_HARMONY_TYPES, ...HARMONY_TYPES.filter(t => !NEUTRAL_OK.has(t))];   // neutral-first strip order
const NEUTRAL_DISABLED = new Set(HARMONY_TYPES.filter(t => !NEUTRAL_OK.has(t)));   // hue schemes greyed out for a neutral
const NEUTRAL_DISABLED_WHY = 'Needs a hue to rotate — unavailable for a neutral seed';   // tooltip on a greyed chip
/** Suggested pops — classic neutral pairings (locked ideal hexes, not paint hexes). */
const POPS = [   // quick-pick accents shown when a neutral seed needs a splash of colour
  { hex: '#9C1626', name: 'Crimson' }, { hex: '#0F6B6E', name: 'Teal' }, { hex: '#C4581A', name: 'Ember' },
  { hex: '#C2912F', name: 'Gold' }, { hex: '#5B3B8C', name: 'Purple' }, { hex: '#3E6B2F', name: 'Moss' },
];
/** Match/scheme options from the single "use my collection" control: off · prefer (boost) · only (filter). */
function matchOpts() {
  const o = { ladder: state.ladder };            // start with the tone-ladder style (#7)
  const owned = store.ownedIds();                // the set of paint ids the user owns
  if (state.collection === 'only' && owned.size) o.ownedIds = owned;   // hard filter: match only owned paints
  else if (state.collection === 'prefer' && owned.size) { o.boostIds = owned; o.boostAmount = OWNED_BOOST; }   // soft boost: prefer owned
  // Keep finishes (washes/shades/contrast/effects) out of harmony suggestions; Contrast is opt-in.
  const ex = new Set(FINISH_TYPES);
  if (state.includeContrast) ex.delete('contrast');   // user opted contrast back in → stop excluding it
  o.excludeTypes = ex;
  // Metals rank as if METAL_DEMOTE ΔE further for colour roles (reported ΔE stays true — §2 honesty).
  o.demoteTypes = new Set(['metal']); o.demoteAmount = METAL_DEMOTE;
  return o;
}

// Build the display info for the hero (seed identity strip): name, hex, brand/line, type, approx flag.
function baseInfo() {
  if (state.customHex) return { hex: state.customHex, name: 'Custom ' + state.customHex, custom: true };   // raw-hex seed has no paint metadata
  const p = state.idx.byId.get(state.baseId);   // the picked paint
  // dname already carries the line for ambiguous names — suppress the meta's line so the hero doesn't read it twice
  const lined = p.dname && p.dname !== p.name;
  return { id: p.id, hex: p.hex, name: p.dname || p.name, brand: p.brand, line: lined ? '—' : p.line, type: p.type, approx: p.approx };
}
function basePaint() { return state.customHex ? null : state.idx.byId.get(state.baseId); }   // the picked paint object, or null for a raw-hex seed
function currentScheme() {
  // seed identity → buildScheme prefers the pick on exact ties and flags honest substitutions, in
  // BOTH seed modes (the slot whose ideal is the pick's hex gets it — Primary or Accent).
  const p = basePaint();   // the picked paint (null for raw-hex seed)
  const seed = p ? { id: p.id, name: p.dname || p.name, hex: p.hex } : null;   // pass identity so the pick wins its own slot
  return buildScheme(state.idx, schemeBase(), state.harmony, { ...matchOpts(), pop: activePop(), seed });
}

// The picker list: paints passing the search + brand + type filters (then sorted). "Entry mode": start
// from an owned paint. Note lines 92–93 repeat the same dname check — a harmless redundancy, left as-is.
function filteredPaints() {
  const q = state.q.toLowerCase();
  const list = state.idx.paints.filter(p =>
    (!state.brand || p.brand === state.brand) &&        // brand filter (empty = all brands)
    (!state.ptype || p.type === state.ptype) &&         // type filter (empty = all types)
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)   // free-text search over name/brand…
       || (p.dname && p.dname.toLowerCase().includes(q))
       || (p.dname && p.dname.toLowerCase().includes(q))));   // the displayed "(Line)" name is searchable too
  return sortPaints(list);
}
/** Sort a paint list by `key` (stable copy; '' keeps dataset order). Shared by the picker (state.psort)
 *  and the shelf (state.shelfSort). */
function sortPaints(list, key = state.psort) {
  const hsl = p => rgbToHsl(hexToRgb(p.hex));   // helper: a paint's [hue, sat, light] for hue/light sorts
  switch (key) {
    case 'name': return list.slice().sort((a, b) => a.name.localeCompare(b.name));   // A→Z by name
    case 'brand': return list.slice().sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));   // brand, then name
    case 'hue': return list.slice().sort((a, b) => hsl(a)[0] - hsl(b)[0]);           // rainbow order
    case 'light': return list.slice().sort((a, b) => hsl(a)[2] - hsl(b)[2]);         // dark→light
    case 'de': { const bl = hexToLab(baseHex()); return list.slice().sort((a, b) => deltaE2000(bl, a.lab) - deltaE2000(bl, b.lab)); }   // closest to the seed first
    case 'owned': return list.slice().sort((a, b) => (store.isOwned(b.id) - store.isOwned(a.id)) || a.name.localeCompare(b.name));   // owned first, then name
    default: return list;   // dataset order
  }
}

/* ---- per-tab renderers (one per output tab: Plan / Equivalents / Accessibility) ---- */
function renderPlan() {
  state.scheme = currentScheme();   // rebuild the role plan for the current seed + harmony (cache in state)
  const cur = { base: schemeBase(), harmony: state.harmony, colors: state.scheme.roles.map(r => r.idealHex) };   // this scheme, for the compare bar
  const cmp = state.compareA ? ui.compareBar(state.compareA, cur) : '';   // if a scheme A is pinned, show A-vs-current
  // Gaps = paints this scheme needs that you don't own and haven't already flagged to buy (#5).
  const gaps = schemeGaps(state.scheme, store.ownedIds());
  const addable = gaps.filter(g => store.markOf(g.paint.id) !== 'want').length;   // how many the "add all to buy" button would add
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
  const m = {};   // map: node's ideal-hex (UPPERCASE) → 'P' | 'A' | '2'
  // The wheel draws its nodes off baseHex(); the scheme's roles are off schemeBase(). In accent-seed mode
  // those frames are 180° apart, so the wheel nodes don't map to the scheme roles (they'd mislabel/vanish).
  // Only badge roles when the two frames coincide (main mode); the live palette + Plan still carry roles.
  if (state.seedRole === 'accent') return m;   // empty map → no wheel badges in accent mode
  for (const d of roleIdeals(schemeBase(), state.harmony, activePop())) {   // each role's ideal colour
    if (d.metal) continue;   // Metal has no wheel node to badge
    m[d.idealHex.toUpperCase()] = d.role === 'Primary' ? 'P' : d.role === 'Accent' ? 'A' : '2';   // Secondary → '2'
  }
  return m;
}
/** Derived palette: harmony-rule colours (never stored) + any free/added nodes. Feeds wheel + live palette. */
function paletteNodes() {
  const base = schemeBase();
  const drop = new Set(state.dropOffsets);   // offsets the user detached (they became free swatches; skip them here)
  const hueH = isHueHarmony(state.harmony);   // value harmonies (shades/mono) can't be uniquely detached by hue
  // Neutral harmonies: partners derive from the pop, not from base rotations — display-only columns
  // (deg null, not detachable), exactly like the value-harmony partners.
  const ruleColours = isNeutralHarmony(state.harmony)
    ? [{ hex: base, deg: 0 }, ...neutralPartners(base, activePop(), state.harmony)]   // neutral: base + pop-derived partners
    : harmonize(base, state.harmony);                                                 // hue: base + rotated partners
  const rule = ruleColours
    .map((n, i) => ({ id: 'p' + i, kind: i ? 'partner' : 'base', hex: n.hex, deg: n.deg, detachable: i > 0 && hueH }))   // index 0 = base, rest = partners
    .filter(n => n.kind === 'base' || !drop.has(n.deg));   // a detached (locked/edited) partner is now a free swatch
  const free = state.extraNodes.map((o, i) => ({ id: 'x' + i, kind: 'free', deg: null, locked: !!o.locked,   // user-added swatches
    hex: rgbToHex(hslToRgb([o.h, o.s, o.l ?? state.wheelL])) }));   // free node's own lightness, or the wheel's if unset
  return [...rule, ...free];
}
/** Render the variable live palette: one column per harmony/free colour → nearest paint (ideal/real fill). */
function renderLive() {
  const el = $('#livepal'); if (!el) return;
  const opts = matchOpts();
  // Role map (Primary/Secondary/Accent/Metal) so each column reads in the Plan's language — see livePalette.
  const ideals = roleIdeals(schemeBase(), state.harmony, activePop());
  const roleByHex = {};   // ideal-hex (UPPER) → role name, so a column can be labelled by its role
  for (const d of ideals) roleByHex[d.idealHex.toUpperCase()] = d.role;
  state.roleByHex = roleByHex;   // the Equivalents drill-down reads this for its source label
  // The pick wins exact ties HERE too — the live palette is the single scheme summary (§3.6) and must
  // agree with the Plan tab about which twin fills the pick's slot.
  const sp = basePaint();
  const optsFor = hex => sp && hex.toUpperCase() === sp.hex.toUpperCase() ? { ...opts, preferIds: new Set([sp.id]) } : opts;   // force the pick to win its own colour
  const vm = paletteNodes().map(n => ({ ...n, match: nearestPaint(state.idx, n.hex, optsFor(n.hex)) }));   // attach each column's nearest real paint
  // Metal has no wheel node, so it rides along as a display-only column → the live palette is the complete
  // scheme summary (one bar, all four roles), letting the Plan drop its duplicate overview strip.
  const metal = ideals.find(d => d.metal);
  vm.push({ id: 'metal', kind: 'metal', hex: metal.idealHex, match: nearestPaint(state.idx, metal.idealHex, { ...opts, types: new Set(['metal']) }) });   // Metal → nearest metallic only
  el.innerHTML = ui.livePalette(vm, state.showReal ? 'real' : 'ideal', roleByHex);   // fill columns with ideal or real paint colour
  applyLinkHighlight();   // re-assert any active hover-link after the columns are rebuilt
  applyEquivSelect();     // re-assert the Equivalents-source ring after the columns are rebuilt
}
/** Cross-surface colour link (§3 "one instrument"): hovering/focusing a role block (Plan, right) or a
 *  live-palette column (left) rings the *same colour* wherever it appears — both DOM surfaces + the wheel
 *  node — so the wheel and the plan read as one tool. Transient interaction → outline ring (§3.5), never a
 *  border-width change (no reflow, §3.4). hex=null clears. */
function applyLinkHighlight() {
  const h = state.hiHex;   // the colour currently link-highlighted (or null)
  for (const el of document.querySelectorAll('[data-hex]'))   // every colour-tagged element on any surface
    el.classList.toggle('linkhi', h != null && el.dataset.hex.toUpperCase() === h);   // ring only the matching colour
}
function linkHighlight(hex) {
  const h = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;   // validate/normalise, null clears
  if (state.hiHex === h) return;   // no change → skip the redraw
  state.hiHex = h;
  applyLinkHighlight();
  wheelDraw();   // redraw so the matching wheel node gains/loses its ring
}
/** Equivalents-source drill-down: on the Equivalents tab, clicking a live-palette column makes that colour
 *  the source whose cross-brand matches are listed, and the column keeps a persistent selection ring so the
 *  left palette and the right list read as tied (an extension of the §3.5 colour link). The source defaults
 *  to the seed; it's session-only (not encoded in the URL) and falls back to the seed if the scheme changes. */
function equivSourceHex() {
  const def = (baseHex() || '#000000').toUpperCase();   // default source = the seed
  if (state.equivSource) {   // user picked a specific column as the source…
    for (const el of document.querySelectorAll('.lcol[data-hex]'))
      if (el.dataset.hex.toUpperCase() === state.equivSource) return state.equivSource;   // still a live column
    state.equivSource = null;   // stale (the scheme changed it away) → fall back to the seed
  }
  return def;
}
function applyEquivSelect() {
  const on = state.tab === 'equiv';   // this behaviour only exists on the Equivalents tab
  const src = on ? equivSourceHex() : null;   // the ring + swatch drill-down only read on the Equivalents tab
  for (const el of document.querySelectorAll('.lcol[data-hex]')) {   // every live-palette column
    el.classList.toggle('eqsel', src != null && el.dataset.hex.toUpperCase() === src);   // persistent selection ring on the source column
    const top = el.querySelector('.lctop'); if (!top) continue;
    if (on) {   // the swatch becomes a keyboard-operable "show equivalents" button — only on this tab
      top.setAttribute('role', 'button'); top.setAttribute('tabindex', '0');
      top.setAttribute('aria-label', `Show equivalents for ${(top.querySelector('.lctag')?.textContent || el.dataset.hex).trim()}`);
    } else { top.removeAttribute('role'); top.removeAttribute('tabindex'); top.removeAttribute('aria-label'); }   // strip the button role off this tab
  }
}
function setEquivSource(hex) {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;   // validate/normalise
  if (!h || h === equivSourceHex()) return;   // ignore junk / re-selecting the current source
  state.equivSource = h;
  renderEquiv();          // re-list matches for the new source colour
  applyEquivSelect();     // move the selection ring to it
  const st = $('#status'); if (st) st.textContent = `Showing equivalents for ${(state.roleByHex || {})[h] ? (state.roleByHex[h] + ' ') : ''}${h}`;   // announce for screen readers
}
/** Re-render the harmony strip for the current mode: neutral seeds get the neutral-native schemes
 *  first with the hue rotations greyed in place (visible + tooltip'd, never removed — §3.4). */
function syncSeg() {
  $('#seg').innerHTML = neutralSeed()
    ? ui.segmented(NEUTRAL_STRIP, state.harmony, { disabled: NEUTRAL_DISABLED, disabledReason: NEUTRAL_DISABLED_WHY })   // neutral: neutral-native first, hue rotations greyed
    : ui.segmented(HARMONY_TYPES, state.harmony);   // hue seed: the normal full set
  scrollHarmonyActive();   // keep the active chip centred in the scrollable strip
}
// Show/hide the quick-pop accent chips (only for neutral schemes that carry a pop, not warm-cool).
function renderPops() {
  const el = $('#pops'); if (!el) return;
  const on = neutralSeed() && isNeutralHarmony(state.harmony) && state.harmony !== 'warm-cool';   // pop-bearing schemes only
  el.hidden = !on;
  if (on) el.innerHTML = ui.popChips(POPS, activePop());   // render the suggested pops, marking the active one
}
/** Discrete pop change (quick-pop chip / restored URL); wheel drags go through the wheel's commit(). */
function setPopHex(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;   // guard against junk
  state.popHex = hex.toUpperCase();
  refreshStudio(); renderActive(); renderPops(); scheduleAnnounce(); updateUrl();   // repaint studio + tab, announce, save to URL
}
/** The neutral-mode chokepoint — call whenever the seed may have changed class. Keeps the harmony
 *  legal for the seed (parking/restoring the painter's hue harmony across the boundary), forces the
 *  seed to Primary (a neutral accent has no complement to build around), and syncs the banner, strip,
 *  and pop chips. Cheap when nothing changed, so the wheel's per-frame commit() can call it. */
let lastNeutral = null, preNeutralHarmony = null;   // lastNeutral = mode at last run; preNeutralHarmony = the hue harmony parked while neutral
function ensureHarmonyMode() {
  const C = labChroma(schemeBase());   // how colourful the seed is (Lab chroma; near 0 = grey)
  // Hysteresis: once neutral, need chroma above the HIGHER exit threshold to leave; once colourful, need
  // to drop below the LOWER enter threshold to become neutral. The 10–14 deadband stops per-frame flicker.
  const n = neutralMode ? C < NEUTRAL_EXIT : C < NEUTRAL_CHROMA;   // hysteresis deadband 10–14
  neutralMode = n;   // publish the held flag everyone else reads
  const legal = n ? NEUTRAL_OK.has(state.harmony) : !isNeutralHarmony(state.harmony);   // is the current harmony valid for this mode?
  if (n === lastNeutral && legal) return;   // nothing changed → cheap early-out (per-frame safe)
  lastNeutral = n;
  if (!legal) {   // the harmony no longer fits the mode → swap it, parking/restoring the painter's choice
    state.dropOffsets = [];   // detached partners don't carry across a mode swap
    if (n) { preNeutralHarmony = state.harmony; state.harmony = 'neutral-pop'; }   // entering neutral: park the hue harmony, default to neutral-pop
    else { state.harmony = validHarmony(preNeutralHarmony) && !isNeutralHarmony(preNeutralHarmony) ? preNeutralHarmony : 'complementary'; preNeutralHarmony = null; }   // leaving: restore the parked one (or complementary)
    $('#status').textContent = n   // announce the automatic swap for screen readers
      ? 'Neutral seed — switched to the Neutral + pop scheme. Hue harmonies are unavailable for a neutral.'
      : `Seed has a hue again — back to the ${state.harmony} scheme.`;
  }
  if (n && state.seedRole === 'accent') {   // neutral always holds Primary; drop out of accent-seed mode
    state.seedRole = 'main';
    for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === 'main'));   // sync the Main/Accent toggle
  }
  for (const x of $('#seedRole').children) {   // honest disable: visible, with the why (§3.5)
    if (n) { x.setAttribute('aria-disabled', 'true'); x.title = 'A neutral seed always holds Primary — pick a pop accent on the wheel instead'; }
    else { x.removeAttribute('aria-disabled'); x.removeAttribute('title'); }   // re-enable when the seed has a hue again
  }
  setNeutralUi(n);   // show/hide the neutral explainer overlay
  syncSeg(); renderPops();   // rebuild the harmony strip + pop chips for the new mode
}
/* The ONE neutral explainer (§3.5), as a wheel OVERLAY so it never reflows the studio (§3.4): it
 * animates in on mode entry, auto-collapses to a compact ◐ pill after a beat, and the pill re-expands
 * it on demand. Timer only re-arms on mode ENTRY or pill click — never per drag frame. */
let bannerTimer = 0;   // setTimeout handle for the auto-collapse
const BANNER_HOLD_MS = 7000;   // how long the expanded banner shows before collapsing to the pill
/** Touch / narrow screens have no spare space: the expanded banner would sit ON the wheel disc and
 *  swallow the touches meant for colour-picking. There, neutral mode enters PILL-FIRST — the ◐ pill
 *  barely covers the rim, and the explainer expands only on request (evaluated per call so rotation/
 *  resize is honoured). */
const compactBanner = () => matchMedia('(pointer: coarse), (max-width: 700px)').matches;   // true on touch/narrow → enter pill-first
function setNeutralUi(n) {
  const ov = $('#neutralOverlay'); if (!ov) return;
  clearTimeout(bannerTimer);
  ov.hidden = !n;   // overlay only exists in neutral mode
  if (n) (compactBanner() ? collapseBanner : expandBanner)();   // ensureHarmonyMode only calls on a mode CHANGE
}
function expandBanner() {   // show the full explainer, hide the pill, arm the auto-collapse
  const nb = $('#neutralBanner'), np = $('#neutralPill');
  nb.hidden = false; np.hidden = true; np.setAttribute('aria-expanded', 'true');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(collapseBanner, BANNER_HOLD_MS);   // collapse itself after a beat
}
function collapseBanner() {   // hide the explainer, show the compact ◐ pill
  const nb = $('#neutralBanner'), np = $('#neutralPill');
  clearTimeout(bannerTimer);
  nb.hidden = true; np.hidden = false; np.setAttribute('aria-expanded', 'false');
}
/** Redraw the always-visible studio (wheel + live palette) after a discrete base/harmony change. */
function refreshStudio() {
  ensureHarmonyMode();   // the seed may have crossed the neutral boundary (picker, hex, drag, undo)
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];   // sync the wheel's lightness to the new seed
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);   // reflect it on the slider (0–100)
  wheelDraw(); renderLive(); renderPops();
}
const MAX_FREE = 6;   // bounds URL length + per-frame nearest-paint scans (S5 micro-decision)
/** Add a colour "along the line": extend the base's value ramp (alternating lighter/darker tints &
 *  shades, stepping outward) rather than inventing a new hue. New swatches are draggable + editable. */
function addFreeNode() {
  if (state.extraNodes.length >= MAX_FREE) return;   // cap reached
  const [bh, bs, bl] = rgbToHsl(hexToRgb(baseHex()));   // base hue/sat/light
  const k = state.extraNodes.length, dir = k % 2 === 0 ? 1 : -1, mag = 0.12 + 0.10 * Math.floor(k / 2);   // alternate lighter/darker, stepping further each pair
  const l = Math.min(0.94, Math.max(0.06, bl + dir * mag));   // new lightness, clamped away from pure black/white
  state.extraNodes.push({ h: bh, s: bs, l });   // same hue/sat as the base, new lightness (a value step)
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
/** Remove a free node (by index, or the last when omitted). */
function removeFreeNode(idx) {
  if (typeof idx === 'number' && idx >= 0) state.extraNodes.splice(idx, 1); else state.extraNodes.pop();   // targeted remove, else drop the last
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
function syncNodeBtns() {   // enable/disable the add & delete buttons against the count + cap
  const a = $('#addnode'), d = $('#delnode');
  if (a) a.disabled = state.extraNodes.length >= MAX_FREE;   // can't add past the cap
  if (d) d.disabled = state.extraNodes.length === 0;         // nothing to delete
}
/** Current hex of an addressable swatch key ('base' | 'p:<deg>' | 'x:<idx>'). */
function swatchHex(sw) {
  if (sw.startsWith('p:')) return rotateHue(baseHex(), +sw.slice(2));   // partner: base rotated by its offset degrees
  if (sw.startsWith('x:')) { const o = state.extraNodes[+sw.slice(2)]; if (o) return rgbToHex(hslToRgb([o.h, o.s, o.l ?? state.wheelL])); }   // free node: its own hsl
  return baseHex();   // 'base'
}
/** Detach a harmony partner into the editable free-swatch list (so lock/edit can pin it independently). */
function detachPartner(deg, extra) {
  if (state.extraNodes.length >= MAX_FREE) return false;   // no room
  const [bh, bs] = rgbToHsl(hexToRgb(baseHex()));
  if (!state.dropOffsets.includes(deg)) state.dropOffsets.push(deg);   // stop the rule regenerating this offset
  state.extraNodes.push({ h: ((bh + deg) % 360 + 360) % 360, s: bs, l: state.wheelL, ...extra });   // add it as a free node at the same colour (extra = {locked}/{h,s,l})
  return true;
}
/** Lock toggle for a swatch — locked swatches survive Generate + harmony changes. The base can't be locked. */
function lockSwatch(sw) {
  if (sw === 'base') return;   // the base is never lockable
  if (sw.startsWith('p:')) detachPartner(+sw.slice(2), { locked: true });   // locking a partner detaches it, locked
  else if (sw.startsWith('x:')) { const o = state.extraNodes[+sw.slice(2)]; if (o) o.locked = !o.locked; }   // toggle a free node's lock
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
/** Set an arbitrary hex on a swatch (the base re-seeds; any other swatch becomes a pinned free swatch). */
function editSwatch(sw, hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;   // validate
  if (sw === 'base') { seedFromHex(hex); return; }   // editing the base = re-seeding the whole scheme
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (sw.startsWith('p:')) detachPartner(+sw.slice(2), { h, s, l });   // partner: detach it pinned to the new colour
  else if (sw.startsWith('x:')) { const i = +sw.slice(2); if (state.extraNodes[i]) state.extraNodes[i] = { ...state.extraNodes[i], h, s, l }; }   // free node: overwrite its colour (keep locked flag)
  syncNodeBtns(); wheelDraw(); renderLive(); updateUrl();
}
let swEditTarget = null;   // swatch key being edited via the native colour picker
/** Open the per-swatch colour editor (native picker), seeded with the swatch's current colour. */
function openSwatchEditor(sw) { const inp = $('#swEdit'); if (!inp) return; swEditTarget = sw; inp.value = swatchHex(sw); inp.click(); }   // remember target, preset colour, open the native <input type=color>
/** Move an added swatch within the free list (drag-reorder). */
function moveFreeNode(from, to) {
  const a = state.extraNodes;
  if (!(from >= 0 && from < a.length && to >= 0 && to < a.length) || from === to) return;   // bounds + no-op guard
  const [m] = a.splice(from, 1); a.splice(to, 0, m);   // pull out `from`, reinsert at `to`
  wheelDraw(); renderLive(); updateUrl();
}
// The interactive colour wheel: an Adobe-Color-style HSV disc with draggable nodes (base + harmony
// partners + free swatches). Sets up canvas sizing, drawing, hit-testing, pointer + keyboard control.
function setupWheel() {
  const cv = $('#wheel'), ctx = cv.getContext('2d');
  const COARSE = matchMedia('(pointer:coarse)').matches;   // touch device → bigger nodes + hit radius
  const NODE = COARSE ? { base: 15, part: 12, hit: 26 } : { base: 11, part: 8, hit: 18 };  // hit: used in S4 (base node / partner node / grab radius)
  let W, H, cx, cy, R;                          // CSS-px width/height, centre x/y, disc radius
  function measure() {                          // size the buffer to the CSS box × DPR; geometry stays in CSS px
    const dpr = Math.min(2, window.devicePixelRatio || 1);   // cap at 2× to bound the pixel count
    W = Math.round(cv.getBoundingClientRect().width) || 280; H = W;   // square (aspect-ratio:1 in CSS)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);   // backing buffer in device pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);     // draw in CSS px → crisp on retina
    cx = W / 2; cy = H / 2; R = W / 2 - 16;     // centre + radius (16px rim margin)
  }
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];   // initial wheel lightness = the seed's lightness
  $('#wl').value = Math.round(state.wheelL * 100);   // reflect it on the slider
  // Polar→screen: hue is the angle (0° up, clockwise), saturation is the radius fraction.
  const pos = (h, s) => [cx + Math.sin(h * Math.PI / 180) * s * R, cy - Math.cos(h * Math.PI / 180) * s * R];
  const disc = document.createElement('canvas');   // offscreen filled HSV disc, rasterised once per (size, lightness)
  let discKey = '';                                // cache key of the last-built disc (skip rebuild if unchanged)
  function buildDisc() {                            // hue = angle, saturation = radius, lightness = the wheel slider
    const key = W + ':' + Math.round(state.wheelL * 100);   // colour data only → theme-independent; cached
    if (key === discKey) return;                   // same size + lightness → reuse the cached raster
    discKey = key; disc.width = W; disc.height = H;
    const dctx = disc.getContext('2d'), img = dctx.createImageData(W, H), data = img.data, L = state.wheelL;
    for (let j = 0; j < H; j++) {                   // per pixel row
      const dy = j - cy;
      for (let i = 0; i < W; i++) {                 // per pixel column
        const dx = i - cx, dist = Math.sqrt(dx * dx + dy * dy), idx = (j * W + i) * 4;   // distance from centre + RGBA offset
        if (dist > R + 0.5) { data[idx + 3] = 0; continue; }   // outside the disc → transparent
        const [r, g, bl] = hslToRgb([(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, dist >= R ? 1 : dist / R, L]);   // hue from angle, sat from radius
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = bl; data[idx + 3] = 255;   // write opaque pixel
      }
    }
    dctx.putImageData(img, 0, 0);                   // blit the computed pixels into the offscreen disc
  }
  // The full wheel render: disc + spokes + partner/free/base/pop nodes + focus ring + role badges + link ring.
  function draw() {
    const b = baseHex();                          // the seed colour
    const [h, s] = rgbToHsl(hexToRgb(b));          // its hue + saturation (where the base node sits)
    // Chrome (spokes/rings/halo) reads from the §3 token set (re-read each draw so a theme toggle is
    // reflected); the HSV disc + node fills are colour *data*. Node outlines use a per-node contrast
    // (textOn) so they stay visible on any colour in both the light and forge-dark themes (§3.1/§10).
    const cs = getComputedStyle(document.documentElement);   // live CSS variables (theme-aware)
    const spoke = cs.getPropertyValue('--border-strong').trim() || '#888';   // spoke colour token
    ctx.clearRect(0, 0, W, H);
    buildDisc(); ctx.drawImage(disc, 0, 0, W, H);   // filled HSV colour field (replaces the dotted hue ring)
    const offs = HARMONY_OFFSETS[state.harmony];    // this harmony's partner hue offsets (degrees)
    const hueH = isHueHarmony(state.harmony);   // value harmonies (shades/mono) have no ring partners to draw
    ctx.strokeStyle = spoke; ctx.lineWidth = 1.5;
    const spokeTo = (hh, ss) => { const [x, y] = pos(hh, ss); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); };   // draw a spoke from centre to a node
    spokeTo(h, s);                                          // base — a spoke to every colour (Adobe-style)
    if (hueH) for (const o of offs) if (!state.dropOffsets.includes(o)) spokeTo(h + o, s);   // hue partners (skip detached)
    for (const o of state.extraNodes) spokeTo(o.h, o.s);   // free/added
    // Partner NODES (filled discs), skipping any the user detached; outline via textOn for contrast.
    if (hueH) for (const o of offs) { if (state.dropOffsets.includes(o)) continue; const [x, y] = pos(h + o, s), ph = rotateHue(b, o); ctx.fillStyle = ph; ctx.beginPath(); ctx.arc(x, y, NODE.part, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = textOn(ph); ctx.stroke(); }
    const accent = cs.getPropertyValue('--accent').trim() || '#7C3AED';   // accent token for selection/pop rings
    if (popNodeOn()) {   // neutral mode: the pop node is the wheel's draggable accent (the seed sits at the hueless centre)
      const pop = activePop(), [ph, psat] = rgbToHsl(hexToRgb(pop)), [px, py] = pos(ph, psat);   // pop colour + position
      spokeTo(ph, psat);
      ctx.fillStyle = pop; ctx.beginPath(); ctx.arc(px, py, NODE.base, 0, 7); ctx.fill();   // pop node
      ctx.lineWidth = 3; ctx.strokeStyle = accent; ctx.stroke();   // accent ring marks it as interactive
    }
    // Free/added NODES: filled with their own colour, thicker ring when locked, accent outline.
    for (const o of state.extraNodes) { const [fx, fy] = pos(o.h, o.s); ctx.fillStyle = rgbToHex(hslToRgb([o.h, o.s, o.l ?? state.wheelL])); ctx.beginPath(); ctx.arc(fx, fy, NODE.part, 0, 7); ctx.fill(); ctx.lineWidth = o.locked ? 3.5 : 2.5; ctx.strokeStyle = accent; ctx.stroke(); }
    // BASE node last so it sits on top; filled with the seed, outlined for contrast.
    const [bx, by] = pos(h, s); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(bx, by, NODE.base, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = textOn(b); ctx.stroke();
    // Keyboard focus halo around the active node (only while focused and not mid-drag).
    if (focused && !dragging) { const ns = hitNodes(), n = ns[Math.min(activeIdx, ns.length - 1)]; if (n) { ctx.beginPath(); ctx.arc(n.x, n.y, NODE.base + 6, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = accent; ctx.stroke(); } }
    // Role badges: stamp P / A / 2 on the node that plays each role, so the wheel says which is the
    // Primary/Accent/Secondary (legend below decodes it). Token pair (--accent / --on-accent + --surface
    // ring) → legible on any node colour in both themes; clamped inside the disc so a rim node's badge
    // can't fall off the edge. The map is keyed by drawn hex, so it's correct in accent-seed mode too.
    const rg = wheelRoleGlyphs();   // map of which node hex gets which P/A/2 badge
    if (Object.keys(rg).length) {
      const surf = cs.getPropertyValue('--surface').trim() || '#fff';   // badge ring colour
      const onAcc = cs.getPropertyValue('--on-accent').trim() || '#fff';   // badge text colour
      const r = COARSE ? 10 : 8.5;   // badge radius (bigger on touch)
      for (const n of hitNodes()) {
        const nh = nodeHex(n).toUpperCase();
        const g = rg[nh]; if (!g) continue;   // this node doesn't carry a role → skip
        let bxr = n.x + 12, byr = n.y - 12;   // badge sits up-and-right of the node
        const vx = bxr - cx, vy = byr - cy, dd = Math.hypot(vx, vy), lim = R - r - 1;   // clamp inside the disc rim
        if (dd > lim) { bxr = cx + vx / dd * lim; byr = cy + vy / dd * lim; }   // pull it back in if it would overflow
        ctx.beginPath(); ctx.arc(bxr, byr, r, 0, 7); ctx.fillStyle = accent; ctx.fill();   // accent disc
        ctx.lineWidth = 2; ctx.strokeStyle = surf; ctx.stroke();   // surface-coloured ring for separation
        ctx.fillStyle = onAcc; ctx.font = '700 ' + (COARSE ? 12 : 10) + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g, bxr, byr);   // the P/A/2 glyph
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';   // reset so later canvas text is unaffected
      }
    }
    // Colour link (hover a role/column elsewhere): ring whichever node is that same colour — recomputing
    // each node's drawn hex the way it's filled, so the match is exact (no wheelL/rounding drift).
    if (state.hiHex) for (const n of hitNodes()) {
      if (nodeHex(n).toUpperCase() === state.hiHex) { ctx.beginPath(); ctx.arc(n.x, n.y, NODE.base + 5, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = accent; ctx.stroke(); }   // ring the linked node
    }
  }
  /** A node's drawn hex, matching how it's filled — the single mapping for badges/link rings/announce. */
  const nodeHex = n => n.kind === 'base' ? baseHex() : n.kind === 'pop' ? activePop()
    : n.kind === 'partner' ? rotateHue(baseHex(), n.deg)                                   // partner = base rotated
    : rgbToHex(hslToRgb([n.h, n.s, state.extraNodes[n.idx]?.l ?? state.wheelL]));           // free = its own hsl
  wheelDraw = draw;          // expose the redraw for discrete base/harmony changes (picker, hex, harmony)
  let raf = 0;               // requestAnimationFrame handle so we coalesce redraws to one per frame
  function commit() {
    ensureHarmonyMode();   // cheap no-op unless the drag just crossed the neutral boundary (strip/banner swap)
    // Coalesce the heavy redraw (≈nearest-paint scans + canvas) to one per frame, and debounce the
    // history write + aria-live — a drag fires pointermove far faster than WebKit's ~100-calls-per-30s
    // replaceState limit (which would throw mid-drag) and faster than a screen reader can speak.
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); renderLive(); renderHero(false); });   // no pop during a live drag
    scheduleUrlUpdate(); scheduleAnnounce();   // debounced URL save + screen-reader announce
  }
  /** True when the wheel's draggable accent node is the neutral-mode pop (pop-bearing schemes only). */
  const popNodeOn = () => isNeutralHarmony(state.harmony) && state.harmony !== 'warm-cool';
  /** Drag/nudge the pop: hue + saturation from the wheel, lightness preserved (POP_MIN_S keeps it a pop). */
  function setPop(h, s) {
    const l = rgbToHsl(hexToRgb(activePop()))[2];   // keep the pop's current lightness
    state.popHex = rgbToHex(hslToRgb([((h % 360) + 360) % 360, Math.max(POP_MIN_S, Math.min(1, s)), l]));   // clamp sat so it stays a vivid pop
    renderPops();   // update the active pop chip
    commit();
  }
  function setBase(h, s) {
    // Adobe-style: moving the base moves everything. Partners are derived (they already follow);
    // free nodes are absolute, so rotate them by the base's hue delta to keep their relationship.
    const dh = ((h - rgbToHsl(hexToRgb(baseHex()))[0]) % 360 + 360) % 360;   // how far the base's hue moved
    if (dh && state.extraNodes.length) state.extraNodes = state.extraNodes.map(n => n.locked ? n : { ...n, h: ((n.h + dh) % 360 + 360) % 360 });   // carry unlocked free nodes along by that delta
    state.customHex = rgbToHex(hslToRgb([h, s, state.wheelL]));   // the new seed is a raw hex now (not a paint)
    $('#hex').value = state.customHex.replace('#', '');   // reflect in the hex field
    commit();
  }
  // Pointer helpers: screen → canvas px, and screen → polar [hue, saturation].
  const pointerXY = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const pointerPolar = e => { const [px, py] = pointerXY(e), dx = px - cx, dy = py - cy; return [(Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, Math.max(0, Math.min(1, Math.hypot(dx, dy) / R))]; };
  function hitNodes() {                  // every grabbable node: kind, its hue/sat, and screen position
    const [h, s] = rgbToHsl(hexToRgb(baseHex())), [bx, by] = pos(h, s);
    const ns = [{ kind: 'base', h, s, x: bx, y: by }];   // base is always present
    if (isHueHarmony(state.harmony)) HARMONY_OFFSETS[state.harmony].forEach(o => { if (state.dropOffsets.includes(o)) return; const ph = ((h + o) % 360 + 360) % 360, [x, y] = pos(ph, s); ns.push({ kind: 'partner', deg: o, h: ph, s, x, y }); });   // hue partners (skip detached)
    if (popNodeOn()) { const [ph, psat] = rgbToHsl(hexToRgb(activePop())), [x, y] = pos(ph, psat); ns.push({ kind: 'pop', h: ph, s: psat, x, y }); }   // neutral-mode pop
    state.extraNodes.forEach((o, i) => { const [x, y] = pos(o.h, o.s); ns.push({ kind: 'free', idx: i, h: o.h, s: o.s, x, y }); });   // free/added
    return ns;
  }
  function pickNode(e) {                 // nearest node within the touch-safe hit radius (free > partner > base on a tie)
    const [px, py] = pointerXY(e);
    let best = null;
    hitNodes().forEach((n, i) => {
      const d = Math.hypot(n.x - px, n.y - py); if (d > NODE.hit) return;   // outside grab radius → ignore
      const pri = n.kind === 'free' || n.kind === 'pop' ? 0 : n.kind === 'partner' ? 1 : 2;   // tie-break priority (lower wins)
      if (!best || d < best.d - 4 || (d < best.d + 4 && pri < best.pri)) best = { ...n, d, pri, index: i };   // closest, or higher-priority within 4px
    });
    return best;
  }
  let active = null, dragging = false, activeIdx = 0, focused = false;   // current drag target / drag flag / keyboard cursor / focus flag
  function applyDrag(e) {                // route the drag to whichever node was grabbed
    const [ph, ps] = pointerPolar(e);   // pointer as [hue, saturation]
    if (active && active.kind === 'partner') setBase((ph - active.deg + 360) % 360, ps);   // rotate the whole harmony rigidly
    else if (active && active.kind === 'free') { state.extraNodes[active.idx] = { h: ph, s: ps }; commit(); }   // move just this free node
    else if (active && active.kind === 'pop') setPop(ph, ps);   // neutral mode: the pop is the draggable accent
    else setBase(ph, ps);               // base node, or empty space → move the base
  }
  // Pointer drag lifecycle: down grabs a node + captures the pointer; move drags; up settles (save URL + announce).
  cv.addEventListener('pointerdown', e => { collapseBanner(); dragging = true; active = pickNode(e); activeIdx = active ? active.index : 0; cv.style.cursor = 'grabbing'; cv.setPointerCapture(e.pointerId); applyDrag(e); });   // interacting with the wheel dismisses the explainer — it must never block a drag
  cv.addEventListener('pointermove', e => { if (dragging) applyDrag(e); });
  cv.addEventListener('pointerup', () => { dragging = false; active = null; cv.style.cursor = 'grab'; updateUrl(); announce(); });
  // --- keyboard operability (WCAG): focus the wheel, then arrows adjust the active node, [ ] cycle, +/- add/remove ---
  function announceActive() {   // speak the keyboard-active node's role/label/hex/nearest-paint via aria-live
    const ns = hitNodes(); if (!ns.length) return;
    const n = ns[Math.min(activeIdx, ns.length - 1)];   // the node under the keyboard cursor
    const label = n.kind === 'base' ? 'Base' : n.kind === 'free' ? 'Added colour' : n.kind === 'pop' ? 'Pop accent' : `Partner ${Math.round(n.deg)} degrees`;
    const hex = n.kind === 'pop' ? activePop() : rgbToHex(hslToRgb([n.h, n.s, state.wheelL]));   // the node's colour
    const dhex = nodeHex(n).toUpperCase();
    const rgl = wheelRoleGlyphs()[dhex];                         // name the role for non-visual users
    const role = rgl === 'P' ? 'Primary, ' : rgl === 'A' ? 'Accent, ' : rgl === '2' ? 'Secondary, ' : '';
    const sp = basePaint();   // the pick wins exact ties in the announcement too (must agree with the Plan)
    const aOpts = sp && hex.toUpperCase() === sp.hex.toUpperCase() ? { ...matchOpts(), preferIds: new Set([sp.id]) } : matchOpts();
    const m = nearestPaint(state.idx, hex, aOpts);   // nearest real paint to announce
    $('#status').textContent = m ? `${role}${label}, ${hex}, nearest ${m.paint.dname || m.paint.name}, ΔE ${m.deltaE.toFixed(1)}.` : `${role}${label}, ${hex}, no close paint.`;
  }
  function nudgeActive(dh, ds) {   // shift the active node by (Δhue, Δsat), routed like a drag
    const ns = hitNodes(); activeIdx = Math.min(activeIdx, ns.length - 1);
    const n = ns[activeIdx];
    const nh = ((n.h + dh) % 360 + 360) % 360, nsv = Math.max(0, Math.min(1, n.s + ds));   // new hue (wrapped) + sat (clamped)
    if (n.kind === 'free') { state.extraNodes[n.idx] = { h: nh, s: nsv }; commit(); }   // move just this free node
    else if (n.kind === 'pop') setPop(nh, nsv);
    else setBase(n.kind === 'partner' ? ((nh - n.deg) % 360 + 360) % 360 : nh, nsv);   // partner → move base so the partner lands here
  }
  // Focus/blur repaint (show/hide the focus halo); focus also announces the active node.
  cv.addEventListener('focus', () => { focused = true; const ns = hitNodes(); activeIdx = Math.min(activeIdx, ns.length - 1); announceActive(); draw(); });
  cv.addEventListener('blur', () => { focused = false; draw(); });
  cv.addEventListener('keydown', e => {   // arrows nudge; [ ] cycle nodes; +/- add/remove free nodes (Shift = bigger step)
    const len = hitNodes().length, big = e.shiftKey ? 5 : 1;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': nudgeActive(-2 * big, 0); break;    // hue down
      case 'ArrowRight': nudgeActive(2 * big, 0); break;    // hue up
      case 'ArrowUp': nudgeActive(0, 0.04 * big); break;    // more saturated
      case 'ArrowDown': nudgeActive(0, -0.04 * big); break; // less saturated
      case '[': activeIdx = (activeIdx - 1 + len) % len; announceActive(); draw(); break;   // previous node
      case ']': activeIdx = (activeIdx + 1) % len; announceActive(); draw(); break;         // next node
      case '+': case '=': addFreeNode(); activeIdx = hitNodes().length - 1; announceActive(); draw(); break;   // add + focus it
      case '-': case '_': removeFreeNode(); activeIdx = Math.min(activeIdx, hitNodes().length - 1); announceActive(); draw(); break;   // remove last
      default: handled = false;
    }
    if (handled) e.preventDefault();   // only swallow keys we acted on
  });
  $('#wl').addEventListener('input', e => { state.wheelL = +e.target.value / 100; const [h, s] = rgbToHsl(hexToRgb(baseHex())); setBase(h, s); });   // lightness slider → re-seed at the new L
  $('#wrand').addEventListener('click', () => setBase(Math.random() * 360, 0.5 + Math.random() * 0.45));   // ↻ Generate: random-ish seed
  measure();   // initial sizing
  draw();      // initial paint
  let rtimer = 0;   // re-measure + redraw when the responsive canvas box changes (resize / orientation / stack)
  window.addEventListener('resize', () => { clearTimeout(rtimer); rtimer = setTimeout(() => { measure(); draw(); }, 150); });   // debounced resize
}
// Equivalents tab: for the source colour, list the closest real paints in OTHER brands (cross-brand matches).
function renderEquiv() {
  const srcHex = equivSourceHex();   // the colour being drilled into (seed by default, or a clicked column)
  const p = basePaint();             // the picked paint (null for raw-hex seed)
  // When the source is the seed AND the seed is a real paint, keep the richer view (curated interchangeable
  // group + that paint's cross-brand equivalents). Any other selected column resolves to its ideal colour.
  if (p && srcHex === (baseHex() || '').toUpperCase()) {
    const self = state.idx.byId.get(p.id);
    const members = groupMembers(state.idx, self);                 // curated equivalents (ΔE ≤ 1)
    const memberIds = new Set(members.map(m => m.id));             // to de-dupe against the ranked list
    const label = groupOf(state.idx, self)?.label || 'this colour';   // the equivalence group's label
    const eq = equivalents(state.idx, self, { n: 8 }).filter(e => !memberIds.has(e.paint.id));   // avoid dupes
    $('#panel-equiv').innerHTML = ui.equivGroup(label, members, store.markOf)                     // "interchangeable" block
      + ui.equivalentsPanel(`${p.dname || p.name} (${p.brand})`, eq, store.markOf);               // + ranked cross-brand list
  } else {
    const role = (state.roleByHex || {})[srcHex];   // does this column play a named role?
    const name = role ? `${role} · ${srcHex}` : `your colour ${srcHex}`;   // name the role when the column plays one
    $('#panel-equiv').innerHTML = ui.equivalentsPanel(name, nearestPaints(state.idx, srcHex, 8), store.markOf);   // nearest 8 to the raw colour
  }
}
// Accessibility tab: colour-blindness simulation, WCAG contrast checks, and a CVD collision fix.
function renderA11y() {
  const s = state.scheme = currentScheme();   // (re)build + cache the scheme
  const colors = s.roles.map(r => r.idealHex);   // the role ideal colours
  const names = s.roles.map(r => r.role);        // their role names (parallel array)
  // Simulate how the palette looks to normal vision + the three dichromacies (Machado matrices, §7).
  const sims = [
    { label: 'Normal', colors },
    { label: 'Deuteranopia', colors: colors.map(c => simulateCvd(c, 'deuteranopia')) },
    { label: 'Protanopia', colors: colors.map(c => simulateCvd(c, 'protanopia')) },
    { label: 'Tritanopia', colors: colors.map(c => simulateCvd(c, 'tritanopia')) },
  ];
  const mk = (a, b, la, lb) => { const w = wcag(a, b); return { a, b, labelA: la, labelB: lb, ratio: w.ratio, passAAText: w.passAAText, passAALarge: w.passAALarge }; };   // one contrast row
  const contrasts = [mk(colors[0], colors[2], 'Primary', 'Accent'), mk(colors[0], '#FFFFFF', 'Primary', 'white'), mk(colors[0], '#000000', 'Primary', 'black')];   // key pairings to check
  const col = minPairDelta(colors, 'deuteranopia');   // the two roles that look MOST alike under deuteranopia
  let collision = null;
  if (col.delta < 10) {   // too close to tell apart → suggest a fix
    const [i, j] = col.pair;
    collision = { roles: [names[i], names[j]], delta: col.delta };
    // Shift whichever of the *colliding* roles is least disruptive to move — the old code
    // always rotated the Accent, so it couldn't fix e.g. a Primary/Secondary collision.
    const freedom = { Accent: 0, Secondary: 1, Metal: 2, Primary: 3 };   // lower = freer to move
    const shiftIdx = (freedom[names[i]] ?? 9) <= (freedom[names[j]] ?? 9) ? i : j;   // pick the freer of the two
    let bestMin = col.delta, best = null;
    for (const d of [25, -25, 40, -40, 55, -55]) {   // try hue rotations, keep the one that separates them most
      const trial = colors.slice();
      trial[shiftIdx] = rotateHue(colors[shiftIdx], d);
      const m = minPairDelta(trial, 'deuteranopia').delta;   // min separation after this rotation
      if (m > bestMin + 1) { bestMin = m; best = trial[shiftIdx]; }   // meaningfully better → remember it
    }
    if (best) {
      // a Metal-role swap must suggest a real metallic (all-metal pool also neutralises the colour-role demote)
      const swapOpts = names[shiftIdx] === 'Metal' ? { ...matchOpts(), types: new Set(['metal']) } : matchOpts();
      collision.suggestion = { role: names[shiftIdx], hex: best, match: nearestPaint(state.idx, best, swapOpts) };   // ideal + nearest real paint for the fix
    }
  }
  $('#panel-a11y').innerHTML = ui.a11yPanel({ names, sims, contrasts, collision });
}
const renderers = { plan: renderPlan, equiv: renderEquiv, a11y: renderA11y };   // tab id → its renderer
function renderActive() { renderers[state.tab](); }   // render whichever tab is showing

/* ---- shelf (collection) — Finder-style bulk stocking, wired to store.setMark ---- */
const COARSE = matchMedia('(pointer:coarse)').matches;   // touch = tap-to-cycle; mouse = multi-select (locked decisions)
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');   // ⌘ vs Ctrl for select-toggle
const shelf = { sel: new Set(), anchor: null, cursor: null, hover: null, selectMode: false };   // ids; selection is transient (not persisted)
// The shelf's filtered+sorted paint list (search + brand + status + type, then sort).
const shelfPaints = () => {
  const q = state.shelfQ.trim().toLowerCase();
  const list = state.idx.paints.filter(p =>
    (!state.shelfBrand || p.brand === state.shelfBrand) &&
    (!state.shelfMark || store.markOf(p.id) === state.shelfMark) &&   // status filter: '' (all) | owned | want
    (!state.shelfType || p.type === state.shelfType) &&               // type filter (base/layer/shade/metal/…)
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)   // free-text over name/brand/line/dname
       || (p.line && p.line !== '—' && p.line.toLowerCase().includes(q))
       || (p.dname && p.dname.toLowerCase().includes(q))));   // the displayed "(Line)" name is searchable too
  return sortPaints(list, state.shelfSort);
};
const cellEl = id => document.getElementById('sc-' + id);   // a shelf cell element by paint id (cells are id="sc-<id>")
const gridCols = () => { const g = $('#shelfGrid'); return Math.max(1, getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length); };   // current column count (for arrow-key navigation)

// The persistent how-to line under the stats — wording depends on touch vs mouse and select mode.
function shelfHint() {
  if (COARSE) return shelf.selectMode
    ? 'Select mode: tap swatches, then Owned / To buy / Clear below. Long-press a swatch for the menu.'
    : 'Tap a swatch to cycle owned → to buy → clear · “Select” for multi · long-press for the menu.';
  return 'Click to select · ⇧ or ⌘ for many · drag a box · then P (owned) · U (to buy) · X (clear). Right-click for options.';
}
function renderShelfStats() {   // "N owned · M to buy · T total" summary line
  const c = store.counts(), total = state.idx.paints.length;
  $('#shelfStats').innerHTML = `<span class="s-owned">${c.owned} owned</span> · <span class="s-want">${c.want} to buy</span> · ${total} total`;
}
function renderShelfBar() {   // the bulk-action bar (its buttons depend on how many cells are selected)
  $('#shelfBar').innerHTML = ui.shelfBar(shelf.sel.size);
}
function renderShelf() {   // full shelf repaint: hint + filters + grid + stats + action bar
  $('#shelfHint').textContent = shelfHint();   // persistent how-to, up under the stats (mockup feedback)
  for (const b of $('#shelfMarkSeg').children) b.setAttribute('aria-pressed', String(b.dataset.mark === state.shelfMark));   // sync status-filter segmented control
  $('#brandChips').innerHTML = ui.brandChips(state.brands, state.shelfBrand);   // brand filter chips
  $('#shelfGrid').innerHTML = ui.shelfGrid(shelfPaints(), store.markOf, shelf.sel);   // the swatch grid
  // tag each cell with a DOM id for aria-activedescendant (keyboard cursor)
  for (const c of $('#shelfGrid').children) c.id = 'sc-' + c.dataset.id;
  renderShelfStats(); renderShelfBar();
}
/** A shelf filter (brand/status/type/search) changed → membership changes, so drop the selection
 *  (its ids may no longer be visible) and re-render. Sorting uses renderShelf directly (keeps selection). */
function shelfFilterChanged() { setSelection([], { anchor: null, cursor: null }); renderShelf(); }
function announceShelf(msg) { $('#status').textContent = msg; }   // push a message to the aria-live status region

/* selection primitives — outline only (CSS), so no reflow (§3.4) */
function paintSelected() {   // reflect the selection set onto each cell's aria-selected (drives the CSS outline)
  for (const c of $('#shelfGrid').children) c.setAttribute('aria-selected', String(shelf.sel.has(c.dataset.id)));
}
function setSelection(ids, { anchor, cursor } = {}) {   // replace the selection; optionally move the anchor/cursor
  shelf.sel = new Set(ids);
  if (anchor !== undefined) shelf.anchor = anchor;   // anchor = the fixed end of a shift-range
  if (cursor !== undefined) shelf.cursor = cursor;   // cursor = the keyboard focus cell
  paintSelected(); setCursor(shelf.cursor); renderShelfBar();
}
function setCursor(id) {   // move the keyboard cursor to a cell (updates the CSS marker + aria-activedescendant)
  shelf.cursor = id;
  const g = $('#shelfGrid');
  for (const c of g.children) c.classList.toggle('cursor', c.dataset.id === id);
  if (id) { g.setAttribute('aria-activedescendant', 'sc-' + id); const c = cellEl(id); if (c) clampTip(c); }   // point AT the cell for screen readers
  else g.removeAttribute('aria-activedescendant');
}
/** Keep a cell's name tip on-screen: a tip is centred on its cell, so edge-column names would clip at
 *  the viewport (the Shelf bug on phones). Measured invisibly (the tip is display:none until shown —
 *  no paint between the style writes), then shifted via --tipdx in the tip's transform. */
function clampTip(c) {
  const tip = c.querySelector('.celltip'); if (!tip) return;
  tip.style.cssText = 'display:block;visibility:hidden';   // make it measurable without showing it
  const w = tip.offsetWidth;                                // its natural width
  tip.style.cssText = '';                                   // restore (back to display:none)
  const r = c.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  const ideal = r.left + r.width / 2 - w / 2;             // where the centred tip's left edge would land
  const dx = ideal < 8 ? 8 - ideal : ideal + w > vw - 8 ? vw - 8 - (ideal + w) : 0;   // nudge in if it would clip
  if (dx) tip.style.setProperty('--tipdx', dx.toFixed(1) + 'px');   // CSS reads this as the tip's horizontal offset
}
function rangeIds(aId, bId) {   // the ids between two cells in display order (for shift-range selection)
  const list = shelfPaints().map(p => p.id);
  let i = list.indexOf(aId), j = list.indexOf(bId);
  if (i < 0) i = j; if (i < 0 || j < 0) return bId ? [bId] : [];   // missing anchor → just the target
  if (i > j) [i, j] = [j, i];   // normalise order
  return list.slice(i, j + 1);
}
/** Apply a mark ('owned'|'want'|'none') to the current selection (or the cursor/hover cell as a fallback). */
function applyMark(mark) {
  let ids = [...shelf.sel];
  if (!ids.length) { const f = shelf.cursor || shelf.hover; if (f) ids = [f]; }   // nothing selected → act on cursor/hover
  if (!ids.length) return;
  for (const id of ids) {
    store.setMark(id, mark);   // persist the mark
    const c = cellEl(id); if (c) { updateCell(c, mark); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }   // update the cell + retrigger the flash animation
  }
  renderShelfStats();
  const verb = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'cleared';
  announceShelf(`${ids.length} ${ids.length === 1 ? 'paint' : 'paints'} marked ${verb}.`);   // screen-reader feedback
  // If a status filter is active and these paints no longer match it, drop them from view.
  if (state.shelfMark && state.shelfMark !== mark) { setSelection([], { anchor: null, cursor: null }); renderShelf(); }
}
// Update a single shelf cell in place (no full re-render → no reflow/jiggle, §3.4): mark + badge + label.
function updateCell(c, mark) {
  c.dataset.mark = mark;               // drives the cell's CSS state
  c.querySelector('.cbadge')?.remove();   // drop the old owned/to-buy badge
  const html = ui.markBadge(mark);     // new badge markup (empty for 'none')
  if (html) c.querySelector('.celltip').insertAdjacentHTML('beforebegin', html);   // insert it before the name tip
  const st = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned';
  c.setAttribute('aria-label', c.getAttribute('aria-label').replace(/—.*$/, '— ' + st));   // refresh the trailing status in the label
}

/* mouse: click-select + marquee drag (mouse only; touch uses tap-to-cycle) */
function setupShelf() {
  const grid = $('#shelfGrid');
  // Track which cell the pointer is over (fallback target for marks) and keep its name tip on-screen.
  grid.addEventListener('pointerover', e => { const c = e.target.closest('.cell'); shelf.hover = c ? c.dataset.id : null; if (c) clampTip(c); });
  grid.addEventListener('pointerout', e => { if (!e.relatedTarget || !grid.contains(e.relatedTarget)) shelf.hover = null; });   // clear only when leaving the grid entirely
  grid.addEventListener('focusin', e => { const c = e.target.closest('.cell'); if (c) clampTip(c); });   // keyboard focus also clamps the tip

  if (COARSE) {                                  // touch: tap-to-cycle, or Select-mode multi-select; long-press → menu
    let lpTimer = null, sx = 0, sy = 0, suppressTap = false;   // long-press timer, start point, and "swallow the tap" flag
    const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    grid.addEventListener('pointerdown', e => {
      const c = e.target.closest('.cell'); if (!c) return;
      sx = e.clientX; sy = e.clientY; suppressTap = false;   // remember where the press started
      lpTimer = setTimeout(() => {               // long-press → context menu for this cell (any mode)
        lpTimer = null; suppressTap = true;      // mark so the following click is ignored
        if (!shelf.sel.has(c.dataset.id)) setSelection([c.dataset.id], { anchor: c.dataset.id, cursor: c.dataset.id });   // select it if it wasn't
        openMenu(e.clientX, e.clientY);
      }, 500);                                   // 500ms = long press
    });
    grid.addEventListener('pointermove', e => { if (lpTimer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancelLP(); });   // moved too far → it's a scroll, not a long-press
    grid.addEventListener('pointerup', cancelLP);
    grid.addEventListener('pointercancel', cancelLP);
    grid.addEventListener('click', e => {
      const c = e.target.closest('.cell'); if (!c) return;
      if (suppressTap) { suppressTap = false; return; }   // long-press already handled this tap
      if (shelf.selectMode) {                    // tap toggles selection (bulk-mark via the action bar)
        const s = new Set(shelf.sel); s.has(c.dataset.id) ? s.delete(c.dataset.id) : s.add(c.dataset.id);
        setSelection(s, { anchor: c.dataset.id, cursor: c.dataset.id });
      } else {                                    // tap cycles this swatch's mark (approach C)
        const next = { none: 'owned', owned: 'want', want: 'none' }[c.dataset.mark || 'none'];   // none → owned → want → none
        store.setMark(c.dataset.id, next); updateCell(c, next);
        c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');   // retrigger the flash animation
        renderShelfStats();
        if (state.shelfMark && state.shelfMark !== next) renderShelf();   // dropped out of the active status filter
      }
    });
    return;   // touch path is fully wired — skip the mouse marquee code below
  }

  // Mouse path: Finder-style click-select + shift-range + ⌘/Ctrl-toggle + marquee drag-box.
  let down = null, marquee = null, base = null, moved = false, dragRects = null;   // press info, the drag rectangle el, pre-drag selection, moved flag, cached cell rects
  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;                   // left button only (right-click → context menu)
    // On macOS, Ctrl+click IS the system secondary-click (fires contextmenu) — so use ⌘ (meta) as the
    // multi-select toggle there, and Ctrl elsewhere. Avoids a Ctrl+click both toggling AND opening the menu.
    const toggle = IS_MAC ? e.metaKey : e.ctrlKey;
    const c = e.target.closest('.cell');
    down = { x: e.clientX, y: e.clientY, id: c ? c.dataset.id : null, shift: e.shiftKey, meta: toggle };   // snapshot the press
    base = (down.shift || down.meta) ? new Set(shelf.sel) : new Set();   // additive drag keeps the existing selection
    moved = false; dragRects = null; grid.setPointerCapture(e.pointerId);
  });
  grid.addEventListener('pointermove', e => {
    if (!down) return;
    if (!moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return;   // movement threshold → drag
    moved = true;
    const r = grid.getBoundingClientRect();
    if (!marquee) {   // first move of this drag → create the marquee box + snapshot cell positions
      marquee = document.createElement('div'); marquee.className = 'marquee'; grid.appendChild(marquee);
      // snapshot cell rects once — they don't move during a captured drag, so we avoid a 554× layout read per move
      dragRects = [...grid.children].filter(el => el !== marquee).map(el => ({ id: el.dataset.id, b: el.getBoundingClientRect() }));
    }
    const x0 = Math.min(down.x, e.clientX), y0 = Math.min(down.y, e.clientY), x1 = Math.max(down.x, e.clientX), y1 = Math.max(down.y, e.clientY);   // the drag rectangle in screen coords
    marquee.style.left = (x0 - r.left) + 'px'; marquee.style.top = (y0 - r.top) + 'px';   // position the box (grid-relative)
    marquee.style.width = (x1 - x0) + 'px'; marquee.style.height = (y1 - y0) + 'px';
    const hit = new Set(base);   // start from the pre-drag selection
    for (const { id, b } of dragRects) {
      if (id && b.right > x0 && b.left < x1 && b.bottom > y0 && b.top < y1) hit.add(id);   // any cell overlapping the box
    }
    shelf.sel = hit; paintSelected(); renderShelfBar();
  });
  grid.addEventListener('pointerup', e => {
    if (!down) return;
    if (marquee) { marquee.remove(); marquee = null; }   // tear down the drag box
    if (!moved) {                                  // a click, not a drag → Finder selection rules
      const id = down.id;
      if (!id) setSelection([], { anchor: null, cursor: null });   // clicked empty space → clear
      else if (down.shift && shelf.anchor) setSelection(rangeIds(shelf.anchor, id), { cursor: id });   // shift → range from anchor
      else if (down.meta) { const s = new Set(shelf.sel); s.has(id) ? s.delete(id) : s.add(id); setSelection(s, { anchor: id, cursor: id }); }   // ⌘/Ctrl → toggle one
      else setSelection([id], { anchor: id, cursor: id });   // plain click → select just this one
    } else {
      shelf.anchor = down.id || shelf.anchor; setCursor(down.id || shelf.cursor); renderShelfBar();   // after a marquee, set the anchor/cursor
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

let menuOpen = false;   // is the shelf right-click menu showing?
function openMenu(x, y) {   // show the shelf context menu at (x,y), clamped inside the viewport
  const m = $('#shelfMenu'); m.hidden = false; menuOpen = true;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, innerWidth - w - 8) + 'px';   // keep it on-screen horizontally
  m.style.top = Math.min(y, innerHeight - h - 8) + 'px';   // …and vertically
  m.querySelector('button')?.focus();   // focus the first item for keyboard use
}
function closeMenu() { if (menuOpen) { $('#shelfMenu').hidden = true; menuOpen = false; $('#shelfGrid').focus(); } }   // hide it + return focus to the grid

/** Lightroom-style keyboard triage; active only in shelf mode, ignored while typing in a field. */
function shelfKeydown(e) {
  if (state.mode !== 'shelf') return;
  const ae = document.activeElement;
  // act only when the grid (or nothing) has focus — never hijack keys from chips, nav, or a text field
  if (ae && ae !== document.body && ae.id !== 'shelfGrid' && !ae.closest('#shelfGrid')) return;
  const k = e.key.toLowerCase();
  if (k === 'p') { applyMark('owned'); e.preventDefault(); }        // P → owned
  else if (k === 'u') { applyMark('want'); e.preventDefault(); }    // U → to buy
  else if (k === 'x') { applyMark('none'); e.preventDefault(); }    // X → clear
  else if (e.key === 'Escape') { if (menuOpen) closeMenu(); else setSelection([], { anchor: null }); e.preventDefault(); }   // Esc closes menu, else clears selection
  else if (e.key.startsWith('Arrow')) { moveCursor(e.key, e.shiftKey); e.preventDefault(); }   // arrows move the cursor (Shift extends)
}
function moveCursor(key, extend) {   // move the keyboard cursor within the grid; `extend` shift-selects a range
  const list = shelfPaints().map(p => p.id); if (!list.length) return;
  let i = shelf.cursor ? list.indexOf(shelf.cursor) : -1;   // current index (or -1 if no cursor yet)
  if (i < 0) i = 0;   // no cursor → start at the first cell
  else { const cols = gridCols(); i += key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : key === 'ArrowDown' ? cols : -cols; }   // step by 1 (horiz) or one row (vert)
  i = Math.max(0, Math.min(list.length - 1, i));   // clamp within the list
  const id = list[i];
  if (extend && shelf.anchor) setSelection(rangeIds(shelf.anchor, id), { cursor: id });   // Shift → extend the range
  else setSelection([id], { anchor: id, cursor: id });   // plain → move selection to the one cell
  cellEl(id)?.scrollIntoView({ block: 'nearest' });   // keep the cursor cell visible
  const p = state.idx.byId.get(id);
  announceShelf(`${p.dname || p.name}, ${p.brand}, ${store.markOf(id) === 'owned' ? 'owned' : store.markOf(id) === 'want' ? 'to buy' : 'not owned'}.`);   // announce the cell
}

/* ---- chrome (top-level UI: paint drawer, hero, URL, undo, theme, tabs, exports) ---- */
function renderList() {   // the paint drawer's swatch strip + its "N of M paints" count
  const items = filteredPaints();
  $('#list').innerHTML = ui.paintStrip(items, state.customHex ? null : state.baseId, store.markOf);   // highlight the picked paint (none for raw-hex)
  $('#count').textContent = `${items.length} of ${state.idx.paints.length} paints${store.counts().owned ? ` · ${store.counts().owned} owned` : ''}`;
}
/* ---- paint drawer: the picker as a tray that drops from the seed toolbar (overlay → no reflow, §3.4) ---- */
let paintsOpen = false, paintMenuOpen = false, paintMenuId = null;   // drawer open? · its right-click menu open? · which paint that menu targets
function openPaints() {
  paintsOpen = true;
  const d = $('#paintsDrawer'); d.hidden = false; void d.offsetWidth; d.classList.add('open');   // reflow → the CSS reveal runs
  $('#paintsBtn').setAttribute('aria-expanded', 'true');
  $('#q').focus();   // land the caret in the search field
}
function closePaints() {
  if (!paintsOpen) return;
  paintsOpen = false; closePaintMenu();   // also dismiss the drawer's context menu
  const d = $('#paintsDrawer'); d.classList.remove('open'); d.hidden = true;   // exit is instant; the drop animates on open
  $('#paintsBtn').setAttribute('aria-expanded', 'false');
}
function togglePaints() { paintsOpen ? closePaints() : openPaints(); }
function openPaintMenu(x, y) {   // show the drawer's right-click menu at (x,y), clamped on-screen
  const m = $('#paintMenu'); m.hidden = false; paintMenuOpen = true;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, innerWidth - w - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  m.querySelector('button')?.focus();
}
function closePaintMenu() { if (paintMenuOpen) { $('#paintMenu').hidden = true; paintMenuOpen = false; } }
/** Mark a paint (owned/want/none) from the drawer's right-click menu or P/U/X; matches depend on the owned set. */
function markPaint(id, mark) {
  if (!['owned', 'want', 'none'].includes(mark)) return;   // guard the mark value
  store.setMark(id, mark);   // persist
  renderList(); renderLive(); renderActive();   // owned set affects the picker + matches
  if (state.mode === 'shelf') renderShelf();
  const p = state.idx.byId.get(id);                  // announce the state change for screen readers (§3.5)
  if (p) $('#status').textContent = `${p.dname || p.name}, ${mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'not owned'}.`;
}
function paintListKeydown(e) {   // arrow/Home/End navigation + P/U/X marking + Esc within the drawer's swatch strip
  const chips = [...$('#list').querySelectorAll('.pchip')]; if (!chips.length) return;
  const cur = document.activeElement.closest ? document.activeElement.closest('.pchip') : null;   // focused chip
  let i = cur ? chips.indexOf(cur) : -1;
  const move = j => { j = Math.max(0, Math.min(chips.length - 1, j)); chips[j].focus(); chips[j].scrollIntoView({ inline: 'nearest', block: 'nearest' }); };   // focus chip j (clamped + scrolled into view)
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { move(i < 0 ? 0 : i + 1); e.preventDefault(); }   // next chip
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { move(i < 0 ? 0 : i - 1); e.preventDefault(); }   // previous chip
  else if (e.key === 'Home') { move(0); e.preventDefault(); }
  else if (e.key === 'End') { move(chips.length - 1); e.preventDefault(); }
  else if (e.key === 'Escape') { closePaints(); $('#paintsBtn').focus(); e.preventDefault(); }   // close the drawer, return focus to its trigger
  else if (cur && (k === 'p' || k === 'u' || k === 'x')) {   // mark the focused chip
    const id = cur.dataset.id;
    markPaint(id, k === 'p' ? 'owned' : k === 'u' ? 'want' : 'none');
    $('#list').querySelector(`.pchip[data-id="${CSS.escape(id)}"]`)?.focus();   // keep keyboard place after re-render
    e.preventDefault();
  }
}
function renderHero(animate = true) {   // the condensed one-line seed-identity strip above the wheel
  $('#hero').innerHTML = ui.hero(baseInfo(), animate, store.markOf, state.seedRole, neutralSeed());   // animate=false during a live drag (no pop spam)
  const wk = document.querySelector('.wkey'); if (wk) wk.hidden = state.seedRole === 'accent';   // no role badges in accent mode → hide their legend
}
let urlTimer = null, announceTimer = null;   // debounce handles for the URL write + the aria-live announce
function announce() {   // describe the current scheme in the aria-live status region
  if (announceTimer) { clearTimeout(announceTimer); announceTimer = null; }   // cancel any pending debounced call
  // The substituted-pick honesty note must reach assistive tech too, not just sighted users (§2/§3.5).
  const sub = state.tab === 'plan' && state.scheme && state.scheme.roles.find(r => r.substituted);   // did a role substitute the pick?
  const subTxt = sub ? ` Note: your pick ${sub.substituted.name} is ${sub.substituted.why}; nearest eligible paint shown.` : '';
  $('#status').textContent = `${baseInfo().name}, ${state.harmony} scheme, ${state.tab} view.` + subTxt;
}
// URL-share encoding: mirror the shareable state into the query string (Adobe-Color style). Each param is
// a compact key: c=seed hex, h=harmony, m=shelf mode, v=tab, r=accent seed, t=dark, f=show-real,
// x=added nodes (h.s.l, '!'=locked, '-'-joined), d=detached offsets, pp=neutral pop. init() decodes these.
function updateUrl() {
  if (urlTimer) { clearTimeout(urlTimer); urlTimer = null; }   // cancel any pending debounced write
  const p = new URLSearchParams();
  p.set('c', baseHex().replace('#', ''));   // c = seed colour (always present)
  p.set('h', state.harmony);                // h = harmony rule (always present)
  if (state.mode === 'shelf') p.set('m', 'shelf');   // only encode non-default values to keep URLs short
  if (state.tab !== 'plan') p.set('v', state.tab);
  if (state.seedRole === 'accent') p.set('r', 'accent');
  if (state.theme === 'dark') p.set('t', 'dark');
  if (state.showReal) p.set('f', '1');
  if (state.extraNodes.length) p.set('x', state.extraNodes.map(n => `${Math.round(n.h)}.${Math.round(n.s * 100)}.${Math.round((n.l ?? state.wheelL) * 100)}${n.locked ? '!' : ''}`).join('-'));   // each added node as h.s.l(!)
  if (state.dropOffsets.length) p.set('d', state.dropOffsets.join('.'));   // detached partner offsets
  if (state.popHex) p.set('pp', state.popHex.replace('#', ''));   // neutral mode's pop accent — share links must reproduce the scheme
  history.replaceState(null, '', '?' + p.toString());   // update the address bar without a navigation
  pushHistory();   // and snapshot for undo (this is the single chokepoint)
}

/* ---- undo / redo: snapshot the palette at each settled change (updateUrl is the single chokepoint) ---- */
const HIST = { stack: [], i: -1, busy: false };   // stack of JSON snapshots · current index · guard so applySnap doesn't re-record
function paletteSnap() {   // serialise the shareable palette state to a JSON string (the undo unit)
  return JSON.stringify({
    customHex: state.customHex || null,
    baseId: state.customHex ? null : state.baseId,   // seed is one or the other, never both
    harmony: state.harmony, seedRole: state.seedRole, showReal: state.showReal, popHex: state.popHex || null,
    extraNodes: state.extraNodes.map(n => ({ h: Math.round(n.h * 10) / 10, s: Math.round(n.s * 1000) / 1000, l: n.l ?? null, locked: !!n.locked })),   // rounded so equal palettes snapshot identically
    dropOffsets: [...state.dropOffsets],
  });
}
function pushHistory() {   // record the current palette on the undo stack (skips no-op/view-only changes)
  if (HIST.busy) return;   // don't record while an undo/redo is applying a snapshot
  const s = paletteSnap();
  if (HIST.stack[HIST.i] === s) return;            // view-only change (tab/theme) → no new palette entry
  HIST.stack.length = HIST.i + 1;                  // a fresh edit drops the redo branch
  HIST.stack.push(s); HIST.i++;
  if (HIST.stack.length > 100) { HIST.stack.shift(); HIST.i--; }   // cap history at 100 entries
  syncHistBtns();
}
function applySnap(json) {   // restore a palette snapshot into state + sync the affected controls
  const o = JSON.parse(json);
  state.customHex = o.customHex; state.baseId = o.baseId;
  state.harmony = validHarmony(o.harmony) ? o.harmony : state.harmony;   // ignore an unknown harmony id
  state.seedRole = o.seedRole === 'accent' ? 'accent' : 'main';
  state.showReal = !!o.showReal;
  state.popHex = o.popHex || null;
  state.extraNodes = (o.extraNodes || []).map(n => ({ h: n.h, s: n.s, ...(n.l != null ? { l: n.l } : {}), ...(n.locked ? { locked: true } : {}) }));   // rebuild free nodes (only include l/locked when set)
  state.dropOffsets = [...(o.dropOffsets || [])];
  state.wheelL = rgbToHsl(hexToRgb(baseHex()))[2];   // resync the wheel lightness to the restored seed
  lastNeutral = null;   // force ensureHarmonyMode (via refreshStudio) to re-sync banner/strip/pops for the restored seed
  syncSeg();
  for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === state.seedRole));   // sync Main/Accent toggle
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));   // sync ideal/real toggle
  const hx = $('#hex'); if (hx) hx.value = baseHex().replace('#', '');   // sync hex field
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);   // sync lightness slider
  syncNodeBtns();   // sync the add/delete node buttons
}
// undo/redo: step the history index, apply that snapshot (busy flag prevents re-recording), re-render.
function undo() { if (HIST.i > 0) { HIST.i--; HIST.busy = true; applySnap(HIST.stack[HIST.i]); renderAll(); HIST.busy = false; syncHistBtns(); } }
function redo() { if (HIST.i < HIST.stack.length - 1) { HIST.i++; HIST.busy = true; applySnap(HIST.stack[HIST.i]); renderAll(); HIST.busy = false; syncHistBtns(); } }
function syncHistBtns() { const u = $('#undo'), r = $('#redo'); if (u) u.disabled = HIST.i <= 0; if (r) r.disabled = HIST.i >= HIST.stack.length - 1; }   // grey out undo/redo at the ends

/** Debounced URL write for rapid-fire updates (wheel/slider drag); see setBase(). */
function scheduleUrlUpdate() {
  if (urlTimer) clearTimeout(urlTimer);
  urlTimer = setTimeout(updateUrl, 250);   // write at most every 250ms
}
/** Debounced live-region announce — a per-frame announce() during a drag floods screen readers. */
function scheduleAnnounce() {
  if (announceTimer) clearTimeout(announceTimer);
  announceTimer = setTimeout(announce, 400);   // speak at most every 400ms
}
function renderAll() { renderList(); renderHero(); refreshStudio(); renderActive(); announce(); updateUrl(); }   // full repaint of every surface

function setTheme(t) {   // switch between the light/dark colour sets (§3) + persist the choice
  state.theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;   // CSS keys its variables off [data-theme]
  store.setPref('theme', state.theme);
  const sw = document.querySelector('#themeToggle');   // keep the settings-menu theme switch in sync
  if (sw) sw.setAttribute('aria-checked', String(state.theme === 'dark'));
}
function syncLocaleSeg() {                            // reflect the active locale in the settings-menu control
  const cur = i18n.getLocale(), seg = $('#localeSeg');
  if (seg) for (const x of seg.children) x.setAttribute('aria-pressed', String(x.dataset.locale === cur));
}
function setMode(mode) {   // switch the top-level Studio ↔ Shelf view
  state.mode = mode === 'shelf' ? 'shelf' : 'studio';
  const on = state.mode === 'shelf';
  closePaints();   // the paint drawer is a Studio control; never leave it open across a mode switch
  document.querySelector('main').dataset.mode = state.mode;   // CSS hook for the active mode
  document.querySelector('.workspace').hidden = on;   // hide the Studio workspace in Shelf mode
  $('#shelf').hidden = !on;                            // …and vice-versa
  for (const b of $('#modeNav').children) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));   // sync the mode switch
  if (on) { renderShelf(); $('#shelfGrid').focus(); }   // entering Shelf: paint it + focus the grid
  else { renderList(); }   // refresh the drawer's owned state in case the shelf changed it
  updateUrl();
}
function selectPaint(id) { state.baseId = id; state.customHex = null; $('#hex').value = baseHex().replace('#', ''); renderAll(); }   // pick a dataset paint as the seed (clears any raw hex)
/** Centre the active harmony chip in the scrollable strip — horizontal only (no page jump). */
function scrollHarmonyActive() {
  const seg = $('#seg'), el = seg && seg.querySelector('button[aria-pressed="true"]');
  if (el) seg.scrollLeft = el.offsetLeft - (seg.clientWidth - el.offsetWidth) / 2;   // scroll so the active chip is centred
}
function syncTabs(focusActive = false) {   // reflect state.tab onto the tab buttons + show the matching panel
  const tabs = $('#tabs');
  for (const b of tabs.children) {
    const sel = b.dataset.tab === state.tab;
    b.setAttribute('aria-selected', String(sel));
    b.tabIndex = sel ? 0 : -1;        // roving tabindex (WAI-ARIA tabs pattern)
    if (sel && focusActive) b.focus();   // move focus to the newly-active tab when asked (keyboard nav)
    // On narrow screens the tab strip scrolls horizontally — keep the active tab in view.
    if (sel && tabs.scrollWidth > tabs.clientWidth) b.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== state.tab;   // show only the active panel
}
function setTab(tab, focusActive = false) {   // switch output tabs
  state.tab = tab;
  syncTabs(focusActive);
  renderActive(); applyEquivSelect(); announce(); updateUrl();   // show/clear the Equivalents-source ring with the tab
}
/** Toggle a paint on/off the to-buy list (#5). Owned paints have no buy control, but guard anyway. */
function toggleBuy(id) {
  if (store.isOwned(id)) return;   // owned paints aren't "to buy"
  store.setMark(id, store.isWant(id) ? 'none' : 'want');   // flip the to-buy mark
  renderLive(); renderActive(); renderHero();   // hero may show the same paint's buy state
  if (state.mode === 'shelf') renderShelf();
}
/** One click: flag every paint this scheme needs (that you don't own) as to-buy (#5). */
function addGapsToBuy() {
  let n = 0;
  for (const g of schemeGaps(state.scheme, store.ownedIds())) {   // each needed paint you don't own
    if (store.markOf(g.paint.id) !== 'want') { store.setMark(g.paint.id, 'want'); n++; }   // add if not already to-buy
  }
  toast(n ? `Added ${n} paint${n > 1 ? 's' : ''} to your buy list` : 'Nothing new to add');
  renderLive(); renderActive();
}
function setLadder(v) {                          // #7 — tone-ladder style (persisted)
  if (!['wash', 'tone', 'both'].includes(v)) return;   // guard the value
  state.ladder = v; store.setPref('ladder', v);
  renderActive();   // ladders show in the Plan tab
}
function setCollection(v) {                      // #6 — off · prefer (boost) · only (filter); persisted
  if (!['off', 'prefer', 'only'].includes(v)) return;
  state.collection = v; store.setPref('collection', v);
  renderLive(); renderActive();   // changes which paints matches consider
}
function toggleContrast() {                       // include Contrast paints in harmony suggestions (persisted)
  state.includeContrast = !state.includeContrast; store.setPref('contrast', state.includeContrast);
  renderLive(); renderActive();
}
function toast(msg) {   // brief self-dismissing status message at the bottom of the screen
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; d.setAttribute('role', 'status');   // role=status → announced
  document.body.appendChild(d); setTimeout(() => d.remove(), 1700);   // auto-remove after 1.7s
}
/** Click-to-copy for any [data-copy] element (hero hex, palette blocks). Best-effort + graceful fallback. */
function copyText(val) {
  if (navigator.clipboard) navigator.clipboard.writeText(val).then(() => toast(`Copied ${val}`)).catch(() => toast('Copy unavailable — select the value manually'));
  else toast('Copy unavailable — select the value manually');   // no clipboard API → tell the user
}
function doExport() {   // build + download a plain-text shopping list for the current scheme + to-buy list
  const s = currentScheme();
  let t = `Palette Studio for Miniatures — shopping list\nBase ${s.base} · ${s.harmony} scheme · ${s.ladder} ladder\n\n`;   // header
  for (const r of shoppingList(s)) t += `${r.role.padEnd(20)} ${r.name} (${r.brand}${r.line && r.line !== '—' ? ' ' + r.line : ''}) ${r.hex}  ΔE ${r.deltaE}${r.owned ? '  ✓ owned' : ''}\n`;   // one line per role's paint
  // The accumulated to-buy collection (#5) — the SHOP output, independent of the current scheme.
  const want = [...store.wantIds()].map(id => state.idx.byId.get(id)).filter(Boolean);
  if (want.length) {
    t += `\nYour to-buy list (${want.length}):\n`;
    for (const p of want) t += `  ${p.name} (${p.brand}${p.line && p.line !== '—' ? ' ' + p.line : ''}) ${p.hex}\n`;
  }
  t += '\nHex values are approximate; ΔE = perceptual distance to the ideal colour.\n';   // honesty footer (§2)
  const a = document.createElement('a');   // synthesise a download link + click it
  const href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }));
  a.href = href; a.download = 'palette-shopping-list.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 0); // revoke after the click's download starts
  toast('Shopping list exported');   // download is the artefact — no silent clipboard write (native-share direction)
}
/** Share the current scheme URL. Prefers the native share sheet (Web Share → OS sheet under Capacitor),
 *  then clipboard, then a visible-URL prompt. No silent clipboard side-effects. */
async function doShare() {
  const url = location.href;   // the whole scheme lives in the URL query (see updateUrl)
  if (navigator.share) {   // 1) native share sheet if available
    try { await navigator.share({ title: 'Palette Studio for Miniatures', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // user dismissed the sheet
  }
  if (navigator.clipboard) {   // 2) copy to clipboard
    try { await navigator.clipboard.writeText(url); toast('Share link copied'); return; } catch { /* fall through */ }
  }
  toast('Copy the URL from the address bar');   // 3) last resort: tell them to copy manually
}
function download(filename, text, type = 'text/plain') {   // generic "save this text as a file" helper
  const a = document.createElement('a');
  const href = URL.createObjectURL(new Blob([text], { type }));
  a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);   // revoke after the download starts
}
/** Export the collection as paintRack-compatible CSV (#27). */
function exportCollectionCsv() {
  const n = store.counts();
  if (!n.owned && !n.want) { toast('Your shelf is empty — nothing to export'); return; }   // nothing to save
  download('my-paint-shelf.csv', marksToCsv(state.idx, store.ownedIds(), store.wantIds()), 'text/csv');
  toast(`Exported ${n.owned} owned · ${n.want} to buy`);
}
/** Import a paintRack CSV (merges) or a Palette Studio JSON backup (restores) (#27). */
function importCollectionFile(file) {
  const reader = new FileReader();   // read the local file on-device (never uploaded)
  reader.onload = () => {
    const text = String(reader.result || '');
    if (/\.json$/i.test(file.name) || /^\s*[{[]/.test(text)) {   // looks like our JSON backup → full restore
      toast(store.importJSON(text) ? 'Collection restored from JSON backup' : 'Could not read that JSON file');
    } else {   // otherwise treat as paintRack CSV → merge marks
      const { matched, unmatched } = applyCsv(text);
      toast(`Imported ${matched} paint${matched === 1 ? '' : 's'}${unmatched.length ? ` · ${unmatched.length} unmatched` : ''}`);
    }
    if (state.mode === 'shelf') renderShelf();
    renderList(); renderLive(); renderActive();   // owned set changed → refresh everything that reads it
  };
  reader.onerror = () => toast('Could not read that file');
  reader.readAsText(file);
}
function applyCsv(text) {   // parse a paintRack CSV to marks and merge them onto the current shelf
  const res = csvToMarks(state.idx, text);
  res.marks.forEach(m => store.setMark(m.id, m.mark));   // merge onto the current shelf
  return res;   // {marks, unmatched}
}

/** Seed the scheme from an arbitrary hex (shared by the hex field + the photo eyedropper). */
function seedFromHex(hex) {
  state.customHex = hex.toUpperCase();   // raw-hex seed (not a dataset paint)
  $('#hex').value = state.customHex.replace('#', '');   // reflect in the hex field
  renderHero(); refreshStudio(); renderActive(); renderList(); announce(); updateUrl();   // full refresh
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
  cv.addEventListener('pointermove', onMove);   // hover → loupe preview (drag → live sample)
  cv.addEventListener('pointerdown', onDown);   // click/tap → lock the colour
  cv.addEventListener('pointerleave', () => { loupe.style.display = 'none'; });   // hide the loupe on exit; the locked colour stays
  $('#fromPhoto').addEventListener('click', () => $('#photoFile').click());   // "From photo" opens the file picker
  $('#photoFile').addEventListener('change', e => {   // a file was chosen → draw it to the canvas + open the dialog
    const f = e.target.files && e.target.files[0]; e.target.value = '';   // clear so the same file re-triggers change
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const s = Math.min(560 / img.width, 360 / img.height, 1);   // fit, never upscale
      cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));   // size the canvas
      ctx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(img.src);   // draw + free the object URL
      pick = null; useBtn.disabled = true; hexEl.textContent = '—'; chip.style.background = 'transparent'; loupe.style.display = 'none';   // reset the picker UI
      if (!dlg.open) dlg.showModal();   // open the eyedropper dialog
    };
    img.onerror = () => toast("Couldn't read that image");
    img.src = URL.createObjectURL(f);   // load the local file (on-device; never uploaded)
  });
  useBtn.addEventListener('click', () => { if (pick) { dlg.close(); seedFromHex(pick); toast(`Seeded from photo ${pick}`); } });   // "Use as base colour" → seed the scheme
  $('#edClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // backdrop click
}

// Wire every DOM event listener to its handler. Grouped by control; runs once at startup.
function wire() {
  // Paint-picker filters: search box, brand/type/sort selects → refilter the drawer list.
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
  $('#list').addEventListener('keydown', paintListKeydown);   // arrows/Home/End/P-U-X/Esc in the strip
  $('#paintMenu').addEventListener('click', e => {   // the drawer's right-click menu: mark the targeted paint
    const b = e.target.closest('[data-act]'); if (!b || !paintMenuId) return;
    const id = paintMenuId;
    markPaint(id, b.dataset.act); closePaintMenu();
    $('#list').querySelector(`.pchip[data-id="${CSS.escape(id)}"]`)?.focus();   // return focus to the marked chip
  });
  $('#paintsBtn').addEventListener('click', e => { e.stopPropagation(); togglePaints(); });   // ☰ Paints trigger opens/closes the drawer
  $('#importPaints').addEventListener('click', () => $('#importFile').click());   // Import → open the file picker
  $('#exportPaints').addEventListener('click', exportCollectionCsv);              // Export → download CSV
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
  // Delegated click handler for the whole studio/output: one listener dispatches on data-* attributes.
  $('main').addEventListener('click', e => {
    const buy = e.target.closest('[data-buy]'); if (buy) { e.stopPropagation(); toggleBuy(buy.dataset.buy); return; }   // toggle a paint's to-buy state
    const lad = e.target.closest('[data-ladder]'); if (lad) { setLadder(lad.dataset.ladder); return; }
    const col = e.target.closest('[data-collection]'); if (col) { setCollection(col.dataset.collection); return; }
    const mv = e.target.closest('[data-move]'); if (mv) { e.stopPropagation(); const [i, dir] = mv.dataset.move.split(':').map(Number); moveFreeNode(i, i + dir); return; }  // reorder (keyboard/touch path)
    const lk = e.target.closest('[data-lock]'); if (lk) { e.stopPropagation(); lockSwatch(lk.dataset.lock); return; }              // lock / unlock a swatch
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); openSwatchEditor(ed.dataset.edit); return; }        // edit a swatch's hex
    const sb = e.target.closest('[data-setbase]'); if (sb) { e.stopPropagation(); seedFromHex(sb.dataset.setbase); return; }   // promote a swatch to the base colour
    const dn = e.target.closest('[data-delnode]'); if (dn) { e.stopPropagation(); removeFreeNode(+dn.dataset.delnode); return; }  // delete an added swatch
    if (state.tab === 'equiv') {   // on the Equivalents tab, clicking a palette column drills into that colour's matches
      const lc = e.target.closest('.lcol[data-hex]');   // …but not when the click is the column's copy button (handled below)
      if (lc && !e.target.closest('.lccopy')) { e.stopPropagation(); setEquivSource(lc.dataset.hex); return; }
    }
    if (e.target.closest('#inclContrast')) { toggleContrast(); return; }   // "include Contrast paints" toggle
    if (e.target.closest('#addGaps')) { addGapsToBuy(); return; }          // "add all gaps to buy" button
    const c = e.target.closest('[data-copy]'); if (c) copyText(c.dataset.copy);   // click-to-copy a hex/value
  });
  // Hex input: strip to 6 hex digits and, when complete, seed the scheme from it.
  $('#hex').addEventListener('input', e => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();   // sanitise to hex chars
    e.target.value = v;
    if (v.length === 6) seedFromHex('#' + v);   // a complete hex → re-seed
  });
  // Harmony strip: pick a harmony (disabled chips just announce why, e.g. hue harmonies under a neutral seed).
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { $('#status').textContent = b.title; return; }   // announce the why, change nothing
    state.harmony = b.dataset.h;
    state.dropOffsets = [];   // new harmony → fresh partners; any locked/edited swatches persist as free nodes
    for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));   // sync the active chip
    scrollHarmonyActive();
    refreshStudio(); renderActive(); announce(); updateUrl();
  });
  // Quick pops (neutral mode): each chip just moves the wheel's pop node — not a second system.
  $('#pops').addEventListener('click', e => {
    const b = e.target.closest('[data-pop]'); if (b) setPopHex(b.dataset.pop);
  });
  // Neutral banner overlay: the banner collapses on click (and on its own after a beat); the pill re-expands it.
  $('#neutralBanner').addEventListener('click', collapseBanner);
  $('#neutralPill').addEventListener('click', expandBanner);
  // Cross-surface colour link: hover/focus a role block (Plan) or a live column → ring that colour everywhere.
  const ws = document.querySelector('.workspace');
  ws.addEventListener('mouseover', e => { const el = e.target.closest('[data-hex]'); linkHighlight(el ? el.dataset.hex : null); });
  ws.addEventListener('mouseleave', () => linkHighlight(null));
  ws.addEventListener('focusin', e => { const el = e.target.closest('[data-hex]'); linkHighlight(el ? el.dataset.hex : null); });
  ws.addEventListener('focusout', e => { if (!e.relatedTarget || !e.relatedTarget.closest('[data-hex]')) linkHighlight(null); });
  ws.addEventListener('keydown', e => {   // keyboard path for the Equivalents drill-down (the swatch is role="button" there)
    if (state.tab !== 'equiv' || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (e.target.closest('.lccopy')) return;                       // the copy button activates itself
    const top = e.target.closest('.lctop[role="button"]'); if (!top) return;
    const lc = top.closest('.lcol[data-hex]'); if (!lc) return;
    e.preventDefault(); setEquivSource(lc.dataset.hex);
  });
  // Ideal↔real toggle: fill live-palette columns with the ideal colour or the nearest real paint.
  $('#realtoggle').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.showReal = b.dataset.fill === 'real';
    for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));   // sync the segmented control
    renderLive(); scheduleAnnounce(); updateUrl();
  });
  $('#addnode').addEventListener('click', addFreeNode);          // + add a swatch along the value ramp
  $('#delnode').addEventListener('click', () => removeFreeNode());   // − remove the last added swatch
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#swEdit').addEventListener('change', e => { if (swEditTarget) { editSwatch(swEditTarget, e.target.value.toUpperCase()); swEditTarget = null; } });   // native colour picker committed → apply to the target swatch
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
  // Output tabs: click to switch; arrow/Home/End keyboard nav (WAI-ARIA tabs pattern).
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
  $('#tabs').addEventListener('keydown', e => {
    const tabs = [...$('#tabs').children];
    const i = tabs.findIndex(b => b.dataset.tab === state.tab);   // current tab index
    let j = -1;   // target index (-1 = key not handled)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j >= 0) { e.preventDefault(); setTab(tabs[j].dataset.tab, true); }   // switch + move focus
  });
  // Seed-role toggle: is the seed the scheme's Main or Accent (entry mode C)? Disabled for neutral seeds.
  $('#seedRole').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { $('#status').textContent = b.title; return; }   // neutral seed → Primary only
    state.seedRole = b.dataset.role;
    for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === state.seedRole));   // sync the toggle
    renderHero(); refreshStudio(); renderActive(); announce(); updateUrl();
  });
  // Compare: pin the current scheme as "A", then change the scheme to see A-vs-current; click again to clear.
  $('#compare').addEventListener('click', () => {
    if (state.compareA) { state.compareA = null; $('#compare').setAttribute('aria-pressed', 'false'); }   // unpin
    else { const s = currentScheme(); state.compareA = { base: schemeBase(), harmony: state.harmony, colors: s.roles.map(r => r.idealHex) }; $('#compare').setAttribute('aria-pressed', 'true'); setTab('plan'); toast('Pinned A — change the scheme to compare'); }   // pin A
    if (state.tab === 'plan') renderPlan();
  });
  $('#export').addEventListener('click', () => { doExport(); closeSettings(); });   // Export/Share live in the ⋯ menu now
  $('#share').addEventListener('click', () => { doShare(); closeSettings(); });

  // settings menu (theme lives here now) — toggle, theme control, click-outside / Esc close
  const sMenu = $('#settingsMenu'), sBtn = $('#settingsBtn');
  const openSettings = () => {   // show the ⋯ menu, positioned under its button + clamped on-screen
    sMenu.hidden = false; sBtn.setAttribute('aria-expanded', 'true');
    const r = sBtn.getBoundingClientRect();
    sMenu.style.left = Math.min(r.left, innerWidth - sMenu.offsetWidth - 8) + 'px';
    sMenu.style.top = (r.bottom + 6) + 'px';
  };
  const closeSettings = () => { sMenu.hidden = true; sBtn.setAttribute('aria-expanded', 'false'); };
  sBtn.addEventListener('click', e => { e.stopPropagation(); sMenu.hidden ? openSettings() : closeSettings(); });   // ⋯ toggles the menu
  $('#themeToggle').addEventListener('click', () => { setTheme(state.theme === 'dark' ? 'light' : 'dark'); wheelDraw(); updateUrl(); });   // flip light/dark (redraw wheel chrome)
  $('#localeSeg').addEventListener('click', e => {   // language switch (chrome strings only)
    const b = e.target.closest('button'); if (!b) return;
    i18n.setLocale(b.dataset.locale);   // persists the pref + re-applies static [data-i18n] strings
    syncLocaleSeg();
    renderHero();                       // re-render JS-built strings that use i18n.t (e.g. the base label)
  });
  document.addEventListener('pointerdown', e => { if (!sMenu.hidden && !e.target.closest('#settingsMenu') && !e.target.closest('#settingsBtn')) closeSettings(); }, true);   // click-outside closes it
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sMenu.hidden) { closeSettings(); sBtn.focus(); } });   // Esc closes it

  // shelf chrome — mode switch, brand/status/type/search filters, sort, bulk-action bar, import/export
  $('#modeNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });   // Studio ↔ Shelf
  $('#brandChips').addEventListener('click', e => {   // brand filter chip
    const b = e.target.closest('.chip'); if (!b) return;
    state.shelfBrand = b.dataset.brand;
    shelfFilterChanged();
  });
  $('#shelfQ').addEventListener('input', e => { state.shelfQ = e.target.value; shelfFilterChanged(); });   // shelf search box
  $('#shelfMarkSeg').addEventListener('click', e => {   // status filter (all / owned / to buy)
    const b = e.target.closest('button'); if (!b) return;
    state.shelfMark = b.dataset.mark;
    shelfFilterChanged();
  });
  $('#shelfType').addEventListener('change', e => { state.shelfType = e.target.value; shelfFilterChanged(); });   // type filter
  // Sorting doesn't change which paints are shown, so keep the selection — just re-render in the new order.
  $('#shelfSort').addEventListener('change', e => { state.shelfSort = e.target.value; renderShelf(); });
  $('#shelfBar').addEventListener('click', e => {   // bulk-action bar: deselect or mark the selection
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'deselect') setSelection([], { anchor: null });
    else applyMark(b.dataset.act);
  });
  $('#shelfMenu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) { applyMark(b.dataset.act); closeMenu(); } });   // context-menu mark
  $('#shelfSelect').addEventListener('click', () => {       // touch: toggle multi-select mode
    shelf.selectMode = !shelf.selectMode;
    $('#shelfSelect').setAttribute('aria-pressed', String(shelf.selectMode));
    if (!shelf.selectMode) setSelection([], { anchor: null });   // leaving select mode clears the selection
    $('#shelfHint').textContent = shelfHint();
  });
  $('#exportColl').addEventListener('click', exportCollectionCsv);   // Shelf's export button
  $('#importColl').addEventListener('click', () => $('#importFile').click());   // Shelf's import button
  $('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importCollectionFile(f); e.target.value = ''; });   // shared file input (drawer + shelf)
  document.addEventListener('pointerdown', e => { if (menuOpen && !e.target.closest('#shelfMenu')) closeMenu(); }, true);   // click-outside closes the shelf menu
  document.addEventListener('keydown', shelfKeydown);   // P/U/X + arrows triage (shelf mode only)
  setupShelf();   // bind the grid's pointer/marquee/context-menu handlers

  // About & data modal — native <dialog> handles Esc + focus trap; close on backdrop click.
  const about = $('#about');
  $('#aboutOpen').addEventListener('click', () => about.showModal());
  $('#aboutOpenMenu').addEventListener('click', () => { closeSettings(); about.showModal(); });   // second path from the ⋯ menu
  $('#aboutClose').addEventListener('click', () => about.close());
  about.addEventListener('click', e => { if (e.target === about) about.close(); });   // click outside the panel
}

// App entry point: resolve theme, load the dataset, decode the shared URL into state, wire the UI, render.
async function init() {
  const url = new URLSearchParams(location.search);   // the shared/deep-link query string
  // Theme precedence: URL param → saved pref → OS preference.
  let theme = url.get('t');
  if (!theme) theme = store.getPref('theme');   // owned/to-buy + prefs are loaded by store.js on import
  if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme);

  state.idx = await loadDataset('./data/paints.json');   // load + index the paint dataset (the only fetch)
  state.brands = [...new Set(state.idx.paints.map(p => p.brand))].sort();   // unique brand list for the filters
  $('#brand').insertAdjacentHTML('beforeend', ui.brandOptions(state.brands));   // populate the brand <select>
  const types = [...new Set(state.idx.paints.map(p => p.type))].sort();   // unique paint types
  const typeOpts = types.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');   // capitalised <option>s
  $('#ptype').insertAdjacentHTML('beforeend', typeOpts);        // picker type filter
  $('#shelfType').insertAdjacentHTML('beforeend', typeOpts);   // shelf type filter (same options)

  // Restore saved preferences (guarded against stale/unknown values).
  const lp = store.getPref('ladder'); if (['wash', 'tone', 'both'].includes(lp)) state.ladder = lp;
  const cp = store.getPref('collection'); if (['off', 'prefer', 'only'].includes(cp)) state.collection = cp;
  state.includeContrast = !!store.getPref('contrast');

  // Decode the shared URL into state — the inverse of updateUrl()'s encoding.
  const h = url.get('h'); if (h && validHarmony(h)) state.harmony = h;   // harmony
  const pp = url.get('pp'); if (pp && /^[0-9a-fA-F]{6}$/.test(pp)) state.popHex = '#' + pp.toUpperCase();   // neutral pop
  const v = url.get('v'); if (v && renderers[v]) state.tab = v;   // active tab
  if (url.get('f') === '1') state.showReal = true;   // ideal/real fill
  const xp = url.get('x');   // added nodes, '-'-joined "h.s.l(!)" tokens
  if (xp) state.extraNodes = xp.split('-').map(tok => {
    const locked = tok.endsWith('!'); const t = locked ? tok.slice(0, -1) : tok;   // trailing '!' = locked
    const [hh, sa, la] = t.split('.'); const H = +hh, S = +sa / 100, L = +la / 100;   // hue, sat%, light% back to fractions
    if (!(Number.isFinite(H) && Number.isFinite(S))) return null;   // drop malformed tokens
    return { h: ((H % 360) + 360) % 360, s: Math.min(1, Math.max(0, S)),   // normalise + clamp
      ...(Number.isFinite(L) ? { l: Math.min(1, Math.max(0, L)) } : {}), ...(locked ? { locked: true } : {}) };
  }).filter(Boolean).slice(0, MAX_FREE);   // discard nulls, cap at the free-node limit
  const dp = url.get('d'); if (dp) state.dropOffsets = dp.split('.').map(Number).filter(Number.isFinite);   // detached partner offsets
  if (url.get('r') === 'accent') { state.seedRole = 'accent'; for (const x of $('#seedRole').children) x.setAttribute('aria-pressed', String(x.dataset.role === 'accent')); }   // accent-seed mode
  const c = url.get('c');   // the seed colour
  if (c && /^[0-9a-fA-F]{6}$/.test(c)) state.customHex = '#' + c.toUpperCase();   // shared hex seed
  else state.baseId = state.idx.paints[0].id;   // no valid seed → default to the first paint

  ensureHarmonyMode();   // seed is now known: sync the strip (incl. neutral mode) + banner + pops
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));   // sync ideal/real toggle
  syncNodeBtns();
  $('#hex').value = baseHex().replace('#', '');   // seed the hex field
  syncTabs();
  wire();          // bind all event listeners
  i18n.apply();   // localize static chrome strings ([data-i18n] / placeholders)
  syncLocaleSeg();
  setupWheel();   // wheel is now always-visible static markup; bind it once
  setupEyedropper();
  renderAll();     // first full render
  if (url.get('m') === 'shelf') setMode('shelf');   // deep-link / refresh stays on the shelf
}

// Start the app; on a dataset-load failure show a helpful message (the app needs a web server, not file://).
init().catch(err => {
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${err.message}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
