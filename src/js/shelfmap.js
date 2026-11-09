// shelfmap.js — the Shelf's Map view (PLAN §5 item 61; mockups/shelf-map.html, C with A, Ryan 2026-11-09).
// Pure: no DOM. It puts paints in a grid of tones (18 hue bands across × 5 lightness bands, plus the greys) and
// says where the shelf has none. ui.js draws the grid, and app.js paints the minimap with drawMinimap.
//
// Why two pictures: a colour wheel shows only two of a colour's three dimensions (hue is the angle, strength the
// distance from the centre). Lightness is lost, so a navy and a sky blue fall on one spot. The minimap answers
// "which colour families do I have?"; the grid answers "can I shade and highlight this colour?".

import { HUE_BAND, HUE_START, GREY_CHROMA } from './data.js';
import { labToHex, deltaE2000 } from './color.js';

/** The hue bands, the Browse order's (data.js): 20° of Lab hue each, from 20° (reds first). Their keys are i18n
 *  keys (`mapBand_red` …), the words people see. */
export const MAP_BANDS = ['red', 'scarlet', 'orange', 'ochre', 'yellow', 'olive', 'yellowGreen', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'royalBlue', 'violet', 'purple', 'magenta', 'pink'];
/** The greys' column: the paints with no hue to sort by (Lab C* under GREY_CHROMA, as Browse puts them last). */
export const GREY = MAP_BANDS.length;
/** The lightness bands, darkest first, in a painter's words. L* limits; each `mid` is its target's lightness when
 *  the dataset has no paint in a cell. */
export const MAP_ROWS = [
  { key: 'shade', hi: 30, mid: 22 },
  { key: 'dark', hi: 45, mid: 38 },
  { key: 'mid', hi: 60, mid: 52 },
  { key: 'light', hi: 75, mid: 67 },
  { key: 'highlight', hi: Infinity, mid: 85 },
];
/** The pots a gap offers: opaque paints you can shade and highlight with (no wash, metal or texture). */
export const FILL_TYPES = new Set(['base', 'layer']);

