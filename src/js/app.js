// app.js — application state, dataset loading, entry modes, tabs, conveniences, theme, URL sharing.
// The only module that touches the DOM. Pure logic lives in color/harmony/data/scheme/a11y/ui.

import { HARMONY_TYPES, isHarmony, isHueHarmony, HARMONY_OFFSETS, harmonize,
  isNeutralHarmony, neutralPartners, NEUTRAL_HARMONY_TYPES, DEFAULT_POP, POP_MIN_S, clampPop } from './harmony.js';
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, rotateHue, textOn, hexToLab, deltaE2000, isNeutral, labChroma, NEUTRAL_CHROMA, NEUTRAL_EXIT, normHex } from './color.js';
import { schemeBaseOf, pickForSchemeBase, swatchKeyHex } from './seed.js';   // the pick ↔ scheme-base frame
import { encodeState, decodeState } from './share.js';   // the share-link contract (state ⇄ URL)
import { setupWheel } from './wheel.js';   // the canvas wheel — bound once, returns its redraw
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
  popHex: null,                        // neutral mode's pop accent (null = DEFAULT_POP); drives the hue math when the seed is neutral
};
const OWNED_BOOST = 6;   // ΔE the soft owned-boost is "worth" — owned paints up to ~6 ΔE worse can still win (#6)
const METAL_DEMOTE = 4;  // ΔE handicap on metallics for COLOUR roles (they read differently on the model); the
                         // Metal role's all-metal pool demotes every candidate equally, so it's unaffected (§7)

/** The colour the painter PICKED. Its identity only — the hero, the seed badge, the hex field and the
 *  share URL. Anything that renders, hit-tests or resolves a swatch key uses schemeBase() (see seed.js). */
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
/** Match/scheme options from the single "use my collection" control: off · prefer (boost) · only (filter). */
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

function filteredPaints() {
  const q = state.q.toLowerCase();
  const list = state.idx.paints.filter(p =>
    (!state.brand || p.brand === state.brand) &&
    (!state.ptype || p.type === state.ptype) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
       || (p.line && p.line !== '—' && p.line.toLowerCase().includes(q))       // same fields as the Shelf search — the two surfaces must not answer differently
       || (p.dname && p.dname.toLowerCase().includes(q))));   // the displayed "(Line)" name is searchable too
  return sortPaints(list);
}
/** Sort a paint list by `key` (stable copy; '' keeps dataset order). Shared by the picker (state.psort)
 *  and the shelf (state.shelfSort). */
