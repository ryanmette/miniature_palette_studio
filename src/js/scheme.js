// scheme.js — turn a base colour + harmony into a role-mapped, paint-matched scheme.
// Pure (takes an indexed dataset); the heart of "ideal vs actual" (CLAUDE.md §1, USE_CASES §3).

import { rotateHue, adjustHsl, adjustDirection, rgbToHsl, hexToRgb, hslToRgb, rgbToHex, hexToLab, deltaE2000, isNeutral, clamp01 } from './color.js';
import { harmonyPartners, neutralPartners, isNeutralHarmony, DEFAULT_POP } from './harmony.js';
import { nearestPaint } from './data.js';

// Tone ladders (#7). Two ways painters think about a role's value steps:
//  • 'wash'  — Wash · Base · Highlight: the *technique* ladder (recess wash + edge highlight around the paint).
//  • 'tone'  — Shadow · Mid · Highlight: a *value-structure* ladder centred on the colour as the mid-tone.
// 'both' shows both. The middle step (base/mid) is the role's ideal itself (adj=null). Deltas are in 0–1 HSL.
// (Each `adj` is an HSL nudge off the ideal: dl = lightness change, ds = saturation change.)
const LADDERS = {
  wash: { label: 'Wash · base · highlight', steps: [
    { key: 'wash', adj: { dl: -0.16, ds: 0.06 } },     // darker + a touch more saturated
    { key: 'base', adj: null },                        // the role's ideal, unchanged
    { key: 'highlight', adj: { dl: 0.24, ds: -0.12 } }, // lighter + a touch desaturated
  ] },
  tone: { label: 'Shadow · mid · highlight', steps: [
    { key: 'shadow', adj: { dl: -0.22, ds: 0.05 } },   // deeper shadow value
    { key: 'mid', adj: null },                         // the role's ideal, unchanged
    { key: 'highlight', adj: { dl: 0.20, ds: -0.06 } }, // lighter highlight value
  ] },
};
// Maps the user's ladder choice to which ladder(s) to render ('both' = wash and tone together).
const LADDER_STYLES = { wash: ['wash'], tone: ['tone'], both: ['wash', 'tone'] };

// Temperature ladder (v1.8 PR 2, §7 locked): a NEUTRAL role's value steps carry no hue to shade or
// highlight with — the painter's move is a temperature axis instead: shade it COOL (blue-grey into the
// recesses) and WARM the light (ivory/bone at the edges). Absolute hue/sat tints (the neutral has no
// hue of its own to adjust), lightness stepped off the role's ideal.
// h/s are ABSOLUTE hue/saturation tints (a neutral has no hue of its own to nudge); dl steps lightness
// off the role's ideal. The middle 'base' step (h: null) is the ideal itself, left as-is.
const TEMP_STEPS = [
  { key: 'cool', h: 222, s: 0.12, dl: -0.14 },   // blue-grey shadow (cool)
  { key: 'base', h: null, s: 0, dl: 0 },         // the neutral ideal, unchanged
  { key: 'warm', h: 32, s: 0.14, dl: 0.16 },     // ivory/bone highlight (warm)
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
  { key: 'shadow', adj: { dl: -0.26, ds: 0.04 } },   // deep shadow — the darkest rung
  { key: 'mid', adj: null },                         // the metal ideal, unchanged
  { key: 'highlight', adj: { dl: 0.30, ds: -0.18 } }, // near-white "ping" highlight
];

/** Heuristic ideal metal for a base colour (warm→gold, cool→silver, else gunmetal). A neutral base
 *  has no meaningful hue to read a temperature from, so it always gets gunmetal. */
export function metalIdeal(baseHex) {
  if (isNeutral(baseHex)) return '#6E7177';   // greyish seed → no temperature to read → gunmetal
  const [h] = rgbToHsl(hexToRgb(baseHex));    // grab the seed's hue angle (0–360°)
  if (h < 70 || h > 300) return '#C8A13A';    // reds/oranges/yellows/magentas are warm → gold
  if (h > 150 && h < 280) return '#B5B5BD';   // greens/cyans/blues are cool → silver
  return '#6E7177';                           // anything in between → neutral gunmetal
}

/**
 * The four role *ideal colours* for a base+harmony — Primary/Secondary/Accent/Metal — WITHOUT any paint
 * matching. Pure + cheap (a few ΔE calls, no dataset scan), so callers that only need the colours (e.g.
 * the live palette, to label each swatch with its role) can use it per frame. buildScheme builds on it.
 * @returns {Array<{role, weight, idealHex, metal?}>}
 */
