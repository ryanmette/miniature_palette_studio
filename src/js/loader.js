// loader.js — the Molten Harmonics loader (CLAUDE.md §3.4; mockups/loaders/MOLTEN_HARMONICS.md, loader.html).
// A determinate loader: one value, `p` from 0 to 1, draws one frame. There is a beginning, a middle and an end,
// and the end is a finished palette: (1) a drop of colour falls and blooms; (2) its colours go out to their
// places on a hue wheel; (3) they pour down into four paint wells, which fill from the bottom, and the wheel
// fades. The app feeds it the real load progress (app.js startLoader).
//
// Pure, as shareimage.js: no DOM and no global. drawLoader() paints on a canvas context it is given; the
// app reads the colours from the page's tokens, so the loader is in the theme on screen (§3.1, §10).

import { roleIdeals } from './scheme.js';
import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, normHex } from './color.js';

/** The §3.1 tokens the loader uses, by the CSS custom property that holds each. */
export const LOADER_TOKENS = { bg: '--bg', ring: '--border-strong', text: '--text-muted', accent: '--accent', well: '--surface-2' };

const clamp01 = x => Math.max(0, Math.min(1, x));
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const hueOf = hex => rgbToHsl(hexToRgb(hex))[0];

/**
 * The four wells: the roles the Recipe will show for this colour and harmony (scheme.js roleIdeals), so the
 * loader ends on the scheme's own target colours. A bad colour falls back to `fallback`.
 * @returns {Array<{name, hex, hue}>}
 */
