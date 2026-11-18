// scheme.js — turn a base colour + harmony into a role-mapped, paint-matched scheme.
// Pure (takes an indexed dataset); the heart of "ideal vs actual" (CLAUDE.md §1, USE_CASES §3).

import { rotateHue, adjustHsl, adjustDirection, rgbToHsl, hexToRgb, hslToRgb, rgbToHex, hexToLab, deltaE2000, isNeutral, clamp01 } from './color.js';
import { harmonyPartners, neutralPartners, isNeutralHarmony, DEFAULT_POP } from './harmony.js';
import { nearestPaint, matchQuality, familyOf, washByGap, WASH_GAP_NEAR } from './data.js';

// Tone ladders (#7). Two ways painters think about a role's value steps:
//  • 'wash'  — Wash · Base · Highlight: the *technique* ladder (recess wash + edge highlight around the paint).
//  • 'tone'  — Shadow · Mid · Highlight: a *value-structure* ladder centred on the colour as the mid-tone.
// 'both' shows both. The middle step (base/mid) is the role's ideal itself (adj=null). Deltas are in 0–1 HSL.
const LADDERS = {
  wash: { label: 'Wash · base · highlight', steps: [
    { key: 'wash', adj: { dl: -0.16, ds: 0.06 } },     // darker + a touch more saturated
    { key: 'base', adj: null },
    { key: 'highlight', adj: { dl: 0.24, ds: -0.12 } }, // lighter + a touch desaturated
  ] },
  tone: { label: 'Shadow · mid · highlight', steps: [
    { key: 'shadow', adj: { dl: -0.22, ds: 0.05 } },
    { key: 'mid', adj: null },
    { key: 'highlight', adj: { dl: 0.20, ds: -0.06 } },
  ] },
};
const LADDER_STYLES = { wash: ['wash'], tone: ['tone'], both: ['wash', 'tone'] };

// Temperature ladder (v1.8 PR 2, §7 locked): a NEUTRAL role's value steps carry no hue to shade or
// highlight with — the painter's move is a temperature axis instead: shade it COOL (blue-grey into the
// recesses) and WARM the light (ivory/bone at the edges). Absolute hue/sat tints (the neutral has no
// hue of its own to adjust), lightness stepped off the role's ideal.
const TEMP_STEPS = [
  { key: 'cool', h: 222, s: 0.12, dl: -0.14 },
  { key: 'base', h: null, s: 0, dl: 0 },
  { key: 'warm', h: 32, s: 0.14, dl: 0.16 },
];

// The 'wash' ladder step prefers REAL shading media — a bottled wash/shade/ink flows into recesses in
// a way a darkened base coat can't. When no medium lands within WASH_GATE ΔE, fall back to the darkened
// base match and say so honestly: the step is flagged `dilute` ("watered down" in the UI).
const WASH_MEDIA = new Set(['wash', 'shade', 'ink']);
const WASH_GATE = 10;   // beyond "Loose" there's no honest bottled wash — thin your base instead

/** One wash step (§7, Wash-step media). Three tries, in order:
 *  1. the real medium nearest by ΔE, within WASH_GATE;
 *  2. the real medium nearest by its colour, a gap of WASH_GAP_NEAR or less (PLAN §5 item 74): the step
 *     carries `gap`, and the card shows the gap, because this pot was not chosen by how dark it looks;
 *  3. the darkened-base match, flagged `dilute` ("watered down"). Only when there IS a paint to thin: a null
 *     match shows as "no close paint", not as a "watered down" tag on a paint that does not exist.
 *  `roleOpts` is the role's match options; the media search lifts the finish exclusion and the Metal role's
 *  type filter (a bottled shade over a metallic is standard practice). */
function washStep(idx, ideal, roleOpts) {
  const media = { ...roleOpts, types: WASH_MEDIA, excludeTypes: undefined };
  const real = nearestPaint(idx, ideal, media);
  if (real && real.deltaE <= WASH_GATE) return { idealHex: ideal, match: real, media: 'wash' };
  const byGap = washByGap(idx, ideal, media);
  if (byGap && byGap.gap <= WASH_GAP_NEAR) return { idealHex: ideal, match: byGap, media: 'wash', gap: byGap.gap };
  const fallback = nearestPaint(idx, ideal, roleOpts);
  return { idealHex: ideal, match: fallback, ...(fallback ? { dilute: true } : {}) };
}

