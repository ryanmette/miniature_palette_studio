#!/usr/bin/env node
/**
 * build-dataset.mjs — assemble src/data/paints.json (dataset v1.2.0).
 *
 * Source: all brands are parsed at build time from the MIT-licensed community dataset
 *   github.com/Arcturus5404/miniature-paints (© 2022 Rick Fleuren, "Miniature Painter Pro").
 * Stage the raw markdown into RAW_DIR (default below), one file per brand:
 *   Citadel_Colour.md Vallejo.md Army_Painter.md Duncan.md P3.md Reaper.md Scale75.md Monument.md
 * e.g.  for f in Citadel_Colour Vallejo Army_Painter Duncan P3 Reaper Scale75 Monument; do \
 *         curl -sL https://raw.githubusercontent.com/Arcturus5404/miniature-paints/main/paints/$f.md -o RAW/$f.md; done
 *
 * Per CLAUDE.md §5: hex is sRGB; Lab is derived at runtime (never stored). All entries are
 * community-sourced → approx:true. Provenance recorded in src/data/SOURCES.md.
 *
 * Curated-broad scope: the real hobby colour ranges + their washes/contrast/metal/effects.
 * We skip airbrush ranges (duplicate the colour ranges), primers/sprays, and craft/weathering lines.
 *
 * Usage:  node scripts/build-dataset.mjs [RAW_DIR]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ROOT = the repo root. This script lives in /scripts, so we walk one level up from its own file path.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// RAW = the folder holding the staged raw brand markdown. Overridable as the first CLI arg; default .cache/raw.
const RAW = process.argv[2] || join(ROOT, '.cache', 'raw');
// The date we recorded these paint values — stamped onto every paint as its provenance "captured" date.
const CAPTURED = '2026-06-25';
// Upstream source repo; src(file) builds the per-brand "where this value came from" URL stored on each paint.
const REPO = 'https://github.com/Arcturus5404/miniature-paints';
const src = file => `${REPO}/blob/main/paints/${file}`;

// Collapse runs of whitespace to one space and trim. The source markdown has stray double-spaces
// (e.g. "Warfront  Range") that would otherwise break the exact set-name lookups used below.
const norm = s => s.replace(/\s+/g, ' ').trim();   // source has stray double-spaces (e.g. "Warfront  Range")

/**
 * Per-brand config: file, the column index of the "Set", and a map of source-set → {line, kind}.
 * `kind` chooses the type: base/layer/dry are flat colours; wash/shade/ink/contrast/glaze/effect are
 * finishes (kept out of harmony suggestions); metal is the metallic role. Sets not listed are skipped
 * (airbrush duplicates, primers/sprays, craft/weathering, discontinued).
 */