export function loaderRoles(baseHex, harmony = 'complementary', fallback = '#0B6371') {
  const base = normHex(baseHex) || normHex(fallback) || '#0B6371';
  let roles;
  try { roles = roleIdeals(base, harmony); } catch { roles = roleIdeals(base, 'complementary'); }
  return roles.map(r => ({ name: r.role, hex: r.idealHex, hue: hueOf(r.idealHex) }));
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the frame for progress `p` (0–1, clamped) on `ctx`, a W × H canvas.
 * @param o.roles   loaderRoles(…)
 * @param o.colors  { bg, ring, text, accent, well } (LOADER_TOKENS, read from the page)
 * @param o.dark    the dark theme: the drop and the dots glow (additive light), as in a forge
 * @param o.font    the label font family (the §3.3 body face)
 * @param o.labelPx the labels' size in canvas pixels (the app keeps it readable on a small canvas)
 * @param o.bar     the progress line, when it is not `p` (with reduced motion the frame is the finished
 *                  palette, and the line still shows the real progress)
 */
export function drawLoader(ctx, W, H, p, { roles, colors, dark = false, font = 'system-ui, sans-serif', labelPx = W * 0.03, bar = p }) {
  p = clamp01(p); bar = clamp01(bar);
  const n = roles.length, cx = W / 2, cy = H * 0.30, R = Math.min(W, H) * 0.20;
  const gap = W * 0.04, box = Math.min(H * 0.16, (W * 0.84 - (n - 1) * gap) / n), rowW = n * box + (n - 1) * gap;
  const sx = (W - rowW) / 2, wy = H * 0.64;
  // Workbench: small radii (§3.4), so the wells are near-square pots, not soft pills
  const corner = box * 0.08;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, W, H);

  // 1 · the drop (0–0.12) falls to the centre, then blooms in rings of the roles' colours (0.08–0.34)
  if (p < 0.12) {
    ctx.fillStyle = roles[0].hex;
    ctx.beginPath(); ctx.arc(cx, lerp(-W * 0.04, cy, easeInOut(clamp01(p / 0.12))), W * 0.018, 0, Math.PI * 2); ctx.fill();
  }
  const bloom = clamp01((p - 0.10) / 0.20);
  if (p >= 0.08 && p < 0.34) {
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    for (let k = 0; k < n; k++) {
      ctx.globalAlpha = (1 - bloom) * 0.5; ctx.strokeStyle = roles[k].hex; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, bloom * (W * 0.045 + k * W * 0.024), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // 2 · the hue wheel draws itself (0.16–0.42), the colours go out to their hues, then it fades (0.52–0.68)
  const ring = easeInOut(clamp01((p - 0.16) / 0.26)), wheelFade = 1 - clamp01((p - 0.52) / 0.16);
  if (ring > 0 && wheelFade > 0.02) {
    ctx.lineWidth = 5; ctx.globalAlpha = 0.26 * wheelFade;
    for (let a = 0; a < 360 * ring; a += 6) {
      const a0 = (a - 90) * Math.PI / 180;
      ctx.strokeStyle = rgbToHex(hslToRgb([a, 0.5, dark ? 0.5 : 0.6]));
      ctx.beginPath(); ctx.arc(cx, cy, R, a0 - 0.06, a0 + 0.06); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const hold = clamp01((p - 0.42) / 0.10), pulse = 1 + 0.12 * Math.sin(hold * Math.PI);

  // 3 · each colour travels down to its well (from 0.52, one after another) and fills it from the bottom
  ctx.font = `500 ${Math.round(labelPx)}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < n; i++) {
    const r = roles[i], rad = r.hue * Math.PI / 180;
    const onWheelX = cx + Math.sin(rad) * R, onWheelY = cy - Math.cos(rad) * R;
    const gather = easeInOut(clamp01((p - 0.16 - i * 0.02) / 0.26));
    const wellStart = 0.52 + i * 0.055, travel = 0.10, fillStart = wellStart + travel, fillDur = 0.16;
    const slotX = sx + i * (box + gap) + box / 2, x0 = slotX - box / 2, bottom = wy + box, dot = box * 0.16;
    if (p >= wellStart - 0.05) {
      ctx.fillStyle = colors.well; roundRect(ctx, x0, wy, box, box, corner); ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = colors.ring; roundRect(ctx, x0, wy, box, box, corner); ctx.stroke();
    }
    if (p < fillStart) {
      let x, y, halo, scale;
      if (p < wellStart) { x = lerp(cx, onWheelX, gather); y = lerp(cy, onWheelY, gather); halo = 0.5; scale = pulse; }
      else { const t = easeInOut(clamp01((p - wellStart) / travel)); x = lerp(onWheelX, slotX, t); y = lerp(onWheelY, bottom - dot - 1, t); halo = 0.5 * (1 - t); scale = 1; }
      if (dark && halo > 0.02) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = halo; ctx.fillStyle = r.hex;
        ctx.beginPath(); ctx.arc(x, y, dot * 1.8 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = r.hex; ctx.beginPath(); ctx.arc(x, y, dot * scale, 0, Math.PI * 2); ctx.fill();
    } else {
      const t = clamp01((p - fillStart) / fillDur), g = easeOut(t);
      const size = lerp(dot * 2, box, g), cr = lerp(size / 2, corner, g);
      const w = size * (1 + 0.08 * Math.sin(t * Math.PI)), h = size * (1 - 0.10 * Math.sin(t * Math.PI));
      ctx.save(); roundRect(ctx, x0, wy, box, box, corner); ctx.clip();
      ctx.fillStyle = r.hex; roundRect(ctx, slotX - w / 2, bottom - h, w, h, cr); ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1.2; ctx.strokeStyle = colors.ring; roundRect(ctx, x0, wy, box, box, corner); ctx.stroke();
      const label = clamp01((t - 0.6) / 0.4);
      if (label > 0) { ctx.globalAlpha = label; ctx.fillStyle = colors.text; ctx.fillText(r.name, slotX, wy + box + W * 0.055); ctx.globalAlpha = 1; }
    }
  }

  // the progress line: the real load, under it all
  ctx.fillStyle = colors.ring; roundRect(ctx, W * 0.08, H * 0.93, W * 0.84, 4, 2); ctx.fill();
  if (bar > 0) { ctx.fillStyle = colors.accent; roundRect(ctx, W * 0.08, H * 0.93, W * 0.84 * bar, 4, 2); ctx.fill(); }
}