// NMM — Non-Metallic Metal (§7, locked): paint the metal ILLUSION with flat paints via a hard
// value structure (deep shadow → mid → near-white ping). Steps derive from the Metal role's ideal;
// matching excludes metallics AND finishes so every rung is a flat paint you can layer.
const NMM_STEPS = [
  { key: 'shadow', adj: { dl: -0.26, ds: 0.04 } },
  { key: 'mid', adj: null },
  { key: 'highlight', adj: { dl: 0.30, ds: -0.18 } },
];

/** Heuristic ideal metal for a base colour (warm→gold, cool→silver, else gunmetal). A neutral base
 *  has no meaningful hue to read a temperature from, so it always gets gunmetal. */
export function metalIdeal(baseHex) {
  if (isNeutral(baseHex)) return '#6E7177';
  const [h] = rgbToHsl(hexToRgb(baseHex));
  if (h < 70 || h > 300) return '#C8A13A';
  if (h > 150 && h < 280) return '#B5B5BD';
  return '#6E7177';
}

/* ---- The Metal role with a shelf (PLAN §5 item 79; docs/UX_REVIEW.md §11; Ryan 2026-11-17: "15 and A") ----
   The Metal target is one of three fixed colours (metalIdeal), and the data has 244 metallics, so some pot is
   always within about 3 ΔE of it. With the common owned boost of 6, a metallic the painter owns never won:
   Leadbelcher is 10.3 from the silver, Retributor Armour 9.4 from the gold. Measured on five shelves, an owned
   metallic was the Metal pot for 7% of schemes. So, for this role only:
   - the rule: with Use my paints: Prefer, an owned metallic ranks METAL_OWNED_REACH ΔE closer (80%, no pot of
     the wrong kind, none over ΔE 14.2; a reach of 20 let a brass in for a gold);
   - the words: an owned pot inside that reach whose word would be Fair, Loose or Poor says "A metallic you own"
     instead, with no advice to mix or to shift the hue. Its ΔE is the true one (§2). The distance is to a colour
     the app chose for "a silver", not to one the harmony made, so "Poor" read as "your silver is a poor silver".
   A role the painter holds (a locked colour, a chosen pot) keeps the plain rule: its target is their choice. */
export const METAL_OWNED_REACH = 15;
export const OWN_METAL_QUALITY = Object.freeze({ label: 'A metallic you own', tier: 'neutral' });
const ownMetalWords = m => (m && m.owned && m.quality.tier !== 'success' && m.deltaE <= METAL_OWNED_REACH
  ? { ...m, quality: OWN_METAL_QUALITY, adjust: null } : m);
/** The Metal role's pot for its target: the nearest metallic, by the rule above. The Recipe (buildScheme) and
 *  the live palette's Metal column (app.js) both call it, so the two always show the same pot and words.
 *  `extra` adds match options (the Recipe's `excludeIds`, so no two roles share a pot). */
export function metalMatch(idx, idealHex, opts = {}, extra = {}) {
  const o = { ...opts, types: new Set(['metal']), ...extra };
  if (o.boostIds) o.boostAmount = METAL_OWNED_REACH;
  return ownMetalWords(nearestPaint(idx, idealHex, o));
}

/**
 * The four role *ideal colours* for a base+harmony — Primary/Secondary/Accent/Metal — WITHOUT any paint
 * matching. Pure + cheap (a few ΔE calls, no dataset scan), so callers that only need the colours (e.g.
 * the live palette, to label each swatch with its role) can use it per frame. buildScheme builds on it.
 * @returns {Array<{role, weight, idealHex, metal?}>}
 */