const BRANDS = [
  { brand: 'Citadel', file: 'Citadel_Colour.md', setIdx: 2, sets: {
    'Base': ['Base', 'base'], 'Layer': ['Layer', 'layer'], 'Dry': ['Dry', 'dry'],
    'Shade': ['Shade', 'shade'], 'Contrast': ['Contrast', 'contrast'],
    'Technical': ['Technical', 'effect'], 'Glaze': ['Glaze', 'glaze'],
  } },
  { brand: 'Vallejo', file: 'Vallejo.md', setIdx: 3, sets: {
    'Game Color': ['Game Color', 'layer'], 'Model Color': ['Model Color', 'layer'],
    'Mecha Color': ['Mecha Color', 'layer'], 'Metal Color': ['Metal Color', 'metal'],
    'Xpress Color': ['Xpress', 'contrast'], 'Xpress Color Intense': ['Xpress', 'contrast'],
    'Game Color Wash': ['Wash', 'wash'], 'Wash FX': ['Wash', 'wash'],
    'Game Color Special FX': ['Special FX', 'effect'],
  } },
  { brand: 'Army Painter', file: 'Army_Painter.md', setIdx: 3, sets: {
    'Warpaints': ['Warpaints', 'layer'], 'Warpaints Fanatic': ['Warpaints Fanatic', 'layer'],
    'Speedpaint Set 2.0': ['Speedpaint', 'contrast'], 'Speedpaint Set': ['Speedpaint', 'contrast'],
    'Warpaints Fanatic Wash': ['Wash', 'wash'], 'Quickshade Washes Set': ['Wash', 'wash'],
    'Warpaints Wash': ['Wash', 'wash'], 'Warpaints Tone': ['Wash', 'wash'],
    'Metallic Colours Paint Set': ['Metallics', 'metal'],
    'Skin Tones Paint Set': ['Skin Tones', 'layer'], 'Skin Tones Paint Set - Washes': ['Skin Tones', 'wash'],
    "D&D Nolzur's Marvelous Pigments": ["Nolzur's", 'layer'],
    "D&D Nolzur's Marvelous Pigments Wash": ["Nolzur's", 'wash'],
    'D&D Underdark Set': ['D&D', 'layer'], 'D&D Undead Set': ['D&D', 'layer'],
  } },
  { brand: 'Two Thin Coats', file: 'Duncan.md', setIdx: 2, sets: {
    'Wave 1': ['Wave 1', 'layer'], 'Wave 2': ['Wave 2', 'layer'], 'Wave 3': ['Wave 3', 'layer'],
  } },
  { brand: 'P3', file: 'P3.md', setIdx: 2, sets: {
    'Privateer Press Formula P3': ['P3', 'layer'], 'Privateer Press Formula P3 Wash': ['P3 Wash', 'wash'],
  } },
  { brand: 'Reaper', file: 'Reaper.md', setIdx: 3, sets: {
    'Master Series Paints Core Colors': ['Master Series', 'layer'],
    'Master Series Paints Pathfinder': ['Pathfinder', 'layer'],
    'Master Series Paints Bones': ['Bones', 'layer'],
    'Master Series Paints Core Colors Wash': ['Wash', 'wash'],
  } },
  { brand: 'Scale75', file: 'Scale75.md', setIdx: 2, sets: {
    'Scale Color Range': ['Scalecolor', 'layer'], 'Fantasy & Games Range': ['Fantasy & Games', 'layer'],
    'Artist Range': ['Artist', 'layer'], 'Warfront Range': ['Warfront', 'layer'],
    'Instant Colors Range': ['Instant', 'contrast'], 'Inktensity Range': ['Inktensity', 'ink'],
    'Metal N Alchemy Range': ['Metal n Alchemy', 'metal'], 'FX Range': ['FX', 'effect'],
    'Soil Works': ['Soil Works', 'effect'],
  } },
  { brand: 'Pro Acryl', file: 'Monument.md', setIdx: 3, sets: {
    'Monument Pro Acrylic Paints': ['Pro Acryl', 'layer'], 'Monument Pro Signature Series': ['Signature', 'layer'],
    'Monument Pro Acrylic Wash': ['Wash', 'wash'],
  } },
];

