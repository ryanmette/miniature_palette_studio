// Unit tests for the harmony engine (src/js/harmony.js), run under `node --test` with `node:assert/strict`.
// Harmony generation is pure math (rotate/step a base colour in HSL), so it's tested in isolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARMONY_OFFSETS, HARMONY_TYPES, harmonize, harmonyPartners, isHarmony, isHueHarmony,
  NEUTRAL_HARMONY_TYPES, isNeutralHarmony, neutralPartners, DEFAULT_POP } from '../src/js/harmony.js';
import { rotateHue, rgbToHsl, hexToRgb } from '../src/js/color.js';

// The hue-offset recipes are locked constants (CLAUDE.md §7) — results must never drift, so this pins every
// harmony's exact degree steps and asserts there are exactly 10 harmony types. Value ramps (shades/mono)
// have 0° offsets because they vary lightness/saturation, not hue.
test('harmony offsets are locked (CLAUDE.md §7)', () => {
  assert.deepEqual(HARMONY_OFFSETS.complementary, [180]);
  assert.deepEqual(HARMONY_OFFSETS.analogous, [-30, 30]);
  assert.deepEqual(HARMONY_OFFSETS.triadic, [120, 240]);
  assert.deepEqual(HARMONY_OFFSETS['split-complementary'], [150, 210]);
  assert.deepEqual(HARMONY_OFFSETS.tetradic, [60, 180, 240]);
  assert.deepEqual(HARMONY_OFFSETS.square, [90, 180, 270]);
  assert.deepEqual(HARMONY_OFFSETS.compound, [30, 180, 210]);
  assert.deepEqual(HARMONY_OFFSETS.shades, [0, 0, 0, 0]);       // value ramps project to 0° hue
  assert.deepEqual(HARMONY_OFFSETS.monochromatic, [0, 0, 0]);
  assert.deepEqual(HARMONY_OFFSETS.custom, []);
  assert.equal(HARMONY_TYPES.length, 10);
});

// The "value" harmonies (shades, monochromatic) hold the base hue fixed and walk lightness/saturation.
// isHueHarmony must report them false (they can't sit on the wheel ring), while still producing distinct
// swatches that all share the base hue.
test('value harmonies keep the base hue but vary value/saturation (and aren\'t hue-harmonies)', () => {
  assert.equal(isHueHarmony('triadic'), true);
  assert.equal(isHueHarmony('custom'), true);     // no partners → trivially a hue harmony
  assert.equal(isHueHarmony('shades'), false);
  assert.equal(isHueHarmony('monochromatic'), false);
  const baseHue = rgbToHsl(hexToRgb('#3366CC'))[0];
  const sh = harmonyPartners('#3366CC', 'shades');
  assert.equal(sh.length, 4);
  assert.equal(new Set(sh.map(p => p.hex)).size, 4);            // four distinct shades
  for (const p of sh) assert.ok(Math.abs(rgbToHsl(hexToRgb(p.hex))[0] - baseHue) < 1);   // same hue
});

// "custom" is the hand-built mode: it has no generated partners, so harmonize returns only the base colour
// (the painter adds the rest by hand).
test('custom harmony has no partners; harmonize returns just the base', () => {
  assert.equal(isHarmony('custom'), true);
  assert.deepEqual(harmonyPartners('#2D567C', 'custom'), []);
  const s = harmonize('#2D567C', 'custom');
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], { hex: '#2D567C', deg: 0 });
});

// Four-colour harmonies (square, compound) yield 4 swatches = base + 3 partners, and the partner degrees
// follow the locked recipe (square's second partner is at 180°).
test('square + compound = base then their partners', () => {
  assert.equal(harmonize('#2D567C', 'square').length, 4);
  assert.equal(harmonize('#2D567C', 'compound').length, 4);
  assert.equal(harmonyPartners('#2D567C', 'square')[1].deg, 180);
});

// harmonize returns the base first (at 0°) followed by its partners, and each partner hex is exactly what
// rotateHue by that degree produces — confirming harmonize and rotateHue agree.
test('harmonize = base (0°) then partners, hexes match rotateHue', () => {
  const s = harmonize('#2D567C', 'triadic');
  assert.equal(s.length, 3);
  assert.deepEqual(s[0], { hex: '#2D567C', deg: 0 });
  assert.equal(s[1].hex, rotateHue('#2D567C', 120));
  assert.equal(s[2].hex, rotateHue('#2D567C', 240));
  assert.equal(s[2].deg, 240);
});

