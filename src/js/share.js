// share.js — the share-link contract: palette state ⇄ URL query string. Pure (no DOM, no globals),
// so the round trip a shared link depends on is unit-testable rather than only reachable by hand.
//
// The contract itself (CLAUDE.md §4): palette/scheme state lives in the URL, so a link reproduces a
// scheme with no storage and no account. Param names are deliberately terse — they end up in a URL a
// painter pastes into a forum post — and they are STABLE: an old link must keep working, so a param
// may gain tolerance but never change meaning.
//
//   p   paint id (omitted for a custom hex)     c   the pick's hex, always present as the fallback
//   h   harmony id                              r   'accent' when the pick seeds the Accent role
//   x   added swatches, h.s.l with '!' = locked d   harmony offsets detached by lock/edit
//   pp  neutral mode's pop accent               f   '1' = live palette filled with real paint
//   v   active output tab (omitted for 'plan')  m   'shelf' = deep-link to the Shelf
//   t   'dark' theme

import { normHex } from './color.js';
import { clampPop } from './harmony.js';

const clamp01 = n => Math.min(1, Math.max(0, n));
const wrapHue = h => ((h % 360) + 360) % 360;

/** Serialise one added swatch: hue.sat.light, with a trailing '!' when it's locked.
 *  Hues are always written already wrapped to 0-359, which is what lets '-' serve as the separator
 *  between swatches — a negative hue would split into an empty token and be dropped on the way back. */
const encodeNode = (n, wheelL) =>
  `${Math.round(n.h)}.${Math.round(n.s * 100)}.${Math.round((n.l ?? wheelL) * 100)}${n.locked ? '!' : ''}`;

/**
 * Palette state → URLSearchParams. `s.pickHex` is the PICK (see seed.js), never the scheme base —
 * a link must reproduce what the painter chose, with the seed role carried separately in `r`.
 */
export function encodeState(s) {
  const p = new URLSearchParams();
  // A paint seed shares its ID, not just its hex — the recipient must get the same paint (brand,
  // group, buy state, exact-tie preference), not an anonymous "Custom #…". The hex rides along as a
  // fallback so an old link (or a paint dropped from a future dataset) still reproduces the colours.
  if (!s.customHex && s.baseId) p.set('p', s.baseId);
  if (s.pickHex) p.set('c', s.pickHex.replace('#', ''));
  if (s.harmony) p.set('h', s.harmony);
  if (s.mode === 'shelf') p.set('m', 'shelf');
  if (s.tab && s.tab !== 'plan') p.set('v', s.tab);
  if (s.seedRole === 'accent') p.set('r', 'accent');
  if (s.theme === 'dark') p.set('t', 'dark');
  if (s.showReal) p.set('f', '1');
  if (s.extraNodes && s.extraNodes.length) p.set('x', s.extraNodes.map(n => encodeNode(n, s.wheelL)).join('-'));
  if (s.dropOffsets && s.dropOffsets.length) p.set('d', s.dropOffsets.join('.'));
  if (s.popHex) p.set('pp', s.popHex.replace('#', ''));
  return p;
}

/** Parse the `x` param back into added swatches. Malformed entries are dropped, never thrown on —
 *  a hand-edited or truncated link should lose a swatch, not fail to load the app. */
export function decodeNodes(xp, maxFree = 6) {
  if (!xp) return [];
  return xp.split('-').map(tok => {
    const locked = tok.endsWith('!');
    const [hh, sa, la] = (locked ? tok.slice(0, -1) : tok).split('.');
    const H = +hh, S = +sa / 100, L = +la / 100;
    if (!(Number.isFinite(H) && Number.isFinite(S))) return null;
    return { h: wrapHue(H), s: clamp01(S), ...(Number.isFinite(L) ? { l: clamp01(L) } : {}), ...(locked ? { locked: true } : {}) };
  }).filter(Boolean).slice(0, maxFree);
}

/** Parse the `d` param (detached harmony offsets). */
export const decodeOffsets = dp => (dp ? String(dp).split('.').map(Number).filter(Number.isFinite) : []);

/**
 * URL query → a state PATCH containing only the keys the link actually carried, so callers can
 * apply it over their defaults. Validators are injected because they depend on the loaded dataset
 * and the registered tabs, which this module deliberately knows nothing about:
 *   `validHarmony(id)` · `hasPaint(id)` · `validTab(id)`
 * Anything failing validation is simply omitted — a link naming a harmony or paint this build no
 * longer has must still open, on the fallbacks, rather than break.
 */
export function decodeState(search, { validHarmony = () => true, hasPaint = () => true, validTab = () => true, maxFree = 6 } = {}) {
  const u = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const out = {};
  const h = u.get('h'); if (h && validHarmony(h)) out.harmony = h;
  const pp = normHex(u.get('pp')); if (pp) out.popHex = clampPop(pp);
  const v = u.get('v'); if (v && validTab(v)) out.tab = v;
  if (u.get('f') === '1') out.showReal = true;
  if (u.get('r') === 'accent') out.seedRole = 'accent';
  if (u.get('t') === 'dark') out.theme = 'dark';
  if (u.get('m') === 'shelf') out.mode = 'shelf';
  const x = u.get('x'); if (x) out.extraNodes = decodeNodes(x, maxFree);
  const d = u.get('d'); if (d) out.dropOffsets = decodeOffsets(d);
  // Seed last: a known paint id wins, else the hex fallback. Neither present → caller's default.
  const pid = u.get('p'), c = normHex(u.get('c'));
  if (pid && hasPaint(pid)) out.baseId = pid;
  else if (c) out.customHex = c;
  return out;
}