// The "finish" types — non-flat paints (washes, shades, inks, contrast, glazes, effects). These are
// excluded from harmony suggestions at runtime, so we tag them here as their own type rather than "layer".
const FINISH = new Set(['wash', 'shade', 'ink', 'contrast', 'glaze', 'effect']);
// Utility products that aren't a colour — mediums, varnishes, sealers, thinners. Skip (not paints).
const SKIP_NAME = /\bmedium\b|thinner|retarder|\bsealer\b|varnish|\badditive\b|improver|anti-shine|lahmian|'?ardcoat|stirrer|reducer|\bcleaner\b|\bglaze medium\b/i;
// Name keywords that mark a paint as a metallic (the "Metal" role) even if its line isn't a metal range.
const METAL_RE = /\bmetal|\bgold|silver|bronze|brass|copper|\bsteel\b|chrome|gunmetal|\btin\b|\biron\b|mithril|chainmail|pewter|platinum|leadbelcher|runefang|ironbreaker|warplock|hashut|\bauric\b|gehenna/i;
// Make a stable URL-safe id fragment: lowercase, drop apostrophes/punctuation, non-alphanumerics → hyphens,
// then trim leading/trailing hyphens (e.g. "'Ard Coat" → "ard-coat").
const slug = s => s.toLowerCase().replace(/['’!.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Resolve the stored type from the line's kind + the paint name (finishes win; then metal; then flat). */
function resolveType(name, kind) {
  // Priority order matters: a finish range wins outright, then name-based finish hints, then metal, then flat.
  if (FINISH.has(kind)) return kind;                 // line is a finish range → keep it
  const n = name.toLowerCase();
  if (/\bwash\b/.test(n)) return 'wash';             // name-based finish fallback (ranges that mix finishes)
  if (/\bshade\b/.test(n)) return 'shade';
  if (/\bink\b/.test(n)) return 'ink';
  // Otherwise it's a flat colour: metal if the line or name says so, else keep the line's base/dry, else layer.
  if (kind === 'metal' || METAL_RE.test(name)) return 'metal';
  return kind === 'base' ? 'base' : kind === 'dry' ? 'dry' : 'layer';
}

/** Parse a brand markdown table: rows start with `|`; hex is the last backtick `#XXXXXX`; name = col 1. */
function parseRows(text, setIdx) {
  return text.split('\n')
    // Keep only real data rows: they start with a table pipe, and aren't the "|---" divider or the header row.
    .filter(l => l.startsWith('|') && !l.startsWith('|---') && !/^\|\s*name/i.test(l))
    .map(l => {
      const c = l.split('|').map(x => x.trim());     // split the row into trimmed cells
      const m = l.match(/`#([0-9A-Fa-f]{6})`/);      // the colour is a 6-digit hex inside backticks
      // Build {name, set, hex} — name is column 1, the set/range is at this brand's setIdx column.
      return m ? { name: c[1], set: norm(c[setIdx] || ''), hex: '#' + m[1].toUpperCase() } : null;
    })
    .filter(Boolean);                                // drop rows with no parseable hex
}

/* ---- assemble ---- */
const paints = [];        // the growing dataset
const seen = new Set();   // ids already added, so a repeated row can't create a duplicate paint
// Add one paint row, stamping the fixed provenance fields (community-sourced, approximate hex, capture date).
function add(brand, line, name, hex, type, sourceUrl) {
  if (!name || SKIP_NAME.test(name)) return;         // skip blanks and non-paint utility products
  const id = `${slug(brand)}-${slug(line)}-${slug(name)}`;   // stable id: brand-line-name (CLAUDE.md §5.1)
  if (seen.has(id)) return; seen.add(id);            // de-dupe on id
  paints.push({ id, brand, line, name, hex: hex.toUpperCase(), type, discontinued: false, approx: true, source: 'community', sourceUrl, captured: CAPTURED });
}

const skipped = {};   // tally of source sets we intentionally didn't ingest, for the closing report
for (const b of BRANDS) {
  // Build a lookup of the wanted (normalised) set names → their {line, kind} for this brand.
  const wanted = {}; for (const [k, v] of Object.entries(b.sets)) wanted[norm(k)] = v;
  const url = src(b.file);                            // provenance URL for every paint from this file
  for (const row of parseRows(readFileSync(join(RAW, b.file), 'utf8'), b.setIdx)) {
    const map = wanted[row.set];
    // A row whose set isn't in our wanted list (airbrush/primer/etc.) is skipped and counted, not added.
    if (!map) { skipped[`${b.brand} / ${row.set}`] = (skipped[`${b.brand} / ${row.set}`] || 0) + 1; continue; }
    const [line, kind] = map;
    add(b.brand, line, row.name, row.hex, resolveType(row.name, kind), url);
  }
}

// Deterministic ordering: brand, then line, then name — so the emitted JSON is stable across builds.
paints.sort((a, b) => a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line) || a.name.localeCompare(b.name));

/* ---- curated special-effect tags (drive bespoke swatch VFX in the UI) ----
   Only effect/technical paints get an `fx`; keyword rules so similar paints across the range are covered.
   slime (goopy gloss) → Nurgle's Rot etc · gloss (wet) → Blood for the Blood God, 'Ard Coat, gems ·
   texture (gritty matte) → Stirland Mud, Typhus Corrosion, Agrellan Earth, Astrogranite, rust/sand/… */
const FX_RULES = [
  ['slime', /\b(rot|nurgle|slime|ooze|mucus|plague)\b/],
  ['gloss', /blood|ard ?coat|gloss|soulstone|spirit ?stone|waystone|tesseract|\bglass\b|\bgem/],
  ['texture', /mud|earth|dune|dust|granite|sand|crackle|ground|stirland|agrellan|astrogranite|armageddon|martian|barak|valhallan|corrosion|rust|texture/],
];
const fxCount = { gloss: 0, slime: 0, texture: 0 }, fxSample = [];   // counts + a few examples for the report
for (const p of paints) {
  if (p.type !== 'effect') continue;                 // only effect/technical paints get a bespoke fx tag
  const n = p.name.toLowerCase();
  const hit = FX_RULES.find(([, re]) => re.test(n));   // first matching keyword rule wins
  // Tag the paint (p.fx drives the swatch VFX in the UI), bump the count, and keep up to 12 samples to log.
  if (hit) { p.fx = hit[0]; fxCount[hit[0]]++; if (fxSample.length < 12) fxSample.push(`${hit[0]}:${p.brand} ${p.name}`); }
}
console.log(`special-effect fx → gloss ${fxCount.gloss}, slime ${fxCount.slime}, texture ${fxCount.texture}`);
console.log('  e.g. ' + fxSample.join(' · '));

/* ---- curated equivalence groups (auto-seeded by tight ΔE2000) ----
   ΔE (delta-E) is a perceptual colour-distance: how different two colours look to the eye. ΔE2000 (CIEDE2000)
   is the modern standard formula. Two paints within ΔE ≤ 1.0 are effectively "indistinguishable" — those are
   the ones we cluster into an equivalence group below.
   NOTE: this sRGB→Lab + ΔE2000 math is a self-contained copy of src/js/color.js §7. It's duplicated on
   purpose — build scripts stay dependency-free and don't import the app's runtime ES modules. */
// Parse "#RRGGBB" → [r, g, b] byte triplet.
const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// sRGB gamma → linear light (the standard sRGB transfer function), input 0–255.
const srgbToLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
// sRGB byte triplet → CIELAB [L*, a*, b*] under a D65 white point (matching in Lab is perceptually uniform).
function toLab([r, g, b]) { const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b); const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883; const f = t => t > Math.pow(6 / 29, 3) ? Math.cbrt(t) : t / (3 * Math.pow(6 / 29, 2)) + 4 / 29; return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; }
// CIEDE2000 (ΔE2000) between two Lab colours, kL=kC=kH=1 — the single matching metric (CLAUDE.md §7).
function dE(l1, l2) { const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180; const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, Cb7 = Math.pow(Cb, 7), G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7)))); const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2); let h1 = Math.atan2(b1, a1p); if (h1 < 0) h1 += 2 * Math.PI; let h2 = Math.atan2(b2, a2p); if (h2 < 0) h2 += 2 * Math.PI; const dL = L2 - L1, dC = C2p - C1p; let dh = 0; if (C1p * C2p !== 0) { dh = h2 - h1; if (dh > Math.PI) dh -= 2 * Math.PI; else if (dh < -Math.PI) dh += 2 * Math.PI; } const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2; let hb; if (C1p * C2p === 0) hb = h1 + h2; else hb = (Math.abs(h1 - h2) > Math.PI) ? (h1 + h2 + 2 * Math.PI) / 2 : (h1 + h2) / 2; const T = 1 - 0.17 * Math.cos(hb - 30 * rad) + 0.24 * Math.cos(2 * hb) + 0.32 * Math.cos(3 * hb + 6 * rad) - 0.2 * Math.cos(4 * hb - 63 * rad); const dT = 30 * rad * Math.exp(-Math.pow((hb * (180 / Math.PI) - 275) / 25, 2)), Cbp7 = Math.pow(Cbp, 7), Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7))), Sl = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dT) * Rc; return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh)); }
// Map a hue angle (0–360°) to a coarse colour-family word, used to label auto-generated groups.
function hueName(h) { return (h < 15 || h >= 345) ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 160 ? 'green' : h < 195 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : h < 330 ? 'magenta' : 'red'; }
// Turn a hex into a human label like "deep red" / "light grey": HSL-derive saturation/lightness, handle the
// achromatic (near-grey) cases first, else prefix the hue word with a lightness qualifier.
function colourName(hex) {
  const [r, g, b] = hx(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.12) return l < 0.12 ? 'near-black' : l > 0.88 ? 'near-white' : l < 0.4 ? 'dark grey' : l > 0.66 ? 'light grey' : 'grey';
  let h; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h = (h * 60 + 360) % 360;
  return (l < 0.28 ? 'deep ' : l > 0.74 ? 'pale ' : l < 0.45 ? 'dark ' : '') + hueName(h);
}

