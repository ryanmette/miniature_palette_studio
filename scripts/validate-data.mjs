#!/usr/bin/env node
/**
 * validate-data.mjs — dataset QA per CLAUDE.md §5 / docs/DATA_SOURCING.md §5.
 *
 * HARD checks (exit non-zero on any failure):
 *   - required fields present (id, brand, line, name, hex, type, source, captured)
 *   - hex is a valid 6-digit sRGB value
 *   - ids are unique
 *   - type is in the allowed set
 * SOFT flags (reported, exit 0): ΔE near-duplicate pairs, name/hue mismatches.
 *
 * Usage: node scripts/validate-data.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'paints.json'), 'utf8'));
const P = data.paints;
const ALLOWED_TYPES = new Set(['base','layer','wash','shade','contrast','metal','ink','dry','technical','glaze','effect','primer','air']);

/* ---- colour math (CLAUDE.md §7; ΔE2000 verified against Sharma) ---- */
const hx = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const sl = c => { c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
function lab([r,g,b]){const R=sl(r),G=sl(g),B=sl(b);const x=(R*0.4124+G*0.3576+B*0.1805)/0.95047,y=R*0.2126+G*0.7152+B*0.0722,z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;const f=t=>t>Math.pow(6/29,3)?Math.cbrt(t):t/(3*Math.pow(6/29,2))+4/29;return[116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))];}
function dE(l1,l2){const[L1,a1,b1]=l1,[L2,a2,b2]=l2,rad=Math.PI/180;const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2,Cb7=Math.pow(Cb,7),G=0.5*(1-Math.sqrt(Cb7/(Cb7+Math.pow(25,7))));const a1p=(1+G)*a1,a2p=(1+G)*a2,C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);let h1=Math.atan2(b1,a1p);if(h1<0)h1+=2*Math.PI;let h2=Math.atan2(b2,a2p);if(h2<0)h2+=2*Math.PI;const dL=L2-L1,dC=C2p-C1p;let dh=0;if(C1p*C2p!==0){dh=h2-h1;if(dh>Math.PI)dh-=2*Math.PI;else if(dh<-Math.PI)dh+=2*Math.PI;}const dH=2*Math.sqrt(C1p*C2p)*Math.sin(dh/2),Lb=(L1+L2)/2,Cbp=(C1p+C2p)/2;let hb;if(C1p*C2p===0)hb=h1+h2;else hb=(Math.abs(h1-h2)>Math.PI)?(h1+h2+2*Math.PI)/2:(h1+h2)/2;const T=1-0.17*Math.cos(hb-30*rad)+0.24*Math.cos(2*hb)+0.32*Math.cos(3*hb+6*rad)-0.2*Math.cos(4*hb-63*rad);const dT=30*rad*Math.exp(-Math.pow((hb*(180/Math.PI)-275)/25,2)),Cbp7=Math.pow(Cbp,7),Rc=2*Math.sqrt(Cbp7/(Cbp7+Math.pow(25,7))),Sl=1+0.015*Math.pow(Lb-50,2)/Math.sqrt(20+Math.pow(Lb-50,2)),Sc=1+0.045*Cbp,Sh=1+0.015*Cbp*T,Rt=-Math.sin(2*dT)*Rc;return Math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh));}
const hue = h => { let [r,g,b]=hx(h).map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(d===0)return{h:0,s:0};let H;if(mx===r)H=((g-b)/d)%6;else if(mx===g)H=(b-r)/d+2;else H=(r-g)/d+4;H*=60;if(H<0)H+=360;return{h:H,s:d/(1-Math.abs(mx+mn-1)||1)};};

/* ---- HARD checks ---- */
const errors = [];
const ids = new Set();
const productKeys = new Set();   // (brand, line, name) — same name across LINES is legitimate (Layer vs Dry
                                 // Dawnstone); the same name within one line is a true duplicate product.