// harmonyPartners returns ONLY the partners (base excluded): complementary has 1, tetradic has 3 —
// matching the offset counts above.
test('harmonyPartners excludes the base', () => {
  assert.equal(harmonyPartners('#2D567C', 'complementary').length, 1);
  assert.equal(harmonyPartners('#2D567C', 'tetradic').length, 3);
});

// An unrecognised harmony name throws (fail loud, don't silently return a wrong scheme); isHarmony is the
// safe guard callers use to check a name before calling harmonize.
test('unknown harmony throws; isHarmony guards', () => {
  assert.throws(() => harmonize('#000000', 'nope'));
  assert.equal(isHarmony('triadic'), true);
  assert.equal(isHarmony('nope'), false);
});

// Regression guard for isHueHarmony's edge cases: true for real hue harmonies AND for "custom" (no partners
// → trivially hue-safe), but false for value harmonies, neutral types, and unknown names.
test('isHueHarmony: false for unknown/neutral types, true for custom (regression)', () => {
  assert.equal(isHueHarmony('custom'), true);
  assert.equal(isHueHarmony('complementary'), true);
  assert.equal(isHueHarmony('shades'), false);
  assert.equal(isHueHarmony('neutral-pop'), false);
  assert.equal(isHueHarmony('no-such-harmony'), false);
});

// Neutral mode has its own harmony registry (for hueless seeds). This pins that list and checks the guards:
// neutral-pop is neutral-only; shades is shared with the hue engine (so not counted "neutral" by
// isNeutralHarmony); and neutral-pop is deliberately NOT in the hue HARMONY_STEPS (the app unions both sets).
test('neutral harmonies: registry + guards (CLAUDE.md §7)', () => {
  assert.deepEqual([...NEUTRAL_HARMONY_TYPES], ['neutral-pop', 'duotone', 'warm-cool', 'shades', 'custom']);
  assert.equal(isNeutralHarmony('neutral-pop'), true);
  assert.equal(isNeutralHarmony('shades'), false);     // shades is shared with the hue engine, not pop-era
  assert.equal(isHarmony('neutral-pop'), false);       // not in HARMONY_STEPS — the app's validHarmony unions both
});

// neutralPartners builds the partners for a hueless seed. For pop-bearing recipes (neutral-pop, duotone) the
// accent "pop" colour is always the last partner and partners are off-ring (deg null, not hue rotations);
// duotone's bridge is more strongly tinted than neutral-pop's; warm-cool is a pure temperature split with no pop.
test('neutralPartners: pop-bearing recipes end on the pop; warm-cool ignores it', () => {
  const seed = '#1B1B1F', pop = '#9C1626';
  const np = neutralPartners(seed, pop, 'neutral-pop');
  assert.equal(np.length, 2);
  assert.equal(np[1].hex, pop);                        // the pop itself is always a partner
  assert.equal(np[0].deg, null);                       // off-ring partners (not base rotations)
  const duo = neutralPartners(seed, pop, 'duotone');
  assert.equal(duo[1].hex, pop);
  assert.notEqual(duo[0].hex, np[0].hex);              // duotone's mid is more strongly tinted than the bridge
  const wc = neutralPartners(seed, pop, 'warm-cool');
  assert.equal(wc.length, 2);
  assert.ok(wc.every(p => p.hex !== pop));             // temperature split — no pop in the recipe
});

// The bridge step moves AWAY from the seed's end of the value range: a near-black seed's bridge is lighter,
// a near-white seed's bridge is darker — so the scheme always has contrast to work with. (L() reads HSL lightness.)
test('neutralPartners: a light seed steps DOWN the value range (away from its end)', () => {
  const darkBridge = neutralPartners('#101010', '#9C1626', 'neutral-pop')[0].hex;
  const lightBridge = neutralPartners('#F0F0F0', '#9C1626', 'neutral-pop')[0].hex;
  const L = hex => rgbToHsl([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)])[2];
  assert.ok(L(darkBridge) > 0.06 + 0.15, 'dark seed climbs');
  assert.ok(L(lightBridge) < 0.94 - 0.15, 'light seed descends');
});

// The recipe constants are locked, so the same inputs must always give byte-identical output (deterministic,
// shareable via URL) — and the default pop colour is pinned.
test('neutralPartners is deterministic (locked recipe constants)', () => {
  assert.deepEqual(neutralPartners('#1B1B1F', '#9C1626', 'neutral-pop'), neutralPartners('#1B1B1F', '#9C1626', 'neutral-pop'));
  assert.equal(DEFAULT_POP, '#9C1626');
});