// Union–find (a.k.a. disjoint-set) is a tiny data structure for grouping items into clusters: each paint
// starts as its own group, and when two paints are "close enough" we union their groups. At the end, paints
// sharing a root belong to the same equivalence group. We union every pair within ΔE ≤ EQUIV_DE
// ("indistinguishable"). A cheap Euclidean-Lab gate skips obviously-far pairs so we don't run the expensive
// ΔE2000 on all ~3M combinations.
const EQUIV_DE = 1.0;
const labs = paints.map(p => toLab(hx(p.hex)));       // precompute each paint's Lab once
const parent = paints.map((_, i) => i);               // union-find: every paint is initially its own root
// find(i): follow parent pointers to the group's root, with path-halving to keep it fast.
const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
for (let i = 0; i < paints.length; i++) for (let j = i + 1; j < paints.length; j++) {
  const dl = labs[i][0] - labs[j][0], da = labs[i][1] - labs[j][1], db = labs[i][2] - labs[j][2];
  if (dl * dl + da * da + db * db > 36) continue;                 // ΔE≤1 ⇒ Euclidean Lab ≪ 6; cheap reject
  // Close enough → union the two paints' groups (point one root at the other).
  if (dE(labs[i], labs[j]) <= EQUIV_DE) { const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; }
}
// Bucket every paint's index under its group root. (The `(members.get(r) || members.set(r, []).get(r))` idiom
// is get-or-create: if root r has no bucket yet, create an empty array for it, then push into it.)
const members = new Map();
for (let i = 0; i < paints.length; i++) { const r = find(i); (members.get(r) || members.set(r, []).get(r)).push(i); }
const groups = [];        // the emitted groups[] array (each: {id, refHex, label})
const labelSeq = {};      // per-label counter so ids like "deep-red-01", "deep-red-02" stay unique
let maxDiameter = 0;      // largest within-group ΔE seen — a sanity metric for the report
for (const idxs of members.values()) {
  if (idxs.length < 2) continue;                                  // singletons aren't a group
  // representative = member nearest the group's mean Lab (the most "central" colour of the cluster)
  const mean = [0, 0, 0]; for (const k of idxs) for (let c = 0; c < 3; c++) mean[c] += labs[k][c] / idxs.length;
  let rep = idxs[0], repD = Infinity, diam = 0;
  for (const k of idxs) { const d = dE(labs[k], mean); if (d < repD) { repD = d; rep = k; } }
  // Group diameter = the largest ΔE between any two members (how spread-out the cluster is).
  for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) diam = Math.max(diam, dE(labs[idxs[a]], labs[idxs[b]]));
  maxDiameter = Math.max(maxDiameter, diam);
  const label = colourName(paints[rep].hex);                      // human label from the representative colour
  const seq = labelSeq[label] = (labelSeq[label] || 0) + 1;       // next number for this label
  const id = `${slug(label)}-${String(seq).padStart(2, '0')}`;    // e.g. "deep-red-01"
  groups.push({ id, refHex: paints[rep].hex, label });
  for (const k of idxs) paints[k].groupId = id;                   // link each member paint back to its group
}
groups.sort((a, b) => a.id.localeCompare(b.id));                  // stable output order
console.log(`equivalence groups: ${groups.length} (max group diameter ΔE ${maxDiameter.toFixed(2)})`);

