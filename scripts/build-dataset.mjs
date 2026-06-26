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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv[2] || join(ROOT, '.cache', 'raw');
const CAPTURED = '2026-06-25';
const REPO = 'https://github.com/Arcturus5404/miniature-paints';
const src = file => `${REPO}/blob/main/paints/${file}`;

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

const FINISH = new Set(['wash', 'shade', 'ink', 'contrast', 'glaze', 'effect']);
// Utility products that aren't a colour — mediums, varnishes, sealers, thinners. Skip (not paints).
const SKIP_NAME = /\bmedium\b|thinner|retarder|\bsealer\b|varnish|\badditive\b|improver|anti-shine|lahmian|'?ardcoat|stirrer|reducer|\bcleaner\b|\bglaze medium\b/i;
const METAL_RE = /\bmetal|\bgold|silver|bronze|brass|copper|\bsteel\b|chrome|gunmetal|\btin\b|\biron\b|mithril|chainmail|pewter|platinum|leadbelcher|runefang|ironbreaker|warplock|hashut|\bauric\b|gehenna/i;
const slug = s => s.toLowerCase().replace(/['’!.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Resolve the stored type from the line's kind + the paint name (finishes win; then metal; then flat). */
function resolveType(name, kind) {
  if (FINISH.has(kind)) return kind;                 // line is a finish range → keep it
  const n = name.toLowerCase();
  if (/\bwash\b/.test(n)) return 'wash';             // name-based finish fallback (ranges that mix finishes)
  if (/\bshade\b/.test(n)) return 'shade';
  if (/\bink\b/.test(n)) return 'ink';
  if (kind === 'metal' || METAL_RE.test(name)) return 'metal';
  return kind === 'base' ? 'base' : kind === 'dry' ? 'dry' : 'layer';
}

/** Parse a brand markdown table: rows start with `|`; hex is the last backtick `#XXXXXX`; name = col 1. */
function parseRows(text, setIdx) {
  return text.split('\n')
    .filter(l => l.startsWith('|') && !l.startsWith('|---') && !/^\|\s*name/i.test(l))
    .map(l => {
      const c = l.split('|').map(x => x.trim());
      const m = l.match(/`#([0-9A-Fa-f]{6})`/);
      return m ? { name: c[1], set: norm(c[setIdx] || ''), hex: '#' + m[1].toUpperCase() } : null;
    })
    .filter(Boolean);
}

/* ---- assemble ---- */
const paints = [];
const seen = new Set();
function add(brand, line, name, hex, type, sourceUrl) {
  if (!name || SKIP_NAME.test(name)) return;
  const id = `${slug(brand)}-${slug(line)}-${slug(name)}`;
  if (seen.has(id)) return; seen.add(id);
  paints.push({ id, brand, line, name, hex: hex.toUpperCase(), type, discontinued: false, approx: true, source: 'community', sourceUrl, captured: CAPTURED });
}

const skipped = {};
for (const b of BRANDS) {
  const wanted = {}; for (const [k, v] of Object.entries(b.sets)) wanted[norm(k)] = v;
  const url = src(b.file);
  for (const row of parseRows(readFileSync(join(RAW, b.file), 'utf8'), b.setIdx)) {
    const map = wanted[row.set];
    if (!map) { skipped[`${b.brand} / ${row.set}`] = (skipped[`${b.brand} / ${row.set}`] || 0) + 1; continue; }
    const [line, kind] = map;
    add(b.brand, line, row.name, row.hex, resolveType(row.name, kind), url);
  }
}

paints.sort((a, b) => a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line) || a.name.localeCompare(b.name));

const dataset = {
  version: '1.2.0',
  generated: CAPTURED,
  license: 'Compiled from MIT-licensed data (© 2022 Rick Fleuren / Miniature Painter Pro). See data/SOURCES.md.',
  attribution: 'Paint data via github.com/Arcturus5404/miniature-paints (MIT). Cross-reference concept credited to DakkaDakka.',
  note: 'Hex is sRGB and approximate; Lab is derived at runtime (CLAUDE.md §5/§7). Finishes (wash/shade/ink/contrast/glaze/effect) are excluded from harmony suggestions at runtime.',
  paints,
};
mkdirSync(join(ROOT, 'src', 'data'), { recursive: true });
writeFileSync(join(ROOT, 'src', 'data', 'paints.json'), JSON.stringify(dataset, null, 1));

const byBrand = {}, byType = {};
for (const p of paints) { byBrand[p.brand] = (byBrand[p.brand] || 0) + 1; byType[p.type] = (byType[p.type] || 0) + 1; }
console.log('paints:', paints.length);
console.log('by brand:', byBrand);
console.log('by type :', byType);
console.log('skipped sets:', Object.keys(skipped).length, '→', Object.entries(skipped).map(([k, v]) => `${k}(${v})`).join(', '));