export function roleIdeals(baseHex, harmony, popHex = DEFAULT_POP, { accentHex = null } = {}) {
  // Neutral harmonies build their hue-bearing partners from the pop colour (harmony.js
  // neutralPartners) — total for any seed, so a mid-transition mismatch can never throw. Their
  // recipes are ordered [secondary, accent] BY CONSTRUCTION (the pop/warm tint is the accent), so
  // they skip the ΔE-furthest rule — on a dark seed a light mid-tint out-distances a dark pop and
  // would steal the Accent slot from the colour the painter explicitly chose.
  const neutral = isNeutralHarmony(harmony);
  const partners = neutral
    ? neutralPartners(baseHex, popHex, harmony)
    : harmonyPartners(baseHex, harmony);
  const baseLab = hexToLab(baseHex);
  let accent = neutral ? partners[partners.length - 1] : partners[0], amax = -1;
  if (!neutral) for (const p of partners) {
    const d = deltaE2000(baseLab, hexToLab(p.hex));
    if (d > amax) { amax = d; accent = p; }
  }
  const secondary = partners.find(p => p !== accent);
  // A rule-less harmony (custom) has no partners — fall back to sensible rotations so the role plan still reads.
  // Accent-seed pinning (§7): when the painter seeded the scheme AS the accent, the Accent role's
  // ideal is their picked colour verbatim in EVERY harmony — under the 180°-step harmonies the
  // geometry already lands there, but split-comp/analogous/value harmonies used to drop the picked
  // colour from the plan entirely (it appeared on no slot, so the pick tie-break and the honesty
  // note could never fire). The rest of the scheme still derives from the complement.
  const accentIdeal = accentHex || (accent ? accent.hex : rotateHue(baseHex, 210));
  const secondaryHex = secondary ? secondary.hex : rotateHue(baseHex, 30);
  return [
    { role: 'Primary', weight: '~60%', idealHex: baseHex },
    { role: 'Secondary', weight: '~30%', idealHex: secondaryHex },
    { role: 'Accent', weight: '~10%', idealHex: accentIdeal },
    { role: 'Metal', weight: 'spot', idealHex: metalIdeal(baseHex), metal: true },
  ];
}

/**
 * Build the role-mapped scheme. `opts` is forwarded to nearestPaint (e.g. {ownedIds, brands, boostIds});
 * `opts.ladder` ∈ {'wash'(default),'tone','both'} picks the tone-ladder style (#7).
 * `opts.holds` (mockups/hold-flow.html, direction A): what the painter holds on a role, by role name.
 *   { kind: 'lock', hex }  — the role's TARGET colour is `hex`; its pot is the nearest, as for any role.
 *   { kind: 'pot', id, hex, was? } — the role's POT is that paint (`was`: the paint a store swap replaced;
 *     the role then carries it as `swappedFrom`). The generated target stays as `idealHex`, so
 *     the gap shows (§2 honesty): the match's ΔE is the pot's distance from it. The ladders step from the
 *     pot's own colour. If `id` is not in the dataset, the hold acts as a lock on `hex`.
 * A held role is flagged `hold` ('lock' | 'pot'), with `generatedHex` (the target the rule made).
 * @returns {{ base, harmony, ladder, roles: Array<{role, weight, idealHex, match, ladders, hold?, generatedHex?, family?}> }}
 *   `family` (when the pot is one tone of a maker's family): data.js familyOf + `current`, the pot's id.
 */
