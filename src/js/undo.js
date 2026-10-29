// undo.js — the undo snapshot: the palette state as one JSON string, and back. Pure (no DOM, no app
// state), so the round trip that undo and redo depend on is unit-tested.
//
// app.js pushHistory compares a new snapshot with the one at the top of the stack. The same string
// means a view-only change (a tab, the theme), so it adds no undo step. That needs an exact round trip:
// JSON writes a number as the shortest digits that read back as the same number (ECMA-262
// Number::toString), so state → snapshot → state → snapshot gives the same string, with no rounding.
//
// An added swatch keeps its own h, s and l, not a hex (share.js stores a hex). A hex gives the same
// colour, but it loses the hue of a grey (the swatch's place on the wheel), and it would fix the
// lightness of a swatch that has none and follows the wheel's. The old snapshot rounded the hue to 0.1°
// and the saturation to 0.001: about 1 added swatch in 15 came back 1 sRGB unit off after an undo.
//
// The wheel's lightness (`wheelL`, the slider) goes in too. A swatch from an old link's h.s token has no
// lightness and shows hsl(h, s, wheelL). After a slider move, wheelL is the slider's value, and the seed's
// hex reads back a little off it, so taking wheelL from the restored seed moved such a swatch 1 sRGB unit.

/**
 * Palette state → the snapshot string. `s` is app.js's `state` (`wheelL` included), plus the three
 * neutral-mode holders it keeps outside `state`: `neutral` (the held mode), `preNeutral` (the parked
 * harmony) and `preSeedRole` (the parked seed role). Only the palette goes in: a tab or the theme is not palette state.
 */
export function snapPalette(s) {
  return JSON.stringify({
    customHex: s.customHex || null,
    baseId: s.customHex ? null : s.baseId,
    harmony: s.harmony, seedRole: s.seedRole, popHex: s.popHex || null,
    // the hysteresis holder + parked harmony are palette state too: without them, undoing to a seed in
    // the 10–14 chroma deadband is re-classified with the CURRENT mode and the restored harmony is
    // forced away (and the parked hue harmony is lost when undoing across a neutral entry)
    neutral: s.neutral ?? null, preNeutral: s.preNeutral ?? null, preSeedRole: s.preSeedRole ?? null,
    extraNodes: (s.extraNodes || []).map(n => ({ h: n.h, s: n.s, l: n.l ?? null, locked: !!n.locked })),
    dropOffsets: [...(s.dropOffsets || [])],
    wheelL: s.wheelL ?? null,
    holds: s.holds && Object.keys(s.holds).length ? s.holds : null,
  });
}

/**
 * The snapshot string → the palette state it holds, in `snapPalette`'s field names. The harmony is not
 * checked here (the caller knows which harmonies this build has). An added swatch with no lightness
 * gets none back, so it follows the wheel's lightness again. `wheelL` is null in a snapshot taken before
 * the wheel had a lightness: the caller then takes it from the seed.
 */
export function readSnap(json) {
  const o = JSON.parse(json);
  return {
    customHex: o.customHex ?? null, baseId: o.baseId ?? null, harmony: o.harmony,
    seedRole: o.seedRole === 'accent' ? 'accent' : 'main',
    popHex: o.popHex || null,
    neutral: typeof o.neutral === 'boolean' ? o.neutral : null,
    preNeutral: o.preNeutral ?? null, preSeedRole: o.preSeedRole ?? null,
    extraNodes: (o.extraNodes || []).map(n => ({ h: n.h, s: n.s, ...(n.l != null ? { l: n.l } : {}), ...(n.locked ? { locked: true } : {}) })),
    dropOffsets: [...(o.dropOffsets || [])],
    wheelL: typeof o.wheelL === 'number' ? o.wheelL : null,
    holds: o.holds && typeof o.holds === 'object' ? o.holds : {},
  };
}
