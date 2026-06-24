import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARMONY_OFFSETS, HARMONY_TYPES, harmonize, harmonyPartners, isHarmony } from '../src/js/harmony.js';
import { rotateHue } from '../src/js/color.js';

test('harmony offsets are locked (CLAUDE.md §7)', () => {
  assert.deepEqual(HARMONY_OFFSETS.complementary, [180]);
  assert.deepEqual(HARMONY_OFFSETS.analogous, [-30, 30]);
  assert.deepEqual(HARMONY_OFFSETS.triadic, [120, 240]);
  assert.deepEqual(HARMONY_OFFSETS['split-complementary'], [150, 210]);
  assert.deepEqual(HARMONY_OFFSETS.tetradic, [60, 180, 240]);
  assert.equal(HARMONY_TYPES.length, 5);
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