export function roleIdeals(baseHex, harmony, popHex = DEFAULT_POP) {
  // Neutral harmonies build their hue-bearing partners from the pop colour (harmony.js
  // neutralPartners) — total for any seed, so a mid-transition mismatch can never throw. Their
  // recipes are ordered [secondary, accent] BY CONSTRUCTION (the pop/warm tint is the accent), so
  // they skip the ΔE-furthest rule — on a dark seed a light mid-tint out-distances a dark pop and
  // would steal the Accent slot from the colour the painter explicitly chose.
  const neutral = isNeutralHarmony(harmony);   // is this one of the greyscale/neutral harmony recipes?
  // Get the harmony's partner colours — neutral recipes build theirs from the pop colour, others rotate the hue.
  const partners = neutral
    ? neutralPartners(baseHex, popHex, harmony)
    : harmonyPartners(baseHex, harmony);
  const baseLab = hexToLab(baseHex);
  // Pick the Accent. Neutral recipes are pre-ordered so the last partner IS the accent; for normal
  // harmonies the accent is the partner FURTHEST from the base (biggest ΔE = the boldest contrast).
  let accent = neutral ? partners[partners.length - 1] : partners[0], amax = -1;
  if (!neutral) for (const p of partners) {
    const d = deltaE2000(baseLab, hexToLab(p.hex));
    if (d > amax) { amax = d; accent = p; }   // track the furthest partner as we go
  }
  const secondary = partners.find(p => p !== accent);   // Secondary = the first partner that isn't the accent
  // A rule-less harmony (custom) has no partners — fall back to sensible rotations so the role plan still reads.
  const accentHex = accent ? accent.hex : rotateHue(baseHex, 210);       // ~complement-ish fallback
  const secondaryHex = secondary ? secondary.hex : rotateHue(baseHex, 30); // ~analogous fallback
  // The four canonical roles with their rough coverage weights (~60/30/10 + a metal spot). Metal is flagged.
  return [
    { role: 'Primary', weight: '~60%', idealHex: baseHex },
    { role: 'Secondary', weight: '~30%', idealHex: secondaryHex },
    { role: 'Accent', weight: '~10%', idealHex: accentHex },
    { role: 'Metal', weight: 'spot', idealHex: metalIdeal(baseHex), metal: true },
  ];
}

/**
 * Build the role-mapped scheme. `opts` is forwarded to nearestPaint (e.g. {ownedIds, brands, boostIds});
 * `opts.ladder` ∈ {'wash'(default),'tone','both'} picks the tone-ladder style (#7).
 * @returns {{ base, harmony, ladder, roles: Array<{role, weight, idealHex, match, ladders}> }}
 */