export function buildScheme(idx, baseHex, harmony, opts = {}) {
  const holds = opts.holds || {};
  const defs = roleIdeals(baseHex, harmony, opts.pop, { accentHex: opts.accentHex }).map(d => {
    const h = holds[d.role];
    if (!h) return d;
    const pot = h.kind === 'pot' ? idx.byId.get(h.id) : null;
    // a store swap (item 38) remembers the paint it replaced, so the Recipe can say so and go back to it
    const was = pot && h.was ? idx.byId.get(h.was) : null;
    if (pot) return { ...d, hold: 'pot', pot, generatedHex: d.idealHex, ...(was ? { swappedFrom: was } : {}) };
    return h.hex ? { ...d, idealHex: h.hex.toUpperCase(), hold: 'lock', generatedHex: d.idealHex } : d;
  });
  const styles = LADDER_STYLES[opts.ladder] || LADDER_STYLES.wash;
  // Distinct role assignment: a small (owned-only) pool can map two close-hued roles to the SAME paint.
  // Assign roles in order, preferring a paint no earlier role used; if none is left, reuse it but flag the
  // role `shared` with a way to differentiate (adjust direction) + the nearest distinct paint to BUY.
  // Chosen pots are taken first, so no other role is given a paint the painter has put somewhere else.
  const usedIds = new Set(defs.filter(d => d.pot).map(d => d.pot.id));

  const roles = defs.map(d => {
    if (d.pot) return chosenPotRole(idx, d, opts, styles);
    // A metal role keeps its type filter for the match and the VALUE steps, so derived shades
    // resolve to real metallics rather than flat colours; the WASH rung deliberately searches real
    // shading media for every role including Metal (§7 wash-media rule — washing a metallic with a
    // bottled shade is standard practice). The slot whose ideal IS the picked paint's own hex
    // (Primary in main mode; the pinned Accent in accent mode — every harmony, via roleIdeals'
    // accentHex) prefers the pick on exact ΔE ties (Layer vs Dry twins share a hex — dataset order
    // must not override the pick).
    const seedTarget = !!(opts.seed && opts.seed.hex && d.idealHex.toUpperCase() === opts.seed.hex.toUpperCase());
    let roleOpts = d.metal ? { ...opts, types: new Set(['metal']) } : opts;
    if (seedTarget) roleOpts = { ...roleOpts, preferIds: new Set([opts.seed.id]) };
    const step = (ideal, media) => media === 'wash' ? washStep(idx, ideal, roleOpts)
      : { idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts) };

    // The Metal role's own pot has its own owned rule and words (metalMatch); a locked Metal colour does not
    const find = extra => (d.metal && !d.hold ? metalMatch(idx, d.idealHex, roleOpts, extra) : nearestPaint(idx, d.idealHex, { ...roleOpts, ...extra }));
    let match = find({ excludeIds: usedIds });
    let shared = false, differentiate = null, buy = null;
    if (!match) {                                   // pool out of distinct options → reuse + flag honestly
      match = find({});
      if (match) {
        shared = true;
        // adjustDirection(ideal, paint): the direction to move the PAINT toward this role's ideal.
        differentiate = adjustDirection(d.idealHex, match.paint.hex) || 'darken or lighten to separate';
        // nearest DISTINCT paint to buy — search the full catalogue (drop owned/boost filters). A metal role
        // keeps its metal-type filter so the buy is a real metallic; colour roles just keep finishes out.
        const buyOpts = d.metal ? { types: new Set(['metal']) } : { excludeTypes: opts.excludeTypes };
        buy = nearestPaint(idx, d.idealHex, { ...buyOpts, excludeIds: usedIds });
      }
    }
    if (match) usedIds.add(match.paint.id);

    // Honesty (§2): you picked a real paint but filters put a DIFFERENT paint in its slot — say so,
    // with why, instead of silently substituting (e.g. "only owned" + an unowned pick, or a wash /
    // contrast pick that the finish exclusion keeps out of suggestions). Applies to whichever slot
    // carries the pick's own colour, in both seed modes.
    let substituted = null;
    if (seedTarget && match && match.paint.id !== opts.seed.id) {
      const sp = idx.byId.get(opts.seed.id);
      const why = opts.ownedIds && !opts.ownedIds.has(opts.seed.id) ? 'not owned'
        : sp && opts.brands && !opts.brands.has(sp.brand) ? `not a ${[...opts.brands][0]} paint (Brand: Only)`
        : sp && opts.excludeTypes && opts.excludeTypes.has(sp.type) ? `a ${sp.type} — excluded from suggestions`
        : 'not eligible under the current filters';
      substituted = { name: opts.seed.name, why };
    }

    // A neutral colour role leads with the temperature ladder (its value steps have no hue to walk);
    // the selected value ladder(s) still follow, so nothing is taken away — only reordered by relevance.
    const roleL = rgbToHsl(hexToRgb(d.idealHex))[2];
    // The un-adjusted base/mid rung REUSES the role's headline match (never a fresh search): the
    // headline was found with excludeIds for distinct assignment, so a re-search could resolve to a
    // different (already-used) paint — and shoppingList walks ladder steps, so the export would then
    // omit the very paint the card shows.
    const baseStep = { idealHex: d.idealHex, match };
    const tempLadder = !d.metal && isNeutral(d.idealHex) ? [{
      style: 'temp',
      label: 'Cool · base · warm',
      steps: TEMP_STEPS.map(t => ({ key: t.key, ...(t.h == null ? baseStep : step(rgbToHex(hslToRgb([t.h, t.s, clamp01(roleL + t.dl)])))) })),
    }] : [];
    const ladders = [...tempLadder, ...styles.map(st => ({
      style: st,
      label: LADDERS[st].label,
      steps: LADDERS[st].steps.map(s => ({ key: s.key, ...(s.adj ? step(adjustHsl(d.idealHex, s.adj), s.key === 'wash' ? 'wash' : null) : baseStep) })),
    }))];
    // Metal also gets the NMM alternative: the true metallic is what most painters expect, but the
    // non-metallic-metal technique needs FLAT paints — offer both, honestly labelled.
    let nmm = null;
    if (d.metal) {
      const nmmOpts = { ...opts, excludeTypes: new Set([...(opts.excludeTypes || []), 'metal']) };
      nmm = NMM_STEPS.map(s => {
        const ideal = s.adj ? adjustHsl(d.idealHex, s.adj) : d.idealHex;
        return { key: s.key, idealHex: ideal, match: nearestPaint(idx, ideal, nmmOpts) };
      });
    }
    return { role: d.role, weight: d.weight, idealHex: d.idealHex, match, shared, differentiate, buy, substituted, nmm, ladders,
      ...(d.hold ? { hold: d.hold, generatedHex: d.generatedHex } : {}) };
  });
  // The maker's ladder (docs/TONE_LADDERS.md, direction A): when a role's pot is one tone of a maker's family
  // (Tone Pro's 1–5), the role carries the whole family as the maker made it. It is its own field, not a ladder:
  // nothing is matched to it (the app's steps are about two Tone Pro tones wide, §4.3), and the shopping list's
  // walk of `ladders` must not add five pots the painter did not choose.
  const withFamily = r => {
    const fam = r.match && familyOf(idx, r.match.paint);
    return fam ? { ...r, family: { ...fam, current: r.match.paint.id } } : r;
  };
  return { base: baseHex, harmony, ladder: opts.ladder || 'wash', roles: roles.map(withFamily) };
}

