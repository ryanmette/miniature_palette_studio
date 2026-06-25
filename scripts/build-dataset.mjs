#!/usr/bin/env node
/**
 * build-dataset.mjs — assemble data/paints.json (dataset v1.0.0) for M1.
 *
 * Sources (all MIT-licensed, © 2022 Rick Fleuren, "Miniature Painter Pro"):
 *   - Citadel: embedded below (current Base/Layer/Shade/Contrast ranges), transcribed
 *     from paints/Citadel_Colour.md of github.com/Arcturus5404/miniature-paints
 *   - Army Painter (Warpaints) + Vallejo (Game Color + Model Color) + Two Thin Coats (Duncan
 *     Rhodes, all three Waves): parsed at build time from the staged raw markdown files
 *     (paints/Army_Painter.md, paints/Vallejo.md, paints/Duncan.md).
 *
 * Per CLAUDE.md §5: hex is sRGB; Lab is derived at runtime (never stored). All entries are
 * community-sourced → approx:true. Cross-brand equivalents are computed at runtime by ΔE 2000
 * (no precomputed groups in v1). Provenance is recorded in data/SOURCES.md.
 *
 * Usage:  node scripts/build-dataset.mjs [RAW_DIR]
 *   RAW_DIR defaults to the staged fetch location; must contain army.md, vallejo.md, and duncan.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv[2] || '/sessions/epic-sleepy-bardeen/mnt/outputs/raw';
const CAPTURED = '2026-06-24';
const REPO = 'https://github.com/Arcturus5404/miniature-paints';
const SRC = {
  Citadel: REPO + '/blob/main/paints/Citadel_Colour.md',
  'Army Painter': REPO + '/blob/main/paints/Army_Painter.md',
  Vallejo: REPO + '/blob/main/paints/Vallejo.md',
  'Two Thin Coats': REPO + '/blob/main/paints/Duncan.md',
};

/* ---- Citadel: current ranges, transcribed from the fetched file ---- */
/* [name, line, hex] */
const CITADEL = [
  // Base
  ['Abaddon Black','Base','#000000'],['Averland Sunset','Base','#FBB81C'],['Barak-Nar Burgundy','Base','#451636'],
  ["Bugman's Glow",'Base','#804C43'],['Caledor Sky','Base','#366699'],['Caliban Green','Base','#003D15'],
  ['Castellan Green','Base','#264715'],['Catachan Fleshtone','Base','#442B25'],['Celestra Grey','Base','#8BA3A3'],
  ['Corax White','Base','#FFFFFF'],['Corvus Black','Base','#171314'],['Daemonette Hide','Base','#655F81'],
  ['Death Guard Green','Base','#6D774D'],['Death Korps Drab','Base','#3D4539'],['Deathworld Forest','Base','#556229'],
  ['Dryad Bark','Base','#2B2A24'],['Gal Vorbak Red','Base','#4B213C'],['Grey Knights Steel','Base','#B0BDC6'],
  ['Grey Seer','Base','#A2A5A7'],['Hobgrot Hide','Base','#9C823B'],['Incubi Darkness','Base','#082E32'],
  ['Ionrach Skin','Base','#97A384'],['Iron Hands Steel','Base','#B2A79F'],['Iron Warriors','Base','#706E6B'],
  ['Jokaero Orange','Base','#ED3814'],['Kantor Blue','Base','#02134E'],['Khorne Red','Base','#650001'],
  ['Leadbelcher','Base','#969696'],['Lupercal Green','Base','#002C2B'],['Macragge Blue','Base','#0F3D7C'],
  ['Mechanicus Standard Grey','Base','#39484A'],['Mephiston Red','Base','#960C09'],['Morghast Bone','Base','#C0A973'],
  ['Mournfang Brown','Base','#490F06'],['Naggaroth Night','Base','#3B2B50'],['Night Lords Blue','Base','#002B5C'],
  ['Nocturne Green','Base','#162A29'],['Orruk Flesh','Base','#97C17E'],['Phoenician Purple','Base','#440052'],
  ['Rakarth Flesh','Base','#9C998D'],['Ratskin Flesh','Base','#A86648'],['Retributor Armour','Base','#EDC169'],
  ['Rhinox Hide','Base','#462F30'],['Runelord Brass','Base','#8D806F'],['Screamer Pink','Base','#7A0E44'],
  ['Screaming Bell','Base','#D18A5E'],['Steel Legion Drab','Base','#584E2D'],['Stegadon Scale Green','Base','#06455D'],
  ['The Fang','Base','#405B71'],['Thondia Brown','Base','#4F322C'],['Thousand Sons Blue','Base','#00506F'],
  ['Waaagh! Flesh','Base','#0B3B36'],['Warplock Bronze','Base','#B36E4F'],['Wraithbone','Base','#DBD1B2'],
  ['XV-88','Base','#6C4811'],['Zandri Dust','Base','#988E56'],
  // Layer
  ['Administratum Grey','Layer','#989C94'],['Ahriman Blue','Layer','#00708A'],['Alaitoc Blue','Layer','#2F4F85'],
  ['Altdorf Guard Blue','Layer','#2D4696'],['Auric Armour Gold','Layer','#FFC451'],['Baharroth Blue','Layer','#54BDCA'],
  ['Balor Brown','Layer','#875408'],['Bestigor Flesh','Layer','#D08951'],['Bloodreaver Flesh','Layer','#6A4848'],
  ['Brass Scorpion','Layer','#A65D2C'],['Cadian Fleshtone','Layer','#C47652'],['Dark Reaper','Layer','#354D4C'],
  ['Dawnstone','Layer','#697068'],['Dechala Lilac','Layer','#B598C9'],['Doombull Brown','Layer','#570003'],
  ['Dorn Yellow','Layer','#FFF55A'],['Elysian Green','Layer','#6B8C37'],["Emperor's Children",'Layer','#B74073'],
  ['Eshin Grey','Layer','#484B4E'],['Evil Sunz Scarlet','Layer','#C01411'],['Fenrisian Grey','Layer','#6D94B3'],
  ['Fire Dragon Bright','Layer','#F4874E'],['Flash Gitz Yellow','Layer','#FFF300'],['Fulgrim Pink','Layer','#F3ABCA'],
  ['Gauss Blaster Green','Layer','#7FC1A5'],["Gehenna's Gold",'Layer','#C96B18'],['Genestealer Purple','Layer','#7658A5'],
  ['Hashut Copper','Layer','#BA885F'],['Hoeth Blue','Layer','#4C78AF'],['Ironbreaker','Layer','#899092'],
  ['Kabalite Green','Layer','#008962'],['Karak Stone','Layer','#B7945C'],['Kislev Flesh','Layer','#D1A570'],
  ['Lothern Blue','Layer','#2C9BCC'],['Loren Forest','Layer','#486C25'],['Lugganath Orange','Layer','#F69B82'],
  ['Moot Green','Layer','#3DAF44'],['Nurgling Green','Layer','#7E975E'],['Pallid Wych Flesh','Layer','#CACCBB'],
  ['Phalanx Yellow','Layer','#FFE200'],['Pink Horror','Layer','#8E2757'],['Runefang Steel','Layer','#C2C8CC'],
  ['Russ Grey','Layer','#507085'],['Screaming Skull','Layer','#B9C099'],['Skarsnik Green','Layer','#588F6B'],
  ['Skavenblight Dinge','Layer','#45413B'],['Skrag Brown','Layer','#8B4806'],['Sotek Green','Layer','#0B6371'],
  ['Squig Orange','Layer','#A74D42'],['Stormvermin Fur','Layer','#6D655F'],['Sybarite Green','Layer','#17A166'],
  ['Tallarn Sand','Layer','#A07409'],['Tau Light Ochre','Layer','#BC6B10'],['Teclis Blue','Layer','#3877BF'],
  ['Temple Guard Blue','Layer','#239489'],['Troll Slayer Orange','Layer','#F16C23'],['Ulthuan Grey','Layer','#C4DDD5'],
  ['Ungor Flesh','Layer','#D1A560'],['Ushabti Bone','Layer','#ABA173'],['Warboss Green','Layer','#317E57'],
  ['Warpstone Glow','Layer','#0F702A'],['Wazdakka Red','Layer','#880804'],['White Scar','Layer','#FFFFFF'],
  ['Wild Rider Red','Layer','#E82E1B'],['Word Bearers Red','Layer','#620104'],['Xereus Purple','Layer','#47125A'],
  ['Yriel Yellow','Layer','#FFD900'],['Zamesi Desert','Layer','#D89D1B'],
  // Shade
  ['Agrax Earthshade','Shade','#A99D8D'],['Athonian Camoshade','Shade','#B6B788'],['Biel-Tan Green','Shade','#7DA57A'],
  ['Carroburg Crimson','Shade','#BE80A4'],['Cassandora Yellow','Shade','#F5CC92'],['Coelia Greenshade','Shade','#1B8F85'],
  ['Drakenhof Nightshade','Shade','#A1A5AF'],['Druchii Violet','Shade','#8F6592'],['Fuegan Orange','Shade','#BB7648'],
  ['Nuln Oil','Shade','#9E9A98'],['Reikland Fleshshade','Shade','#BE9A80'],['Seraphim Sepia','Shade','#AE8158'],
  // Contrast
  ['Aethermatic Blue','Contrast','#1C7E92'],['Apothecary White','Contrast','#A5BED4'],['Black Templar','Contrast','#171717'],
  ['Blood Angels Red','Contrast','#860B0E'],['Flesh Tearers Red','Contrast','#4B0402'],['Gryph-Hound Orange','Contrast','#94300E'],
  ['Iyanden Yellow','Contrast','#DB7F0C'],['Magos Purple','Contrast','#7A3F6E'],['Ork Flesh','Contrast','#00591E'],
  ['Snakebite Leather','Contrast','#694C29'],['Talassar Blue','Contrast','#003B70'],
];