const chroma = lab => Math.hypot(lab[1], lab[2]);
const hueDeg = lab => (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;

/** The column a colour falls in: a hue band 0–17, or GREY. */
export function bandOf(lab) {
  if (chroma(lab) < GREY_CHROMA) return GREY;
  return Math.floor(((hueDeg(lab) - HUE_START + 720) % 360) / HUE_BAND) % MAP_BANDS.length;
}
/** The row a colour falls in: 0 (shade) to 4 (highlight). */
export const rowOf = lab => MAP_ROWS.findIndex(r => lab[0] < r.hi);

/**
 * The shelf as cells. `paints` are the ones to place (the view's filters picked them); `markOf(id)` says which
 * are owned and which are on the shopping list. A paint that is neither is not placed.
 * @returns {{cells:{owned:object[], want:object[]}[][], total:number, owned:number, want:number}}
 *   cells[band][row], band 0–18 (18 = greys), row 0–4 (0 = shade)
 */
export function mapCells(paints, markOf) {
  const cells = Array.from({ length: GREY + 1 }, () => MAP_ROWS.map(() => ({ owned: [], want: [] })));
  let owned = 0, want = 0;
  for (const p of paints) {
    const m = markOf(p.id);
    if (m !== 'owned' && m !== 'want') continue;
    cells[bandOf(p.lab)][rowOf(p.lab)][m].push(p);
    if (m === 'owned') owned++; else want++;
  }
  return { cells, total: owned + want, owned, want };
}

/** What the map says in one line: how many tones and families have no owned paint. A paint on the shopping list
 *  does not fill a gap (you cannot shade with a paint you do not have yet); it shows as a ring. */
export function mapSummary({ cells }) {
  let emptyCells = 0, emptyFamilies = 0;
  for (let b = 0; b <= GREY; b++) {
    const n = cells[b].filter(c => c.owned.length).length;
    emptyCells += MAP_ROWS.length - n;
    if (b < GREY && !n) emptyFamilies++;
  }
  return { emptyCells, cellCount: (GREY + 1) * MAP_ROWS.length, emptyFamilies, familyCount: GREY };
}

// The colour each cell is about: the mean Lab of the dataset's opaque paints still made in it, so a target is a
// colour you can buy, not a corner of the colour space no paint reaches. Worked out once per dataset.
const targetCache = new WeakMap();
/** @returns {{lab:number[], hex:string}[][]} targets[band][row] */
export function cellTargets(indexed) {
  let t = targetCache.get(indexed);
  if (t) return t;
  const sum = Array.from({ length: GREY + 1 }, () => MAP_ROWS.map(() => [0, 0, 0, 0]));
  for (const p of indexed.paints) {
    if (p.discontinued || !FILL_TYPES.has(p.type)) continue;
    const s = sum[bandOf(p.lab)][rowOf(p.lab)];
    s[0] += p.lab[0]; s[1] += p.lab[1]; s[2] += p.lab[2]; s[3]++;
  }
  t = sum.map((col, b) => col.map((s, r) => {
    // A cell with no paint at all in the data: the band's middle hue at a modest strength, the row's lightness.
    const h = (HUE_START + (b + 0.5) * HUE_BAND) * Math.PI / 180, c = b === GREY ? 0 : 20;
    const lab = s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : [MAP_ROWS[r].mid, c * Math.cos(h), c * Math.sin(h)];
    return { lab, hex: labToHex(lab) };
  }));
  targetCache.set(indexed, t);
  return t;
}

/**
 * The pots that fill a cell: the closest opaque paints still made to the cell's target, among those in the cell,
 * that are not on the shelf yet. Ranked by ΔE 2000 alone, and the ΔE reported is the true one (§2, §7).
 * @param {Set<string>} [onShelf] the ids owned or on the shopping list
 * @returns {{paint:object, deltaE:number}[]}
 */
export function fillPots(indexed, band, row, { onShelf = new Set(), n = 3 } = {}) {
  const target = cellTargets(indexed)[band][row].lab;
  const out = [];
  for (const p of indexed.paints) {
    if (p.discontinued || !FILL_TYPES.has(p.type) || onShelf.has(p.id)) continue;
    if (bandOf(p.lab) !== band || rowOf(p.lab) !== row) continue;
    out.push({ paint: p, deltaE: deltaE2000(target, p.lab) });
  }
  return out.sort((a, b) => a.deltaE - b.deltaE).slice(0, n);
}

/** Where a colour sits on the minimap: hue is the angle (a* to the right, b* up), strength the distance from
 *  the centre, `cmax` at the rim. [x, y] from the centre, in units of the radius. */
export function minimapXY(lab, cmax = 90) {
  const r = Math.min(1, chroma(lab) / cmax), t = Math.atan2(lab[2], lab[1]);
  return [r * Math.cos(t), -r * Math.sin(t)];
}
/** The hue band under a point of the minimap ([x, y] from the centre, any unit). */
export function bandAtXY(x, y) {
  const deg = (Math.atan2(-y, x) * 180 / Math.PI + 360) % 360;
  return Math.floor(((deg - HUE_START + 720) % 360) / HUE_BAND) % MAP_BANDS.length;
}

/**
 * Paint the minimap on a 2D canvas context it is given (the loader's and the share image's way: no DOM here).
 * One dot per owned paint in its own colour, a ring in `buy` per paint on the shopping list; a hue family with no
 * owned paint is fogged (hatched). The greys sit in a strip under the disc, dark to light.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{size:number, dpr?:number, cells:object, tokens:{bg:string, border:string, edge:string, text:string, buy:string, faint:string}}} o
 *   size: the disc's CSS width; the canvas is size × (size + strip) CSS px
 */
export const STRIP = 22;
export function drawMinimap(ctx, { size, dpr = 1, cells, tokens }) {
  const W = size, R = W / 2 - 4, cx = W / 2, cy = W / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, W + STRIP);
  // the disc's edge and its 18 spokes, quiet
  ctx.lineWidth = 1; ctx.strokeStyle = tokens.border;
  for (let b = 0; b < MAP_BANDS.length; b++) {
    const t = (HUE_START + b * HUE_BAND) * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(t), cy - R * Math.sin(t)); ctx.stroke();
  }
  // fog: a family with no owned paint, hatched
  for (let b = 0; b < MAP_BANDS.length; b++) {
    if (cells.cells[b].some(c => c.owned.length)) continue;
    const t0 = (HUE_START + b * HUE_BAND) * Math.PI / 180, t1 = t0 + HUE_BAND * Math.PI / 180;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, -t0, -t1, true); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = tokens.faint; ctx.lineWidth = 1;
    for (let k = -W; k < W * 2; k += 5) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - W, W); ctx.stroke(); }
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = tokens.edge; ctx.stroke();
  // the greys' strip: a hairline from dark to light
  const sy = W + STRIP / 2, x0 = 6, x1 = W - 6;
  ctx.beginPath(); ctx.moveTo(x0, sy); ctx.lineTo(x1, sy); ctx.strokeStyle = tokens.border; ctx.stroke();
  const dot = (x, y, p, want) => {
    ctx.beginPath(); ctx.arc(x, y, want ? 3.5 : 3.25, 0, Math.PI * 2);
    if (want) { ctx.lineWidth = 1.75; ctx.strokeStyle = tokens.buy; ctx.stroke(); }
    else { ctx.fillStyle = p.hex; ctx.fill(); ctx.lineWidth = 0.75; ctx.strokeStyle = tokens.text; ctx.stroke(); }
  };
  for (const pass of ['owned', 'want']) {   // rings on top, so a paint to buy is never hidden under a dot
    for (let b = 0; b <= GREY; b++) for (const c of cells.cells[b]) for (const p of c[pass]) {
      if (b === GREY) dot(x0 + (x1 - x0) * Math.min(1, Math.max(0, p.lab[0] / 100)), sy, p, pass === 'want');
      else { const [x, y] = minimapXY(p.lab); dot(cx + x * R, cy + y * R, p, pass === 'want'); }
    }
  }
}
