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
//   x   added swatches, hex with '!' = locked   d   harmony offsets detached by lock/edit
//       (RRGGBB, and an old link's h.s.l tokens still decode)
//   pp  neutral mode's pop accent               f   '1' = live palette filled with real paint
//   v   active output tab (omitted for 'plan')  m   'shelf' or 'schemes' = deep-link to that mode
//                                                     (address bar only, never in a shared link — shareUrl)
//   s   the id of the saved scheme on screen (store.js): address bar only, never in a shared link
//   sv  'list' = the Shelf shows the list, not the grid   sg  'project' = the list grouped by scheme
//       (both address bar only, never in a shared link)
//   n   the scheme's name (a saved scheme's, in a shared link): the Save dialog offers it on another device
//   l   the store list (PLAN §5 item 37): paint tokens joined by '.', each "id", "id*2" (2 pots) and/or
//       "id_0" (for the scheme at index 0 of the `j` params)    j   one scheme a store list is for, each its
//       scheme query with its name as `n` (repeated, in order)
//   b   the "bought" link back: paint ids joined by '.', to mark owned on the device that opens it
//       (l, j and b are read once on load, asked about, then dropped from the address bar)
//   t   'dark' theme. The address bar has it only for a link's theme (app.js updateUrl); a shared
//       link has it whenever the scheme shows dark (shareUrl).

import { normHex, rgbToHex, hslToRgb, rgbToHsl, hexToRgb } from './color.js';
import { clampPop } from './harmony.js';

const clamp01 = n => Math.min(1, Math.max(0, n));
/** store.js's own rule for a name (one line, 80 letters at most), so a name in a link is a name it keeps. */
const cleanName = x => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').slice(0, 80) : '');
const wrapHue = h => ((h % 360) + 360) % 360;

/** Serialise one added swatch: its hex without the '#', with a trailing '!' when it is locked.
 *  The hex is the colour on screen, so a reload shows the same colour. The old token (hue.sat.light in
 *  whole numbers) was up to 3 sRGB units off per channel after a reload. A hex has no '.' and no '-', so
 *  decodeNodes never reads it as an old token, and '-' stays the separator between swatches. */
const encodeNode = (n, wheelL) =>
  `${rgbToHex(hslToRgb([n.h, n.s, n.l ?? wheelL])).slice(1)}${n.locked ? '!' : ''}`;

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
  if (s.mode === 'shelf' || s.mode === 'schemes') p.set('m', s.mode);
  if (s.shelfView === 'list') p.set('sv', 'list');
  if (s.shelfGroup === 'project') p.set('sg', 'project');
  if (s.tab && s.tab !== 'plan') p.set('v', s.tab);
  if (s.seedRole === 'accent') p.set('r', 'accent');
  if (s.theme === 'dark') p.set('t', 'dark');
  if (s.extraNodes && s.extraNodes.length) p.set('x', s.extraNodes.map(n => encodeNode(n, s.wheelL)).join('-'));
  if (s.dropOffsets && s.dropOffsets.length) p.set('d', s.dropOffsets.join('.'));
  if (s.popHex) p.set('pp', s.popHex.replace('#', ''));
  const hd = encodeHolds(s.holds); if (hd) p.set('hd', hd);
  return p;
}

/* Holds (mockups/hold-flow.html, direction A): one token per held role, joined by "_".
   Role letter · kind · (paint id ·) hex:  S.l.2F4A6B (Secondary locked to a colour)
   M.p.citadel-base-balthasar-gold.A77353 (Metal's chosen pot, its hex as the fallback). No paint id has
   "." or "_" (checked over data 1.6.0), and URLSearchParams leaves both as they are. Primary is never held:
   the harmony is built from it. */
const HOLD_ROLES = { S: 'Secondary', A: 'Accent', M: 'Metal' };
const HOLD_LETTER = { Secondary: 'S', Accent: 'A', Metal: 'M' };
export function encodeHolds(holds) {
  if (!holds) return '';
  return Object.entries(holds).filter(([r, h]) => HOLD_LETTER[r] && h && normHex(h.hex))
    .map(([r, h]) => [HOLD_LETTER[r], h.kind === 'pot' && h.id ? 'p' : 'l', ...(h.kind === 'pot' && h.id ? [h.id] : []), normHex(h.hex).slice(1)].join('.'))
    .join('_');
}
/** The `hd` param → holds. A bad token is dropped; a pot this build does not have becomes a lock on its
 *  hex (the colour is kept, as `c` is the fallback for `p`). */