/** A role whose pot the painter chose: the pot is the match (its ΔE is from the generated target, so the
 *  card shows the gap), and the ladders (and NMM for Metal) step from the pot's own colour. The pot is
 *  used as it is, under every filter: the painter chose it (Use my paints decorates it, it never drops it). */
function chosenPotRole(idx, d, opts, styles) {
  const pot = d.pot, potHex = pot.hex.toUpperCase();
  const dE = deltaE2000(hexToLab(potHex), hexToLab(d.generatedHex));
  const owned = opts.knownOwnedIds ? opts.knownOwnedIds.has(pot.id) : undefined;
  const match = { paint: pot, deltaE: dE, quality: matchQuality(dE), chosen: true, ...(owned !== undefined ? { owned } : {}) };
  // The ladders are the same steps as any role's (§7), from the pot's colour. Only the base rung is the pot.
  const ladderScheme = buildScheme(idx, potHex, 'custom', { ...opts, holds: null, seed: null, accentHex: null });
  const twin = ladderScheme.roles.find(r => r.role === (d.metal ? 'Metal' : 'Primary'));
  const swapBase = s => (s.key === 'base' || s.key === 'mid' ? { ...s, idealHex: potHex, match } : s);
  // Primary's ladders step from its idealHex, which is the pot's colour here; Metal's twin steps from the
  // metal rule's ideal, so a metal pot builds its own ladders below.
  let ladders = twin.ladders.map(l => ({ ...l, steps: l.steps.map(swapBase) }));
  let nmm = null;
  if (d.metal) {
    const m = metalLadders(idx, potHex, opts, styles);
    ladders = m.ladders.map(l => ({ ...l, steps: l.steps.map(swapBase) }));
    nmm = m.nmm;
  }
  return { role: d.role, weight: d.weight, idealHex: d.generatedHex, match, shared: false, differentiate: null, buy: null,
    substituted: null, nmm, ladders, hold: 'pot', generatedHex: d.generatedHex, ...(d.swappedFrom ? { swappedFrom: d.swappedFrom } : {}) };
}

