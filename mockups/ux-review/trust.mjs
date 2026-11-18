// UX review, November 2026 (docs/UX_REVIEW.md, finding F12): the trust panel. Dev-only, never shipped.
// For well-known Warhammer Colour (Citadel) pots: where is the Vallejo Game Color pot that painters treat
// as its equivalent in the app's own match list, and at what dE?
// The pairs are painter lore from the reviewer's memory (GW's 2012 conversion chart and the Game Color
// names). They are NOT checked against a source: read the result as "the app and the lore differ", not as
// "the app is wrong".
// Run from the repo root:  node mockups/ux-review/trust.mjs
import fs from 'node:fs';
const R = new URL('../../src/', import.meta.url).pathname;
const { indexDataset, equivalents, nearestPaints, matchQuality } = await import(R + 'js/data.js');
const { deltaE2000Hex } = await import(R + 'js/color.js');
const ix = indexDataset(JSON.parse(fs.readFileSync(R + 'data/paints.json', 'utf8')));
const all = ix.paints || ix.all || ix; const paints = Array.isArray(all) ? all : Object.values(all);
const find = (name, brand, line) => paints.filter(p => p.name.toLowerCase() === name.toLowerCase() && p.brand === brand && (!line || p.line === line));
const pairs = [['Evil Sunz Scarlet','Bloody Red'],['Warpstone Glow','Sick Green'],['Caliban Green','Dark Green'],['Ushabti Bone','Bonewhite'],['Khorne Red','Scar Red'],['Kantor Blue','Imperial Blue'],['Altdorf Guard Blue','Ultramarine Blue'],['Mournfang Brown','Beasty Brown'],['Leadbelcher','Gunmetal'],['Yriel Yellow','Gold Yellow'],['Troll Slayer Orange','Hot Orange'],['Abaddon Black','Black'],['Mephiston Red','Heavy Red'],['Rhinox Hide','Charred Brown'],['Warboss Green','Goblin Green'],['Retributor Armour','Polished Gold'],['Runefang Steel','Silver'],['Averland Sunset','Heavy Goldbrown'],['Macragge Blue','Imperial Blue'],['Screaming Skull','Bonewhite']];
for (const [c, v] of pairs) {
  const cp = find(c, 'Warhammer Colour')[0]; const vps = find(v, 'Vallejo', 'Game Color');
  if (!cp) { console.log(c, '— not in data'); continue; }
  const eq = equivalents(ix, cp, { n: 8 });
  const top = eq.slice(0, 3).map(e => { const p = e.paint || e; return `${p.name} (${p.brand} ${p.line}) ${(e.dE ?? e.de ?? deltaE2000Hex(cp.hex, p.hex)).toFixed(1)}`; });
  const vg = paints.filter(p => p.brand === 'Vallejo' && p.line === 'Game Color' && p.type === cp.type || (p.brand === 'Vallejo' && p.line === 'Game Color')).map(p => [p, deltaE2000Hex(cp.hex, p.hex)]).sort((a, b) => a[1] - b[1]);
  const bestVG = vg[0];
  if (!vps.length) { console.log(`${c} ${cp.hex} | expected VGC "${v}" NOT IN DATA | app's best VGC: ${bestVG[0].name} ${bestVG[1].toFixed(1)} | top: ${top.join('; ')}`); continue; }
  const vp = vps[0]; const d = deltaE2000Hex(cp.hex, vp.hex);
  const rankAll = paints.filter(p => p.brand !== cp.brand).map(p => deltaE2000Hex(cp.hex, p.hex)).filter(x => x < d).length + 1;
  const rankVG = vg.findIndex(x => x[0].id === vp.id) + 1;
  const inTop8 = eq.some(e => (e.paint || e).id === vp.id);
  console.log(`${c} ${cp.hex} -> VGC ${v} ${vp.hex}: dE ${d.toFixed(1)} ${matchQuality(d).label}; rank ${rankAll} of other brands, ${rankVG} in Game Color; in the app's list: ${inTop8 ? 'yes' : 'NO'} | app's best VGC: ${bestVG[0].name} ${bestVG[1].toFixed(1)} | top3: ${top.join('; ')}`);
}
