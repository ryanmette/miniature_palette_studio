// app.js — application state, dataset loading, entry modes, tabs, conveniences, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/scheme/a11y/ui.

import { HARMONY_TYPES, isHarmony, isHueHarmony, HARMONY_OFFSETS, harmonize,
  isNeutralHarmony, neutralPartners, NEUTRAL_HARMONY_TYPES, DEFAULT_POP, POP_MIN_S, clampPop, rollHarmony } from './harmony.js';
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, rotateHue, textOn, isNeutral, labChroma, NEUTRAL_CHROMA, NEUTRAL_EXIT, normHex } from './color.js';
import { schemeBaseOf, pickForSchemeBase, swatchKeyHex, addRecent } from './seed.js';   // the pick ↔ scheme-base frame; Recent picks
import { encodeState, decodeState, shareUrl } from './share.js';   // the share-link contract (state ⇄ URL)
import { setupWheel } from './wheel.js';   // the canvas wheel — bound once, returns its redraw
import { createMarkMenu, isMenuKey } from './markmenu.js';   // the ONE mark menu: the Shelf's and the seed list's
import { setupPicker } from './picker.js';   // the seed field and its list — bound once, returns { close, refresh, isOpen }
import { simulateCvd, wcag, minPairDelta } from './a11y.js';
import { loadDataset, equivalents, nearestPaints, nearestPaint, closestPaints, paintMatcher, warmPaintSearch, FINISH_TYPES, FINISH_PENALTY, groupMembers, groupOf } from './data.js';
import { buildScheme, shoppingList, schemeGaps, roleIdeals } from './scheme.js';
import { csvToMarks, marksToCsv } from './collection-io.js';   // collection portability (#27)
import * as ui from './ui.js';
import * as store from './store.js';   // versioned, portable collection + prefs persistence (the only storage chokepoint)
import * as i18n from './i18n.js';      // lightweight UI-string localization (chrome only; paint names never translate)
import { APP_VERSION } from './version.js';   // the one app-version constant (check-docs.mjs holds it to package.json)

const t = i18n.t;

const $ = sel => document.querySelector(sel);
const state = {
  idx: null, scheme: null,
  baseId: null, customHex: null,
  harmony: 'complementary',
  seedRole: 'main', tab: 'plan', theme: 'light',
  compareA: null, wheelL: null, hiHex: null,   // hiHex = the colour link-highlighted across wheel/plan/live palette

  extraNodes: [], showReal: false,   // editable swatches [{h,s,l?,locked?}] (S5); live-palette ideal↔real fill
  dropOffsets: [],                   // harmony offsets "detached" by lock/edit so the rule stops regenerating them
  mode: 'studio', shelfBrand: '', shelfMark: '', shelfQ: '', shelfType: '', shelfSort: '', brands: [],   // Studio/Shelf mode; shelf brand · status · search · type · sort
  ladder: 'wash', collection: 'off',  // #7 tone-ladder style; how the collection drives matching: off | prefer (#6 boost) | only (hard filter)
  includeContrast: false,             // include Contrast paints in harmony suggestions (washes/shades stay excluded)
  popHex: null,                        // neutral mode's pop accent (null = DEFAULT_POP); drives the hue math when the seed is neutral
};
const OWNED_BOOST = 6;   // ΔE the soft owned-boost is "worth" — owned paints up to ~6 ΔE worse can still win (#6)
const METAL_DEMOTE = 4;  // ΔE handicap on metallics for COLOUR roles (they read differently on the model); the
                         // Metal role's all-metal pool demotes every candidate equally, so it's unaffected (§7)

/** The colour the painter PICKED. Its identity only — the hero, the seed badge, the seed field's list and
 *  the share URL. Anything that renders, hit-tests or resolves a swatch key uses schemeBase() (see seed.js). */
const pickHex = () => state.customHex || state.idx.byId.get(state.baseId)?.hex;
/** Entry mode C: when the seed is the *accent*, build the scheme around its complement. */
const schemeBase = () => schemeBaseOf(pickHex(), state.seedRole);
/** Write the SCHEME base — the wheel's frame and the palette's base column. In accent-seed mode the
 *  pick lives 180° away, so it's the pick that actually gets stored (seed.js pickForSchemeBase). */
const seedFromSchemeBase = hex => seedFromHex(pickForSchemeBase(hex, state.seedRole));
/** Accent-seed pinning (§7): in accent mode the Accent role's ideal is the picked colour verbatim,
 *  in every harmony. Null in main mode — the geometry decides. */
const accentPin = () => (state.seedRole === 'accent' ? pickHex() : null);

/* ---- neutral mode (CLAUDE.md §7 / PLAN v1.8): a neutral seed swaps the scheme engine ---- */
// Hysteresis (enter < NEUTRAL_CHROMA, exit > NEUTRAL_EXIT): a drag hovering on the boundary can't
// flip the mode per frame. ensureHarmonyMode is the only writer; everyone else reads the held mode.
let neutralMode = null;
const neutralSeed = () => neutralMode ?? isNeutral(schemeBase());
const activePop = () => state.popHex || DEFAULT_POP;
const validHarmony = t => isHarmony(t) || isNeutralHarmony(t);
/** Strip order in neutral mode: the neutral-native schemes first, then the disabled hue rotations. */
const NEUTRAL_OK = new Set(NEUTRAL_HARMONY_TYPES);
const NEUTRAL_STRIP = [...NEUTRAL_HARMONY_TYPES, ...HARMONY_TYPES.filter(t => !NEUTRAL_OK.has(t))];
const NEUTRAL_DISABLED = new Set(HARMONY_TYPES.filter(t => !NEUTRAL_OK.has(t)));
const NEUTRAL_DISABLED_WHY = 'Needs a hue to rotate — unavailable for a neutral seed';
/** Suggested pops — classic neutral pairings (locked ideal hexes, not paint hexes). */
const POPS = [
  { hex: '#9C1626', name: 'Crimson' }, { hex: '#0F6B6E', name: 'Teal' }, { hex: '#C4581A', name: 'Ember' },
  { hex: '#C2912F', name: 'Gold' }, { hex: '#5B3B8C', name: 'Purple' }, { hex: '#3E6B2F', name: 'Moss' },
];
/** Match/scheme options from the single "Use my paints" setting (⋯): off · prefer (boost) · only (filter). */
function matchOpts() {
  const o = { ladder: state.ladder };
  const owned = store.ownedIds();
  // Ownership always decorates the match (the ✓ owned badge + the export's `owned` column are facts
  // about the shelf); only RANKING is gated on the collection setting.
  if (owned.size) o.knownOwnedIds = owned;
  if (state.collection === 'only' && owned.size) o.ownedIds = owned;
  else if (state.collection === 'prefer' && owned.size) { o.boostIds = owned; o.boostAmount = OWNED_BOOST; }
  // Keep finishes (washes/shades/contrast/effects) out of harmony suggestions; Contrast is opt-in.
  const ex = new Set(FINISH_TYPES);
  if (state.includeContrast) ex.delete('contrast');
  o.excludeTypes = ex;
  // Metals rank as if METAL_DEMOTE ΔE further for colour roles (reported ΔE stays true — §2 honesty).
  o.demoteTypes = new Set(['metal']); o.demoteAmount = METAL_DEMOTE;
  return o;
}

function baseInfo() {
  if (state.customHex) return { hex: state.customHex, name: 'Custom ' + state.customHex, custom: true };
  const p = state.idx.byId.get(state.baseId);
  // dname already carries the line for ambiguous names — suppress the meta's line so the hero doesn't read it twice
  const lined = p.dname && p.dname !== p.name;
  return { id: p.id, hex: p.hex, name: ui.pname(p), brand: p.brand, line: lined ? '—' : p.line, type: p.type, approx: p.approx };
}
function basePaint() { return state.customHex ? null : state.idx.byId.get(state.baseId); }
function currentScheme() {
  // seed identity → buildScheme prefers the pick on exact ties and flags honest substitutions, in
  // BOTH seed modes (the slot whose ideal is the pick's hex gets it — Primary or Accent).
  const p = basePaint();
  const seed = p ? { id: p.id, name: ui.pname(p), hex: p.hex } : null;
  return buildScheme(state.idx, schemeBase(), state.harmony, { ...matchOpts(), pop: activePop(), seed, accentHex: accentPin() });
}

/** Sort the Shelf's paints by `key` (state.shelfSort; a stable copy, '' keeps dataset order). The seed
 *  field's browse grid has its own orders (data.js browseOrder). */
