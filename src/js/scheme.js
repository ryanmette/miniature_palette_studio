// scheme.js — turn a base colour + harmony into a role-mapped, paint-matched scheme.
// Pure (takes an indexed dataset); the heart of "ideal vs actual" (CLAUDE.md §1, USE_CASES §3).

import { rotateHue, adjustHsl, adjustDirection, rgbToHsl, hexToRgb, hslToRgb, rgbToHex, hexToLab, deltaE2000, isNeutral, clamp01 } from './color.js';
import { harmonyPartners, neutralPartners, isNeutralHarmony, DEFAULT_POP } from './harmony.js';
import { nearestPaint } from './data.js';

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
 * @returns {{ base, harmony, ladder, roles: Array<{role, weight, idealHex, match, ladders}> }}
 */
export function buildScheme(idx, baseHex, harmony, opts = {}) {
  const defs = roleIdeals(baseHex, harmony, opts.pop, { accentHex: opts.accentHex });
  const styles = LADDER_STYLES[opts.ladder] || LADDER_STYLES.wash;
  // Distinct role assignment: a small (owned-only) pool can map two close-hued roles to the SAME paint.
  // Assign roles in order, preferring a paint no earlier role used; if none is left, reuse it but flag the
  // role `shared` with a way to differentiate (adjust direction) + the nearest distinct paint to BUY.
  const usedIds = new Set();

  const roles = defs.map(d => {
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
    const step = (ideal, media) => {
      if (media === 'wash') {   // prefer a real wash/shade/ink; fall back to "watered down" base honestly
        const real = nearestPaint(idx, ideal, { ...roleOpts, types: WASH_MEDIA, excludeTypes: undefined });
        if (real && real.deltaE <= WASH_GATE) return { idealHex: ideal, match: real, media: 'wash' };
        // dilute only when there IS a base paint to thin — a null match must render as a plain
        // "no close paint", not a "watered down" tag pointing at a paint that doesn't exist.
        const fallback = nearestPaint(idx, ideal, roleOpts);
        return { idealHex: ideal, match: fallback, ...(fallback ? { dilute: true } : {}) };
      }
      return { idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts) };
    };

    let match = nearestPaint(idx, d.idealHex, { ...roleOpts, excludeIds: usedIds });
    let shared = false, differentiate = null, buy = null;
    if (!match) {                                   // pool out of distinct options → reuse + flag honestly
      match = nearestPaint(idx, d.idealHex, roleOpts);
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
    return { role: d.role, weight: d.weight, idealHex: d.idealHex, match, shared, differentiate, buy, substituted, nmm, ladders };
  });
  return { base: baseHex, harmony, ladder: opts.ladder || 'wash', roles };
}

/**
 * Scheme "gaps" (#5): the distinct real paints this scheme relies on that the user does NOT own —
 * i.e. the candidates to add to a to-buy list. Walks every role match + ladder step, deduped by id.
 * @returns {Array<{role:string, paint:object, deltaE:number}>}
 */
export function schemeGaps(scheme, ownedSet = new Set()) {
  const seen = new Set(), gaps = [];
  for (const r of scheme.roles) {
    const matches = [r.match, ...r.ladders.flatMap(l => l.steps.map(s => s.match))];
    for (const m of matches) {
      if (!m || ownedSet.has(m.paint.id) || seen.has(m.paint.id)) continue;
      seen.add(m.paint.id);
      gaps.push({ role: r.role, paint: m.paint, deltaE: Math.round(m.deltaE * 10) / 10 });
    }
  }
  return gaps;
}

/**
 * Flatten a scheme into a buyable shopping list (M8 export). Walks the active ladder(s); dedupes by
 * paint id so the middle step (base/mid) and any cross-ladder overlap aren't listed twice.
 */
export function shoppingList(scheme) {
  const rows = [], seen = new Set();
  for (const r of scheme.roles) {
    const push = (roleLabel, m) => {
      if (!m || seen.has(m.paint.id)) return;
      seen.add(m.paint.id);
      rows.push({
        role: roleLabel, name: m.paint.name, brand: m.paint.brand, line: m.paint.line,
        hex: m.paint.hex, deltaE: Math.round(m.deltaE * 10) / 10, owned: !!m.owned,
      });
    };
    for (const lad of r.ladders) for (const s of lad.steps) {
      push(s.key === 'base' || s.key === 'mid' ? r.role : `${r.role} ${s.key}`, s.match);
    }
  }
  return rows;
}