// ---- manual curation overrides (src/data/group-overrides.json), applied after auto-seeding ----
// Hand-corrections to the auto-seeded groups, anchored by stable paint ids: relabel a group, split (dissolve)
// a wrong cluster, or exclude a single paint. Wrapped in try/catch so a missing/invalid file just skips.
try {
  const ov = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'group-overrides.json'), 'utf8'));
  const pById = new Map(paints.map(p => [p.id, p]));   // id → paint, for fast lookup
  const gById = new Map(groups.map(g => [g.id, g]));   // id → group
  const rm = new Set();   // group ids to dissolve
  const tally = { relabel: 0, split: 0, exclude: 0, dissolved: 0 };   // audit counts for the report
  // relabel: rename the group that a named member belongs to.
  for (const { member, label } of (ov.relabel || [])) {
    const g = gById.get(pById.get(member)?.groupId); if (g && label) { g.label = label; tally.relabel++; }
  }
  // split: mark the named member's whole group for dissolution (a bad cluster that shouldn't be equivalent).
  for (const member of (ov.split || [])) { const gid = pById.get(member)?.groupId; if (gid) { rm.add(gid); tally.split++; } }
  // excludeMembers: remove a single paint from its group (keeps the rest of the cluster intact).
  for (const id of (ov.excludeMembers || [])) { const p = pById.get(id); if (p?.groupId) { delete p.groupId; tally.exclude++; } }
  for (const p of paints) if (p.groupId && rm.has(p.groupId)) delete p.groupId;   // drop groupId from split members
  // Recount members per surviving group; a group that dropped below 2 members is no longer a group → dissolve it.
  const count = {};
  for (const p of paints) if (p.groupId) count[p.groupId] = (count[p.groupId] || 0) + 1;
  for (const g of groups) if (!rm.has(g.id) && (count[g.id] || 0) < 2) { rm.add(g.id); tally.dissolved++; for (const p of paints) if (p.groupId === g.id) delete p.groupId; }
  if (rm.size) { const kept = groups.filter(g => !rm.has(g.id)); groups.length = 0; groups.push(...kept); }   // rebuild groups without the removed ones
  console.log(`group-overrides: relabel ${tally.relabel}, split ${tally.split}, exclude ${tally.exclude}, auto-dissolved ${tally.dissolved} → ${groups.length} groups`);
} catch (e) { console.log(`group-overrides: skipped (${e.message})`); }

