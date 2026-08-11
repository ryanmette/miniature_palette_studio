// seed.js — the seed FRAME: the mapping between the colour the painter picked and the colour the
// scheme is actually built from. Pure (no DOM, no app state) so the mapping is unit-testable.
//
// Two colours were both called "the base" and the codebase read whichever was closest to hand:
//   • the PICK        — what the painter chose (the hero, the seed badge, the URL's `c`, the hex field)
//   • the SCHEME BASE — what the harmony is generated from (the wheel, the live palette, the Plan)
// They coincide in main-seed mode and sit 180° apart in accent-seed mode, where the pick seeds the
// *Accent* and the scheme is built around its complement. Mixing the two drew wheel nodes that were
// in no scheme and resolved swatch keys to a colour rotated 180° from the one on screen.
//
// Rule of thumb for callers: anything that RENDERS, HIT-TESTS or RESOLVES A SWATCH KEY works in the
// scheme-base frame; only the pick's own identity (name, badge, share URL) uses the pick.

import { rotateHue } from './color.js';

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
