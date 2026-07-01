// scheme.js — turn a base colour + harmony into a role-mapped, paint-matched scheme.
// Pure (takes an indexed dataset); the heart of "ideal vs actual" (CLAUDE.md §1, USE_CASES §3).

import { rotateHue, adjustHsl, adjustDirection, rgbToHsl, hexToRgb, hexToLab, deltaE2000, isNeutral } from './color.js';
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
export function roleIdeals(baseHex, harmony, popHex = DEFAULT_POP) {
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
  const accentHex = accent ? accent.hex : rotateHue(baseHex, 210);
  const secondaryHex = secondary ? secondary.hex : rotateHue(baseHex, 30);
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
  const defs = roleIdeals(baseHex, harmony, opts.pop);
  const styles = LADDER_STYLES[opts.ladder] || LADDER_STYLES.wash;
  // Distinct role assignment: a small (owned-only) pool can map two close-hued roles to the SAME paint.
  // Assign roles in order, preferring a paint no earlier role used; if none is left, reuse it but flag the
  // role `shared` with a way to differentiate (adjust direction) + the nearest distinct paint to BUY.
  const usedIds = new Set();

  const roles = defs.map(d => {
    // A metal role keeps its type filter across the whole ladder (match + every step), so its
    // derived shades resolve to real metallics rather than flat colours.
    const roleOpts = d.metal ? { ...opts, types: new Set(['metal']) } : opts;
    const step = ideal => ({ idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts) });

    let match = nearestPaint(idx, d.idealHex, { ...roleOpts, excludeIds: usedIds });
    let shared = false, differentiate = null, buy = null;
    if (!match) {                                   // pool out of distinct options → reuse + flag honestly
      match = nearestPaint(idx, d.idealHex, roleOpts);
      if (match) {
        shared = true;
        differentiate = adjustDirection(match.paint.hex, d.idealHex) || 'darken or lighten to separate';
        // nearest DISTINCT paint to buy — search the full catalogue (drop owned/boost filters). A metal role
        // keeps its metal-type filter so the buy is a real metallic; colour roles just keep finishes out.
        const buyOpts = d.metal ? { types: new Set(['metal']) } : { excludeTypes: opts.excludeTypes };
        buy = nearestPaint(idx, d.idealHex, { ...buyOpts, excludeIds: usedIds });
      }
    }
    if (match) usedIds.add(match.paint.id);

    const ladders = styles.map(st => ({
      style: st,
      label: LADDERS[st].label,
      steps: LADDERS[st].steps.map(s => ({ key: s.key, ...step(s.adj ? adjustHsl(d.idealHex, s.adj) : d.idealHex) })),
    }));
    return { role: d.role, weight: d.weight, idealHex: d.idealHex, match, shared, differentiate, buy, ladders };
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