export function decodeHolds(hd, hasPaint = () => true) {
  const out = {};
  if (!hd) return out;
  for (const tok of String(hd).split('_')) {
    const parts = tok.split('.'), role = HOLD_ROLES[parts[0]];
    if (!role || out[role]) continue;
    if (parts[1] === 'l' && parts.length === 3) { const hex = normHex(parts[2]); if (hex) out[role] = { kind: 'lock', hex }; }
    else if (parts[1] === 'p' && parts.length === 4) {
      const hex = normHex(parts[3]); if (!hex) continue;
      out[role] = parts[2] && hasPaint(parts[2]) ? { kind: 'pot', id: parts[2], hex } : { kind: 'lock', hex };
    }
  }
  return out;
}

/**
 * The link that Share link hands out: the address-bar URL without `m` and `s`. `name` is the saved scheme's
 * name, as `n` (none: no `n`). `m=shelf` keeps a refresh
 * on the Shelf, but a friend who opens a shared link wants the SCHEME, so a link shared from the Shelf
 * must open the Studio. `s` is the id of a scheme saved on THIS device (store.js): it means nothing on
 * another one. Everything else stays, the output tab (`v`) too.
 * `theme` is the theme on screen. A shared scheme carries the theme it was made in, so `t=dark` goes
 * in when it is dark, also when the address bar has no `t` (the address bar has `t` only for a link's
 * theme, see app.js updateUrl). Leave it out to keep the address bar's `t`.
 */
export function shareUrl(href, theme, name = '') {
  const u = new URL(href);
  u.searchParams.delete('m');
  u.searchParams.delete('s');
  u.searchParams.delete('sv');   // how this device shows its own Shelf: not part of the scheme
  u.searchParams.delete('sg');
  for (const k of ['l', 'j', 'b']) u.searchParams.delete(k);   // a store trip is not a scheme
  // The name rides along (mockups/project-naming.html, answer 3) only when the caller has one.
  const nm = cleanName(name);
  if (nm) u.searchParams.set('n', nm); else u.searchParams.delete('n');
  if (theme === 'dark') u.searchParams.set('t', 'dark');
  else if (theme) u.searchParams.delete('t');
  return u.href;
}

/**
 * A scheme's own link: the query a saved scheme keeps (store.js `link`), "?p=…&c=…&h=…". It is the
 * scheme and nothing else: no mode (`m`), output tab (`v`), theme (`t`) or saved-scheme id (`s`), so the
 * Studio can tell "Saved" from "Changed" with a plain string compare, whatever tab or theme is on screen.
 */
export function schemeQuery(s) {
  return '?' + encodeState({ ...s, mode: 'studio', tab: 'plan', theme: null, shelfView: null, shelfGroup: null }).toString();
}

/** Parse the `x` param back into added swatches. Malformed entries are dropped, never thrown on —
 *  a hand-edited or truncated link should lose a swatch, not fail to load the app. A token is a hex
 *  (RRGGBB) or, in an old link, hue.sat.light in whole numbers (the light can be absent). */
