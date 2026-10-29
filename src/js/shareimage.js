// shareimage.js — the share image: a picture of the scheme that the device makes when the painter shares it.
// No server makes or keeps it (CLAUDE.md §1): a link preview cannot show a scheme, because the preview bots do
// not run JavaScript, so the painter sends a picture with the link (mockups/share-image.html, direction A).
//
// Pure, in two steps. layoutShareImage() turns a view of the scheme into a list of draw operations; text is
// measured by a function it is given. paintShareImage() draws those operations on a canvas context it is
// given. Neither touches the DOM or a global, so node --test runs both (a fake measure, a fake context).
// The app (app.js) makes the canvas, loads the fonts, reads the theme's tokens and encodes the PNG.

/** Square: Messages, Instagram and WhatsApp show it whole, and Discord shows it at about 300 × 300. */
export const SHARE_SIZE = 1080;

/** The §3.3 faces. A canvas does not wait for a webfont, so the app loads these before it draws. */
const FAMILY = {
  display: '"Barlow Condensed", "Arial Narrow", sans-serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
};
export const SHARE_FONTS = ['700 58px "Barlow Condensed"', '400 28px "IBM Plex Sans"', '500 28px "IBM Plex Sans"', '600 28px "IBM Plex Sans"'];
const font = (weight, px, fam = 'body') => `${weight} ${px}px ${FAMILY[fam]}`;

/** The §3.1 tokens the image uses, by the CSS custom property that holds each. The app reads them from the
 *  page, so the image is in the theme on screen and no colour is written here (§10). */
export const SHARE_TOKENS = {
  bg: '--bg', text: '--text', muted: '--text-muted', accent: '--accent', border: '--border', borderStrong: '--border-strong',
  successText: '--success-text', warningText: '--warning-text', dangerText: '--danger-text',
  success: '--success', warning: '--warning', danger: '--danger',
};

