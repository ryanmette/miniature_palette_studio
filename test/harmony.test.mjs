import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARMONY_OFFSETS, HARMONY_TYPES, harmonize, harmonyPartners, isHarmony, isHueHarmony,
  NEUTRAL_HARMONY_TYPES, isNeutralHarmony, neutralPartners, DEFAULT_POP } from '../src/js/harmony.js';
import { rotateHue, rgbToHsl, hexToRgb } from '../src/js/color.js';

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

test('custom harmony has no partners; harmonize returns just the base', () => {
  assert.equal(isHarmony('custom'), true);
  assert.deepEqual(harmonyPartners('#2D567C', 'custom'), []);
  const s = harmonize('#2D567C', 'custom');
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], { hex: '#2D567C', deg: 0 });
});

test('square + compound = base then their partners', () => {
  assert.equal(harmonize('#2D567C', 'square').length, 4);
  assert.equal(harmonize('#2D567C', 'compound').length, 4);
  assert.equal(harmonyPartners('#2D567C', 'square')[1].deg, 180);
});

test('harmonize = base (0°) then partners, hexes match rotateHue', () => {
  const s = harmonize('#2D567C', 'triadic');
  assert.equal(s.length, 3);
  assert.deepEqual(s[0], { hex: '#2D567C', deg: 0 });
  assert.equal(s[1].hex, rotateHue('#2D567C', 120));
  assert.equal(s[2].hex, rotateHue('#2D567C', 240));
  assert.equal(s[2].deg, 240);
});

test('harmonyPartners excludes the base', () => {
  assert.equal(harmonyPartners('#2D567C', 'complementary').length, 1);
  assert.equal(harmonyPartners('#2D567C', 'tetradic').length, 3);
});

test('unknown harmony throws; isHarmony guards', () => {
  assert.throws(() => harmonize('#000000', 'nope'));
  assert.equal(isHarmony('triadic'), true);
  assert.equal(isHarmony('nope'), false);
});

test('isHueHarmony: false for unknown/neutral types, true for custom (regression)', () => {
  assert.equal(isHueHarmony('custom'), true);
  assert.equal(isHueHarmony('complementary'), true);
  assert.equal(isHueHarmony('shades'), false);
  assert.equal(isHueHarmony('neutral-pop'), false);
  assert.equal(isHueHarmony('no-such-harmony'), false);
});

test('neutral harmonies: registry + guards (CLAUDE.md §7)', () => {
  assert.deepEqual([...NEUTRAL_HARMONY_TYPES], ['neutral-pop', 'duotone', 'warm-cool', 'shades', 'custom']);
  assert.equal(isNeutralHarmony('neutral-pop'), true);
  assert.equal(isNeutralHarmony('shades'), false);     // shades is shared with the hue engine, not pop-era
  assert.equal(isHarmony('neutral-pop'), false);       // not in HARMONY_STEPS — the app's validHarmony unions both
});

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

test('neutralPartners: a light seed steps DOWN the value range (away from its end)', () => {
  const darkBridge = neutralPartners('#101010', '#9C1626', 'neutral-pop')[0].hex;
  const lightBridge = neutralPartners('#F0F0F0', '#9C1626', 'neutral-pop')[0].hex;
  const L = hex => rgbToHsl([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)])[2];
  assert.ok(L(darkBridge) > 0.06 + 0.15, 'dark seed climbs');
  assert.ok(L(lightBridge) < 0.94 - 0.15, 'light seed descends');
});

test('neutralPartners is deterministic (locked recipe constants)', () => {
  assert.deepEqual(neutralPartners('#1B1B1F', '#9C1626', 'neutral-pop'), neutralPartners('#1B1B1F', '#9C1626', 'neutral-pop'));
  assert.equal(DEFAULT_POP, '#9C1626');
});

test('value-harmony steps stay distinct for extreme bases (clamp compression)', async () => {
  const { harmonize } = await import('../src/js/harmony.js');
  const uniq = hexes => new Set(hexes).size === hexes.length;
  for (const base of ['#F2E9E4', '#101010', '#FFFFFF', '#000000']) {
    const shades = harmonize(base, 'shades').map(p => p.hex);
    assert.ok(uniq(shades), `${base} shades all distinct: ${shades.join(' ')}`);   // clamp01 used to emit duplicate white/black partners
  }
  // a base with full head-room is untouched — the locked ±0.12/±0.24 steps must not drift
  const normal = harmonize('#9A1115', 'shades').map(p => p.hex);
  assert.deepEqual(normal, ['#9A1115', '#2C0506', '#630B0D', '#D1171D', '#E93C41']);
});

test('clampPop enforces the minimum pop chroma on any entry path', async () => {
  const { clampPop, POP_MIN_S } = await import('../src/js/harmony.js');
  const { rgbToHsl, hexToRgb } = await import('../src/js/color.js');
  assert.equal(clampPop('#9C1626'), '#9C1626');                       // saturated → untouched
  const clamped = clampPop('#888888');                                // grey (URL pp=888888) → gains chroma
  assert.ok(rgbToHsl(hexToRgb(clamped))[1] >= POP_MIN_S - 0.01, 'clamped pop meets POP_MIN_S');
  assert.notEqual(clamped, '#888888');
});

/* ---- Roll a scheme (CLAUDE.md §7): the pool and the pick ---- */
test('rollHarmony: a seed with a hue rolls from the 9 rule harmonies, never Custom', async () => {
  const { ROLL_TYPES, rollPool } = await import('../src/js/harmony.js');
  assert.deepEqual([...ROLL_TYPES], ['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic',
    'square', 'compound', 'shades', 'monochromatic']);
  assert.ok(!ROLL_TYPES.includes('custom'));
  for (const t of ROLL_TYPES) assert.ok(isHarmony(t) && !isNeutralHarmony(t), t);
  assert.equal(rollPool('custom').length, 9);   // from Custom, every rule harmony can come
});