const HEX = /^#[0-9A-F]{6}$/;
for (const p of P){
  for (const f of ['id','brand','line','name','hex','type','source','captured'])
    if (p[f]===undefined || p[f]===null || p[f]==='') errors.push(`missing ${f}: ${p.id||p.name}`);
  if (!HEX.test(p.hex)) errors.push(`bad hex ${p.hex} on ${p.id}`);
  if (!ALLOWED_TYPES.has(p.type)) errors.push(`bad type "${p.type}" on ${p.id}`);
  if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`); else ids.add(p.id);
  const pk = `${p.brand}|${p.line}|${(p.name||'').toLowerCase()}`;
  if (productKeys.has(pk)) errors.push(`duplicate product ${p.brand} ${p.line} "${p.name}" (${p.id})`); else productKeys.add(pk);
}

/* ---- SOFT flags ----
 * These used to print ~640 lines every run and CI passed regardless, which is indistinguishable
 * from printing nothing: a real regression would have scrolled past unnoticed. Both checks now
 * report a COUNT plus only the entries that are actually actionable, so the visible list trends to
 * zero and anything new stands out. Pass --verbose for the full detail.
 */
const VERBOSE = process.argv.includes('--verbose');
const labs = P.map(p => lab(hx(p.hex)));
const byId = new Map(P.map(p => [p.id, p]));
// Finish class, mirroring §5.2's clustering rule — a wash is never interchangeable with a flat that
// happens to share its hex, so a cross-finish near-duplicate is EXPECTED, not a finding.
const finishClass = t => t === 'metal' ? 'metal'
  : ['wash','shade','ink','contrast','glaze'].includes(t) ? 'translucent'
  : ['effect','technical'].includes(t) ? 'effect' : 'flat';

// Cross-brand near-duplicates (ΔE < 1.0). Most are the whole point of groups[] — the actionable ones
// are same-finish pairs that are NOT in a shared equivalence group, i.e. a group the build missed.
const dupes = { total: 0, grouped: 0, crossFinish: 0, actionable: [] };
for (let i=0;i<P.length;i++) for (let j=i+1;j<P.length;j++){
  if (P[i].brand===P[j].brand) continue;
  const d = dE(labs[i],labs[j]);
  if (d >= 1.0) continue;
  dupes.total++;
  if (P[i].groupId && P[i].groupId === P[j].groupId) dupes.grouped++;
  else if (finishClass(P[i].type) !== finishClass(P[j].type)) dupes.crossFinish++;
  else dupes.actionable.push([d, P[i], P[j]]);
}
dupes.actionable.sort((a,b)=>a[0]-b[0]);
// name/hue sanity
const BANDS = {red:[[338,360],[0,15]],orange:[[8,48]],yellow:[[42,72]],green:[[66,170]],turquoise:[[155,205]],teal:[[155,205]],blue:[[188,258]],purple:[[278,322]],violet:[[278,322]],pink:[[300,350]],magenta:[[300,350]]};
// Accepted name/hue exceptions — miniature paints carry fantasy names on purpose ("Thunderbird Blue"
// is a green), so most mismatches are correct data. The file grandfathers the set that existed when
// this check was made actionable; NEW ones are reported.
let accepted = new Set();
try {
  const ex = JSON.parse(readFileSync(join(ROOT, 'scripts', 'data-exceptions.json'), 'utf8'));
  accepted = new Set(ex.nameHueAccepted || []);
} catch { /* no exceptions file → every mismatch is new */ }

const mism = [], grandfathered = [];
for (const p of P){
  const {h,s} = hue(p.hex); if (s < 0.25) continue;
  for (const [word, bands] of Object.entries(BANDS)){
    if (new RegExp(`\\b${word}`,'i').test(p.name)){
      if (!bands.some(([lo,hi]) => h>=lo && h<=hi)) {
        const line = `${p.name} (${p.brand}) ${p.hex} hue ${h.toFixed(0)}° vs "${word}"  [${p.id}]`;
        (accepted.has(p.id) ? grandfathered : mism).push(line);
      }
      break;
    }
  }
}
// An accepted id that no longer mismatches is stale — the exceptions file should shrink, not rot.
const stale = [...accepted].filter(id => !byId.has(id) || !grandfathered.some(l => l.endsWith(`[${id}]`)));

/* ---- report ---- */
const byBrand = {}, byType = {};
for (const p of P){ byBrand[p.brand]=(byBrand[p.brand]||0)+1; byType[p.type]=(byType[p.type]||0)+1; }
console.log(`\nDataset v${data.version} — ${P.length} paints`);
console.log('by brand:', byBrand);
console.log('by type :', byType);
console.log(`approx: ${P.filter(p=>p.approx).length}/${P.length}`);
console.log(`\nSOFT — cross-brand near-duplicates (ΔE<1.0): ${dupes.total} total`
  + ` · ${dupes.grouped} already grouped · ${dupes.crossFinish} cross-finish (expected, §5.2)`);
console.log(`  ungrouped same-finish pairs (actionable): ${dupes.actionable.length}`);
for (const [d,a,b] of dupes.actionable) console.log(`  ΔE ${d.toFixed(2)}  ${a.name} (${a.brand}) ≈ ${b.name} (${b.brand})  — should share a groupId`);

console.log(`\nSOFT — name/hue mismatches: ${mism.length} new · ${grandfathered.length} accepted (scripts/data-exceptions.json)`);
for (const m of mism) console.log('  NEW  '+m);
if (stale.length) console.log(`  ${stale.length} accepted id(s) no longer mismatch — prune them from data-exceptions.json`);
if (VERBOSE) for (const g of grandfathered) console.log('  ok   '+g);

console.log(`\nHARD checks: ${errors.length===0 ? 'PASS ✓' : 'FAIL ✗'}`);
if (errors.length){ for (const e of errors.slice(0,40)) console.log('  '+e); process.exit(1); }