// The finish overlays (§2, §3.5): the same stops as app.css .metal / .fx-wash / .fx-contrast, as canvas
// gradients. They convey the finish and never change the paint's colour. test/shareimage.test.mjs holds
// these three to app.css, so the image and the app cannot drift apart.
export const FINISH_FX = {
  metal: { deg: 158, stops: [[0, 'rgba(255,255,255,.5)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.26)']] },
  'fx-wash': { deg: 155, stops: [[0, 'rgba(255,255,255,.40)'], [0.48, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.16)']] },
  'fx-contrast': { deg: 150, stops: [[0, 'rgba(255,255,255,.30)'], [0.42, 'rgba(255,255,255,0)'], [0.96, 'rgba(0,0,0,.20)']] },
};
// The same type → overlay map as ui.js fxCls; a curated p.fx (gloss · slime · texture) wins.
const FX_BY_TYPE = { metal: 'metal', wash: 'fx-wash', ink: 'fx-wash', shade: 'fx-wash', glaze: 'fx-wash', contrast: 'fx-contrast' };
export const finishKind = p => (p ? (p.fx ? 'fx-' + p.fx : FX_BY_TYPE[p.type] || null) : null);

// The finish icons (ui.js GLYPHS, a 16 px grid) and their words (data.js FINISH_WORDS), drawn after the brand.
const GEM = 'M3 6l5-4 5 4-5 8z';
const DROP = 'M8 2c2.4 3.2 4 5.2 4 7.2A4 4 0 0 1 4 9.2C4 7.2 5.6 5.2 8 2z';
const STAR = 'M8 1l1.6 4.4L14 7l-4.4 1.6L8 13 6.4 8.6 2 7l4.4-1.6z';
export const FINISH_GLYPHS = { metal: GEM, contrast: DROP, wash: DROP, shade: DROP, ink: DROP, glaze: DROP, effect: STAR };

/** Fit text into at most `maxLines` lines of `maxW`; the last line ends with "…" when text is left over.
 *  A word wider than the box breaks between characters. */
export function fitText(measure, f, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  for (let w of String(text).split(/\s+/).filter(Boolean)) {
    const joined = cur ? cur + ' ' + w : w;
    if (measure(f, joined) <= maxW) { cur = joined; continue; }
    if (cur) lines.push(cur);
    while (measure(f, w) > maxW && w.length > 1) {
      let i = w.length - 1;
      while (i > 1 && measure(f, w.slice(0, i)) > maxW) i--;
      lines.push(w.slice(0, i)); w = w.slice(i);
    }
    cur = w;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return { lines, cut: false };
  const keep = lines.slice(0, maxLines);
  let last = keep[maxLines - 1] + '…';
  while (measure(f, last) > maxW && last.length > 1) last = last.slice(0, -2) + '…';
  keep[maxLines - 1] = last;
  return { lines: keep, cut: true };
}

/**
 * The view of a scheme that the image draws, from scheme.js buildScheme(). `seed` is { id, name } (id null for
 * a typed colour); `harmony` is the harmony's name as the strip shows it; `words` are the image's words in the
 * app's language (see layoutShareImage).
 */
export function shareView(scheme, { seed, harmony, words }) {
  return {
    seed, harmony, words,
    roles: scheme.roles.map(r => {
      const m = r.match, p = m && m.paint;
      return { role: r.role, weight: r.weight, ideal: r.idealHex, pot: p ? {
        id: p.id, name: p.dname || p.name, brand: p.brand, line: p.line, hex: p.hex, type: p.type, fx: p.fx || null,
        dE: m.deltaE, label: m.quality.label, tier: m.quality.tier,
      } : null };
    }),
  };
}

const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const lineOf = p => (p.line && p.line !== '—' && p.line !== p.brand ? ' · ' + p.line : '');
const isSeed = (view, pot) => !!(pot && view.seed.id && pot.id === view.seed.id);

/**
 * The layout of the recipe card. `view`:
 *   { seed: { id, name }, harmony: 'Split-complementary',
 *     roles: [{ role, weight, ideal, pot: { id, name, brand, line, hex, type, fx, dE, label, tier } | null }],
 *     words: { from: 'From {name}', yourPaint, noPot, footer, finish: { metal: 'metallic', … } } }
 * `tokens`: SHARE_TOKENS read from the page. `measure(font, text)` → width in px.
 * @returns {{ W, H, ops: Array<object> }} — every text op carries `px` and its `ground`, so a test can check
 *   sizes and contrast without drawing.
 */
export function layoutShareImage(view, tokens, measure) {
  const T = tokens, W = SHARE_SIZE, H = SHARE_SIZE, M = 72, ops = [];
  const text = (x, y, s, f, px, color, extra = {}) => ops.push({ t: 'text', x, y, text: s, font: f, px, fill: color, ground: T.bg, ...extra });

  ops.push({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: T.bg });
  // the mark (src/icon.svg) and the name
  ops.push({ t: 'mark', x: M, y: 60, size: 60, ink: T.text, lid: T.accent });
  text(M + 76, 110, 'Palette Studio', font(700, 58, 'display'), 58, T.text);
  // "From <your paint> · <harmony>": the harmony always shows; only the paint's name gets the "…"
  const subF = font(500, 34), tail = ` · ${view.harmony}`;
  const from = fitText(measure, subF, fill(view.words.from, { name: view.seed.name }), W - 2 * M - measure(subF, tail), 1).lines[0];
  text(M, 172, from + tail, subF, 34, T.text);

  // the four roles, two by two
  const top = 210, gap = 40, colW = (W - 2 * M - gap) / 2, rowH = 400, swH = 112, band = 26;
  const px = { role: 26, name: 44, meta: 28, de: 28 }, lh = Math.round(px.name * 1.18);
  view.roles.forEach((r, i) => {
    const x = M + (i % 2) * (colW + gap), y0 = top + Math.floor(i / 2) * rowH, pot = r.pot;
    // the pot's own colour, never tinted (§2); the band on top is the target, so the gap between them shows
    ops.push({ t: 'swatch', x, y: y0, w: colW, h: swH, hex: pot ? pot.hex : r.ideal, kind: finishKind(pot), band: r.ideal, bandH: band });
    let y = y0 + swH + Math.round(px.role * 1.7);
    text(x, y, `${r.role.toUpperCase()}  ${r.weight}`, font(600, px.role), px.role, T.muted, { spacing: 0.05 });
    y += lh + 4;
    const nm = fitText(measure, font(600, px.name), pot ? pot.name : view.words.noPot, colW, 2);
    nm.lines.forEach((ln, k) => text(x, y + k * lh, ln, font(600, px.name), px.name, T.text, { kind: 'name' }));
    if (!pot) return;
    y += lh * (nm.lines.length - 1) + Math.round(px.meta * 1.6);
    meta(ops, measure, x, y, pot, colW, T, px.meta, view.words.finish);
    y += Math.round(px.de * 1.8);
    delta(ops, measure, x, y, pot, isSeed(view, pot), view.words.yourPaint, T, px.de, colW);
  });

  // the footer: where to open it, and the honest note (§2: the hex of a paint is approximate)
  const fy = H - 56, fpx = 30;
  ops.push({ t: 'line', x1: M, y1: fy - 46, x2: W - M, y2: fy - 46, stroke: T.border, w: 2 });
  text(M, fy, 'palette.ryanmette.com', font(600, fpx), fpx, T.accent);
  text(W - M, fy, view.words.footer, font(400, fpx), fpx, T.muted, { align: 'right' });
  return { W, H, ops };
}

function meta(ops, measure, x, y, pot, maxW, T, px, words) {
  // brand · line, then the finish icon and its word for a non-flat paint (§2: never mistaken for flat paint)
  const f = font(400, px), word = words && words[pot.type];
  const tailW = word ? measure(f, ' ' + word) + px * 1.3 : 0;
  const s = fitText(measure, f, pot.brand + lineOf(pot), maxW - tailW, 1).lines[0];
  ops.push({ t: 'text', x, y, text: s, font: f, px, fill: T.muted, ground: T.bg });
  if (!word) return;
  const gx = x + measure(f, s) + px * 0.4;
  ops.push({ t: 'glyph', d: FINISH_GLYPHS[pot.type], x: gx, y: y - px * 0.8, size: px * 0.8, fill: T.muted });
  ops.push({ t: 'text', x: gx + px * 0.9, y, text: word, font: f, px, fill: T.muted, ground: T.bg });
}

function tag(ops, measure, x, y, label, edge, color, T, px) {
  // §3.5 tags: square, a border in the state's colour, the *-text colour, no fill
  const f = font(500, px), w = measure(f, label) + px * 0.9, h = px * 1.5;
  ops.push({ t: 'rect', x, y: y - h * 0.75, w, h, stroke: edge, lw: 2, r: 4 });
  ops.push({ t: 'text', x: x + px * 0.45, y, text: label, font: f, px, fill: color, ground: T.bg });
  return w;
}

function delta(ops, measure, x, y, pot, seed, yourPaint, T, px, maxW) {
  // ΔE is plain mono text, never a chip, and always has its §3.2 label (§2: never imply a perfect match).
  // The picked paint itself says "Starting paint". A tag that does not fit beside the number goes under it.
  if (seed) { tag(ops, measure, x, y, yourPaint, T.borderStrong, T.muted, T, px); return; }
  const tier = pot.tier === 'success' ? [T.success, T.successText] : pot.tier === 'warning' ? [T.warning, T.warningText] : [T.danger, T.dangerText];
  const de = `ΔE ${pot.dE.toFixed(1)}`, mf = font(400, px, 'mono');
  ops.push({ t: 'text', x, y, text: de, font: mf, px, fill: T.text, ground: T.bg });
  const beside = measure(mf, de) + px * 0.6, tagW = measure(font(500, px), pot.label) + px * 0.9;
  if (beside + tagW <= maxW) tag(ops, measure, x + beside, y, pot.label, tier[0], tier[1], T, px);
  else tag(ops, measure, x, y + px * 1.7, pot.label, tier[0], tier[1], T, px);
}

/* ---- painting: draws the operations on a 2D context it is given ---- */

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function linear(ctx, x, y, w, h, deg, stops) {
  // a CSS angle on a box (0deg = to top, 90deg = to right) and its gradient line, as CSS defines it
  const a = deg * Math.PI / 180, vx = Math.sin(a), vy = -Math.cos(a), len = Math.abs(w * vx) + Math.abs(h * vy);
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createLinearGradient(cx - vx * len / 2, cy - vy * len / 2, cx + vx * len / 2, cy + vy * len / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function overlay(ctx, o) {
  const { x, y, w, h, kind } = o;
  if (FINISH_FX[kind]) { ctx.fillStyle = linear(ctx, x, y, w, h, FINISH_FX[kind].deg, FINISH_FX[kind].stops); ctx.fillRect(x, y, w, h); return; }
  if (kind === 'fx-gloss' || kind === 'fx-slime') {
    // a wet highlight top-left and a darker foot (app.css .fx-gloss / .fx-slime, simplified to one highlight)
    ctx.save(); ctx.translate(x + w * 0.34, y + h * 0.26); ctx.scale(w * 0.58, h * 0.42);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(255,255,255,.82)'); g.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    ctx.fillStyle = linear(ctx, x, y, w, h, 180, [[0.52, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.34)']]); ctx.fillRect(x, y, w, h);
  } else if (kind === 'fx-texture') {
    // a gritty matte grain (app.css .fx-texture): light and dark specks on a 5 px grid
    for (let j = 0; j < h; j += 5) for (let i = (j / 5) % 2 ? 2 : 0; i < w; i += 5) {
      ctx.fillStyle = (i + j) % 3 ? 'rgba(0,0,0,.30)' : 'rgba(255,255,255,.12)'; ctx.fillRect(x + i, y + j, 1.5, 1.5);
    }
  }
}

/** Draw a layout on a 2D context (a canvas of layout.W × layout.H). */
export function paintShareImage(ctx, layout) {
  ctx.textBaseline = 'alphabetic';
  for (const o of layout.ops) {
    if (o.t === 'rect') {
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(o.x, o.y, o.w, o.h); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw; rounded(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, o.r || 0); ctx.stroke(); }
    } else if (o.t === 'line') {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w;
      ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
    } else if (o.t === 'swatch') {
      // square, --r-sw, an inset border so a white-ish paint still shows (§3.5)
      ctx.save(); rounded(ctx, o.x, o.y, o.w, o.h, 6); ctx.clip();
      ctx.fillStyle = o.hex; ctx.fillRect(o.x, o.y, o.w, o.h);
      if (o.kind) overlay(ctx, o);
      ctx.fillStyle = o.band; ctx.fillRect(o.x, o.y, o.w, o.bandH);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(o.x, o.y + o.bandH, o.w, 2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; rounded(ctx, o.x + 1, o.y + 1, o.w - 2, o.h - 2, 5); ctx.stroke();
    } else if (o.t === 'text') {
      ctx.font = o.font; ctx.fillStyle = o.fill; ctx.textAlign = o.align || 'left';
      if ('letterSpacing' in ctx) ctx.letterSpacing = o.spacing ? `${o.spacing * o.px}px` : '0px';
      ctx.fillText(o.text, o.x, o.y);
    } else if (o.t === 'glyph') {
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.size / 16, o.size / 16);
      ctx.fillStyle = o.fill; ctx.fill(new Path2D(o.d)); ctx.restore();
    } else if (o.t === 'mark') {
      // the mark (src/icon.svg): a dropper whose colour lands as a round pot lid
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.size / 32, o.size / 32);
      ctx.translate(20.27, 10.91); ctx.rotate(-140 * Math.PI / 180); ctx.scale(0.7, 0.7);
      ctx.fillStyle = o.ink; ctx.fillRect(-1.25, -15, 2.5, 2.4);
      ctx.fill(new Path2D('M-1.6 -12.8h3.2L4.2 -4.6h-8.4z'));
      rounded(ctx, -6.5, -5, 13, 17, 3); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -23.6, 6, 0, Math.PI * 2); ctx.fillStyle = o.lid; ctx.fill();
      ctx.restore();
    }
  }
}

/* ---- what goes with the image ---- */

/** The share text: a text version of the image (a share has no alt field for a file), then the link. */
export function shareText(view, url) {
  const names = view.roles.map(r => (r.pot ? r.pot.name : view.words.noPot)).join(' · ');
  return `${fill(view.words.from, { name: view.seed.name })} · ${view.harmony}: ${names}\n${url}`;
}

/** The file name: "palette-studio-mephiston-red-split-complementary.png" (ASCII, no spaces). */
export function shareFileName(view) {
  const slug = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return ['palette-studio', slug(view.seed.name), slug(view.harmony)].filter(Boolean).join('-') + '.png';
}