function sortPaints(list, key = state.psort) {
  // numeric sorts decorate–sort–undecorate: the key computes ONCE per paint, not once per comparison
  // (hue/light ran ~2·n·log n HSL conversions per sort; 'de' the same in ΔE2000)
  const by = fn => list.map(p => [fn(p), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  switch (key) {
    case 'name': return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    case 'brand': return list.slice().sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
    case 'hue': return by(p => rgbToHsl(hexToRgb(p.hex))[0]);
    case 'light': return by(p => rgbToHsl(hexToRgb(p.hex))[2]);
    case 'de': { const bl = hexToLab(pickHex()); return by(p => deltaE2000(bl, p.lab)); }
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
  render('scheme');
}
/** The neutral-mode chokepoint — call whenever the seed may have changed class. Keeps the harmony
 *  legal for the seed (parking/restoring the painter's hue harmony across the boundary), forces the
 *  seed to Primary (a neutral accent has no complement to build around), and syncs the banner, strip,
 *  and pop chips. Cheap when nothing changed, so the wheel's per-frame commit() can call it. */
let lastNeutral = null, preNeutralHarmony = null, preNeutralSeedRole = null;
let modeNote = '';   // set by ensureHarmonyMode on a real mode change; consumed once by announce()
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
  if (!legal) {
    state.dropOffsets = [];
    if (n) { preNeutralHarmony = state.harmony; state.harmony = 'neutral-pop'; }
    else { state.harmony = validHarmony(preNeutralHarmony) && !isNeutralHarmony(preNeutralHarmony) ? preNeutralHarmony : 'complementary'; preNeutralHarmony = null; }
    notes.push(n
      ? 'Neutral seed — switched to the Neutral + pop scheme. Hue harmonies are unavailable for a neutral.'
      : `Seed has a hue again — back to the ${state.harmony} scheme.`);
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
  if (notes.length) modeNote = notes.join(' ');

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
 *  wheel (paint pick, hex field, undo, init) — during a drag the slider is already the source. */
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
 *   'all'     init / undo / redo — everything, including the paint drawer
 *   'seed'    the pick changed (paint, hex field, photo, "use as base")
 *   'scheme'  harmony · seed role · pop changed; the seed itself did not
 *   'palette' added/locked/reordered swatches — studio only, exactly as before
 *   'drag'    a live wheel frame: coalesced to one repaint per frame, URL + speech debounced
 *   'settle'  a drag ended: commit the URL and speak; everything is already painted
 */
let renderRaf = 0;
function render(reason = 'scheme') {
  if (reason === 'settle') { updateUrl(); announce(); return; }

  ensureHarmonyMode();   // the seed may have crossed the neutral boundary (picker, hex, drag, undo)
  if (reason === 'seed' || reason === 'all') syncWheelL();

  if (reason === 'palette') { drawStudio(); updateUrl(); return; }

  const paint = () => {
    if (reason === 'all' || reason === 'seed') renderList();
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
  updateUrl(); announce();
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
    // The Metal column's matches float true metallics first — a flat near the hex isn't an equivalent (§7)
    const srcOpts = role === 'Metal' ? { floatTypes: new Set(['metal']) } : {};
    $('#panel-equiv').innerHTML = chips + ui.equivalentsPanel(name, nearestPaints(state.idx, srcHex, 8, srcOpts), store.markOf);
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
const renderers = { plan: renderPlan, equiv: renderEquiv, a11y: renderA11y };
function renderActive() { renderers[state.tab](); }

/* ---- shelf (collection) — Finder-style bulk stocking, wired to store.setMark ---- */
const COARSE = matchMedia('(pointer:coarse)').matches;   // touch = tap-to-cycle; mouse = multi-select (locked decisions)
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');   // ⌘ vs Ctrl for select-toggle
const shelf = { sel: new Set(), anchor: null, cursor: null, hover: null, selectMode: false, viewIds: null };   // ids; selection is transient (not persisted); viewIds = the drawn order (set by renderShelf)
const shelfPaints = () => {
  const q = state.shelfQ.trim().toLowerCase();
  const list = state.idx.paints.filter(p =>
    (!state.shelfBrand || p.brand === state.shelfBrand) &&
    (!state.shelfMark || store.markOf(p.id) === state.shelfMark) &&   // status filter: '' (all) | owned | want
    (!state.shelfType || p.type === state.shelfType) &&               // type filter (base/layer/shade/metal/…)
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
       || (p.line && p.line !== '—' && p.line.toLowerCase().includes(q))
       || (p.dname && p.dname.toLowerCase().includes(q))));   // the displayed "(Line)" name is searchable too
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
  renderShelfStats(); renderShelfBar();
}
/** A shelf filter (brand/status/type/search) changed → membership changes, so drop the selection
 *  (its ids may no longer be visible) and re-render. Sorting uses renderShelf directly (keeps selection). */
function shelfFilterChanged() { setSelection([], { anchor: null, cursor: null }); renderShelf(); }
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
function clampTip(c) {
  const tip = c.querySelector('.celltip'); if (!tip) return;
  tip.style.cssText = 'display:block;visibility:hidden';
  const w = tip.offsetWidth;
  tip.style.cssText = '';
  const r = c.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  const ideal = r.left + r.width / 2 - w / 2;             // where the centred tip's left edge would land
  const dx = ideal < 8 ? 8 - ideal : ideal + w > vw - 8 ? vw - 8 - (ideal + w) : 0;
  if (dx) tip.style.setProperty('--tipdx', dx.toFixed(1) + 'px');
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
  const cells = [];
  for (const id of ids) {
    const c = cellEl(id); if (c) { updateCell(c, mark); c.classList.remove('flash'); cells.push(c); }
  }
  // restart the confirm-flash with a SINGLE forced layout — write→read→write per cell was one full
  // grid layout per selected paint (a 500-cell mark froze the main thread for seconds on mobile)
  if (cells.length) { void cells[0].offsetWidth; for (const c of cells) c.classList.add('flash'); }
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
  c.setAttribute('aria-label', c.getAttribute('aria-label').replace(/—.*$/, '— ' + ui.markLabel(mark)));
}

/* mouse: click-select + marquee drag (mouse only; touch uses tap-to-cycle) */
function setupShelf() {
  const grid = $('#shelfGrid');
  grid.addEventListener('pointerover', e => { const c = e.target.closest('.cell'); shelf.hover = c ? c.dataset.id : null; if (c) clampTip(c); });
  grid.addEventListener('pointerout', e => { if (!e.relatedTarget || !grid.contains(e.relatedTarget)) shelf.hover = null; });
  grid.addEventListener('focusin', e => { const c = e.target.closest('.cell'); if (c) clampTip(c); });

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

  // right-click context menu → mark the selection (selecting the target first if it's outside the selection)
  grid.addEventListener('contextmenu', e => {
    const c = e.target.closest('.cell'); if (!c) return;
    e.preventDefault();
    if (!shelf.sel.has(c.dataset.id)) setSelection([c.dataset.id], { anchor: c.dataset.id, cursor: c.dataset.id });
    openMenu(e.clientX, e.clientY);
  });
}

let menuOpen = false, menuOpenedAt = 0;
function openMenu(x, y) {
  const m = $('#shelfMenu'); m.hidden = false; menuOpen = true; menuOpenedAt = performance.now();
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
  // act only when the grid (or nothing) has focus — never hijack keys from chips, nav, or a text field.
  // The context menu counts as "in the grid": openMenu moves focus onto its first button, and without
  // this Escape (and P/U/X) would dead-end there — no keyboard way back out of the menu.
  if (ae && ae !== document.body && ae.id !== 'shelfGrid' && !ae.closest('#shelfGrid') && !ae.closest('#shelfMenu')) return;
  // Never hijack a browser/OS chord: ⌘P (print), Ctrl+U (view source) and Ctrl+X (cut) all collide
  // with the P/U/X triage keys. Shift is NOT excluded — Shift+Arrow extends the selection.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'p') { applyMark('owned'); e.preventDefault(); }
  else if (k === 'u') { applyMark('want'); e.preventDefault(); }
  else if (k === 'x') { applyMark('none'); e.preventDefault(); }
  else if (e.key === 'Escape') { if (menuOpen) closeMenu(); else setSelection([], { anchor: null }); e.preventDefault(); }
  else if (e.key.startsWith('Arrow')) { moveCursor(e.key, e.shiftKey); e.preventDefault(); }
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
  cellEl(id)?.scrollIntoView({ block: 'nearest' });
  const p = state.idx.byId.get(id);
  announceShelf(`${ui.pname(p)}, ${p.brand}, ${ui.markLabel(store.markOf(id))}.`);
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
  if (p) $('#status').textContent = `${ui.pname(p)}, ${ui.markLabel(mark)}.`;
}
function paintListKeydown(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;   // same chord guard as the Shelf (⌘P / Ctrl+U / Ctrl+X)
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
  const note = modeNote; modeNote = '';
  $('#status').textContent = (note ? note + ' ' : '') + `${baseInfo().name}, ${state.harmony} scheme, ${state.tab} view.` + subTxt;
}
function updateUrl() {
  if (urlTimer) { clearTimeout(urlTimer); urlTimer = null; }
  const p = encodeState({ ...state, pickHex: pickHex() });   // the link carries the PICK, role in `r` (share.js)
  history.replaceState(null, '', '?' + p.toString());
  // Mid-gesture URL writes (the debounced updates while a wheel drag is still down) must NOT snapshot:
  // one drag would otherwise litter the undo stack with intermediates, so Ctrl+Z after a drag stepped
  // back to a mid-drag colour instead of the pre-drag state. The drag's settling updateUrl (pointerup/
  // pointercancel) runs after the flag clears and takes the one real snapshot.
  if (!wheelDragging) pushHistory();
}

/* ---- undo / redo: snapshot the palette at each settled change (updateUrl is the single chokepoint) ---- */
const HIST = { stack: [], i: -1, busy: false };
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
  if (HIST.stack.length > 100) { HIST.stack.shift(); HIST.i--; }
  syncHistBtns();
}
function applySnap(json) {
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
  const hx = $('#hex'); if (hx) hx.value = pickHex().replace('#', '');
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
const renderAll = () => render('all');   // init / undo / redo

function setTheme(t) {
  state.theme = t === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;
  store.setPref('theme', state.theme);
  const sw = document.querySelector('#themeToggle');   // keep the settings-menu theme switch in sync
  if (sw) sw.setAttribute('aria-checked', String(state.theme === 'dark'));
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
function selectPaint(id) { state.baseId = id; state.customHex = null; $('#hex').value = pickHex().replace('#', ''); renderAll(); }
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
  renderActive(); applyEquivSelect(); announce(); updateUrl();   // show/clear the Equivalents-source ring with the tab
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
  download('palette-shopping-list.txt', t);
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
      const ok = store.importJSON(text);
      toast(ok ? 'Collection restored from JSON backup' : 'That file is not a Palette Studio backup — nothing was changed');
      if (ok) applyRestoredPrefs();   // the backup's theme/locale/plan prefs must reach the RUNNING UI, not just storage
    } else {
      const { matched, added, changed, unmatched } = applyCsv(text);
      // say what the merge DID — an import that silently rewrites existing marks (owned → to-buy
      // via a wishlist row) must at least be visible in the toast
      const bits = [`${added} new`, changed ? `${changed} changed` : '', unmatched.length ? `${unmatched.length} unmatched` : ''].filter(Boolean);
      toast(`Imported ${matched} paint${matched === 1 ? '' : 's'} · ${bits.join(' · ')}`);
    }
    if (state.mode === 'shelf') renderShelf();
    renderList(); renderLive(); renderActive();
  };
  reader.onerror = () => toast('Could not read that file');
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
 *  where the seed isn't resolved yet and renderHero() would have nothing to draw. */
function applyPrefsToState() {
  const th = store.getPref('theme'); if (th === 'light' || th === 'dark') setTheme(th);
  const lo = store.getPref('locale'); if (lo) { i18n.setLocale(lo); syncLocaleSeg(); }
  const lp = store.getPref('ladder'); if (['wash', 'tone', 'both'].includes(lp)) state.ladder = lp;
  const cp = store.getPref('collection'); if (['off', 'prefer', 'only'].includes(cp)) state.collection = cp;
  state.includeContrast = !!store.getPref('contrast');
}
/** After a JSON restore: apply the prefs the backup carried AND repaint what shows them — without
 *  this the restored theme/locale/plan settings only took effect after a full reload. */
function applyRestoredPrefs() { applyPrefsToState(); renderHero(); wheelDraw(); }

/** Seed the scheme from an arbitrary hex (shared by the hex field + the photo eyedropper). */
function seedFromHex(hex) {
  state.customHex = hex.toUpperCase();
  $('#hex').value = state.customHex.replace('#', '');
  render('seed');
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
  useBtn.addEventListener('click', () => { if (pick) { dlg.close(); seedFromHex(pick); toast(`Seeded from photo ${pick}`); } });
  $('#edClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // backdrop click
}

function wire() {
  // Same 140ms debounce the Shelf search already had: every keystroke otherwise re-ran
  // filteredPaints() + sortPaints() over 2,508 paints and replaced the whole chip strip's innerHTML,
  // so typing a paint name cost nine full parse+layout cycles — type-lag on phones.
  let qTimer = 0;
  $('#q').addEventListener('input', e => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = e.target.value; renderList(); }, 140);
  });
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
    const col = e.target.closest('[data-collection]'); if (col) { setCollection(col.dataset.collection); return; }
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
  $('#hex').addEventListener('input', e => {
    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
    e.target.value = v;
    if (v.length === 6) seedFromHex('#' + v);
  });
  $('#seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { $('#status').textContent = b.title; return; }   // announce the why, change nothing
    state.harmony = b.dataset.h;
    state.dropOffsets = [];   // new harmony → fresh partners; any locked/edited swatches persist as free nodes
    for (const x of $('#seg').children) x.setAttribute('aria-pressed', String(x.dataset.h === state.harmony));
    scrollHarmonyActive();
    render('scheme');
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
  $('#themeToggle').addEventListener('click', () => { setTheme(state.theme === 'dark' ? 'light' : 'dark'); wheelDraw(); updateUrl(); });
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
  $('#shelfSort').addEventListener('change', e => { state.shelfSort = e.target.value; renderShelf(); });
  $('#shelfBar').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'deselect') setSelection([], { anchor: null });
    else applyMark(b.dataset.act);
  });
  $('#shelfMenu').addEventListener('click', e => {
    // A long-press opens the menu under the fingertip with a button focused — the click some browsers
    // synthesize at finger-lift would instantly activate it before the user ever saw the menu.
    if (performance.now() - menuOpenedAt < 350) return;
    const b = e.target.closest('[data-act]'); if (b) { applyMark(b.dataset.act); closeMenu(); }
  });
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
  // Theme precedence: the link's `t` (a shared scheme carries the theme it was designed in) > the
  // stored pref > the OS. Held separately from the resolved value because applyPrefsToState() below
  // re-applies the STORED pref after hydrate, and must not outrank the link.
  const urlTheme = url.get('t') === 'dark' ? 'dark' : url.get('t') === 'light' ? 'light' : null;
  setTheme(urlTheme || store.getPref('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  state.idx = await loadDataset('./data/paints.json');
  // Native shell: recover the collection if WKWebView evicted localStorage (no-op on the web). This
  // ran TWICE — the second call was byte-identical dead work — and neither re-applied what it
  // restored, so on a shell whose storage had been evicted the recovered theme/locale sat in state
  // while the DOM kept the pre-hydrate one. applyRestoredPrefs() exists for exactly that.
  await store.hydrate();
  applyPrefsToState();   // hydrate may have restored theme/locale/plan prefs — apply them, don't strand them
  if (urlTheme) setTheme(urlTheme);   // ...but the link's theme still outranks the stored pref
  state.brands = [...new Set(state.idx.paints.map(p => p.brand))].sort();
  $('#brand').insertAdjacentHTML('beforeend', ui.brandOptions(state.brands));
  $('#shelfBrand').insertAdjacentHTML('beforeend', ui.brandOptions(state.brands));   // the Shelf filters brand the same way the drawer does
  const types = [...new Set(state.idx.paints.map(p => p.type))].sort();
  const typeOpts = types.map(t => `<option value="${ui.esc(t)}">${ui.esc(t.charAt(0).toUpperCase() + t.slice(1))}</option>`).join('');
  $('#ptype').insertAdjacentHTML('beforeend', typeOpts);
  $('#shelfType').insertAdjacentHTML('beforeend', typeOpts);

  // One decoder (share.js), validators injected — anything this build no longer has is dropped so an
  // old link still opens on the fallbacks. `t`/`m` are read separately: theme applies before this
  // point, and the Shelf deep-link is applied after the first render.
  Object.assign(state, decodeState(url, {
    validHarmony, hasPaint: id => state.idx.byId.has(id), validTab: t => !!renderers[t], maxFree: MAX_FREE,
  }));
  if (!state.customHex && !state.baseId) state.baseId = state.idx.paints[0].id;   // no usable seed in the link

  ensureHarmonyMode();   // seed is now known: sync the strip (incl. neutral mode) + banner + pops
  for (const x of $('#realtoggle').children) x.setAttribute('aria-pressed', String((x.dataset.fill === 'real') === state.showReal));
  syncNodeBtns();
  $('#hex').value = pickHex().replace('#', '');
  syncTabs();
  wire();
  i18n.apply();   // localize static chrome strings ([data-i18n] / placeholders)
  syncLocaleSeg();
  // Bind the wheel once (always-visible static markup) and keep its redraw. Everything it needs is
  // passed in — it owns no scheme state, so this list IS its whole contract with the app.
  wheelDraw = setupWheel({
    state, render, schemeBase, activePop, matchOpts, basePaint, wheelRoleGlyphs,
    addFreeNode, removeFreeNode, collapseBanner,
    setDragging: v => { wheelDragging = v; },   // gates mid-drag history snapshots (one undo entry per drag)
  });
  setupEyedropper();
  renderAll();
  if (url.get('m') === 'shelf') setMode('shelf');   // deep-link / refresh stays on the shelf
}

init().catch(err => {
  // err.message is not under the app's control (fetch/parse errors can echo response bodies) — the
  // ONE innerHTML sink that must escape (every other render path goes through ui.js esc()).
  $('main').innerHTML = `<p style="padding:24px;color:var(--danger);max-width:60ch">Couldn't load the paint data: ${ui.esc(err.message)}.
    Serve the app from a local web server (e.g. <code class="mono">python3 -m http.server</code> in <code class="mono">src/</code>)
    so the browser can fetch <code class="mono">data/paints.json</code>.</p>`;
});