/** The Metal ladders and NMM steps from a given metal colour (a chosen metal pot's), as buildScheme makes them. */
function metalLadders(idx, hex, opts, styles) {
  const roleOpts = { ...opts, types: new Set(['metal']) };
  const step = (ideal, media) => media === 'wash' ? washStep(idx, ideal, roleOpts)
    : { idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts) };
  const ladders = styles.map(st => ({ style: st, label: LADDERS[st].label,
    steps: LADDERS[st].steps.map(s => ({ key: s.key, ...(s.adj ? step(adjustHsl(hex, s.adj), s.key === 'wash' ? 'wash' : null) : { idealHex: hex, match: null }) })) }));
  const nmmOpts = { ...opts, excludeTypes: new Set([...(opts.excludeTypes || []), 'metal']) };
  const nmm = NMM_STEPS.map(s => { const ideal = s.adj ? adjustHsl(hex, s.adj) : hex; return { key: s.key, idealHex: ideal, match: nearestPaint(idx, ideal, nmmOpts) }; });
  return { ladders, nmm };
}

/**
 * The paints a scheme needs that the painter does not own, each one time (#5).
 *
 * Each gap says which PART of the Recipe it is from (PLAN §5 item 80; UX review F04), because the parts are
 * different buys: `part: 'role'` is a role's own pot (four at most: the scheme itself); `'ladder'` is a step of
 * a tone ladder (a wash, a shadow, a highlight); `'nmm'` is a rung of the Metal role's NMM recipe only. One
 * button used to add all three: a median 14 pots from 7 brands, with the metallic ladder AND the NMM recipe,
 * which are two ways to paint one part. A paint in two parts counts in the first of role, ladder, nmm.
 * `nmm: true` marks every NMM rung, also one that is a role pot or a ladder step, so "add the NMM pots" can
 * add the whole recipe. The roles' pots come first in the list, then the ladders, then NMM.
 */
export function schemeGaps(scheme, ownedSet = new Set()) {
  const byId = new Map();
  const take = (r, m, part) => {
    if (!m || ownedSet.has(m.paint.id)) return;
    const had = byId.get(m.paint.id);
    if (had) { if (part === 'nmm') had.nmm = true; return; }
    byId.set(m.paint.id, { role: r.role, paint: m.paint, deltaE: Math.round(m.deltaE * 10) / 10, part, nmm: part === 'nmm' });
  };
  for (const r of scheme.roles) take(r, r.match, 'role');
  for (const r of scheme.roles) for (const l of r.ladders) for (const s of l.steps) take(r, s.match, 'ladder');
  // The NMM rungs are rendered on the Metal card as a real recipe, so they're real gaps too —
  // omitting them sent a painter following that recipe to the shop missing exactly its paints.
  for (const r of scheme.roles) for (const s of (r.nmm || [])) take(r, s.match, 'nmm');
  return [...byId.values()];
}

/**
 * Flatten a scheme into a buyable shopping list (M8 export). Walks the active ladder(s); dedupes by
 * paint id so the middle step (base/mid) and any cross-ladder overlap aren't listed twice.
 */
export function shoppingList(scheme) {
  const rows = [], seen = new Set();
  for (const r of scheme.roles) {
    // `gap`: a wash chosen by its colour (washStep's second try). The row says the gap, not only a large ΔE.
    const push = (roleLabel, m, gap) => {
      if (!m || seen.has(m.paint.id)) return;
      seen.add(m.paint.id);
      rows.push({
        role: roleLabel, name: m.paint.name, brand: m.paint.brand, line: m.paint.line,
        hex: m.paint.hex, deltaE: Math.round(m.deltaE * 10) / 10, owned: !!m.owned, ...(gap != null ? { gap: Math.round(gap) } : {}),
      });
    };
    for (const lad of r.ladders) for (const s of lad.steps) {
      push(s.key === 'base' || s.key === 'mid' ? r.role : `${r.role} ${s.key}`, s.match, s.gap);
    }
    // NMM is an ALTERNATIVE to the metallic, so its rungs are labelled as such rather than folded
    // into the role — the painter can see which rows belong to which technique.
    for (const s of (r.nmm || [])) push(`${r.role} NMM ${s.key}`, s.match);
  }
  return rows;
}