const dataset = {
  version: '1.4.0',
  generated: CAPTURED,
  license: 'Compiled from MIT-licensed data (© 2022 Rick Fleuren / Miniature Painter Pro). See data/SOURCES.md.',
  attribution: 'Paint data via github.com/Arcturus5404/miniature-paints (MIT). Cross-reference concept credited to DakkaDakka.',
  note: 'Hex is sRGB and approximate; Lab is derived at runtime (CLAUDE.md §5/§7). Finishes (wash/shade/ink/contrast/glaze/effect) are excluded from harmony suggestions at runtime. groups[] = curated equivalence clusters (paints within ΔE 1.0); paints carry groupId.',
  groups,
  paints,
};
// Write the final dataset to the shipped location (pretty-printed with 1-space indent to keep diffs readable).
mkdirSync(join(ROOT, 'src', 'data'), { recursive: true });
writeFileSync(join(ROOT, 'src', 'data', 'paints.json'), JSON.stringify(dataset, null, 1));

// Closing report: totals by brand and by type, plus the sets we skipped — a quick eyeball of the build.
const byBrand = {}, byType = {};
for (const p of paints) { byBrand[p.brand] = (byBrand[p.brand] || 0) + 1; byType[p.type] = (byType[p.type] || 0) + 1; }
console.log('paints:', paints.length);
console.log('by brand:', byBrand);
console.log('by type :', byType);
console.log('skipped sets:', Object.keys(skipped).length, '→', Object.entries(skipped).map(([k, v]) => `${k}(${v})`).join(', '));