/* ---- helpers ---- */
const slug = s => s.toLowerCase().replace(/['’!.]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
function typeOf(name, line){
  const n = name.toLowerCase();
  if (/wash|shade|earthshade|fleshshade|nuln oil|greenshade|crimson|nightshade|sepia|camoshade/.test(n) || line==='Shade') return 'wash';
  if (/\bink\b/.test(n)) return 'ink';
  if (/metal|gold|silver|bronze|brass|copper|\bsteel\b|chrome|gunmetal|\btin\b|\biron\b|mithril|chainmail|leadbelcher|runefang|retributor armour|auric|gehenna|ironbreaker|warplock|hashut/.test(n)) return 'metal';
  if (line==='Base') return 'base';
  if (line==='Contrast') return 'contrast';
  return 'layer';
}
function parseBrandTable(text){           // for Army/Vallejo: |Name|Code|Set|R|G|B|Hex|
  return text.split('\n').filter(l=>l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('|Name'))
    .map(l=>{const c=l.split('|').map(x=>x.trim()); const m=(c[7]||'').match(/`#([0-9A-Fa-f]{6})`/);
      return m ? {name:c[1], line:c[3], hex:'#'+m[1].toUpperCase()} : null;}).filter(Boolean);
}
function parseDuncan(text){               // Two Thin Coats has no Code column: |Name|Set|R|G|B|Hex|
  return text.split('\n').filter(l=>l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('|Name'))
    .map(l=>{const c=l.split('|').map(x=>x.trim()); const m=(c[6]||'').match(/`#([0-9A-Fa-f]{6})`/);
      return m ? {name:c[1], line:c[2], hex:'#'+m[1].toUpperCase()} : null;}).filter(Boolean);
}

/* ---- assemble ---- */
const paints = [];
const seen = new Set();
function add(brand, line, name, hex){
  const id = `${slug(brand)}-${slug(line)}-${slug(name)}`;
  if (seen.has(id)) return false; seen.add(id);
  paints.push({ id, brand, line, name, hex: hex.toUpperCase(), type: typeOf(name, line),
    discontinued:false, approx:true, source:'community', sourceUrl: SRC[brand], captured: CAPTURED });
  return true;
}

// Citadel (embedded)
for (const [name, line, hex] of CITADEL) add('Citadel', line, name, hex);

// Army Painter — Warpaints only
const army = parseBrandTable(readFileSync(join(RAW,'army.md'),'utf8'));
for (const p of army) if (p.line === 'Warpaints') add('Army Painter','Warpaints',p.name,p.hex);

// Vallejo — Game Color + Model Color
const vallejo = parseBrandTable(readFileSync(join(RAW,'vallejo.md'),'utf8'));
for (const p of vallejo) if (p.line === 'Game Color' || p.line === 'Model Color') add('Vallejo', p.line, p.name, p.hex);

// Two Thin Coats (Duncan Rhodes) — all three Waves, line = the Set (Wave 1/2/3)
const duncan = parseDuncan(readFileSync(join(RAW,'duncan.md'),'utf8'));
for (const p of duncan) add('Two Thin Coats', p.line, p.name, p.hex);

paints.sort((a,b)=> a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line) || a.name.localeCompare(b.name));

const dataset = {
  version: '1.1.0',
  generated: CAPTURED,
  license: 'Compiled from MIT-licensed data (© 2022 Rick Fleuren / Miniature Painter Pro). See data/SOURCES.md.',
  attribution: 'Paint data via github.com/Arcturus5404/miniature-paints (MIT). Cross-reference concept credited to DakkaDakka.',
  note: 'Hex is sRGB and approximate; Lab is derived at runtime (CLAUDE.md §5/§7). Cross-brand equivalents are computed at runtime by ΔE 2000.',
  paints,
};
mkdirSync(join(ROOT,'src','data'), { recursive: true });
const outShip = join(ROOT,'src','data','paints.json');
const json = JSON.stringify(dataset, null, 1);
writeFileSync(outShip, json);

const byBrand = {};
for (const p of paints) byBrand[p.brand]=(byBrand[p.brand]||0)+1;
console.log('paints:', paints.length, byBrand);
console.log('wrote', outShip);