export function decodeNodes(xp, maxFree = 6) {
  if (!xp) return [];
  return xp.split('-').map(tok => {
    const locked = tok.endsWith('!');
    const body = locked ? tok.slice(0, -1) : tok;
    const hex = normHex(body);
    if (hex) {
      const [h, s, l] = rgbToHsl(hexToRgb(hex));   // float error can make s a little more than 1
      return { h, s: clamp01(s), l: clamp01(l), ...(locked ? { locked: true } : {}) };
    }
    const [hh, sa, la] = body.split('.');
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
  if (u.get('r') === 'accent') out.seedRole = 'accent';
  if (u.get('t') === 'dark') out.theme = 'dark';
  const m = u.get('m'); if (m === 'shelf' || m === 'schemes') out.mode = m;
  if (u.get('sv') === 'list') out.shelfView = 'list';
  if (u.get('sg') === 'project') out.shelfGroup = 'project';
  const n = cleanName(u.get('n')); if (n) out.name = n;
  const x = u.get('x'); if (x) out.extraNodes = decodeNodes(x, maxFree);
  const d = u.get('d'); if (d) out.dropOffsets = decodeOffsets(d);
  const hd = u.get('hd'); if (hd) out.holds = decodeHolds(hd, hasPaint);
  // Seed last: a known paint id wins, else the hex fallback. Neither present → caller's default.
  const pid = u.get('p'), c = normHex(u.get('c'));
  if (pid && hasPaint(pid)) out.baseId = pid;
  else if (c) out.customHex = c;
  return out;
}

/* ---- the store trip (PLAN §5 item 37; mockups/shopping-list.html §6) ----
   No server joins two devices (§1), so the list goes to the phone in a link, and what was bought comes back in
   another link. Both are plain queries, as the share link is: nothing leaves the device but a URL the painter
   sends. A paint id has only a–z, 0–9 and '-' (checked over data 1.6.0), so '.', '*' and '_' can join and mark
   them, and URLSearchParams leaves all three as they are: the link stays short and readable. */
const QTY_MAX = 99;
const listToken = it => it.id + (it.qty >= 2 ? `*${Math.min(QTY_MAX, it.qty)}` : '') + (it.project >= 0 ? `_${it.project}` : '');

/**
 * The store list → its query (no leading '?'): `m=shelf&sv=list`, then a `j` per scheme, then `l`.
 * @param items     [{ id, qty?, project? }] — `project` is an index into `projects`, or absent
 * @param projects  [{ link, name? }] — each scheme's own link (schemeQuery) and name
 */
export function encodeList(items, projects = []) {
  const p = new URLSearchParams();
  p.set('m', 'shelf'); p.set('sv', 'list');
  for (const pr of projects) {
    const q = new URLSearchParams(String(pr.link || '').replace(/^\?/, ''));
    const nm = cleanName(pr.name); if (nm) q.set('n', nm); else q.delete('n');
    p.append('j', q.toString());
  }
  p.set('l', items.map(listToken).join('.'));
  return p.toString();
}

/**
 * A query → the store list in it, or null when it has none. A paint this build does not have is left out
 * (`hasPaint`), as is a bad token; a bad project index becomes no project.
 * @returns {{ items: Array<{id, qty, project}>, projects: Array<{link, name}> } | null}
 *   `qty` is 1 or more; `project` is an index into `projects`, or -1. `link` has no `n` (the scheme only).
 */
export function decodeList(search, { hasPaint = () => true } = {}) {
  const u = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const l = u.get('l');
  if (l == null) return null;
  const projects = u.getAll('j').map(j => {
    const q = new URLSearchParams(j), name = cleanName(q.get('n'));
    q.delete('n');
    return { link: '?' + q.toString(), name };
  });
  const items = [], seen = new Set();
  for (const tok of l.split('.')) {
    const m = /^([a-z0-9-]+)(?:\*(\d{1,2}))?(?:_(\d{1,3}))?$/.exec(tok);
    if (!m || seen.has(m[1]) || !hasPaint(m[1])) continue;
    seen.add(m[1]);
    const qty = Math.max(1, Math.min(QTY_MAX, Number(m[2] || 1)));
    const k = m[3] == null ? -1 : Number(m[3]);
    items.push({ id: m[1], qty, project: k >= 0 && k < projects.length && projects[k].link.length > 1 ? k : -1 });
  }
  return { items, projects };
}

/** The "bought" link back → its query: `m=shelf&b=id.id`. Only marks owned; never removes one. */
export function encodeBought(ids) {
  const p = new URLSearchParams();
  p.set('m', 'shelf');
  p.set('b', [...new Set(ids)].join('.'));
  return p.toString();
}
/** A query → the bought paint ids in it (known paints only, each once), or null when it has no `b`. */
export function decodeBought(search, { hasPaint = () => true } = {}) {
  const u = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const b = u.get('b');
  if (b == null) return null;
  return [...new Set(b.split('.').filter(id => /^[a-z0-9-]+$/.test(id) && hasPaint(id)))];
}