export function buildScheme(idx, baseHex, harmony, opts = {}) {
  const defs = roleIdeals(baseHex, harmony, opts.pop);   // the four role IDEAL colours (no paint matching yet)
  const styles = LADDER_STYLES[opts.ladder] || LADDER_STYLES.wash;   // which tone ladder(s) to build (default wash)
  // Distinct role assignment: a small (owned-only) pool can map two close-hued roles to the SAME paint.
  // Assign roles in order, preferring a paint no earlier role used; if none is left, reuse it but flag the
  // role `shared` with a way to differentiate (adjust direction) + the nearest distinct paint to BUY.
  const usedIds = new Set();   // paint ids already claimed by an earlier role (drives distinct assignment)

  const roles = defs.map(d => {   // build one output role per ideal (Primary, Secondary, Accent, Metal)
    // A metal role keeps its type filter across the whole ladder (match + every step), so its
    // derived shades resolve to real metallics rather than flat colours. The slot whose ideal IS the
    // picked paint's own hex (Primary in main mode; Accent in accent mode) prefers the pick on exact
    // ΔE ties (Layer vs Dry twins share a hex — dataset order must not override the pick).
    // True when THIS role's ideal colour is the exact colour the user picked (its own hex) — so this is
    // the slot that should hold their pick (Primary in main mode, Accent in accent mode).
    const seedTarget = !!(opts.seed && opts.seed.hex && d.idealHex.toUpperCase() === opts.seed.hex.toUpperCase());
    // Metal role searches only metal-type paints; other roles use the caller's options as-is.
    let roleOpts = d.metal ? { ...opts, types: new Set(['metal']) } : opts;
    // For the seed's own slot, ask nearestPaint to prefer the picked paint on exact ΔE ties.
    if (seedTarget) roleOpts = { ...roleOpts, preferIds: new Set([opts.seed.id]) };
    // Helper to match ONE ladder step to a real paint. `media === 'wash'` means "prefer a real bottled wash".
    const step = (ideal, media) => {
      if (media === 'wash') {   // prefer a real wash/shade/ink; fall back to "watered down" base honestly
        const real = nearestPaint(idx, ideal, { ...roleOpts, types: WASH_MEDIA, excludeTypes: undefined });
        if (real && real.deltaE <= WASH_GATE) return { idealHex: ideal, match: real, media: 'wash' };   // good bottled wash found
        return { idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts), dilute: true };   // none close → thin the base, flagged
      }
      return { idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts) };   // ordinary step: nearest real paint
    };

    // First try: nearest paint NOT already used by an earlier role (so each role gets a distinct paint).
    let match = nearestPaint(idx, d.idealHex, { ...roleOpts, excludeIds: usedIds });
    let shared = false, differentiate = null, buy = null;
    if (!match) {                                   // pool out of distinct options → reuse + flag honestly
      match = nearestPaint(idx, d.idealHex, roleOpts);   // retry WITHOUT the exclude → allow reusing a paint
      if (match) {
        shared = true;   // flag this role as sharing a paint with another role
        // Tell the painter which way to shift the shared paint so the two roles still read apart.
        // adjustDirection(ideal, paint): the direction to move the PAINT toward this role's ideal.
        differentiate = adjustDirection(d.idealHex, match.paint.hex) || 'darken or lighten to separate';
        // nearest DISTINCT paint to buy — search the full catalogue (drop owned/boost filters). A metal role
        // keeps its metal-type filter so the buy is a real metallic; colour roles just keep finishes out.
        const buyOpts = d.metal ? { types: new Set(['metal']) } : { excludeTypes: opts.excludeTypes };
        buy = nearestPaint(idx, d.idealHex, { ...buyOpts, excludeIds: usedIds });   // the distinct paint to suggest buying
      }
    }
    if (match) usedIds.add(match.paint.id);   // claim this paint so later roles avoid it

    // Honesty (§2): you picked a real paint but filters put a DIFFERENT paint in its slot — say so,
    // with why, instead of silently substituting (e.g. "only owned" + an unowned pick, or a wash /
    // contrast pick that the finish exclusion keeps out of suggestions). Applies to whichever slot
    // carries the pick's own colour, in both seed modes.
    let substituted = null;
    // Only fires on the seed's own slot when the matched paint is NOT the picked paint — work out WHY.
    if (seedTarget && match && match.paint.id !== opts.seed.id) {
      const sp = idx.byId.get(opts.seed.id);   // the picked paint's own record
      const why = opts.ownedIds && !opts.ownedIds.has(opts.seed.id) ? 'not owned'   // "only owned" filter excluded it
        : sp && opts.excludeTypes && opts.excludeTypes.has(sp.type) ? `a ${sp.type} — excluded from suggestions`  // a finish type kept out
        : 'not eligible under the current filters';   // some other active filter
      substituted = { name: opts.seed.name, why };   // record what was swapped + the reason, shown honestly in the UI
    }

    // A neutral colour role leads with the temperature ladder (its value steps have no hue to walk);
    // the selected value ladder(s) still follow, so nothing is taken away — only reordered by relevance.
    const roleL = rgbToHsl(hexToRgb(d.idealHex))[2];   // the role ideal's own lightness (0–1), the temp ladder pivots on it
    // The un-adjusted base/mid rung REUSES the role's headline match (never a fresh search): the
    // headline was found with excludeIds for distinct assignment, so a re-search could resolve to a
    // different (already-used) paint — and shoppingList walks ladder steps, so the export would then
    // omit the very paint the card shows.
    const baseStep = { idealHex: d.idealHex, match };
    // Only NEUTRAL non-metal roles get a temperature ladder (a grey has no hue to shade/highlight). Empty otherwise.
    const tempLadder = !d.metal && isNeutral(d.idealHex) ? [{
      style: 'temp',
      label: 'Cool · base · warm',
      // For each temp step: the null-hue middle reuses the headline match; the others build an absolute cool/warm tint at the stepped lightness.
      steps: TEMP_STEPS.map(t => ({ key: t.key, ...(t.h == null ? baseStep : step(rgbToHex(hslToRgb([t.h, t.s, clamp01(roleL + t.dl)])))) })),
    }] : [];
    // Full ladder list for this role: the (optional) temperature ladder first, then each selected value ladder.
    const ladders = [...tempLadder, ...styles.map(st => ({
      style: st,
      label: LADDERS[st].label,
      // Each step: apply its HSL adj to the ideal then match a paint; the null middle step reuses the
      // headline match (baseStep) instead of re-searching. The 'wash' step passes media='wash' so it prefers a real bottled wash.
      steps: LADDERS[st].steps.map(s => ({ key: s.key, ...(s.adj ? step(adjustHsl(d.idealHex, s.adj), s.key === 'wash' ? 'wash' : null) : baseStep) })),
    }))];
    // Metal also gets the NMM alternative: the true metallic is what most painters expect, but the
    // non-metallic-metal technique needs FLAT paints — offer both, honestly labelled.
    let nmm = null;
    if (d.metal) {
      // NMM needs FLAT paints, so exclude metallics (on top of any finishes the caller already excludes).
      const nmmOpts = { ...opts, excludeTypes: new Set([...(opts.excludeTypes || []), 'metal']) };
      nmm = NMM_STEPS.map(s => {
        const ideal = s.adj ? adjustHsl(d.idealHex, s.adj) : d.idealHex;   // stepped colour (or the ideal for the middle)
        return { key: s.key, idealHex: ideal, match: nearestPaint(idx, ideal, nmmOpts) };   // nearest flat paint for the rung
      });
    }
    // The finished role: its ideal colour, best matched paint, sharing/substitution flags, buy suggestion, NMM, and ladders.
    return { role: d.role, weight: d.weight, idealHex: d.idealHex, match, shared, differentiate, buy, substituted, nmm, ladders };
  });
  // The whole scheme: the seed, the chosen harmony, the active ladder style, and every built role.
  return { base: baseHex, harmony, ladder: opts.ladder || 'wash', roles };
}

