// scheme.js — turn a base colour + harmony into a role-mapped, paint-matched scheme.
// Pure (takes an indexed dataset); the heart of "ideal vs actual" (CLAUDE.md §1, USE_CASES §3).

import { rotateHue, adjustHsl, rgbToHsl, hexToRgb, hexToLab, deltaE2000 } from './color.js';
import { harmonyPartners } from './harmony.js';
import { nearestPaint } from './data.js';

const WASH = { dl: -0.16, ds: 0.06 };       // darker + a touch more saturated
const HIGHLIGHT = { dl: 0.24, ds: -0.12 };  // lighter + a touch desaturated

/** Heuristic ideal metal for a base colour (warm→gold, cool→silver, else gunmetal). */
export function metalIdeal(baseHex) {
  const [h] = rgbToHsl(hexToRgb(baseHex));
  if (h < 70 || h > 300) return '#C8A13A';
  if (h > 150 && h < 280) return '#B5B5BD';
  return '#6E7177';
}

/**
 * Build the role-mapped scheme. `opts` is forwarded to nearestPaint (e.g. {ownedIds, brands}).
 * @returns {{ base, harmony, roles: Array<{role, weight, idealHex, match, wash, highlight}> }}
 */
export function buildScheme(idx, baseHex, harmony, opts = {}) {
  const partners = harmonyPartners(baseHex, harmony);
  const baseLab = hexToLab(baseHex);
  let accent = partners[0], amax = -1;
  for (const p of partners) {
    const d = deltaE2000(baseLab, hexToLab(p.hex));
    if (d > amax) { amax = d; accent = p; }
  }
  const secondary = partners.find(p => p !== accent);
  const secondaryHex = secondary ? secondary.hex : rotateHue(baseHex, 30);

  const defs = [
    { role: 'Body', weight: '~60%', idealHex: baseHex },
    { role: 'Secondary', weight: '~30%', idealHex: secondaryHex },
    { role: 'Accent', weight: '~10%', idealHex: accent.hex },
    { role: 'Metal', weight: 'spot', idealHex: metalIdeal(baseHex), metal: true },
  ];

  const roles = defs.map(d => {
    // A metal role keeps its type filter across the whole ladder (match + wash + highlight),
    // so its derived shades resolve to real metallics rather than flat colours.
    const roleOpts = d.metal ? { ...opts, types: new Set(['metal']) } : opts;
    const ladder = ideal => ({ idealHex: ideal, match: nearestPaint(idx, ideal, roleOpts) });
    return {
      role: d.role,
      weight: d.weight,
      idealHex: d.idealHex,
      match: nearestPaint(idx, d.idealHex, roleOpts),
      wash: ladder(adjustHsl(d.idealHex, WASH)),
      highlight: ladder(adjustHsl(d.idealHex, HIGHLIGHT)),
    };
  });
  return { base: baseHex, harmony, roles };
}

/** Flatten a scheme into a buyable shopping list (M8 export). */
export function shoppingList(scheme) {
  const rows = [];
  for (const r of scheme.roles) {
    for (const [kind, slot] of [['', r], ['wash', r.wash], ['highlight', r.highlight]]) {
      const m = slot.match;
      if (m) rows.push({
        role: kind ? `${r.role} ${kind}` : r.role,
        name: m.paint.name, brand: m.paint.brand, line: m.paint.line,
        hex: m.paint.hex, deltaE: Math.round(m.deltaE * 10) / 10,
      });
    }
  }
  return rows;
}
