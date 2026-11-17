// UX review, November 2026 (docs/UX_REVIEW.md §11; finding F02, PLAN §5 item 79): the Metal role with a shelf.
// Dev-only, never shipped. It changes nothing: it measures candidate ranking rules, so that Ryan can choose.
//
// The Metal role's target is one of three fixed colours (scheme.js metalIdeal): gold, silver or gunmetal. Its
// pot is the nearest metallic by dE 2000, and with Use my paints: Prefer an owned paint ranks 6 dE closer
// (app.js OWNED_BOOST). The data has 244 metallics, so some pot is always within a few dE of the target, and
// an owned metallic that is 10 dE away never wins.
//
// The rules:
//   now      the app today: the owned boost is 6
//   boost N  the owned boost is N for the Metal role
//   kind     a metallic of the target's KIND that the painter owns is the pot, whatever its dE; with none, as now.
//            Two kinds, read from the hex in Lab: "white metal" (C* under 15: silver, steel, gunmetal) and
//            "yellow metal" (hue 40 to 110 degrees: gold, brass, bronze). A coloured metallic is neither.
//   any      the nearest metallic that the painter owns, of any kind
//
// Run from the repo root:  node mockups/ux-review/metal-rule.mjs
import fs from 'node:fs';
const R = new URL('../../src/', import.meta.url).pathname;
const { indexDataset, matchQuality, startPaints } = await import(R + 'js/data.js');
const { deltaE2000, hexToLab } = await import(R + 'js/color.js');
const { metalIdeal } = await import(R + 'js/scheme.js');
const idx = indexDataset(JSON.parse(fs.readFileSync(R + 'data/paints.json', 'utf8')));

const metals = idx.paints.filter(p => p.type === 'metal' && !p.discontinued);
const kindOf = hex => {
  const [, a, b] = hexToLab(hex), C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return C < 15 ? 'white' : h >= 40 && h <= 110 ? 'yellow' : 'coloured';
};
const TARGETS = { gold: '#C8A13A', silver: '#B5B5BD', gunmetal: '#6E7177' };

// How often each target comes up: the app's own pool of starting paints (data.js startPaints)
const pool = startPaints(idx), share = { gold: 0, silver: 0, gunmetal: 0 };
for (const p of pool) share[Object.keys(TARGETS).find(k => TARGETS[k] === metalIdeal(p.hex))]++;
for (const k in share) share[k] /= pool.length;

const find = (name, brand, line) => {
  const m = metals.filter(p => p.name === name && p.brand === brand && (!line || p.line === line));
  if (m.length !== 1) throw new Error(`${name} (${brand}${line ? ' · ' + line : ''}): ${m.length} metallics`);
  return m[0].id;
};
const WC = 'Warhammer Colour', AP = 'Army Painter';
const SHELVES = {
  'A. the test painter (6 pots)': [['Leadbelcher', WC], ['Retributor Armour', WC], ['Balthasar Gold', WC], ['Ironbreaker', WC], ['Stormhost Silver', WC], ['Auric Armour Gold', WC]],
  'B. a starter set (2 pots)': [['Leadbelcher', WC], ['Retributor Armour', WC]],
  'C. one silver': [['Leadbelcher', WC]],
  'D. one gold': [['Retributor Armour', WC]],
  'E. Army Painter (4 pots)': [['Plate Mail Metal', AP, 'Warpaints'], ['Shining Silver', AP, 'Warpaints'], ['Greedy Gold', AP, 'Warpaints'], ['Gun Metal', AP, 'Warpaints']],
};
// Three shelves at the edges of the "kind" rule, shown but not in the totals: a bronze only (a yellow metal that is
// far from gold), a bright silver only (far from gunmetal), and a brass whose hex is nearly grey (the rule calls
// it a white metal: the hex of a metallic is the weakest value in the data).
const EDGES = {
  'F. one bronze': [['Warplock Bronze', WC]],
  'G. one bright silver': [['Stormhost Silver', WC]],
  'H. one brass': [['Runelord Brass', WC]],
};

const pick = (target, owned, rule) => {
  const t = hexToLab(target), scored = metals.map(p => ({ p, d: deltaE2000(t, p.lab), own: owned.has(p.id) }));
  const best = score => scored.reduce((a, b) => (score(b) < score(a) ? b : a));
  const boost = n => best(x => x.d - (x.own ? n : 0));
  if (rule === 'now') return boost(6);
  if (rule.startsWith('boost ')) return boost(Number(rule.slice(6)));
  const mine = scored.filter(x => x.own && (rule === 'any' || kindOf(x.p.hex) === kindOf(target)));
  return mine.length ? mine.reduce((a, b) => (b.d < a.d ? b : a)) : boost(6);
};

const RULES = ['now', 'boost 10', 'boost 15', 'boost 20', 'kind', 'any'];
console.log('How often each target comes up (' + pool.length + ' starting paints):',
  Object.entries(share).map(([k, v]) => `${k} ${(100 * v).toFixed(0)}%`).join(', '));
console.log('The data has', metals.length, 'metallics still made.\n');

const totals = Object.fromEntries(RULES.map(r => [r, { owned: 0, wrongKind: 0, poor: 0, ds: [] }]));
for (const [title, list] of Object.entries({ ...SHELVES, ...EDGES })) {
  const owned = new Set(list.map(a => find(...a))), counted = title in SHELVES;
  console.log(title);
  for (const [tname, target] of Object.entries(TARGETS)) {
    const cells = RULES.map(rule => {
      const x = pick(target, owned, rule), wrong = x.own && kindOf(x.p.hex) !== kindOf(target);
      const T = totals[rule], w = share[tname] / Object.keys(SHELVES).length;
      if (x.own && counted) { T.owned += w; T.ds.push(x.d); if (wrong) T.wrongKind += w; if (x.d > 10) T.poor += w; }
      return `${rule}: ${x.own ? 'OWNED ' : ''}${x.p.name} ${x.d.toFixed(1)} ${matchQuality(x.d).label}${wrong ? ' (WRONG KIND)' : ''}`;
    });
    console.log(`  ${tname.padEnd(8)} ${cells.join(' | ')}`);
  }
}
console.log('\nShelves A to E, weighted by how often each target comes up:');
for (const r of RULES) {
  const T = totals[r], ds = T.ds.sort((a, b) => a - b);
  console.log(`  ${r.padEnd(9)} an owned pot is the Metal pot: ${(100 * T.owned).toFixed(0)}% | of the wrong kind: ${(100 * T.wrongKind).toFixed(0)}% | shown as "Poor": ${(100 * T.poor).toFixed(0)}%`
    + (ds.length ? ` | dE of the owned pots: ${ds[0].toFixed(1)} to ${ds[ds.length - 1].toFixed(1)}` : ''));
}