/**
 * Scheme "gaps" (#5): the distinct real paints this scheme relies on that the user does NOT own —
 * i.e. the candidates to add to a to-buy list. Walks every role match + ladder step, deduped by id.
 * @returns {Array<{role:string, paint:object, deltaE:number}>}
 */
export function schemeGaps(scheme, ownedSet = new Set()) {
  const seen = new Set(), gaps = [];   // `seen` dedupes by paint id; `gaps` is the result
  for (const r of scheme.roles) {
    // Every paint this role leans on: its main match plus each ladder step's match.
    const matches = [r.match, ...r.ladders.flatMap(l => l.steps.map(s => s.match))];
    for (const m of matches) {
      if (!m || ownedSet.has(m.paint.id) || seen.has(m.paint.id)) continue;   // skip empties, owned paints, and repeats
      seen.add(m.paint.id);
      gaps.push({ role: r.role, paint: m.paint, deltaE: Math.round(m.deltaE * 10) / 10 });   // ΔE rounded to 1 decimal
    }
  }
  return gaps;
}

/**
 * Flatten a scheme into a buyable shopping list (M8 export). Walks the active ladder(s); dedupes by
 * paint id so the middle step (base/mid) and any cross-ladder overlap aren't listed twice.
 */
export function shoppingList(scheme) {
  const rows = [], seen = new Set();   // `seen` dedupes by paint id across all roles/steps
  for (const r of scheme.roles) {
    // Append one row for a paint match, unless it's empty or already listed.
    const push = (roleLabel, m) => {
      if (!m || seen.has(m.paint.id)) return;
      seen.add(m.paint.id);
      rows.push({
        role: roleLabel, name: m.paint.name, brand: m.paint.brand, line: m.paint.line,
        hex: m.paint.hex, deltaE: Math.round(m.deltaE * 10) / 10, owned: !!m.owned,   // ΔE rounded; owned flag for the list
      });
    };
    // Walk every ladder step; the base/mid step is labelled just by the role, other steps get "Role step" (e.g. "Accent highlight").
    for (const lad of r.ladders) for (const s of lad.steps) {
      push(s.key === 'base' || s.key === 'mid' ? r.role : `${r.role} ${s.key}`, s.match);
    }
  }
  return rows;
}