function sortPaints(list, key = '') {
  // numeric sorts decorate–sort–undecorate: the key computes ONCE per paint, not once per comparison
  // (hue/light ran ~2·n·log n HSL conversions per sort)
  const by = fn => list.map(p => [fn(p), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  switch (key) {
    case 'name': return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    case 'brand': return list.slice().sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
    case 'hue': return by(p => rgbToHsl(hexToRgb(p.hex))[0]);
    case 'light': return by(p => rgbToHsl(hexToRgb(p.hex))[2]);
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
  $('#panel-plan').innerHTML = cmp + ui.planControls(state.ladder, state.includeContrast, addable)
    + '<div class="micro" style="margin:14px 0 0">Each role: ideal colour → nearest real paint (ΔE 2000), plus the selected tone ladder</div>'
    + ui.roleSlots(state.scheme, store.markOf);
}
let wheelDraw = () => {};   // set by setupWheel(); lets discrete base/harmony changes redraw the promoted wheel
// Set by setupWheel() too. render() calls it when something other than the lightness slider changes
// the colour, the harmony or the seed role, so the slider's next move starts a new run from the colour
// now (wheel.js).
let endLightnessRun = () => {};
/** node ideal-hex (UPPER) → role glyph (P/A/2) for the current scheme. Keyed off schemeBase() so it's
 *  correct in accent-seed mode (the base node is then the Accent); Metal has no wheel node. */
function wheelRoleGlyphs() {
  const m = {};
  // The wheel now draws in the SAME frame the roles are computed in (schemeBase()), so the badges are
  // correct in accent-seed mode too — they used to be suppressed there because the two frames were
  // 180° apart and every glyph would have landed on the wrong node.
  for (const d of roleIdeals(schemeBase(), state.harmony, activePop(), { accentHex: accentPin() })) {
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
  // Neutral harmonies: partners derive from the pop, not from base rotations — display-only columns
  // (deg null, not detachable), exactly like the value-harmony partners.
  const ruleColours = isNeutralHarmony(state.harmony)
    ? [{ hex: base, deg: 0 }, ...neutralPartners(base, activePop(), state.harmony)]
    : harmonize(base, state.harmony);
  const rule = ruleColours
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
  const ideals = roleIdeals(schemeBase(), state.harmony, activePop(), { accentHex: accentPin() });
  const roleByHex = {};
  for (const d of ideals) roleByHex[d.idealHex.toUpperCase()] = d.role;
  state.roleByHex = roleByHex;   // the Equivalents drill-down reads this for its source label
  // The pick wins exact ties HERE too — the live palette is the single scheme summary (§3.6) and must
  // agree with the Plan tab about which twin fills the pick's slot.
  const sp = basePaint();
  const optsFor = hex => sp && hex.toUpperCase() === sp.hex.toUpperCase() ? { ...opts, preferIds: new Set([sp.id]) } : opts;
  const vm = paletteNodes().map(n => ({ ...n, match: nearestPaint(state.idx, n.hex, optsFor(n.hex)) }));
  // Seed docks — the Main|Accent control lives ON the palette now (§3.5): the pick's chip sits in
  // the column whose role it seeds; the other eligible column offers a "seed here" dock. First
  // matching column only (a free node can duplicate a role colour). Neutral seeds always hold
  // Primary, so their Accent dock renders disabled with the why.
  const seedRoleName = state.seedRole === 'accent' ? 'Accent' : 'Primary';
  const otherRoleName = state.seedRole === 'accent' ? 'Primary' : 'Accent';
  const info = baseInfo();
  let chipPlaced = false, switchPlaced = false;
  const placeDock = c => {
    const role = roleByHex[c.hex.toUpperCase()];
    if (!chipPlaced && role === seedRoleName) { chipPlaced = true; return { type: 'chip', name: info.name, hex: info.hex }; }
    if (!switchPlaced && role === otherRoleName) {
      switchPlaced = true;
      const disabled = otherRoleName === 'Accent' && neutralSeed()
        ? 'A neutral seed always holds Primary — pick a pop accent on the wheel instead' : null;
      return { type: 'switch', target: otherRoleName === 'Accent' ? 'accent' : 'main', disabled };
    }
    return null;
  };
  for (const c of vm) c.dock = placeDock(c);
  // Metal has no wheel node, so it rides along as a display-only column → the live palette is the complete
  // scheme summary (one bar, all four roles), letting the Plan drop its duplicate overview strip.
  const pin = accentPin();
  if (pin && !vm.some(c => c.hex.toUpperCase() === pin.toUpperCase())) {   // non-180° harmonies: no rule column carries the pick
    const pc = { id: 'accentpin', kind: 'pin', hex: pin, match: nearestPaint(state.idx, pin, optsFor(pin)) };
    pc.dock = placeDock(pc);
    vm.push(pc);
  }
  const metal = ideals.find(d => d.metal);
  vm.push({ id: 'metal', kind: 'metal', hex: metal.idealHex, match: nearestPaint(state.idx, metal.idealHex, { ...opts, types: new Set(['metal']) }) });
  el.innerHTML = ui.livePalette(vm, state.showReal ? 'real' : 'ideal', roleByHex);
  applyLinkHighlight();   // re-assert any active hover-link after the columns are rebuilt
  applyEquivSelect();     // re-assert the Equivalents-source ring after the columns are rebuilt
}
/** Cross-surface colour link (§3 "one instrument"): hovering/focusing a role block (Plan, right) or a
 *  live-palette column (left) rings the *same colour* wherever it appears — both DOM surfaces + the wheel
 *  node — so the wheel and the plan read as one tool. Transient interaction → outline ring (§3.5), never a
 *  border-width change (no reflow, §3.4). hex=null clears. */
let linkHiPainted = false;   // whether any .linkhi is (possibly) in the DOM — skips the per-drag-frame sweep
function applyLinkHighlight() {
  const h = state.hiHex;
  if (h == null && !linkHiPainted) return;   // nothing shown, nothing to clear — no document-wide pass
  for (const el of document.querySelectorAll('[data-hex]'))
    el.classList.toggle('linkhi', h != null && el.dataset.hex.toUpperCase() === h);
  linkHiPainted = h != null;
}
function linkHighlight(hex) {
  const h = hex ? normHex(hex) : null;
  if (state.hiHex === h) return;
  state.hiHex = h;
  applyLinkHighlight();
  wheelDraw();   // redraw so the matching wheel node gains/loses its ring
}
/** Equivalents-source drill-down: on the Equivalents tab, clicking a live-palette column makes that colour
 *  the source whose cross-brand matches are listed, and the column keeps a persistent selection ring so the
 *  left palette and the right list read as tied (an extension of the §3.5 colour link). The source defaults
 *  to the seed; it's session-only (not encoded in the URL) and falls back to the seed if the scheme changes. */
function equivSourceHex() {
  const def = (pickHex() || '#000000').toUpperCase();
  if (state.equivSource) {
    for (const el of document.querySelectorAll('.lcol[data-hex]'))
      if (el.dataset.hex.toUpperCase() === state.equivSource) return state.equivSource;   // still a live column
    state.equivSource = null;   // stale (the scheme changed it away) → fall back to the seed
  }
  return def;
}
let equivAttrsPainted = false;   // whether the drill-down attributes are (possibly) applied — same skip
function applyEquivSelect() {
  const on = state.tab === 'equiv';
  if (!on && !equivAttrsPainted) return;   // off the tab with nothing applied → skip the sweep (drag frames)
  equivAttrsPainted = on;
  const src = on ? equivSourceHex() : null;   // the ring + swatch drill-down only read on the Equivalents tab
  for (const el of document.querySelectorAll('.lcol[data-hex]')) {
    el.classList.toggle('eqsel', src != null && el.dataset.hex.toUpperCase() === src);
    const top = el.querySelector('.lctop'); if (!top) continue;
    if (on) {   // the swatch becomes a keyboard-operable "show equivalents" button — only on this tab
      top.setAttribute('role', 'button'); top.setAttribute('tabindex', '0');
      top.setAttribute('aria-label', `Show equivalents for ${(top.querySelector('.lctag')?.textContent || el.dataset.hex).trim()}`);
    } else { top.removeAttribute('role'); top.removeAttribute('tabindex'); top.removeAttribute('aria-label'); }
  }
}
function setEquivSource(hex) {
  const h = normHex(hex);
  if (!h || h === equivSourceHex()) return;   // ignore junk / re-selecting the current source
  state.equivSource = h;
  renderEquiv();
  applyEquivSelect();
  const st = $('#status'); if (st) st.textContent = `Showing equivalents for ${(state.roleByHex || {})[h] ? (state.roleByHex[h] + ' ') : ''}${h}`;
}
/** Re-render the harmony strip for the current mode: neutral seeds get the neutral-native schemes
 *  first with the hue rotations greyed in place (visible + tooltip'd, never removed — §3.4). */
function syncSeg() {
  $('#seg').innerHTML = neutralSeed()
    ? ui.segmented(NEUTRAL_STRIP, state.harmony, { disabled: NEUTRAL_DISABLED, disabledReason: NEUTRAL_DISABLED_WHY })
    : ui.segmented(HARMONY_TYPES, state.harmony);
  scrollHarmonyActive();
}
function renderPops() {
  const el = $('#pops'); if (!el) return;
  const on = neutralSeed() && isNeutralHarmony(state.harmony) && state.harmony !== 'warm-cool';   // pop-bearing schemes only
  el.hidden = !on;
  if (on) el.innerHTML = ui.popChips(POPS, activePop());
}
/** Discrete pop change (quick-pop chip / restored URL); wheel drags go through the wheel's commit().
 *  clampPop enforces the POP_MIN_S floor on this path too — an achromatic pop (e.g. a grey `pp` URL
 *  param) would otherwise turn the recipes into hue-0 red tints beside a grey "pop" swatch. */
function setPopHex(hex) {
  const h = normHex(hex); if (!h) return;
  state.popHex = clampPop(h);
  render('pop');
}
/** The neutral-mode chokepoint — call whenever the seed may have changed class. Keeps the harmony
 *  legal for the seed (parking/restoring the painter's hue harmony across the boundary), forces the
 *  seed to Primary (a neutral accent has no complement to build around), and syncs the banner, strip,
 *  and pop chips. Cheap when nothing changed, so the wheel's per-frame commit() can call it. */
let lastNeutral = null, preNeutralHarmony = null, preNeutralSeedRole = null;
let modeNote = '';   // set by ensureHarmonyMode on a real mode change; consumed once by announce()
/** The sentence of a pending modeNote that names the harmony the mode change chose ("back to the
 *  complementary scheme"), and the same news without that harmony. A chip or a roll before that announce
 *  replaces the harmony, so setHarmony puts the short form in its place. */
let modeHarmonyNote = null;   // { full, short } or null
/** The news of a change for the next announce(): it leads the scheme summary. A new seed ("New seed: X"),
 *  a roll ("Rolled: Compound"), or ↻ that moved the lightness. A say() after the render wrote over that
 *  announce, so the mode note and the §2 "your pick is excluded" note were never spoken. Set by seedNews()
 *  and setHarmony(); consumed once, as modeNote. */
let newsLead = '';
/** True when newsLead names the harmony ("Rolled: Compound"): announce() then leaves "{harmony} scheme"
 *  out of the summary, so the harmony is said once. */
let newsNamesHarmony = false;
/** Show the news of a new seed as a toast (what you see) and let the render that follows say it, in its
 *  one announce. Call it just before a render that speaks. */
function seedNews(msg) { newsLead = msg; toast(msg, { speak: false }); }
/** A live hex in the seed field renders without speaking: the field's list says the new seed, and takes
 *  the mode note here, so the note is never spoken later, on a render that did not cause it. */
function takeModeNote() { const n = modeNote; modeNote = ''; modeHarmonyNote = null; return n; }
/**
 * Can a parked accent role be handed back yet? Restoring flips schemeBase() 180°, and Lab chroma is
 * NOT identical across hues, so restoring on a seed that has only just cleared the threshold could
 * land the ROTATED seed back under it and flip the mode again next frame. Require the rotated seed
 * to be clearly non-neutral too; until then the role stays parked.
 */
const canRestoreAccent = () =>
  preNeutralSeedRole === 'accent' && labChroma(schemeBaseOf(pickHex(), 'accent')) > NEUTRAL_EXIT;

function ensureHarmonyMode() {
  const C = labChroma(schemeBase());
  const n = neutralMode ? C < NEUTRAL_EXIT : C < NEUTRAL_CHROMA;   // hysteresis deadband 10–14
  neutralMode = n;
  const legal = n ? NEUTRAL_OK.has(state.harmony) : !isNeutralHarmony(state.harmony);
  // A parked accent role is a PENDING restore, so it's re-evaluated on every call rather than only
  // on a mode flip: a drag that keeps moving away from grey gets the role back as soon as the
  // rotated seed clears the deadband, not merely at the instant it crossed it.
  const restoring = !n && canRestoreAccent();
  if (n === lastNeutral && legal && !restoring) return;
  lastNeutral = n;

  const notes = [];
  let harmonyNote = null;
  if (!legal) {
    state.dropOffsets = [];
    if (n) { preNeutralHarmony = state.harmony; state.harmony = 'neutral-pop'; }
    else { state.harmony = validHarmony(preNeutralHarmony) && !isNeutralHarmony(preNeutralHarmony) ? preNeutralHarmony : 'complementary'; preNeutralHarmony = null; }
    harmonyNote = n
      ? { full: 'Neutral seed — switched to the Neutral + pop scheme. Hue harmonies are unavailable for a neutral.',
          short: 'Neutral seed — hue harmonies are unavailable for a neutral.' }
      : { full: `Seed has a hue again — back to the ${state.harmony} scheme.`, short: 'Seed has a hue again.' };
    notes.push(harmonyNote.full);
  }
  // The seed role parks and restores SYMMETRICALLY with the harmony above. A neutral seed always
  // holds Primary (a neutral accent has no complement to build from), but before this a drag that
  // merely PASSED THROUGH the low-saturation centre ended accent-seed mode for good — the harmony
  // came back on the way out and the seed role didn't.
  if (n && state.seedRole === 'accent') {
    preNeutralSeedRole = 'accent';
    state.seedRole = 'main';   // the palette's Accent dock renders disabled with the why (renderLive follows)
  } else if (restoring) {
    state.seedRole = 'accent';
    preNeutralSeedRole = null;
    notes.push('Your pick seeds the Accent role again.');
  }
  // Hand the notes to announce() rather than writing #status here: they used to land in the live
  // region and be overwritten a statement later by the caller's own announce(), so the one thing a
  // screen-reader user needed to hear — the scheme changed under them — was never spoken.
  if (notes.length) { modeNote = notes.join(' '); modeHarmonyNote = harmonyNote; }

  setNeutralUi(n);
  syncSeg(); renderPops();
}
/* The ONE neutral explainer (§3.5), as a wheel OVERLAY so it never reflows the studio (§3.4): it
 * animates in on mode entry, auto-collapses to a compact ◐ pill after a beat, and the pill re-expands
 * it on demand. Timer only re-arms on mode ENTRY or pill click — never per drag frame. */
let bannerTimer = 0;
const BANNER_HOLD_MS = 7000;
/** Touch / narrow screens have no spare space: the expanded banner would sit ON the wheel disc and
 *  swallow the touches meant for colour-picking. There, neutral mode enters PILL-FIRST — the ◐ pill
 *  barely covers the rim, and the explainer expands only on request (evaluated per call so rotation/
 *  resize is honoured). */
const compactBanner = () => matchMedia('(pointer: coarse), (max-width: 700px)').matches;
function setNeutralUi(n) {
  const ov = $('#neutralOverlay'); if (!ov) return;
  clearTimeout(bannerTimer);
  ov.hidden = !n;
  if (n) (compactBanner() ? collapseBanner : expandBanner)();   // ensureHarmonyMode only calls on a mode CHANGE
}
function expandBanner() {
  const nb = $('#neutralBanner'), np = $('#neutralPill');
  nb.hidden = false; np.hidden = true; np.setAttribute('aria-expanded', 'true');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(collapseBanner, BANNER_HOLD_MS);
}
function collapseBanner() {
  const nb = $('#neutralBanner'), np = $('#neutralPill');
  clearTimeout(bannerTimer);
  nb.hidden = true; np.hidden = false; np.setAttribute('aria-expanded', 'false');
}
/** Repaint the always-visible studio column (wheel + live palette + pop chips). */
function drawStudio() { wheelDraw(); renderLive(); renderPops(); }
/** Re-derive the wheel's lightness from the seed. Only needed when the seed changed from OUTSIDE the
 *  wheel (a paint pick, a typed hex, undo, init) — during a drag the slider is already the source. */
function syncWheelL() {
  state.wheelL = rgbToHsl(hexToRgb(schemeBase()))[2];
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);
}

/**
 * THE render chokepoint. Every path that changes scheme state calls render(reason) instead of
 * assembling its own list of renderers. The hand-rolled lists disagreed with each other, which is
 * how the Plan/Equivalents/Accessibility tabs could sit on a stale colour through an entire wheel
 * drag, and how the hero could paint before neutral mode had settled and claim a role the engine
 * had already overridden.
 *
 * The order is load-bearing:
 *   1. ensureHarmonyMode() FIRST — it can rewrite state.harmony and state.seedRole, so nothing may
 *      read the mode before it settles.
 *   2. studio (wheel + live palette + pops) → 3. hero → 4. the active output tab.
 *   5. ONE announce, composing any mode-change note instead of overwriting it.
 *
 * Reasons:
 *   'all'     init / undo / redo — everything
 *   'seed'    the pick changed (a paint or a hex in the seed field, a photo, "use as base")
 *   'scheme'  harmony · seed role changed; the seed itself did not
 *   'pop'     a quick-pop chip changed the pop: as 'scheme', but an open lightness run stays open
 *             (the pop is not the base colour, so the slider can still go back to its start colour)
 *   'palette' added/locked/reordered swatches — studio only, exactly as before
 *   'drag'    a live wheel or lightness-slider frame: coalesced to one repaint per frame, URL +
 *             speech debounced
 *   'settle'  a drag ended: commit the URL and speak; everything is already painted
 *   'marks'   a mark changed (owned · to buy · clear), anywhere: the ONE path that repaints everything
 *             that shows a mark or ranks by the owned set (renderMarks). `ids`: the paints whose mark
 *             changed, or null for many (an import). The colour and the scheme did not change, so: no
 *             end of a lightness run, no undo step, no URL write, and no scheme summary (the caller says
 *             what it marked).
 */
let renderRaf = 0;
/** `speak: false` repaints without the scheme summary in #status (a restore says its own line). */
function render(reason = 'scheme', { speak = true, ids = null } = {}) {
  if (reason === 'settle') { updateUrl(); if (speak) announce(); return; }
  if (reason === 'marks') { renderMarks(ids); return; }

  // A pick, a typed hex, undo/redo, a share link or a harmony/seed-role change ends a lightness run.
  // Wheel drags and ↻ render as 'drag': the slider sees their new pick for itself. A pop change
  // ('pop', or a pop dragged on the wheel) does not change the base colour, so the run stays open.
  if (reason === 'seed' || reason === 'all' || reason === 'scheme') endLightnessRun();
  ensureHarmonyMode();   // the seed may have crossed the neutral boundary (picker, hex, drag, undo)
  if (reason === 'seed' || reason === 'all') syncWheelL();

  if (reason === 'palette') { drawStudio(); updateUrl(); return; }

  const paint = () => {
    drawStudio();
    renderHero(reason !== 'drag');   // no pop animation mid-drag
    renderActive();                  // the output tabs follow the scheme — mid-drag included
  };

  if (reason === 'drag') {
    // Coalesce the heavy repaint (nearest-paint scans + canvas + tab) to one per frame, and debounce
    // the history write + aria-live: a drag fires pointermove far faster than WebKit's replaceState
    // limit (which throws mid-drag) and far faster than a screen reader can speak.
    if (!renderRaf) renderRaf = requestAnimationFrame(() => { renderRaf = 0; paint(); });
    scheduleUrlUpdate(); scheduleAnnounce();
    return;
  }
  paint();
  updateUrl(); if (speak) announce();
}
/* ---- marks: one path for every mark change (render('marks')) ----
   Each writer used to repaint its own list of surfaces, and the lists disagreed: a mark on the Shelf left
   the Studio's live palette and Plan on the old state, a mark in the old Paints drawer left the hero's buy
   toggle stale, and with Use my paints on even the matches could be stale until the next full render.
   What shows a mark, or ranks by the owned set:
     Studio — the seed field's list while it is open (picker.js refresh) · the wheel and the live palette
              (Use my paints ranks them) · the hero (✓ owned or its buy toggle) · the active tab (the Plan's
              buy toggles and gaps, the Equivalents badges, the Accessibility swap) · the matching note
              ("from the N you own").
     Shelf  — the cells' badges, the stats line, and the status filter (a paint can leave the view).
   The hidden mode repaints when it shows: the Studio through studioMarksStale, the Shelf because
   setMode('shelf') rebuilds its grid. The ⋯ Use my paints hint does not follow marks (§3.6). */
let studioMarksStale = false;
function renderMarks(ids) {
  if (state.mode === 'shelf') { renderShelfMarks(ids); studioMarksStale = true; return; }
  paintStudioMarks(ids);
}
function paintStudioMarks(ids = null) {
  studioMarksStale = false;
  // A mark re-renders the control that made it (a buy toggle in the Plan or the hero, Add gaps to buy):
  // focus goes back to the new one, in the same place.
  const ae = document.activeElement, aeId = ae?.id, buyId = ae?.dataset?.buy;
  const region = buyId ? ae.closest('#hero, [data-panel], #livepal') : null;
  picker.refresh(ids);   // the seed field's list, while it is open (closed, it is built from scratch on open)
  drawStudio();
  renderHero(false);   // no pop: the colour did not change
  renderActive();
  renderMatchNote();
  if (region) region.querySelector(`[data-buy="${CSS.escape(buyId)}"]`)?.focus({ preventScroll: true });
  else if (aeId && !ae.isConnected) document.getElementById(aeId)?.focus({ preventScroll: true });
}
function renderShelfMarks(ids) {
  // An Owned or To buy filter no longer shows a paint whose new mark differs: it leaves the view, and the
  // selection and the cursor let go of it.
  const gone = new Set(state.shelfMark && ids ? ids.filter(id => store.markOf(id) !== state.shelfMark) : []);
  if (gone.size) {
    const keep = id => (id && !gone.has(id) ? id : null);
    setSelection([...shelf.sel].filter(id => !gone.has(id)), { anchor: keep(shelf.anchor), cursor: keep(shelf.cursor) });
  }
  if (!ids || gone.size) renderShelf();   // many paints (an import), or the view changed: rebuild
  else { for (const id of ids) { const c = cellEl(id); if (c) updateCell(c, store.markOf(id)); } renderShelfStats(); }
}

const MAX_FREE = 6;   // bounds URL length + per-frame nearest-paint scans (S5 micro-decision)
/** Add a colour "along the line": extend the base's value ramp (alternating lighter/darker tints &
 *  shades, stepping outward) rather than inventing a new hue. New swatches are draggable + editable. */
function addFreeNode() {
  if (state.extraNodes.length >= MAX_FREE) return;
  const [bh, bs, bl] = rgbToHsl(hexToRgb(schemeBase()));
  const k = state.extraNodes.length, dir = k % 2 === 0 ? 1 : -1, mag = 0.12 + 0.10 * Math.floor(k / 2);
  const l = Math.min(0.94, Math.max(0.06, bl + dir * mag));
  state.extraNodes.push({ h: bh, s: bs, l });
  syncNodeBtns(); render('palette');
}
/** Remove a free node (by index, or the last when omitted). */
function removeFreeNode(idx) {
  if (typeof idx === 'number' && idx >= 0) state.extraNodes.splice(idx, 1); else state.extraNodes.pop();
  syncNodeBtns(); render('palette');
}
function syncNodeBtns() {
  const a = $('#addnode'), d = $('#delnode');
  if (a) a.disabled = state.extraNodes.length >= MAX_FREE;
  if (d) d.disabled = state.extraNodes.length === 0;
}
/** Current hex of an addressable swatch key ('base' | 'p:<deg>' | 'x:<idx>'). */
function swatchHex(sw) {
  // Resolved in the SCHEME frame: the live palette mints 'p:<deg>' keys relative to schemeBase(), so
  // resolving them against the pick landed 180° away in accent-seed mode (the editor opened on the
  // wrong colour and locking visibly recoloured the column).
  return swatchKeyHex(sw, {
    schemeBase: schemeBase(), extraNodes: state.extraNodes, wheelL: state.wheelL,
    toHex: hsl => rgbToHex(hslToRgb(hsl)),
  });
}
/** Detach a harmony partner into the editable free-swatch list (so lock/edit can pin it independently). */
function detachPartner(deg, extra) {
  if (state.extraNodes.length >= MAX_FREE) return false;
  const [bh, bs] = rgbToHsl(hexToRgb(schemeBase()));
  if (!state.dropOffsets.includes(deg)) state.dropOffsets.push(deg);
  state.extraNodes.push({ h: ((bh + deg) % 360 + 360) % 360, s: bs, l: state.wheelL, ...extra });
  return true;
}
/** Lock toggle for a swatch — locked swatches survive Generate + harmony changes. The base can't be locked. */
function lockSwatch(sw) {
  if (sw === 'base') return;
  if (sw.startsWith('p:')) detachPartner(+sw.slice(2), { locked: true });
  else if (sw.startsWith('x:')) { const o = state.extraNodes[+sw.slice(2)]; if (o) o.locked = !o.locked; }
  syncNodeBtns(); render('palette');
}
/** Set an arbitrary hex on a swatch (the base re-seeds; any other swatch becomes a pinned free swatch). */
function editSwatch(sw, hex) {
  hex = normHex(hex); if (!hex) return;
  if (sw === 'base') { seedFromSchemeBase(hex); return; }   // the base column IS the scheme base (§seed.js frame)
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (sw.startsWith('p:')) detachPartner(+sw.slice(2), { h, s, l });
  else if (sw.startsWith('x:')) { const i = +sw.slice(2); if (state.extraNodes[i]) state.extraNodes[i] = { ...state.extraNodes[i], h, s, l }; }
  syncNodeBtns(); render('palette');
}
let swEditTarget = null;   // swatch key being edited via the native colour picker
/** Open the per-swatch colour editor (native picker), seeded with the swatch's current colour. */
function openSwatchEditor(sw) { const inp = $('#swEdit'); if (!inp) return; swEditTarget = sw; inp.value = swatchHex(sw); inp.click(); }
/** Move an added swatch within the free list (drag-reorder). */
function moveFreeNode(from, to) {
  const a = state.extraNodes;
  if (!(from >= 0 && from < a.length && to >= 0 && to < a.length) || from === to) return;
  const [m] = a.splice(from, 1); a.splice(to, 0, m);
  render('palette');
}
/** The scheme colours the Equivalents tab can source from — mirrors the live palette's columns
 *  (rule/free nodes + the pinned accent + Metal), labelled the way the bar labels them. */
function equivSourceCols() {
  const ideals = roleIdeals(schemeBase(), state.harmony, activePop(), { accentHex: accentPin() });
  const roleByHex = {};
  for (const d of ideals) roleByHex[d.idealHex.toUpperCase()] = d.role;
  const nodes = paletteNodes(), baseCol = (nodes.find(n => n.kind === 'base') || nodes[0]).hex;
  const cols = nodes.map(n => ({ hex: n.hex,
    label: roleByHex[n.hex.toUpperCase()] || (n.kind === 'base' ? 'Base' : n.kind === 'free' ? 'Added'
      : n.deg ? `${n.deg > 0 ? '+' : ''}${n.deg}°` : ui.toneTag(n.hex, baseCol)) }));   // deg 0 = value partner (§F13)
  const pin = accentPin();
  if (pin && !cols.some(c => c.hex.toUpperCase() === pin.toUpperCase())) cols.push({ hex: pin, label: 'Accent' });
  const metal = ideals.find(d => d.metal);
  cols.push({ hex: metal.idealHex, label: 'Metal' });
  const seen = new Set();   // a free node can duplicate a rule colour — one chip per colour
  return cols.filter(c => { const k = c.hex.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
function renderEquiv() {
  // XSS barrier: srcHex descends from user-influenced values (chip data attrs, column data-hex,
  // the pick jump, the URL seed). normHex's integer round-trip re-mints it as a provably-hex string
  // (and the sink esc()s as defence-in-depth) — nothing below interpolates the raw input.
  const srcHex = normHex(equivSourceHex()) || '#000000';
  const p = basePaint();
  const chips = ui.equivSourceChips(equivSourceCols(), srcHex);
  // When the source is the seed AND the seed is a real paint, keep the richer view (curated interchangeable
  // group + that paint's cross-brand equivalents). Any other selected column resolves to its ideal colour.
  if (p && srcHex === (pickHex() || '').toUpperCase()) {
    const self = state.idx.byId.get(p.id);
    const members = groupMembers(state.idx, self);                 // curated equivalents (ΔE ≤ 1)
    // Auto-seeded groups cluster by ΔE alone, so a metal's group can hold flats — list true metallics first
    if (self.type === 'metal') members.sort((a, b) => (a.type === 'metal' ? 0 : 1) - (b.type === 'metal' ? 0 : 1));
    const memberIds = new Set(members.map(m => m.id));
    const label = groupOf(state.idx, self)?.label || 'this colour';
    const eq = equivalents(state.idx, self, { n: 8 }).filter(e => !memberIds.has(e.paint.id));   // avoid dupes
    $('#panel-equiv').innerHTML = chips + ui.equivGroup(label, members, store.markOf)
      + ui.equivalentsPanel(`${ui.pname(p)} (${p.brand})`, eq, store.markOf);
  } else {
    const role = (state.roleByHex || {})[srcHex];
    const name = role ? `${role} · ${srcHex}` : `your colour ${srcHex}`;   // name the role when the column plays one
    // The Metal column's matches float true metallics first — a flat near the hex isn't an equivalent (§7).
    // Any other colour is a flat target (the Plan matches roles with finishes excluded), so washes, contrasts,
    // texture paints and metals rank FINISH_PENALTY further, as for a picked flat paint (data.js closestPaints,
    // the seed field's hex list too). Reported ΔE stays true.
    const list = role === 'Metal'
      ? nearestPaints(state.idx, srcHex, 8, { floatTypes: new Set(['metal']), demoteTypes: new Set(FINISH_TYPES), demoteAmount: FINISH_PENALTY })
      : closestPaints(state.idx, srcHex, 8);
    $('#panel-equiv').innerHTML = chips + ui.equivalentsPanel(name, list, store.markOf);
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
  // Check ALL simulated deficiencies, not just deuteranopia — a scheme can collide only under
  // tritanopia (blue/purple) or protanopia while staying distinct for deutan viewers. Warn on the
  // worst collision and search the fix against the worst-case across every type.
  const CVD_TYPES = ['deuteranopia', 'protanopia', 'tritanopia'];
  const worstPair = cols => CVD_TYPES.reduce((w, t) => {
    const c = minPairDelta(cols, t);
    return !w || c.delta < w.delta ? { ...c, type: t } : w;
  }, null);
  const col = worstPair(colors);
  let collision = null;
  if (col.delta < 10) {
    const [i, j] = col.pair;
    collision = { roles: [names[i], names[j]], delta: col.delta, type: col.type };
    // Shift whichever of the *colliding* roles is least disruptive to move — the old code
    // always rotated the Accent, so it couldn't fix e.g. a Primary/Secondary collision.
    const freedom = { Accent: 0, Secondary: 1, Metal: 2, Primary: 3 };
    const shiftIdx = (freedom[names[i]] ?? 9) <= (freedom[names[j]] ?? 9) ? i : j;
    let bestMin = col.delta, best = null;
    for (const d of [25, -25, 40, -40, 55, -55]) {
      const trial = colors.slice();
      trial[shiftIdx] = rotateHue(colors[shiftIdx], d);
      const m = worstPair(trial).delta;
      if (m > bestMin + 1) { bestMin = m; best = trial[shiftIdx]; }
    }
    if (best) {
      // a Metal-role swap must suggest a real metallic (all-metal pool also neutralises the colour-role demote)
      const swapOpts = names[shiftIdx] === 'Metal' ? { ...matchOpts(), types: new Set(['metal']) } : matchOpts();
      collision.suggestion = { role: names[shiftIdx], hex: best, match: nearestPaint(state.idx, best, swapOpts) };
    }
  }
  $('#panel-a11y').innerHTML = ui.a11yPanel({ names, sims, contrasts, collision });
}
// A fixed list and plain comparisons, never a function looked up by the link's v= name: on an object a
// name such as __proto__ or toString found the prototype's member (?v=__proto__ crashed the app on load;
// ?v=toString showed no tab).
const TABS = ['plan', 'equiv', 'a11y'];
function renderActive() {
  if (state.tab === 'equiv') renderEquiv();
  else if (state.tab === 'a11y') renderA11y();
  else renderPlan();
}

/* ---- shelf (collection) — Finder-style bulk stocking, wired to store.setMark ---- */
const COARSE = matchMedia('(pointer:coarse)').matches;   // touch = tap-to-cycle; mouse = multi-select (locked decisions)
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');   // ⌘ vs Ctrl for select-toggle
const shelf = { sel: new Set(), anchor: null, cursor: null, hover: null, selectMode: false, viewIds: null };   // ids; selection is transient (not persisted); viewIds = the drawn order (set by renderShelf)
const shelfPaints = () => {
  // The seed field's matcher (data.js paintMatcher): every word must match the name, the display name
  // ("dawnstone (layer)"), the brand, the line, the type or the finish word. The Shelf keeps its own order.
  const match = paintMatcher(state.shelfQ);
  const list = state.idx.paints.filter(p =>
    (!state.shelfBrand || p.brand === state.shelfBrand) &&
    (!state.shelfMark || store.markOf(p.id) === state.shelfMark) &&   // status filter: '' (all) | owned | want
    (!state.shelfType || p.type === state.shelfType) &&               // type filter (base/layer/shade/metal/…)
    (!match || match(p)));
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
  const view = shelfPaints();
  $('#shelfGrid').innerHTML = ui.shelfGrid(view, store.markOf, shelf.sel);
  // tag each cell with a DOM id for aria-activedescendant (keyboard cursor); the empty-state
  // placeholder has no data-id and must not become "sc-undefined"
  for (const c of $('#shelfGrid').children) if (c.dataset.id) c.id = 'sc-' + c.dataset.id;
  // innerHTML wiped the .cursor ring but the grid's aria-activedescendant survived — re-apply the
  // cursor to the fresh cells (or clear it if the cell filtered/sorted away) so ring and AT agree
  setCursor(shelf.cursor && cellEl(shelf.cursor) ? shelf.cursor : null);
  paintedSel = new Set(shelf.sel);   // the rebuilt grid baked the selection in — resync the diff base
  shelf.viewIds = view.map(p => p.id);   // cache the visible order: keyboard nav must not re-filter+sort 2,508 paints per keypress
  renderShelfStats(); renderShelfBar(); syncShelfFilterUi();
}
/** A shelf filter (brand/status/type/search) changed → membership changes, so drop the selection
 *  (its ids may no longer be visible) and re-render. Sorting uses renderShelf directly (keeps selection). */
function shelfFilterChanged() { setSelection([], { anchor: null, cursor: null }); renderShelf(); revealShelfResults(); }

/* ---- Shelf dock (§3.6; mockups/shelf-landing.html "Chosen" + its design critique) ----
   Desktop: a sticky filter bar, always open. Phone (≤520px): the bar tucks up under the header on a
   small scroll down; a real scroll up, a tap, or a drag on the handle brings it back. Movement is
   transform-only (CSS), so the grid never reflows (§3.4). Tucked controls are `inert` — never
   focusable or read out while out of sight. */
const PHONE = matchMedia('(max-width: 520px)');
const dock = { open: true, acc: 0, lastY: 0, stuck: false, quietUntil: 0, sheet: false };
const headerH = () => $('header').getBoundingClientRect().height;
function applyDock() {
  const d = $('#shelfDock'), panel = $('#shelfPanel'), handle = $('#shelfHandle');
  const tucked = PHONE.matches && dock.stuck && !dock.open;
  // Read every layout value before any write. A read after the class writes below forced an extra style
  // pass on the frame the panel reveals. The classes only change transform, visibility, shadow and
  // corners, so these sizes are the same before and after the writes.
  const ph = handle.offsetTop, dh = d.offsetHeight, hh = headerH();
  // "over": the open panel covers paints, so it reads as a sheet pulled down over the grid (shadow + rounded
  // corners, app.css). Keyed to that state, not to a gesture: a tap, a drag, a scroll-up reveal and a focused
  // search all look the same. Layout values (header + dock height vs the grid's top), so the slide's
  // transform can't make it flicker; just after pinning only the title is under the panel, so no shadow.
  const over = PHONE.matches && dock.stuck && !tucked && $('#shelfGrid').getBoundingClientRect().top < hh + dh;
  d.style.setProperty('--panel-h', ph + 'px');   // tucking slides the handle row up to the header
  d.classList.toggle('stuck', dock.stuck);
  d.classList.toggle('tucked', tucked);
  d.classList.toggle('over', over);
  panel.inert = tucked;
  handle.setAttribute('aria-expanded', String(!tucked));
}
function setDockOpen(open, { focus = false } = {}) {
  const wasTucked = $('#shelfDock').classList.contains('tucked');
  dock.open = open; dock.acc = 0;
  applyDock();
  // While the panel slides down under the finger, it ignores taps. A quick second tap on the handle
  // otherwise landed on the search field and popped the phone keyboard (the slide is 200ms).
  if (open && wasTucked) {
    const panel = $('#shelfPanel');
    panel.style.pointerEvents = 'none';
    setTimeout(() => { panel.style.pointerEvents = ''; }, 250);
  }
  // keyboard only: on touch, focusing the search would pop the on-screen keyboard over the grid
  if (focus) (open ? $('#shelfQ') : $('#shelfHandle')).focus({ preventScroll: true });
}
function onShelfScroll() {
  if (state.mode !== 'shelf') return;
  const y = window.scrollY, dy = y - dock.lastY;
  dock.lastY = y;
  const stuck = $('#shelfSentinel').getBoundingClientRect().top < headerH() - 0.5;
  if (stuck !== dock.stuck) { dock.stuck = stuck; if (!stuck) { dock.open = true; dock.acc = 0; } }
  // never hide while someone is typing in the search, or while the sheet is open; ignore our own scrolls
  const typing = document.activeElement === $('#shelfQ');
  if (PHONE.matches && dock.stuck && !typing && !dock.sheet && performance.now() > dock.quietUntil) {
    const next = ui.dockStep(dock, dy);
    dock.acc = next.acc; dock.open = next.open;
  }
  applyDock();
}
/** After a filter change, bring the first results into view just below the dock. Without this, a
 *  filter applied deep in the grid leaves the page scrolled past a now-shorter list (blank screen),
 *  or the first results hide under the dock. */
function revealShelfResults() {
  if (state.mode !== 'shelf') return;
  const g = $('#shelfGrid').getBoundingClientRect().top, d = $('#shelfDock').getBoundingClientRect().bottom;
  if (g >= d) return;   // already in view (at the top of the page)
  dock.quietUntil = performance.now() + 200;
  window.scrollTo(0, window.scrollY + g - d - 8);
  dock.lastY = window.scrollY;
}
/** Text + active state for the handle chip, the Filters badge, the active selects, and the sheet button. */
function syncShelfFilterUi() {
  const sum = ui.shelfFilterSummary({ q: state.shelfQ, mark: state.shelfMark, brand: state.shelfBrand, type: state.shelfType });
  const chip = $('#shelfChip');
  chip.textContent = sum.text;
  chip.classList.toggle('on', sum.any);
  $('#shelfHandle').setAttribute('aria-label', 'Search and filters' + (sum.any ? ` — ${sum.text.replace('⌕ ', '')}` : ''));
  const badge = $('#shelfFBadge');
  badge.hidden = !sum.sheet;
  badge.textContent = sum.sheet || '';
  $('#shelfFiltersBtn').setAttribute('aria-label', sum.sheet ? `Filters, ${sum.sheet} on` : 'Filters');
  $('#shelfBrand').classList.toggle('on', !!state.shelfBrand);
  $('#shelfType').classList.toggle('on', !!state.shelfType);
  const n = shelf.viewIds ? shelf.viewIds.length : 0;
  $('#shelfDone').textContent = `Show ${n.toLocaleString()} paint${n === 1 ? '' : 's'}`;
}
/* Filters sheet (phone): the desktop bar's brand · type · sort elements, shown as a modal sheet. */
function openShelfSheet() {
  const m = $('#shelfMore');
  dock.sheet = true;
  m.classList.add('open');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'shelfMoreTitle');
  m.removeAttribute('aria-label');
  $('#shelfScrim').hidden = false;
  $('#shelfDock').classList.add('sheet-open');
  $('#shelfFiltersBtn').setAttribute('aria-expanded', 'true');
  // Focus the sheet's title, not its first select: on iOS, focusing a <select> during a tap opens its
  // picker at once, so every tap on Filters opened the brand list. Tab then reaches Brand (WAI-ARIA APG
  // dialog pattern: a static element at the start may take the first focus).
  $('#shelfMoreTitle').focus({ preventScroll: true });
}
function closeShelfSheet({ returnFocus = true } = {}) {
  if (!dock.sheet) return;
  const m = $('#shelfMore');
  dock.sheet = false;
  m.classList.remove('open');
  m.setAttribute('role', 'group'); m.removeAttribute('aria-modal'); m.removeAttribute('aria-labelledby');
  m.setAttribute('aria-label', 'More filters');
  $('#shelfScrim').hidden = true;
  $('#shelfDock').classList.remove('sheet-open');
  $('#shelfFiltersBtn').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('#shelfFiltersBtn').focus({ preventScroll: true });
}
function setupShelfDock() {
  // the header's height changes with the breakpoint, the safe area, and wrapping — track it live
  new ResizeObserver(() => { document.documentElement.style.setProperty('--hdr-h', headerH() + 'px'); applyDock(); }).observe($('header'));
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onShelfScroll(); });
  }, { passive: true });
  PHONE.addEventListener('change', () => { closeShelfSheet({ returnFocus: false }); dock.open = true; applyDock(); });

  // handle: tap or Enter/Space toggles; a vertical drag opens (down) or tucks (up). Tap is the main way;
  // drag is extra (WCAG 2.5.7). touch-action:none on the handle keeps the drag from scrolling the page.
  const h = $('#shelfHandle');
  let drag = null, dragged = false;
  h.addEventListener('pointerdown', e => { drag = { y: e.clientY, moved: false }; dragged = false; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => { if (drag && Math.abs(e.clientY - drag.y) > 12) drag.moved = true; });
  h.addEventListener('pointerup', e => {
    if (drag && drag.moved) { dragged = true; setDockOpen(e.clientY > drag.y); }
    drag = null;
  });
  h.addEventListener('pointercancel', () => { drag = null; });
  h.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }   // the drag already did it
    setDockOpen(!dock.open, { focus: e.detail === 0 });
  });

  $('#shelfFiltersBtn').addEventListener('click', openShelfSheet);
  $('#shelfScrim').addEventListener('click', () => closeShelfSheet());
  $('#shelfDone').addEventListener('click', () => closeShelfSheet());
  $('#shelfReset').addEventListener('click', () => {
    state.shelfBrand = state.shelfType = state.shelfSort = '';
    $('#shelfBrand').value = $('#shelfType').value = $('#shelfSort').value = '';
    shelfFilterChanged();
  });
  $('#shelfMore').addEventListener('keydown', e => {
    if (!dock.sheet) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeShelfSheet(); return; }
    if (e.key !== 'Tab') return;   // keep focus inside the modal sheet
    const f = [...$('#shelfMore').querySelectorAll('button, select')];
    const first = f[0], last = f[f.length - 1];
    // the title takes the first focus (openShelfSheet), so Shift+Tab from it must wrap too
    const atStart = document.activeElement === first || document.activeElement === $('#shelfMoreTitle');
    if (e.shiftKey && atStart) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
}
function announceShelf(msg) { $('#status').textContent = msg; }

/* selection primitives — outline only (CSS), so no reflow (§3.4) */
let paintedSel = new Set();   // what the DOM currently shows — a marquee move must not rewrite 2,508 attributes
function paintSelected() {
  for (const id of paintedSel) if (!shelf.sel.has(id)) cellEl(id)?.setAttribute('aria-selected', 'false');
  for (const id of shelf.sel) if (!paintedSel.has(id)) cellEl(id)?.setAttribute('aria-selected', 'true');
  paintedSel = new Set(shelf.sel);
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
  if (id) { g.setAttribute('aria-activedescendant', 'sc-' + id); const c = cellEl(id); if (c) clampTip(c); }
  else g.removeAttribute('aria-activedescendant');
}
/** Keep a cell's name tip on-screen: a tip is centred on its cell, so edge-column names would clip at
 *  the viewport (the Shelf bug on phones). Measured invisibly (the tip is display:none until shown —
 *  no paint between the style writes), then shifted via --tipdx in the tip's transform. */
/** Scroll the keyboard-cursor cell into view, clear of the sticky header and filter dock (WCAG 2.4.11).
 *  Done here, not in CSS. A CSS scroll margin had to read the dock's height from a custom property on
 *  :root, which restyled every cell (~6,500 elements) on each tuck and reveal. scroll-padding on the root
 *  made the browser treat the dock as covered, so focusing its own search field scrolled the page. */
function revealCell(c) {
  if (!c) return;
  const r = c.getBoundingClientRect(), roof = $('#shelfDock').getBoundingClientRect().bottom + 8, floor = window.innerHeight - 8;
  const dy = r.top < roof ? r.top - roof : r.bottom > floor ? r.bottom - floor : 0;
  if (!dy) return;
  dock.quietUntil = performance.now() + 200;   // our own scroll: it must not tuck or reveal the dock over the cell
  window.scrollBy(0, dy);
}
function clampTip(c) {
  const tip = c.querySelector('.celltip'); if (!tip) return;
  tip.style.cssText = 'display:block;visibility:hidden';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.cssText = '';
  const r = c.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  const ideal = r.left + r.width / 2 - w / 2;             // where the centred tip's left edge would land
  const dx = ideal < 8 ? 8 - ideal : ideal + w > vw - 8 ? vw - 8 - (ideal + w) : 0;
  if (dx) tip.style.setProperty('--tipdx', dx.toFixed(1) + 'px');
  // Vertically the tip sits above the cell, unless that would put it under the sticky chrome: the header,
  // or in the Shelf the filter dock, which paints over the grid. Then it flips below the cell.
  let roof = $('header').getBoundingClientRect().bottom;
  if (state.mode === 'shelf') roof = Math.max(roof, $('#shelfDock').getBoundingClientRect().bottom);
  tip.classList.toggle('below', r.top - 7 - h < roof + 4);   // 7 = .celltip's offset in app.css
}
function rangeIds(aId, bId) {
  const list = shelf.viewIds || shelfPaints().map(p => p.id);   // the order renderShelf last drew
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
  store.setMarks(ids, mark);   // ONE persist — 500 setMark calls would serialise the whole state 500×
  render('marks', { ids });    // the cells, the stats, a status filter; the Studio when it shows next
  // restart the confirm-flash with a SINGLE forced layout — write→read→write per cell was one full
  // grid layout per selected paint (a 500-cell mark froze the main thread for seconds on mobile)
  const cells = ids.map(cellEl).filter(Boolean);
  for (const c of cells) c.classList.remove('flash');
  if (cells.length) { void cells[0].offsetWidth; for (const c of cells) c.classList.add('flash'); }
  const verb = mark === 'owned' ? 'owned' : mark === 'want' ? 'to buy' : 'cleared';
  announceShelf(`${ids.length} ${ids.length === 1 ? 'paint' : 'paints'} marked ${verb}.`);
}
function updateCell(c, mark) {
  c.dataset.mark = mark;
  c.querySelector('.cbadge')?.remove();
  const html = ui.markBadge(mark);
  if (html) c.querySelector('.celltip').insertAdjacentHTML('beforebegin', html);
  c.setAttribute('aria-label', c.getAttribute('aria-label').replace(/—.*$/, '— ' + ui.markLabel(mark)));
}

/* mouse: click-select + marquee drag (mouse only; touch uses tap-to-cycle) */
function setupShelf() {
  const grid = $('#shelfGrid');
  grid.addEventListener('pointerover', e => { const c = e.target.closest('.cell'); shelf.hover = c ? c.dataset.id : null; if (c) clampTip(c); });
  // One tooltip at a time, last input wins (app.css): pointing at a cell shows that cell's name; using the
  // keys shows the keyboard cursor's name again. Real movement only: a keyboard-driven scroll under a
  // resting mouse changes what is hovered, and that must not count as pointing.
  grid.addEventListener('pointermove', e => { if ((e.movementX || e.movementY) && grid.dataset.input !== 'pointer') grid.dataset.input = 'pointer'; });
  grid.addEventListener('pointerdown', () => { grid.dataset.input = 'pointer'; });
  grid.addEventListener('pointerout', e => { if (!e.relatedTarget || !grid.contains(e.relatedTarget)) shelf.hover = null; });
  grid.addEventListener('focusin', e => { const c = e.target.closest('.cell'); if (c) clampTip(c); });

  // The mark menu's gestures (markmenu.js): a right-click everywhere; a long-press on a touch screen, as
  // before. Bound first, so the handlers below can ask it whether a press is already used.
  shelfMenuSurface = markMenu.attach({ container: grid, item: el => el.closest('.cell'), longPress: COARSE, onOpen: openShelfMenu });

  if (COARSE) {                                  // touch: tap-to-cycle, or Select-mode multi-select; long-press → menu
    grid.addEventListener('click', e => {
      const c = e.target.closest('.cell'); if (!c) return;
      if (shelfMenuSurface.ignorePress()) return;   // a long-press opened the menu, or this tap only closed it
      if (shelf.selectMode) {                    // tap toggles selection (bulk-mark via the action bar)
        const s = new Set(shelf.sel); s.has(c.dataset.id) ? s.delete(c.dataset.id) : s.add(c.dataset.id);
        setSelection(s, { anchor: c.dataset.id, cursor: c.dataset.id });
      } else {                                    // tap cycles this swatch's mark (approach C)
        const id = c.dataset.id, next = { none: 'owned', owned: 'want', want: 'none' }[c.dataset.mark || 'none'];
        store.setMark(id, next);
        render('marks', { ids: [id] });          // the cell and the stats; it leaves an Owned / To buy view
        const cc = cellEl(id);
        if (cc) { cc.classList.remove('flash'); void cc.offsetWidth; cc.classList.add('flash'); }
        const p = state.idx.byId.get(id);
        announceShelf(`${ui.pname(p)}, ${ui.markLabel(next)}.`);   // the new state, for a screen reader too (§3.5)
      }
    });
    return;
  }

  let down = null, marquee = null, base = null, moved = false, dragRects = null;
  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;                   // left button only (right-click → context menu)
    if (shelfMenuSurface.ignorePress()) return;   // this click only closed the menu: no selection change
    // On macOS, Ctrl+click IS the system secondary-click (fires contextmenu) — so use ⌘ (meta) as the
    // multi-select toggle there, and Ctrl elsewhere. Avoids a Ctrl+click both toggling AND opening the menu.
    const toggle = IS_MAC ? e.metaKey : e.ctrlKey;
    const c = e.target.closest('.cell');
    // PAGE coordinates throughout the drag: pointer capture doesn't block wheel-scroll, and
    // viewport-frozen coords would desync the drawn marquee AND the hit-test by the scroll delta.
    down = { x: e.pageX, y: e.pageY, id: c ? c.dataset.id : null, shift: e.shiftKey, meta: toggle };
    base = (down.shift || down.meta) ? new Set(shelf.sel) : new Set();
    moved = false; dragRects = null; grid.setPointerCapture(e.pointerId);
  });
  let mqRaf = 0, mqX = 0, mqY = 0;
  function mqApply() {                            // one marquee update: rect + hit-test + diff-paint (needs `down`)
    const r = grid.getBoundingClientRect();
    const gx = r.left + scrollX, gy = r.top + scrollY;   // the grid's PAGE origin, re-read per frame
    if (!marquee) {
      marquee = document.createElement('div'); marquee.className = 'marquee'; grid.appendChild(marquee);
      // snapshot cell rects once (page coords) — cells don't move within the page during a captured
      // drag, so we avoid a 2,500× layout read per move while staying scroll-proof
      dragRects = [...grid.children].filter(el => el !== marquee).map(el => {
        const b = el.getBoundingClientRect();
        return { id: el.dataset.id, b: { left: b.left + scrollX, right: b.right + scrollX, top: b.top + scrollY, bottom: b.bottom + scrollY } };
      });
    }
    const x0 = Math.min(down.x, mqX), y0 = Math.min(down.y, mqY), x1 = Math.max(down.x, mqX), y1 = Math.max(down.y, mqY);
    marquee.style.left = (x0 - gx) + 'px'; marquee.style.top = (y0 - gy) + 'px';
    marquee.style.width = (x1 - x0) + 'px'; marquee.style.height = (y1 - y0) + 'px';
    const hit = new Set(base);
    for (const { id, b } of dragRects) {
      if (id && b.right > x0 && b.left < x1 && b.bottom > y0 && b.top < y1) hit.add(id);
    }
    const sizeChanged = hit.size !== shelf.sel.size;
    shelf.sel = hit; paintSelected();
    if (sizeChanged) renderShelfBar();   // the bar only shows the count — rebuilding it per frame is waste
  }
  grid.addEventListener('pointermove', e => {
    if (!down) return;
    if (!moved && Math.hypot(e.pageX - down.x, e.pageY - down.y) < 5) return;   // movement threshold → drag
    moved = true;
    mqX = e.pageX; mqY = e.pageY;
    if (mqRaf) return;   // coalesce: high-rate mice fire 120–240 moves/s — one hit-test per frame is plenty
    mqRaf = requestAnimationFrame(() => { mqRaf = 0; if (down) mqApply(); });
  });
  grid.addEventListener('pointerup', e => {
    if (!down) return;
    // flush the queued frame BEFORE settling — a fast drag whose last pointermove hadn't painted yet
    // would otherwise lose its tail (the release-point cells silently missing from the selection)
    if (mqRaf) { cancelAnimationFrame(mqRaf); mqRaf = 0; if (moved) mqApply(); }
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
}

/* ---- the Shelf's menu: the shared mark menu (markmenu.js) with Use as seed on top ---- */
let markMenu = null, shelfMenuSurface = null;   // made in wire(); setupShelf() binds the grid's gestures
/** Open the menu for a cell. Right-click, long-press and Shift+F10 select the cell first when it is not in
 *  the selection (Finder). The marks act on the whole selection; Use as seed needs exactly one paint. */
function openShelfMenu(c, how = 'key', point = null) {
  const id = c.dataset.id;
  if (!shelf.sel.has(id)) setSelection([id], { anchor: id, cursor: id });
  const ids = [...shelf.sel], n = ids.length, one = n === 1 ? state.idx.byId.get(ids[0]) : null;
  markMenu.open({
    header: one ? ui.menuTitle(one) : t('nSelected', { n }),
    items: [
      { value: 'seed', label: t('useAsSeed'), disabled: n !== 1,
        hint: n === 1 ? '' : n ? t('useSeedMany') : t('useSeedNone'),
        why: n ? t('useSeedManySaid', { n }) : t('useSeedNoneSaid') },
      { sep: true },
      { value: 'owned', label: t('markOwned') },
      { value: 'want', label: t('markWant') },
      { value: 'none', label: t('clearMark') },
    ],
    anchor: c, point: how === 'mouse' ? point : null, back: $('#shelfGrid'),
    onChoose: v => { if (v === 'seed') useAsSeed(ids[0]); else applyMark(v); },
    onDisabled: it => say(it.why),
    onClose: () => $('#shelfGrid').classList.remove('menuopen'),
  });
  $('#shelfGrid').classList.add('menuopen');   // its title names the paint: no cell tip under the menu
}
/** Shelf menu → Use as seed: the Studio starts from this paint. The Shelf has no pick mode: a tap there
 *  still marks; this is the one way from the Shelf to a new scheme. */
function useAsSeed(id) {
  const p = state.idx.byId.get(id); if (!p) return;
  setMode('studio');
  selectPaint(id);
  window.scrollTo(0, 0);
  // Focus goes to the Studio tab of the switch, as when you change the mode by hand. Not the seed field:
  // on a phone, its keyboard would cover the new scheme.
  $('#modeNav [data-mode="studio"]').focus({ preventScroll: true });
}

/** Lightroom-style keyboard triage; active only in shelf mode, ignored while typing in a field. */
function shelfKeydown(e) {
  if (state.mode !== 'shelf') return;
  const ae = document.activeElement;
  // act only when the grid (or nothing) has focus — never hijack keys from chips, nav, or a text field.
  // The mark menu counts as "in the grid": it takes focus when it opens, and P/U/X still work there. The
  // menu's own keys (arrows, Esc, Tab) stop in the menu (markmenu.js), so they never reach this.
  if (ae && ae !== document.body && ae.id !== 'shelfGrid' && !ae.closest('#shelfGrid') && !markMenu.contains(ae)) return;
  // Never hijack a browser/OS chord: ⌘P (print), Ctrl+U (view source) and Ctrl+X (cut) all collide
  // with the P/U/X triage keys. Shift is NOT excluded — Shift+Arrow extends the selection, Shift+F10
  // opens the menu.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  $('#shelfGrid').dataset.input = 'key';   // the keyboard cursor's tooltip wins again (one tooltip at a time)
  const k = e.key.toLowerCase();
  const mark = { p: 'owned', u: 'want', x: 'none' }[k];
  if (mark) { markMenu.close(); applyMark(mark); e.preventDefault(); }
  else if (isMenuKey(e)) { e.preventDefault(); if (!markMenu.isOpen()) openShelfMenuFromKeys(); }
  else if (e.key === 'Escape') { setSelection([], { anchor: null }); e.preventDefault(); }
  else if (e.key.startsWith('Arrow')) { moveCursor(e.key, e.shiftKey); e.preventDefault(); }
}
/** Shift+F10 / the ContextMenu key: the menu opens at the cursor cell (USE_CASES §10.2). With no cursor,
 *  at the first selected paint; with neither, it says how to choose one. */
function openShelfMenuFromKeys() {
  const id = shelf.cursor && cellEl(shelf.cursor) ? shelf.cursor : [...shelf.sel].find(x => cellEl(x));
  if (!id) { announceShelf(t('menuNoPaint')); return; }
  const c = cellEl(id);
  revealCell(c);
  openShelfMenu(c, 'key');
}
function moveCursor(key, extend) {
  const list = shelf.viewIds || shelfPaints().map(p => p.id); if (!list.length) return;   // cached — no re-filter+sort per keypress
  let i = shelf.cursor ? list.indexOf(shelf.cursor) : -1;
  if (i < 0) i = 0;
  else { const cols = gridCols(); i += key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : key === 'ArrowDown' ? cols : -cols; }
  i = Math.max(0, Math.min(list.length - 1, i));
  const id = list[i];
  if (extend && shelf.anchor) setSelection(rangeIds(shelf.anchor, id), { cursor: id });
  else setSelection([id], { anchor: id, cursor: id });
  revealCell(cellEl(id));
  const p = state.idx.byId.get(id);
  announceShelf(`${ui.pname(p)}, ${p.brand}, ${ui.markLabel(store.markOf(id))}.`);
}

/* ---- the seed field (picker.js): what it needs from the app ---- */
let picker = { close() {}, refresh() {}, isOpen: () => false };   // setupPicker() in init() replaces it
/** Recent picks for the seed field's browse grid, newest first: this visit only, in memory (seed.js
 *  addRecent). Not saved: no new data to back up, restore or delete. */
let recentPicks = [];
/** Mark one paint from the seed field's list (its mark menu); the matches depend on the owned set. */
function markPaint(id, mark) {
  if (!['owned', 'want', 'none'].includes(mark)) return;
  store.setMark(id, mark);
  render('marks', { ids: [id] });
  const p = state.idx.byId.get(id);                  // the new state, for a screen reader too (§3.5)
  if (p) say(`${ui.pname(p)}, ${ui.markLabel(mark)}.`);
}
/** Esc after a live hex in the seed field: the pick from before the typing comes back. Esc means "never
 *  mind", so the colours typed since `mark` (histMark() when the typing began) leave the undo history:
 *  the palette at the mark comes back whole, and no new step goes on top of the cancelled ones. */
function restoreSeed(pick, mark = null) {
  // A note still waiting from the live hex ("switched to Neutral + pop") is about the change Esc undoes
  takeModeNote();
  const i0 = mark == null ? -1 : mark - HIST.dropped, snap = i0 >= 0 && i0 < HIST.i ? HIST.stack[i0] : null;
  const o = snap ? JSON.parse(snap) : null;
  const same = !!o && (pick.id ? o.baseId === pick.id && !o.customHex : o.customHex === pick.hex);
  if (same) {
    HIST.i = i0; HIST.stack.length = i0 + 1;
    HIST.busy = true; applySnap(snap);
  } else if (pick.id && state.idx.byId.has(pick.id)) { state.baseId = pick.id; state.customHex = null; }
  else state.customHex = pick.hex;
  seedNews(t('seedBack', { name: baseInfo().name }));
  render(same ? 'all' : 'seed');   // one announce: the news, any mode note, the scheme
  HIST.busy = false; syncHistBtns();
}
/** Seed-role switch (docked in the live palette): rebuild the scheme around the pick as `role`. */
function setSeedRole(role) {
  if ((role !== 'main' && role !== 'accent') || state.seedRole === role) return;
  state.seedRole = role;
  preNeutralSeedRole = null;   // an explicit dock choice outranks anything parked at the neutral boundary
  render('scheme');
}
function renderHero(animate = true) {
  $('#hero').innerHTML = ui.hero(baseInfo(), animate, store.markOf, state.seedRole, neutralSeed());   // animate=false during a live drag (no pop spam)
  // The legend stays in both seed modes now: the wheel draws in the scheme frame, so the P/A/2 badges
  // are correct in accent-seed mode too (they used to be suppressed there — see wheelRoleGlyphs).
  const wk = document.querySelector('.wkey'); if (wk) wk.hidden = false;
}
let urlTimer = null, announceTimer = null, wheelDragging = false;   // wheelDragging gates mid-drag history snapshots
function announce() {
  if (announceTimer) { clearTimeout(announceTimer); announceTimer = null; }
  // The substituted-pick honesty note must reach assistive tech too, not just sighted users (§2/§3.5).
  const sub = state.tab === 'plan' && state.scheme && state.scheme.roles.find(r => r.substituted);
  const subTxt = sub ? ` Note: your pick ${sub.substituted.name} is ${sub.substituted.why}; nearest eligible paint shown.` : '';
  // A pending mode-change note leads (it's the news), then the standing summary. Consumed once — the
  // switch is announced on the render that caused it, not on every later one.
  const note = modeNote; modeNote = ''; modeHarmonyNote = null;
  // The news (newsLead) comes before the mode note: what happened, then what it changed. A lead that
  // names the harmony ("Rolled: Compound") replaces "compound scheme" in the summary: one name, said once.
  const lead = newsLead, named = newsNamesHarmony; newsLead = ''; newsNamesHarmony = false;
  $('#status').textContent = (lead ? lead + '. ' : '') + (note ? note + ' ' : '')
    + `${baseInfo().name}, ${named ? '' : state.harmony + ' scheme, '}${state.tab} view.` + subTxt;
}
function updateUrl() {
  if (urlTimer) { clearTimeout(urlTimer); urlTimer = null; }
  // The link carries the PICK, role in `r` (share.js). The address bar carries `t` only for a link's
  // theme, the one theme a reload cannot get back from anywhere else. A device theme written as `t` came
  // back over "Follows your device" after the device changed; a saved one came back over a newer saved
  // pick. Share link adds the theme on screen (shareUrl).
  const p = encodeState({ ...state, theme: linkTheme, pickHex: pickHex() });
  history.replaceState(null, '', '?' + p.toString());
  // Mid-gesture URL writes (the debounced updates while a wheel drag is still down) must NOT snapshot:
  // one drag would otherwise litter the undo stack with intermediates, so Ctrl+Z after a drag stepped
  // back to a mid-drag colour instead of the pre-drag state. The drag's settling updateUrl (pointerup/
  // pointercancel) runs after the flag clears and takes the one real snapshot.
  if (!wheelDragging) pushHistory();
}

/* ---- undo / redo: snapshot the palette at each settled change (updateUrl is the single chokepoint) ---- */
// `dropped`: the steps that fell off the bottom of the stack, so a mark (histMark) stays right
const HIST = { stack: [], i: -1, busy: false, dropped: 0 };
/** Where the undo history is now. The seed field takes it when the typing begins (restoreSeed). A step
 *  still waiting for its debounced write (a slider or ↻ change in the last 250ms) is written first, so the
 *  mark is the palette on screen and Esc does not keep the typed colours. */
const histMark = () => { if (urlTimer && !wheelDragging) updateUrl(); return HIST.i + HIST.dropped; };
function paletteSnap() {
  return JSON.stringify({
    customHex: state.customHex || null,
    baseId: state.customHex ? null : state.baseId,
    harmony: state.harmony, seedRole: state.seedRole, showReal: state.showReal, popHex: state.popHex || null,
    // the hysteresis holder + parked harmony are palette state too: without them, undoing to a seed in
    // the 10–14 chroma deadband is re-classified with the CURRENT mode and the restored harmony is
    // forced away (and the parked hue harmony is lost when undoing across a neutral entry)
    neutral: neutralMode, preNeutral: preNeutralHarmony, preSeedRole: preNeutralSeedRole,
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
  if (HIST.stack.length > 100) { HIST.stack.shift(); HIST.i--; HIST.dropped++; }
  syncHistBtns();
}
function applySnap(json) {
  // News and a mode note still waiting to be said are about the change this snapshot reverses: drop them
  takeModeNote(); newsLead = ''; newsNamesHarmony = false;
  const o = JSON.parse(json);
  state.customHex = o.customHex; state.baseId = o.baseId;
  state.harmony = validHarmony(o.harmony) ? o.harmony : state.harmony;
  state.seedRole = o.seedRole === 'accent' ? 'accent' : 'main';
  state.showReal = !!o.showReal;
  state.popHex = o.popHex || null;
  state.extraNodes = (o.extraNodes || []).map(n => ({ h: n.h, s: n.s, ...(n.l != null ? { l: n.l } : {}), ...(n.locked ? { locked: true } : {}) }));
  state.dropOffsets = [...(o.dropOffsets || [])];
  state.wheelL = rgbToHsl(hexToRgb(schemeBase()))[2];
  neutralMode = typeof o.neutral === 'boolean' ? o.neutral : null;   // restore the hysteresis holder with the snapshot
  preNeutralHarmony = o.preNeutral ?? null;
  preNeutralSeedRole = o.preSeedRole ?? null;   // parked seed role travels with the snapshot too
  lastNeutral = null;   // force ensureHarmonyMode (via refreshStudio) to re-sync banner/strip/pops for the restored seed
  syncSeg();
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
  const wl = $('#wl'); if (wl) wl.value = Math.round(state.wheelL * 100);
  syncNodeBtns();
}
// A step still waiting for its debounced write goes on the stack first, so undo steps back from it (it
// was skipped, and its colour lost) and redo does not drop it.
function undo() { if (urlTimer) updateUrl(); if (HIST.i > 0) { HIST.i--; HIST.busy = true; applySnap(HIST.stack[HIST.i]); renderAll(); HIST.busy = false; syncHistBtns(); } }
function redo() { if (urlTimer) updateUrl(); if (HIST.i < HIST.stack.length - 1) { HIST.i++; HIST.busy = true; applySnap(HIST.stack[HIST.i]); renderAll(); HIST.busy = false; syncHistBtns(); } }
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
const renderAll = () => render('all');   // init / undo / redo
/** The device's light/dark setting. The app follows it, live, until the painter picks a theme (§3.1). */
const osDark = matchMedia('(prefers-color-scheme: dark)');
const deviceTheme = () => (osDark.matches ? 'dark' : 'light');
/** The theme a link's `t` applied, or null. It is shown, never saved; the address bar keeps it, so a
 *  refresh shows the link's theme again. A saved pick, Use device setting, a device change or a restore
 *  clears it. */
let linkTheme = null;

/** Apply a theme. Only the painter's own toggle saves it (`save`). The OS default and a shared link's
 *  `t` are applied but never stored: storing them froze "follow the OS" at the first visit's value, and
 *  let a dark share link overwrite the recipient's own saved choice. */
function setTheme(t, { save = false } = {}) {
  state.theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  if (save) store.setPref('theme', state.theme);
  const sw = document.querySelector('#themeToggle');   // keep the settings-menu theme switch in sync
  if (sw) sw.setAttribute('aria-checked', String(state.theme === 'dark'));
  syncThemeSlot();
}
function syncLocaleSeg() {                            // reflect the active locale in the settings-menu control
  const cur = i18n.getLocale(), seg = $('#localeSeg');
  if (seg) for (const x of seg.children) x.setAttribute('aria-pressed', String(x.dataset.locale === cur));
}
function setMode(mode) {
  state.mode = mode === 'shelf' ? 'shelf' : 'studio';
  const on = state.mode === 'shelf';
  picker.close();   // the seed field's list is a Studio control: never left open across a mode switch
  document.querySelector('main').dataset.mode = state.mode;
  document.body.dataset.mode = state.mode;   // the phone header drops its rule in Shelf mode (app.css)
  if (!on) closeShelfSheet({ returnFocus: false });
  document.querySelector('.workspace').hidden = on;
  $('#shelf').hidden = !on;
  for (const b of $('#modeNav').children) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  // Open the Shelf at its top. focus() alone scrolls the page to the grid and hides the search + filters;
  // the grid still takes focus so arrows and P/U/X work at once.
  if (on) {
    renderShelf(); window.scrollTo(0, 0);
    Object.assign(dock, { open: true, acc: 0, lastY: 0, stuck: false }); applyDock();
    $('#shelfGrid').focus({ preventScroll: true });
  }
  else if (studioMarksStale) paintStudioMarks();   // marks made on the Shelf: the Studio repaints now it shows
  updateUrl();
}
/** Seed from a paint: the seed field's list, or the Shelf's Use as seed. It goes into Recent. The render's
 *  announce starts with "New seed: X" (seedNews). */
function selectPaint(id) {
  state.baseId = id; state.customHex = null; recentPicks = addRecent(recentPicks, id);
  seedNews(t('newSeed', { name: baseInfo().name }));
  renderAll();
}
/** Change the harmony: a chip in the strip, and Roll a scheme. One path, so a roll is exactly a tap on
 *  its chip: one ↶ step, the chip centres, the hero pops, and one announce. `lead` is the news that
 *  leads that announce ("Rolled: Compound"); it names the harmony, so the summary does not say it again.
 *  `trigger`: the control that was pressed, which stays where it was on the screen (holdInPlace). */
function setHarmony(h, { lead = '', trigger = null } = {}) {
  state.harmony = h;
  state.dropOffsets = [];   // new harmony → fresh partners; any locked/edited swatches persist as free nodes
  for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));
  scrollHarmonyActive();
  // The painter chose this harmony, so a pending note that names the harmony a mode change chose is out of
  // date (↻ on black, then Roll before the debounced announce: "back to the complementary scheme" was said
  // with "analogous scheme"). Its short form keeps the news of the mode change.
  if (modeHarmonyNote) { modeNote = modeNote.replace(modeHarmonyNote.full, modeHarmonyNote.short); modeHarmonyNote = null; }
  // Add to news that waits for its announce (↻'s "Lightness moved to 12%" is debounced): do not replace it.
  if (lead) { newsLead = newsLead ? newsLead + '. ' + lead : lead; newsNamesHarmony = true; }
  holdInPlace(trigger, () => render('scheme'));
}
/**
 * Run `change`, then scroll the page so `el` is where it was on the screen (§3.4). Over 1024px the studio
 * column is sticky: with the page scrolled, it rests on the bottom edge of the workspace, so a new harmony
 * that changes the output column's height moved the whole studio (the strip and Roll with it) by 30–90px,
 * and the next press at the same place missed. Elsewhere `el` does not move, and nothing scrolls. At the
 * very bottom of the page there can be no room to scroll, so `el` can still move once there.
 */
function holdInPlace(el, change) {
  if (!el || !el.isConnected) { change(); return; }
  const y0 = el.getBoundingClientRect().top;
  change();
  const dy = el.getBoundingClientRect().top - y0;
  if (Math.abs(dy) < 0.5) return;
  let d = dy;
  const studio = el.closest('.studio');
  if (studio && getComputedStyle(studio).position === 'sticky') {
    // The studio top that puts el back at y0. Above the sticky top, the studio rests on the workspace's
    // bottom edge (top = that edge − its height), so scroll that edge to the place, in one step: also when
    // a taller output lifted the studio off the edge, where a scroll of dy alone leaves it stuck at the top.
    const s = studio.getBoundingClientRect(), target = y0 - (el.getBoundingClientRect().top - s.top);
    if (target < parseFloat(getComputedStyle(studio).top)) d = studio.parentElement.getBoundingClientRect().bottom - s.height - target;
  }
  window.scrollBy(0, d);
}
/** Roll a scheme (the d6, §3.6/§7): a random harmony for the colour now. The pick, its role, the
 *  lightness, the locked and added colours and the pop stay. Never Custom or the current harmony, and a
 *  neutral seed rolls only from the harmonies it can use (rollHarmony), so "Rolled: X" is always true. */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function rollScheme() {
  const h = rollHarmony(state.harmony, { neutral: neutralSeed() }, Math.random);
  setHarmony(h, { lead: t('rolled', { name: ui.harmonyLabel(h) }), trigger: $('#rollScheme') });
  // The die turns once (§3.4). The scheme changed above, at the press: nothing waits for the turn. The
  // CSS reduced-motion rule does not stop element.animate(), so the check is here.
  const die = $('#rollScheme .d6');
  if (!die || reduceMotion.matches || !die.animate) return;
  die.getAnimations().forEach(a => a.cancel());   // a fast second press starts the turn again
  // The same function list in every keyframe: lists that differ interpolate as matrices, and 200° → 360°
  // then turned back the short way instead of on to a full turn.
  die.animate([{ transform: 'translateY(0) rotate(0deg) scale(1)' },
    { transform: 'translateY(-5px) rotate(200deg) scale(.9)', offset: 0.45 },
    { transform: 'translateY(0) rotate(360deg) scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
/** Centre a harmony chip (by default the active one) in the scrollable strip — horizontal only (no page jump). The strip is
 *  position: relative (app.css), so a chip's offsetLeft is measured from the strip itself: the Roll
 *  button before it does not shift the centre. */
function scrollHarmonyActive(el = $('#seg')?.querySelector('button[aria-pressed="true"]')) {
  const seg = $('#seg');
  if (seg && el) seg.scrollLeft = el.offsetLeft - (seg.clientWidth - el.offsetWidth) / 2;
}
function syncTabs(focusActive = false) {
  const tabs = $('#tabs');
  for (const b of tabs.children) {
    const sel = b.dataset.tab === state.tab;
    b.setAttribute('aria-selected', String(sel));
    b.tabIndex = sel ? 0 : -1;        // roving tabindex (WAI-ARIA tabs pattern)
    if (sel && focusActive) b.focus();
    // On narrow screens the tab strip scrolls horizontally — centre the active tab in the strip.
    // Scroll the strip only: scrollIntoView also scrolled the page down to the tabs on load (small phones).
    if (sel && tabs.scrollWidth > tabs.clientWidth) {
      const tr = tabs.getBoundingClientRect(), br = b.getBoundingClientRect();
      tabs.scrollLeft += (br.left + br.width / 2) - (tr.left + tr.width / 2);
    }
  }
  for (const panel of document.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== state.tab;
}
function setTab(tab, focusActive = false) {
  state.tab = tab;
  syncTabs(focusActive);
  renderActive(); applyEquivSelect(); announce(); updateUrl();   // show/clear the Equivalents-source ring with the tab
}
/** Toggle a paint on/off the to-buy list (#5). Owned paints have no buy control, but guard anyway. */
function toggleBuy(id) {
  if (store.isOwned(id)) return;
  store.setMark(id, store.isWant(id) ? 'none' : 'want');
  render('marks', { ids: [id] });   // the hero and the Plan can both show this paint's toggle
}
/** One click: flag every paint this scheme needs (that you don't own) as to-buy (#5). */
function addGapsToBuy() {
  const ids = [...new Set(schemeGaps(state.scheme, store.ownedIds()).map(g => g.paint.id))].filter(id => store.markOf(id) !== 'want');
  const n = ids.length;
  if (n) { store.setMarks(ids, 'want'); render('marks', { ids }); }   // one write, one repaint
  toast(n ? `Added ${n} paint${n > 1 ? 's' : ''} to your buy list` : 'Nothing new to add');
}
function setLadder(v) {                          // #7 — tone-ladder style (persisted)
  if (!['wash', 'tone', 'both'].includes(v)) return;
  state.ladder = v; store.setPref('ladder', v);
  renderActive();
}
/** ⋯ → Use my paints (#6): off · prefer (boost) · only (filter); saved for the device. The menu's hint
 *  and the matching note follow — the hint only here and on open, never on a mark change (its live
 *  region would repeat itself while you stock the shelf). */
function setCollection(v) {
  if (!['off', 'prefer', 'only'].includes(v)) return;
  state.collection = v; store.setPref('collection', v);
  syncCollectionSeg(); syncUmpHint();
  renderLive(); renderActive(); renderMatchNote();
}
function toggleContrast() {                       // include Contrast paints in harmony suggestions (persisted)
  state.includeContrast = !state.includeContrast; store.setPref('contrast', state.includeContrast);
  renderLive(); renderActive(); renderMatchNote();
}
/** `speak: false`: only the toast shows; the caller's render says the words (seedNews). */
function toast(msg, { speak = true } = {}) {
  // The toast is what you see; say() is what a screen reader hears. A live region inserted with its text
  // already in it is not announced reliably, so the words go into a region that is already there.
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; d.setAttribute('aria-hidden', 'true');
  // An open modal <dialog> is in the top layer, above any z-index, so while one is open the toast goes
  // inside the top one, where you can see it.
  const modal = [...document.querySelectorAll('dialog[open]')].reverse().find(isModal);
  (modal || document.body).appendChild(d); setTimeout(() => d.remove(), 1700);
  if (speak) say(msg);
}
function isModal(el) {
  try { return el.matches(':modal'); } catch { return false; }   // :modal is Chrome 105+, Safari 15.6+
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
  download('palette-shopping-list.txt', t);
  toast(i18n.t('listSaved'));   // download is the artefact — no silent clipboard write (native-share direction)
}
/** Share the current scheme URL. Prefers the native share sheet (Web Share → OS sheet under Capacitor),
 *  then clipboard, then a visible-URL prompt. No silent clipboard side-effects. */
async function doShare() {
  const url = shareUrl(location.href, state.theme);   // without m=shelf (a friend gets the scheme, not your Shelf), with the theme on screen
  if (navigator.share) {
    try { await navigator.share({ title: 'Palette Studio for Miniatures', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // user dismissed the sheet
  }
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(url); toast(t('linkCopied')); return; } catch { /* fall through */ }
  }
  // the link itself, not the address bar: that one can carry m=shelf, and lacks the t=dark a share adds
  try { prompt(t('copyLink'), url); } catch { toast(url); }
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
/** Import a paintRack CSV (merges) or a Palette Studio JSON backup (#27). A backup REPLACES the shelf
 *  and settings, so it goes through the same confirm as ⋯ → Restore… — one rule for every .json. */
function importCollectionFile(file, opener) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    if (/\.json$/i.test(file.name) || /^\s*[{[]/.test(text)) { confirmRestore(text, opener); return; }
    const { matched, added, changed, unmatched } = applyCsv(text);
    // say what the merge DID — an import that silently rewrites existing marks (owned → to-buy
    // via a wishlist row) must at least be visible in the toast
    const bits = [`${added} new`, changed ? `${changed} changed` : '', unmatched.length ? `${unmatched.length} unmatched` : ''].filter(Boolean);
    toast(`Imported ${matched} paint${matched === 1 ? '' : 's'} · ${bits.join(' · ')}`);
    render('marks');   // many paints at once: the Shelf rebuilds, the Studio repaints where it shows
  };
  reader.onerror = () => toast(t('readFail'));
  reader.readAsText(file);
}
function applyCsv(text) {
  const res = csvToMarks(state.idx, text);
  let added = 0, changed = 0;   // count what the merge does to EXISTING marks (report, don't hide)
  const byMark = new Map();     // mark → ids, so each mark costs ONE write
  for (const m of res.marks) {
    const prev = store.markOf(m.id);
    if (prev === m.mark) continue;
    prev === 'none' ? added++ : changed++;
    if (!byMark.has(m.mark)) byMark.set(m.mark, []);
    byMark.get(m.mark).push(m.id);
  }
  // Grouped, not per row: setMark() ends in persist(), which JSON.stringifies the whole collection
  // and writes localStorage. A 1,500-row paintRack import did that 1,500 times over a growing array
  // inside one FileReader turn and froze the main thread — setMarks() exists for exactly this.
  for (const [mark, ids] of byMark) store.setMarks(ids, mark);   // merge onto the shelf (import wins; the toast says so)
  return { ...res, added, changed };
}
/** Pull every pref out of the store into live state + chrome. No rendering, so it's safe at init —
 *  where the seed isn't resolved yet and renderHero() would have nothing to draw. A theme or locale of
 *  null means "follow the device": it is applied, never saved (a restored backup, Delete, a first run). */
function applyPrefsToState({ keepLinkTheme = false } = {}) {
  const th = store.getPref('theme');
  if (keepLinkTheme && linkTheme) setTheme(linkTheme);
  else {
    linkTheme = null;   // a restored or deleted theme wins over a link's (init applies the link's after this)
    setTheme(th === 'light' || th === 'dark' ? th : deviceTheme());
  }
  i18n.applyLocale(store.getPref('locale')); syncLocaleSeg();
  const lp = store.getPref('ladder'); state.ladder = ['wash', 'tone', 'both'].includes(lp) ? lp : 'wash';
  const cp = store.getPref('collection'); state.collection = ['off', 'prefer', 'only'].includes(cp) ? cp : 'off';
  state.includeContrast = !!store.getPref('contrast');
}
/** The shelf and settings were replaced (Restore) or deleted: apply the new prefs at once and repaint
 *  everything that shows a mark or a setting. Without this they took effect only after a reload. */
function afterStoreReplaced({ keepLinkTheme = false } = {}) {
  applyPrefsToState({ keepLinkTheme });
  syncSettingsControls();
  render('all', { speak: false });   // the caller says what happened; the scheme summary would only bury it
  if (state.mode === 'shelf') renderShelf();
  renderMatchNote();
  syncLocaleStrings();
}

/* ---- ⋯ Settings (§3.6; mockups/collection-setting.html #fullmenu, corrected by #critique) ----
   One <dialog> for both layouts. SHEET is the same query app.css lays the rows out with, so the layout
   and the modality never disagree: a phone or a touch screen gets a MODAL sheet (showModal: the page
   behind is inert, Done closes it); a mouse gets a non-modal popover that Esc, a click outside, ⋯ or
   focus leaving it closes. Focus: in on the pressed Use my paints segment; out to whatever opened it. */
const SHEET = matchMedia('(max-width: 520px), (pointer: coarse)');
const settings = { opener: 'button', ret: 'opener', btnDown: false };   // opener: 'button' (⋯) | 'note'
const sMenu = () => $('#settingsMenu');
const settingsOpen = () => sMenu().open;
const UMP_WORD = { off: 'umpOff', prefer: 'umpPrefer', only: 'umpOnly' };
const UMP_HINT = { off: 'umpHintOff', prefer: 'umpHintPrefer', only: 'umpHintOnly' };
const umpHintHtml = v => `<b>${ui.esc(t(UMP_WORD[v]))}</b> · ${ui.esc(t(UMP_HINT[v]))}`;
/** The file name a backup saves as today (local date). */
function backupName(d = new Date()) {
  const p2 = n => String(n).padStart(2, '0');
  return `palette-studio-backup-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
}
/** Speak a short status. While a modal dialog is open the page behind it is inert, so #status there is
 *  never read out — the line goes to the open dialog's own live region instead (each has a [data-say]).
 *  The same words twice in a row get a trailing no-break space: a region whose text does not change
 *  says nothing. */
function say(msg) {
  const modal = [...document.querySelectorAll('dialog[open]')].reverse().find(isModal);
  const el = (modal && modal.querySelector('[data-say]')) || (settingsOpen() ? $('#setStatus') : null) || $('#status');
  el.textContent = el.textContent === msg ? msg + '\u00a0' : msg;
}

function syncCollectionSeg() {
  for (const b of $('#collectionSeg').children) b.setAttribute('aria-pressed', String(b.dataset.collection === state.collection));
}
/** The Use my paints hint (a live region). Called only when the painter changes the setting and just
 *  before the menu opens, never on a store update. With Prefer or Only but no owned paints, it says
 *  so and offers Open Shelf (outside the live region). */
function syncUmpHint() {
  const empty = state.collection !== 'off' && !store.counts().owned;
  const el = $('#umpHint'), html = empty ? ui.esc(t('umpHintEmpty')) : umpHintHtml(state.collection);
  // Write only a change: every write to a live region is read out again, the same words too (a language
  // change with the same hint, a restore that keeps the setting).
  if (el.innerHTML !== html) el.innerHTML = html;
  $('#umpOpenShelf').hidden = !empty;
}
/** The theme row's reserved slot: "Follows your device" (text) until the painter picks a theme, then
 *  a "Use device setting" text action. Both live in one cell, so swapping them moves nothing. */
function syncThemeSlot() {
  const slot = $('#themeSlot'); if (!slot) return;
  // Not following when a theme is saved, or when a link's theme differs from the device's. Testing only
  // the saved pref said "Follows your device" over a dark link on a light device.
  const follows = !store.getPref('theme') && state.theme === deviceTheme();
  slot.classList.toggle('saved', !follows);
  const sw = $('#themeToggle');
  if (follows) sw.setAttribute('aria-describedby', 'themeFollows'); else sw.removeAttribute('aria-describedby');
}
/** The hidden copies that hold each reserved slot open at its largest state (app.css .fixslot). Rebuilt
 *  on a language change, since the words set the size. */
function buildSlotSizers() {
  const fill = (slot, htmls) => {
    slot.querySelectorAll('.fixsize').forEach(x => x.remove());
    for (const h of htmls) slot.insertAdjacentHTML('afterbegin', h);
  };
  const size = (inner, cls = '') => `<div class="fixsize${cls}" aria-hidden="true">${inner}</div>`;
  // each Use my paints sizer is a hint state plus the shared line under it, as the live column is
  const shared = `<p class="sethint umpshared">${ui.esc(t('umpShared'))}</p>`;
  fill($('#umpSlot'), [
    ...['off', 'prefer', 'only'].map(v => size(`<div class="umpnow"><p class="sethint">${umpHintHtml(v)}</p></div>${shared}`)),
    size(`<div class="umpnow"><p class="sethint">${ui.esc(t('umpHintEmpty'))}</p><span class="btn">${ui.esc(t('openShelf'))}</span></div>${shared}`),
  ]);
  fill($('#backupSlot'), [t('backupHint'), t('backupSaved', { file: backupName() })]
    .map(x => size(`<p class="sethint">${ui.esc(x)}</p>`)));
}
/** Every settings control from the current state — before the menu shows, so nothing is announced. */
function syncSettingsControls() {
  syncCollectionSeg(); syncUmpHint(); syncThemeSlot(); syncLocaleSeg();
}
/** The Backup row's status line goes back to its hint. Only while the menu is closed (on open and on
 *  close): it is a live region, and a reset while you can hear it would read the hint out again. */
const resetBackupNow = () => { $('#backupNow').textContent = t('backupHint'); };
/** ⋯ and the note's Use my paints line both say whether the menu is open (aria-expanded). */
function setSettingsExpanded(open) {
  $('#settingsBtn').setAttribute('aria-expanded', String(open));
  renderMatchNote();
}
function placeSettings() {
  const m = sMenu(), b = $('#settingsBtn').getBoundingClientRect();
  let top = Math.round($('header').getBoundingClientRect().bottom + 6);
  // A short screen (a phone turned sideways, or 400% zoom: 1280×1024 is 320×256) leaves little room
  // under the header, which grows with zoom. A fixed dialog cannot be scrolled into view, so a height
  // floor put the lower rows off the screen for good (WCAG 1.4.10). Then the menu covers the header
  // instead: 8px from the top. The modal sheet makes the header inert anyway, and the popover still
  // closes with Esc or a click outside.
  if (innerHeight - top - 8 < 240) top = 8;
  const cw = document.documentElement.clientWidth;
  m.style.top = top + 'px';
  // under ⋯, right-aligned to it, and never closer than 8px to either screen edge
  m.style.right = Math.max(8, Math.min(Math.round(cw - b.right), cw - 8 - m.offsetWidth)) + 'px';
  m.style.maxHeight = (innerHeight - top - 8) + 'px';
  syncSettingsFade();
}
/** The bottom fade shows while more rows are below the visible part. */
function syncSettingsFade() {
  const b = $('#settingsBody');
  sMenu().classList.toggle('more', b.scrollTop + b.clientHeight < b.scrollHeight - 2);
}
function openSettings(opener = 'button') {
  const m = sMenu(); if (m.open) return;
  settings.opener = opener; settings.ret = 'opener';
  picker.close();
  syncSettingsControls(); resetBackupNow();
  if (SHEET.matches) m.showModal(); else m.show();
  placeSettings();
  $('#settingsBody').scrollTop = 0; syncSettingsFade();
  setSettingsExpanded(true);
  $('#collectionSeg [aria-pressed="true"]').focus();   // the first control (WAI-ARIA dialog pattern)
}
/** `ret`: where focus goes — 'opener' (⋯ or the note line), 'button' (⋯: an action that closes the menu,
 *  such as Save shopping list), or null (focus is already going somewhere else). */
function closeSettings(ret = 'opener') {
  if (!settingsOpen()) return;
  settings.ret = ret;
  sMenu().close();   // → the 'close' handler (also reached by the native Esc of the modal sheet)
  setSettingsExpanded(false);   // now, not a task later when 'close' fires
}
function onSettingsClosed() {
  setSettingsExpanded(false);
  resetBackupNow();   // reset while hidden, so the status line is not read out
  const ret = settings.ret; settings.ret = 'opener';
  if (ret === null) return;
  const el = ret === 'opener' && settings.opener === 'note' ? $('#matchnote [data-note="ump"]') : null;
  (el || $('#settingsBtn')).focus({ preventScroll: true });
}
function setupSettings() {
  const m = sMenu(), sBtn = $('#settingsBtn');
  buildSlotSizers();
  sBtn.addEventListener('click', e => { e.stopPropagation(); settings.btnDown = false; settingsOpen() ? closeSettings() : openSettings('button'); });
  $('#settingsDone').addEventListener('click', () => closeSettings());
  m.addEventListener('close', onSettingsClosed);
  $('#settingsBody').addEventListener('scroll', syncSettingsFade, { passive: true });
  addEventListener('resize', () => { if (settingsOpen()) placeSettings(); });
  // The layout and the modality come from one query: if it flips while open (a rotation), close.
  SHEET.addEventListener('change', () => closeSettings(null));
  // Popover only (the modal sheet has the native Esc, and the page behind it is inert). The listener is
  // on the menu, not the document, so an Esc in the Restore confirm (another dialog) never reaches it.
  m.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || isModal(m)) return;
    e.preventDefault(); e.stopPropagation(); closeSettings();
  });
  // A tap on the sheet's backdrop closes it. The dialog box itself is also the event target for a tap
  // on its own padding, so test the point, not the target.
  m.addEventListener('click', e => {
    if (!isModal(m) || e.target !== m) return;
    const r = m.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeSettings();
  });
  // Popover: a click outside closes it — not one on ⋯ or the note (their own click toggles it), and not
  // one in another open dialog (the Restore confirm opens over it).
  document.addEventListener('pointerdown', e => {
    if (e.target.closest('#settingsBtn, #matchnote [data-note="ump"]')) { settings.btnDown = true; return; }   // cleared by their click (or the pointerup below)
    if (!settingsOpen() || isModal(m) || m.contains(e.target) || e.target.closest('dialog[open]')) return;
    closeSettings(null);
  }, true);
  document.addEventListener('pointerup', () => { if (settings.btnDown) setTimeout(() => { settings.btnDown = false; }); }, true);
  // Popover: focus leaving it closes it (Tab past the end, Shift+Tab out). A null relatedTarget is the
  // window losing focus — the Restore file picker — so it stays open for the confirm.
  m.addEventListener('focusout', e => {
    const to = e.relatedTarget;
    if (!settingsOpen() || isModal(m) || !to || settings.btnDown || m.contains(to) || to.closest('dialog[open]')) return;
    closeSettings(null);
  });

  // Use my paints
  $('#collectionSeg').addEventListener('click', e => { const b = e.target.closest('[data-collection]'); if (b) setCollection(b.dataset.collection); });
  $('#umpOpenShelf').addEventListener('click', () => { closeSettings(null); setMode('shelf'); });
  // Theme: the switch saves a choice; "Use device setting" clears it and follows the device again
  $('#themeToggle').addEventListener('click', () => { linkTheme = null; setTheme(state.theme === 'dark' ? 'light' : 'dark', { save: true }); wheelDraw(); updateUrl(); });
  $('#themeUseDevice').addEventListener('click', () => {
    store.setPref('theme', null); linkTheme = null;   // a saved pick and a link's theme both give way
    setTheme(deviceTheme()); wheelDraw(); updateUrl();
    $('#themeToggle').focus();   // the button it was on is now the "Follows your device" text
    say(t('themeFollowsSaid'));
  });
  $('#localeSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    i18n.setLocale(b.dataset.locale);   // persists the pref + re-applies static [data-i18n] strings
    syncLocaleSeg(); syncLocaleStrings(); syncUmpHint();
    renderHero();                       // re-render JS-built strings that use i18n.t (e.g. the base label)
    wheelDraw();                        // …and the lightness slider's spoken value
  });
  // Scheme: both actions act on the finished scheme and close the menu; focus goes back to ⋯
  $('#export').addEventListener('click', () => { closeSettings('button'); doExport(); });
  $('#share').addEventListener('click', () => { closeSettings('button'); doShare(); });
  // Backup
  $('#backupBtn').addEventListener('click', () => {
    const name = saveBackup(), now = $('#backupNow');
    now.textContent = t('backupSaved', { file: name });
    // On a short phone the line can sit under the bottom fade: bring it into view (.setbody's
    // scroll-padding stops it above the fade)
    now.scrollIntoView({ block: 'nearest' });
    syncSettingsFade();
  });
  $('#restoreBtn').addEventListener('click', () => $('#restoreFile').click());
  $('#restoreFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => confirmRestore(String(reader.result || ''), $('#restoreBtn'));
    reader.onerror = () => toast(t('readFail'));
    reader.readAsText(f);
  });
  // Help & info
  $('#aboutOpenMenu').addEventListener('click', () => { closeSettings(null); openAbout($('#settingsBtn')); });
}

/* ---- Back up / Restore / Delete ---- */
/** Download the backup file (store.exportJSON, with its `saved` date). @returns the file name */
function saveBackup() {
  const name = backupName();
  download(name, store.exportJSON(), 'application/json');
  return name;
}
const cdlg = { onOk: null, opener: null };
/** The shared confirm (role=alertdialog, modal). Focus starts on Cancel. Esc or Cancel closes only it,
 *  and focus goes back to `opener`. "Save a backup of this shelf" changes in place to "✓ Saved", and the
 *  file name shows in a status line INSIDE the dialog, where a screen reader still hears it. */
function openConfirm({ title, bodyHtml, okLabel, onOk, opener }) {
  const d = $('#confirmDlg');
  $('#cdlgTitle').textContent = title;
  $('#cdlgBody').innerHTML = bodyHtml;
  $('#cdlgOkLbl').textContent = okLabel;
  $('#cdlgSaveLbl').textContent = t('saveBackup');
  $('#cdlgSave').removeAttribute('aria-disabled');
  $('#cdlgSaved').textContent = '';
  const slot = $('#cdlgSaveSlot');
  slot.querySelector('.fixsize')?.remove();
  slot.insertAdjacentHTML('afterbegin', `<div class="fixsize" aria-hidden="true"><p class="sethint">${ui.esc(t('savedFile', { file: backupName() }))}</p></div>`);
  cdlg.onOk = onOk; cdlg.opener = opener;
  d.showModal();
  $('#cdlgCancel').focus();
}
function setupConfirm() {
  const d = $('#confirmDlg');
  $('#cdlgCancel').addEventListener('click', () => d.close());
  $('#cdlgOk').addEventListener('click', () => { const fn = cdlg.onOk; cdlg.onOk = null; d.close(); fn?.(); });
  $('#cdlgSave').addEventListener('click', () => {
    if ($('#cdlgSave').getAttribute('aria-disabled') === 'true') return;   // saved already; focus stays here
    const name = saveBackup();
    $('#cdlgSaveLbl').textContent = t('savedShort');
    $('#cdlgSave').setAttribute('aria-disabled', 'true');
    $('#cdlgSaved').textContent = t('savedFile', { file: name });
  });
  d.addEventListener('close', () => {
    cdlg.onOk = null;
    // the opener can have gone from view (the Shelf hidden); fall back to a control that stays
    const o = cdlg.opener && cdlg.opener.isConnected && cdlg.opener.getClientRects().length ? cdlg.opener
      : settingsOpen() ? $('#restoreBtn') : $('#settingsBtn');
    o.focus({ preventScroll: true });
  });
}
const fmtCounts = c => t('counts', { owned: c.owned, want: c.want });
/** "In the backup (30 Sept 2026):" with the date, and the brackets and colon around it, in one piece:
 *  on a phone only "In the backup" may wrap, never inside the date. */
function datedLabel(date) {
  const mark = '\u0001';
  return ui.esc(t('inBackupDated', { date: mark }))
    .replace(new RegExp(`\\(?${mark}\\)?:?`), m => `<span class="nw">${m.replace(mark, ui.esc(date))}</span>`);
}
/** Restore… and a .json through Import…: read the file, show what Replace would do, apply nothing yet. */
function confirmRestore(text, opener) {
  const info = store.inspectJSON(text);
  if (!info.ok) { toast(t('notBackup')); opener?.focus({ preventScroll: true }); return; }
  const date = info.saved ? new Intl.DateTimeFormat(i18n.getLocale(), { dateStyle: 'medium' }).format(new Date(info.saved)) : null;
  const lost = info.lost ? `<p>${ui.esc(info.lost === 1 ? t('lostOne') : t('lostMany', { n: info.lost }))}</p>` : '';
  openConfirm({
    title: t('restoreTitle'),
    bodyHtml: `<dl class="cdlgcounts"><dt>${ui.esc(t('onDevice'))}</dt><dd>${ui.esc(fmtCounts(store.counts()))}</dd>`
      + `<dt>${date ? datedLabel(date) : ui.esc(t('inBackup'))}</dt><dd>${ui.esc(fmtCounts(info))}</dd></dl>`
      + lost + `<p>${ui.esc(t('restoreWarn'))}</p>`,
    okLabel: t('replace'), opener,
    onOk: () => {
      if (!store.importJSON(text)) { toast(t('notBackup')); return; }
      // The confirm is closed by now, so this shows in the menu or on the page. It goes first: a screen
      // reader then hears the news, and after it the Use my paints hint if the backup changed it.
      toast(t('restored'));
      afterStoreReplaced();
    },
  });
}
/** About & data → Delete my shelf and settings…: offers a backup first, then removes every copy. */
function confirmDelete() {
  openConfirm({
    title: t('deleteTitle'),
    bodyHtml: `<dl class="cdlgcounts"><dt>${ui.esc(t('onDevice'))}</dt><dd>${ui.esc(fmtCounts(store.counts()))}</dd></dl>`
      + `<p>${ui.esc(t('deleteWarn'))}</p>`,
    okLabel: t('deleteBtn'), opener: $('#deleteOpen'),
    onOk: () => { store.clear(); toast(t('deleted')); afterStoreReplaced(); },
  });
}

/* ---- About & data ---- */
let aboutOpener = null;
function openAbout(opener) { aboutOpener = opener; $('#about').showModal(); }
/** Strings built in JS that follow the language: the version line and the slot sizes. */
function syncLocaleStrings() {
  $('#aboutVersion').textContent = t('versionLine', { app: APP_VERSION, data: (state.idx && state.idx.version) || '—' });
  buildSlotSizers();
  renderMatchNote();
}

/* ---- the matching note under the live palette (ui.js matchNote) ---- */
let noteHtml = null;
function renderMatchNote() {
  const el = $('#matchnote'); if (!el) return;
  const html = ui.matchNote({ collection: state.collection, owned: store.counts().owned,
    contrast: state.includeContrast, expanded: settingsOpen() }, t);
  if (html !== noteHtml) { el.innerHTML = html; noteHtml = html; }   // unchanged → keep the DOM (and focus)
}
function setupMatchNote() {
  $('#matchnote').addEventListener('click', e => {
    const b = e.target.closest('[data-note]'); if (!b) return;
    const k = b.dataset.note;
    if (k === 'ump') { settings.btnDown = false; settingsOpen() ? closeSettings() : openSettings('note'); }
    else if (k === 'shelf') setMode('shelf');
    else if (k === 'contrast') {
      setTab('plan');
      const c = $('#inclContrast'); if (!c) return;
      c.focus({ preventScroll: true });
      const r = c.getBoundingClientRect();
      if (r.top < headerH() + 8 || r.bottom > innerHeight - 8) c.scrollIntoView({ block: 'center' });
    }
  });
}

/** Seed the scheme from an arbitrary hex (the seed field, the photo eyedropper, the base column).
 *  `speak: false`: the caller says the new seed itself (a live hex in the seed field). `news`: the words
 *  of the toast, which the render's announce says first (seedNews); true says "New seed: X". */
function seedFromHex(hex, { speak = true, news = '' } = {}) {
  state.customHex = hex.toUpperCase();
  if (news && speak) seedNews(news === true ? t('newSeed', { name: baseInfo().name }) : news);
  render('seed', { speak });
}

/** Photo eyedropper (#v2): pick a colour from a local image — drawn to a canvas, sampled (3×3 average),
 *  never uploaded. Single-pick → seeds the scheme. Uses a native <dialog> (focus-trap + Esc). */
function setupEyedropper() {
  const dlg = $('#eyedropper'), stage = $('#edStage'), cv = $('#edCanvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const loupe = $('#edLoupe'), lctx = loupe.getContext('2d'), chip = $('#edChip'), hexEl = $('#edHex'), useBtn = $('#edUse');
  let pick = null;                                     // the COMMITTED colour — only a click/tap (or drag) sets it
  const avg = (x, y) => {                              // ≤3×3 average around (x,y), clamped INSIDE the canvas
    // window never exceeds the canvas (a 2px image must not read out-of-bounds transparent black),
    // and pixels are alpha-weighted — transparent PNG background must not darken the sample
    const sw = Math.min(3, cv.width), sh = Math.min(3, cv.height);
    const x0 = Math.max(0, Math.min(cv.width - sw, x - 1)), y0 = Math.max(0, Math.min(cv.height - sh, y - 1));
    const d = ctx.getImageData(x0, y0, sw, sh).data; let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; r += d[i] * a; g += d[i + 1] * a; b += d[i + 2] * a; w += a; }
    return w ? rgbToHex([Math.round(r / w), Math.round(g / w), Math.round(b / w)]) : null;   // fully transparent spot → no pick
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
    const c = avg(x, y); if (!c) return;               // a fully-transparent spot has no colour to lock
    pick = c; chip.style.background = pick; hexEl.textContent = pick; useBtn.disabled = false;
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
  useBtn.addEventListener('click', () => { if (pick) { dlg.close(); seedFromHex(pick, { news: `Seeded from photo ${pick}` }); } });
  $('#edClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // backdrop click
}

function wire() {
  // The Shelf's Import… (a paintRack CSV, or a .json backup through the Restore confirm): remember the
  // button, so the confirm can hand focus back to it.
  let importOpener = null;
  // Plan-ladder step tips reuse the Shelf's clamped tooltip — an edge step's full name must not
  // clip at the viewport (§3.4); clampTip measures + shifts it on every show path.
  $('main').addEventListener('mouseover', e => { const st = e.target.closest('.ladder .step'); if (st) clampTip(st); });
  $('main').addEventListener('focusin', e => { const st = e.target.closest('.ladder .step'); if (st) clampTip(st); });
  $('main').addEventListener('click', e => {
    const eqs = e.target.closest('[data-eqsrc]');
    if (eqs) { e.stopPropagation(); setEquivSource(eqs.dataset.eqsrc); return; }   // tab-local source chips (A)
    const gq = e.target.closest('[data-goequiv]');
    if (gq) { e.stopPropagation(); setTab('equiv'); setEquivSource(gq.dataset.goequiv); return; }   // Plan-card jump (B)
    const sd = e.target.closest('[data-seeddock]');
    if (sd) {   // the palette's seed dock IS the Main|Accent control now
      e.stopPropagation();
      if (sd.getAttribute('aria-disabled') === 'true') { $('#status').textContent = sd.title; return; }
      setSeedRole(sd.dataset.seeddock);
      return;
    }
    const buy = e.target.closest('[data-buy]'); if (buy) { e.stopPropagation(); toggleBuy(buy.dataset.buy); return; }
    const lad = e.target.closest('[data-ladder]'); if (lad) { setLadder(lad.dataset.ladder); return; }
    const mv = e.target.closest('[data-move]'); if (mv) { e.stopPropagation(); const [i, dir] = mv.dataset.move.split(':').map(Number); moveFreeNode(i, i + dir); return; }  // reorder (keyboard/touch path)
    const lk = e.target.closest('[data-lock]'); if (lk) { e.stopPropagation(); lockSwatch(lk.dataset.lock); return; }              // lock / unlock a swatch
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); openSwatchEditor(ed.dataset.edit); return; }        // edit a swatch's hex
    const sb = e.target.closest('[data-setbase]'); if (sb) { e.stopPropagation(); seedFromSchemeBase(sb.dataset.setbase); return; }   // promote a swatch to the SCHEME base (accent-seed stores the pick 180° away)
    const dn = e.target.closest('[data-delnode]'); if (dn) { e.stopPropagation(); removeFreeNode(+dn.dataset.delnode); return; }  // delete an added swatch
    if (state.tab === 'equiv') {   // on the Equivalents tab, clicking a palette column drills into that colour's matches
      const lc = e.target.closest('.lcol[data-hex]');   // …but not when the click is the column's copy button (handled below)
      if (lc && !e.target.closest('.lccopy')) { e.stopPropagation(); setEquivSource(lc.dataset.hex); return; }
    }
    if (e.target.closest('#inclContrast')) { toggleContrast(); return; }
    if (e.target.closest('#addGaps')) { addGapsToBuy(); return; }
    const c = e.target.closest('[data-copy]'); if (c) copyText(c.dataset.copy);
  });
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { $('#status').textContent = b.title; return; }   // announce the why, change nothing
    setHarmony(b.dataset.h, { trigger: b });
  });
  // Keyboard focus centres its chip too: the browser left a half-visible chip (and its focus ring) cut off
  // at the strip's edge. Keyboard only — a mouse press must not slide the chip out from under itself.
  $('#seg').addEventListener('focusin', e => { if (e.target.matches('button:focus-visible')) scrollHarmonyActive(e.target); });
  $('#rollScheme').addEventListener('click', rollScheme);
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
    // A text field keeps its own undo. Not the seed field when it is empty and its list is closed (after a
    // pick, focus stays there): it has no text to undo, so the keys undo the scheme.
    const tg = e.target, seedIdle = tg.id === 'seedQ' && !tg.value && !picker.isOpen();
    if (!(e.metaKey || e.ctrlKey) || (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) && !seedIdle)) return;
    // Studio only: on the Shelf it changed a palette you cannot see. Not while a dialog is in front.
    if (state.mode !== 'studio' || document.querySelector('dialog[open]')) return;
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
  $('#compare').addEventListener('click', () => {
    if (state.compareA) { state.compareA = null; $('#compare').setAttribute('aria-pressed', 'false'); }
    else { const s = currentScheme(); state.compareA = { base: schemeBase(), harmony: state.harmony, colors: s.roles.map(r => r.idealHex) }; $('#compare').setAttribute('aria-pressed', 'true'); setTab('plan'); toast('Pinned A — change the scheme to compare'); }
    if (state.tab === 'plan') renderPlan();
  });
  setupSettings(); setupConfirm(); setupMatchNote();   // ⋯ Settings, the Restore/Delete confirm, the matching note

  // shelf chrome
  $('#modeNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  $('#shelfBrand').addEventListener('change', e => { state.shelfBrand = e.target.value; shelfFilterChanged(); });
  let sqTimer = 0;   // debounce: every keystroke rebuilt the full 2,508-cell grid — type-lag on phones
  $('#shelfQ').addEventListener('input', e => {
    clearTimeout(sqTimer);
    sqTimer = setTimeout(() => { state.shelfQ = e.target.value; shelfFilterChanged(); }, 140);
  });
  $('#shelfMarkSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.shelfMark = b.dataset.mark;
    shelfFilterChanged();
  });
  $('#shelfType').addEventListener('change', e => { state.shelfType = e.target.value; shelfFilterChanged(); });
  // Sorting doesn't change which paints are shown, so keep the selection — just re-render in the new order.
  $('#shelfSort').addEventListener('change', e => { state.shelfSort = e.target.value; renderShelf(); revealShelfResults(); });
  $('#shelfBar').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'deselect') setSelection([], { anchor: null });
    else applyMark(b.dataset.act);
  });
  $('#shelfSelect').addEventListener('click', () => {       // touch: toggle multi-select mode
    shelf.selectMode = !shelf.selectMode;
    $('#shelfSelect').setAttribute('aria-pressed', String(shelf.selectMode));
    if (!shelf.selectMode) setSelection([], { anchor: null });   // leaving select mode clears the selection
    $('#shelfHint').textContent = shelfHint();
  });
  $('#exportColl').addEventListener('click', exportCollectionCsv);
  $('#importColl').addEventListener('click', e => { importOpener = e.currentTarget; $('#importFile').click(); });
  $('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importCollectionFile(f, importOpener); e.target.value = ''; });
  document.addEventListener('keydown', shelfKeydown);
  markMenu = createMarkMenu({ box: $('#markMenu'), head: $('#markMenuHead'), list: $('#markMenuList') });
  setupShelf();
  setupShelfDock();

  // About & data modal — native <dialog> handles Esc + focus trap; close on backdrop click. It opens
  // from the footer or from ⋯ (which closes first), so focus goes back by hand to whichever it was.
  const about = $('#about');
  $('#aboutOpen').addEventListener('click', e => openAbout(e.currentTarget));
  $('#aboutClose').addEventListener('click', () => about.close());
  about.addEventListener('click', e => { if (e.target === about) about.close(); });   // click outside the panel
  about.addEventListener('close', () => { (aboutOpener || $('#aboutOpen')).focus({ preventScroll: true }); aboutOpener = null; });
  $('#deleteOpen').addEventListener('click', confirmDelete);
}

async function init() {
  const url = new URLSearchParams(location.search);
  // Theme precedence: the link's `t` (a shared scheme carries the theme it was designed in) > the
  // stored pref > the OS. Held separately from the resolved value because applyPrefsToState() below
  // re-applies the STORED pref after hydrate, and must not outrank the link. Only t=dark (share.js): the
  // address bar never writes t=light, so a t=light link changed theme on its first reload.
  const tParam = url.get('t') === 'dark' ? 'dark' : null;
  setTheme(tParam || store.getPref('theme') || deviceTheme());

  state.idx = await loadDataset('./data/paints.json');
  // Native shell: recover the collection if WKWebView evicted localStorage (no-op on the web). This
  // ran TWICE — the second call was byte-identical dead work — and neither re-applied what it
  // restored, so on a shell whose storage had been evicted the recovered theme/locale sat in state
  // while the DOM kept the pre-hydrate one. applyPrefsToState() below applies it.
  await store.hydrate();
  applyPrefsToState();   // hydrate may have restored theme/locale/plan prefs — apply them, don't strand them
  if (tParam) { linkTheme = tParam; setTheme(tParam); }   // ...but the link's theme still outranks the stored pref
  // Another tab saved a mark or a setting, or deleted or restored the shelf (store.js): show it here too.
  // This tab's link theme stays, unless the saved theme itself changed there.
  store.onExternalChange(before => afterStoreReplaced({ keepLinkTheme: before.theme === store.getPref('theme') }));
  state.brands = [...new Set(state.idx.paints.map(p => p.brand))].sort();
  $('#shelfBrand').insertAdjacentHTML('beforeend', ui.brandOptions(state.brands));   // brand and type filters: the Shelf's only (§3.6)
  const types = [...new Set(state.idx.paints.map(p => p.type))].sort();
  const typeOpts = types.map(t => `<option value="${ui.esc(t)}">${ui.esc(t.charAt(0).toUpperCase() + t.slice(1))}</option>`).join('');
  $('#shelfType').insertAdjacentHTML('beforeend', typeOpts);

  // One decoder (share.js), validators injected — anything this build no longer has is dropped so an
  // old link still opens on the fallbacks. `t`/`m` are read separately: theme applies before this
  // point, and the Shelf deep-link is applied after the first render.
  Object.assign(state, decodeState(url, {
    validHarmony, hasPaint: id => state.idx.byId.has(id), validTab: t => TABS.includes(t), maxFree: MAX_FREE,
  }));
  if (!state.customHex && !state.baseId) state.baseId = state.idx.paints[0].id;   // no usable seed in the link

  ensureHarmonyMode();   // seed is now known: sync the strip (incl. neutral mode) + banner + pops
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
  syncNodeBtns();
  if (!state.customHex) recentPicks = addRecent([], state.baseId);   // the paint the visit starts on is the first Recent pick
  syncTabs();
  wire();
  i18n.apply();   // localize static chrome strings ([data-i18n] / placeholders)
  syncLocaleSeg(); syncLocaleStrings(); syncSettingsControls();
  // Bind the wheel once (always-visible static markup) and keep its redraw. Everything it needs is
  // passed in — it owns no scheme state, so this list IS its whole contract with the app.
  ({ draw: wheelDraw, endLightnessRun } = setupWheel({
    state, render, pickHex, schemeBase, activePop, matchOpts, basePaint, wheelRoleGlyphs,
    addFreeNode, removeFreeNode, collapseBanner, seedNews,
    setDragging: v => { wheelDragging = v; },   // gates mid-drag history snapshots (one undo entry per drag)
  }));
  setupEyedropper();
  picker = setupPicker({
    state, t, say, markMenu,
    getPick: () => ({ id: state.customHex ? null : state.baseId, hex: pickHex() }),
    recent: () => recentPicks,
    markOf: store.markOf, ownedIds: store.ownedIds,
    seedPaint: selectPaint,
    seedHex: (hex, { live } = {}) => seedFromHex(hex, live ? { speak: false } : { news: true }),
    restoreSeed, markPaint, histMark, takeModeNote,
    coarse: () => COARSE, phone: () => PHONE.matches,
  });
  renderAll();
  if (url.get('m') === 'shelf') setMode('shelf');   // deep-link / refresh stays on the shelf
  // The first search letter would fold all 3,225 paints at once (about 70ms on a slow phone): do it now,
  // while the browser has nothing else to do.
  (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => warmPaintSearch(state.idx));
  // Until the painter picks a theme, keep following the OS while the app is open (e.g. an automatic
  // sunset switch). A saved choice always wins. Bound last: updateUrl() before the link is decoded
  // would rewrite the address bar without the shared scheme.
  osDark.addEventListener('change', e => {
    if (store.getPref('theme')) return;   // a saved choice wins; ⋯ → Use device setting clears it
    linkTheme = null;   // the device changed: follow it, over a link's theme too
    setTheme(e.matches ? 'dark' : 'light'); wheelDraw(); updateUrl();
  });
}

// iOS WebKit only applies :active styles on touch when a touchstart listener exists. The touch styles
// remove the grey tap flash (app.css), so :active (buttons press to .96) is now the press feedback.
document.addEventListener('touchstart', () => {}, { passive: true });

init().catch(err => {
  // err.message is not under the app's control (fetch/parse errors can echo response bodies) — the
  // ONE innerHTML sink that must escape (every other render path goes through ui.js esc()).
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${ui.esc(err.message)}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