test('rollHarmony: a neutral seed rolls only from the harmonies it can use', async () => {
  const { ROLL_NEUTRAL_TYPES, rollPool } = await import('../src/js/harmony.js');
  assert.deepEqual([...ROLL_NEUTRAL_TYPES], ['neutral-pop', 'duotone', 'warm-cool', 'shades']);
  for (const t of ROLL_NEUTRAL_TYPES) assert.ok(NEUTRAL_HARMONY_TYPES.includes(t), t);
  assert.deepEqual(rollPool('neutral-pop', { neutral: true }), ['duotone', 'warm-cool', 'shades']);
});

test('rollHarmony: never the current harmony, never Custom, from any random number', async () => {
  const { rollHarmony, ROLL_TYPES, ROLL_NEUTRAL_TYPES } = await import('../src/js/harmony.js');
  // the edges of [0, 1) and points between them
  const rs = [0, 1e-9, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999999, 1 - Number.EPSILON];
  for (const neutral of [false, true]) {
    const pool = neutral ? ROLL_NEUTRAL_TYPES : ROLL_TYPES;
    for (const cur of [...pool, 'custom']) for (const r of rs) {
      const h = rollHarmony(cur, { neutral }, () => r);
      assert.notEqual(h, cur, `${cur} → ${h}`);
      assert.notEqual(h, 'custom');
      assert.ok(pool.includes(h), `${h} is in the ${neutral ? 'neutral' : 'hue'} pool`);
    }
  }
});

test('rollHarmony: every harmony in the pool can come up', async () => {
  const { rollHarmony, rollPool, ROLL_TYPES, ROLL_NEUTRAL_TYPES } = await import('../src/js/harmony.js');
  for (const neutral of [false, true]) {
    for (const cur of neutral ? ROLL_NEUTRAL_TYPES : ROLL_TYPES) {
      const pool = rollPool(cur, { neutral }), seen = new Set();
      // one random number in the middle of each pool slot reaches each harmony once
      pool.forEach((_, i) => seen.add(rollHarmony(cur, { neutral }, () => (i + 0.5) / pool.length)));
      assert.deepEqual([...seen].sort(), [...pool].sort(), `${cur}${neutral ? ' (neutral)' : ''}`);
    }
  }
});

test('startsNeutral: under 10 a link starts neutral, at 14 or more it does not, whatever its harmony', async () => {
  const { startsNeutral } = await import('../src/js/harmony.js');
  const { NEUTRAL_CHROMA, NEUTRAL_EXIT } = await import('../src/js/color.js');
  for (const h of ['complementary', 'shades', 'custom', 'neutral-pop', 'duotone', 'warm-cool']) {
    assert.equal(startsNeutral(0, h), true, `C* 0, ${h}`);
    assert.equal(startsNeutral(NEUTRAL_CHROMA - 0.01, h), true, `C* 9.99, ${h}`);
    assert.equal(startsNeutral(NEUTRAL_EXIT, h), false, `C* 14, ${h}`);   // as the live rule: neutral holds only while C* < 14
    assert.equal(startsNeutral(40, h), false, `C* 40, ${h}`);
  }
});

test('startsNeutral: in the 10–14 band only a neutral-only harmony starts neutral mode', async () => {
  const { startsNeutral } = await import('../src/js/harmony.js');
  const { NEUTRAL_CHROMA, NEUTRAL_EXIT } = await import('../src/js/color.js');
  for (const C of [NEUTRAL_CHROMA, 11.8, NEUTRAL_EXIT - 0.01]) {
    for (const h of ['neutral-pop', 'duotone', 'warm-cool']) assert.equal(startsNeutral(C, h), true, `C* ${C}, ${h}`);
    // Shades and Custom can be in either mode. They start as a hue seed, with the same colours.
    for (const h of ['complementary', 'triadic', 'monochromatic', 'shades', 'custom']) assert.equal(startsNeutral(C, h), false, `C* ${C}, ${h}`);
  }
});

test('startsNeutral: the mode it starts in is one the live hysteresis rule keeps (no flip on load)', async () => {
  // app.js ensureHarmonyMode: a held neutral mode stays while C* < NEUTRAL_EXIT, a held hue mode while
  // C* >= NEUTRAL_CHROMA. A start mode outside that would flip on the first render and drop the harmony.
  const { startsNeutral } = await import('../src/js/harmony.js');
  const { NEUTRAL_CHROMA, NEUTRAL_EXIT } = await import('../src/js/color.js');
  for (let C = 0; C <= 20; C += 0.25) for (const h of ['neutral-pop', 'duotone', 'warm-cool', 'shades', 'complementary']) {
    const n = startsNeutral(C, h);
    assert.equal(n ? C < NEUTRAL_EXIT : C < NEUTRAL_CHROMA, n, `C* ${C}, ${h}`);
  }
});

test('startsNeutral: the regression-test colours (#F5DCD6 under 10, #F3D5CE in the band)', async () => {
  const { startsNeutral } = await import('../src/js/harmony.js');
  const { labChroma } = await import('../src/js/color.js');
  assert.ok(labChroma('#F5DCD6') < 10);
  const C = labChroma('#F3D5CE');
  assert.ok(C >= 10 && C < 14, `C* ${C}`);
  assert.equal(startsNeutral(C, 'neutral-pop'), true);    // the link's neutral-pop survives the reload
  assert.equal(startsNeutral(C, 'complementary'), false);
});
