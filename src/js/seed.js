// seed.js — the seed FRAME: the mapping between the colour the painter picked and the colour the
// scheme is actually built from. Also the seed field's query parser (parseSeedQuery): what the painter
// typed, read as a paint search or a hex; and its Recent picks (addRecent). Pure (no DOM, no app state),
// so all of it is unit-tested.
//
// Two colours were both called "the base" and the codebase read whichever was closest to hand:
//   • the PICK        — what the painter chose (the hero, the seed badge, the URL's `c`)
//   • the SCHEME BASE — what the harmony is generated from (the wheel, the live palette, the Plan)
// They coincide in main-seed mode and sit 180° apart in accent-seed mode, where the pick seeds the
// *Accent* and the scheme is built around its complement. Mixing the two drew wheel nodes that were
// in no scheme and resolved swatch keys to a colour rotated 180° from the one on screen.
//
// Rule of thumb for callers: anything that RENDERS, HIT-TESTS or RESOLVES A SWATCH KEY works in the
// scheme-base frame; only the pick's own identity (name, badge, share URL) uses the pick.

import { rotateHue, normHex } from './color.js';

/** The scheme base for a pick: 180° away when the pick seeds the Accent, else the pick itself. */
export const schemeBaseOf = (pickHex, seedRole) =>
  seedRole === 'accent' ? rotateHue(pickHex, 180) : pickHex;

/**
 * The inverse: the pick that puts the scheme base at `hex`. Every write that lands in the scheme
 * frame — a wheel drag, editing the base column, "use as base colour" — goes through this, or the
 * colour would jump 180° the moment it was set in accent-seed mode.
 * rotateHue is its own inverse at 180°, so this is `schemeBaseOf` again; it exists as a named
 * function because the two directions read very differently at a call site.
 */
export const pickForSchemeBase = (hex, seedRole) =>
  seedRole === 'accent' ? rotateHue(hex, 180) : hex;

/** A harmony partner's colour: always a rotation of the SCHEME base, never of the pick. */
export const partnerHex = (schemeBase, deg) => rotateHue(schemeBase, deg);

/**
 * Resolve an addressable swatch key to the colour that key currently shows.
 * Keys: 'base' (the scheme base column) · 'p:<deg>' (a harmony partner) · 'x:<idx>' (an added swatch).
 * `frame`: { schemeBase, extraNodes, wheelL, toHex } — `toHex` converts an [h,s,l] triple to a hex
 * (injected so this module stays free of the colour-conversion import graph's DOM-adjacent callers).
 */
export function swatchKeyHex(key, { schemeBase, extraNodes = [], wheelL = 0.5, toHex }) {
  if (key.startsWith('p:')) return partnerHex(schemeBase, +key.slice(2));
  if (key.startsWith('x:')) {
    const o = extraNodes[+key.slice(2)];
    if (o) return toHex([o.h, o.s, o.l ?? wheelL]);
  }
  return schemeBase;
}

/**
 * Read what the painter typed in the seed field ("Paint or #hex"). One answer for each kind of text:
 *   { kind: 'empty' }                  nothing typed
 *   { kind: 'hex', hex, live: true }   "#" and 6 hex digits, typed or pasted: the seed changes as you type
 *   { kind: 'hex', hex, live: false }  "#RGB", or 6 digits without "#" ("9a1115"): only Enter seeds it
 *   { kind: 'partial' }                "#", "#9A", "#9A11": not a colour yet
 *   { kind: 'name', hexWord? }         a paint search. Six hex LETTERS ("decade") are a word first; the
 *                                      field then offers hexWord ("#DECADE") as its last option
 * A paint name never becomes a colour: "Abaddon Black" is a search. (The old hex box kept only the hex
 * letters of what you typed, so it seeded #ABADDB.) "#RGB" never seeds live: while you type "#9A1115",
 * its first 3 digits would seed #99AA11 for a moment. Every hex comes back through normHex, so no typed
 * text can reach the page as markup.
 */
export function parseSeedQuery(raw) {
  const q = String(raw ?? '').trim();
  if (!q) return { kind: 'empty' };
  let m = /^#\s*([0-9a-f]{6})$/i.exec(q);
  if (m) return { kind: 'hex', hex: normHex(m[1]), live: true };
  m = /^#\s*([0-9a-f]{3})$/i.exec(q);
  if (m) return { kind: 'hex', hex: normHex(m[1].replace(/./g, c => c + c)), live: false };
  if (/^#\s*[0-9a-f]{0,5}$/i.test(q)) return { kind: 'partial' };
  m = /^[0-9a-f]{6}$/i.exec(q);
  if (m) return /\d/.test(q) ? { kind: 'hex', hex: normHex(q), live: false } : { kind: 'name', hexWord: normHex(q) };
  return { kind: 'name' };
}

/** How many Recent picks the seed field keeps. The browse grid shows one row of them: as many as fit. */
export const RECENT_MAX = 12;

/**
 * Recent picks for the seed field's browse grid: `id` first, then the earlier picks, with no repeats
 * and at most `max`. A new array; the input is not changed. This visit only: the app keeps the list in
 * memory, never in storage, so it is no new saved data (nothing to back up, restore or delete).
 */
export function addRecent(list, id, max = RECENT_MAX) {
  const prev = Array.isArray(list) ? list : [];
  if (!id) return prev.slice(0, max);
  return [id, ...prev.filter(x => x !== id)].slice(0, max);
}
