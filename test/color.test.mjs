import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb, rgbToHex, rgbToLab, deltaE2000, deltaE2000Hex,
  rgbToHsl, hslToRgb, rotateHue, relativeLuminance, contrastRatio, textOn, adjustDirection,
  labChroma, isNeutral, lightnessRun, lightnessRunHex, lightnessInput, lightnessBand } from '../src/js/color.js';

const approx = (a, b, eps = 1e-2) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b} (±${eps})`);

test('hex round-trips and short form', () => {
  assert.equal(rgbToHex(hexToRgb('#9A1115')), '#9A1115');
  assert.deepEqual(hexToRgb('#FFF'), [255, 255, 255]);
  assert.throws(() => hexToRgb('nope'));
});

test('CIEDE2000 — Sharma et al. reference pairs (exact to 3dp)', () => {
  const refs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
    [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
    [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, exp] of refs) approx(deltaE2000(a, b), exp, 1e-3);
});

test('Lab anchors: white L*≈100, black L*≈0', () => {
  approx(rgbToLab([255, 255, 255])[0], 100, 0.01);
  approx(rgbToLab([0, 0, 0])[0], 0, 0.01);
});

test('HSL round-trips within 1/255', () => {
  for (const hex of ['#9A1115', '#2D567C', '#FFD900', '#808080', '#0F702A']) {
    const rgb = hexToRgb(hex);
    hslToRgb(rgbToHsl(rgb)).map(Math.round).forEach((v, i) => approx(v, rgb[i], 1));
  }
});

test('rotateHue: 360°=identity, +180° of red ≈ cyan', () => {
  assert.equal(rotateHue('#FF0000', 360), '#FF0000');
  approx(deltaE2000Hex(rotateHue('#FF0000', 180), '#00FFFF'), 0, 0.5);
});

test('relative luminance & contrast', () => {
  approx(relativeLuminance('#FFFFFF'), 1, 1e-6);
  approx(relativeLuminance('#000000'), 0, 1e-6);
  approx(contrastRatio('#FFFFFF', '#000000'), 21, 1e-2);
});

test('textOn picks legible colour', () => {
  assert.equal(textOn('#FFFFFF'), '#15150F');
  assert.equal(textOn('#FFD900'), '#15150F');
  assert.equal(textOn('#000000'), '#FFFFFF');
  assert.equal(textOn('#08085A'), '#FFFFFF');
});

test('adjustDirection: null when the colours are effectively the same', () => {
  assert.equal(adjustDirection('#808080', '#808080'), null);
  assert.equal(adjustDirection('#808080', '#818181'), null);   // below the 0.03 threshold
});

test('adjustDirection: names the lightness axis (the highest-priority axis)', () => {
  assert.equal(adjustDirection('#FFFFFF', '#000000'), 'lighten');   // ideal far lighter
  assert.equal(adjustDirection('#000000', '#FFFFFF'), 'darken');    // ideal far darker
  assert.equal(adjustDirection('#8F8F8F', '#808080'), 'lighten slightly'); // small gap → "slightly"
});

test('adjustDirection: names the saturation axis when it dominates', () => {
  // same hue/lightness, big saturation gap → mute / saturate (sat is weighted 0.8, still wins here)
  assert.equal(adjustDirection('#808080', '#FF0000'), 'mute');      // ideal greyer than paint
  assert.equal(adjustDirection('#FF0000', '#808080'), 'saturate');  // ideal more saturated than paint
});

test('adjustDirection: falls back to hue when only hue differs', () => {
  // equal S and L, hue 120° apart → hue is the only non-trivial axis
  assert.equal(adjustDirection('#00FF00', '#FF0000'), 'shift hue');
});

test('labChroma: achromatic hexes ≈ 0; saturated hexes are high', () => {
  assert.ok(labChroma('#000000') < 0.5);
  assert.ok(labChroma('#FFFFFF') < 0.5);
  assert.ok(labChroma('#808080') < 0.5);
  assert.ok(labChroma('#FF0000') > 60);
});

test('isNeutral (CLAUDE.md §7, Lab C* < 10): blacks/whites/greys yes, colours no', () => {
  for (const hex of ['#000000', '#FFFFFF', '#808080', '#1B1B1F', '#E8E8E4']) assert.equal(isNeutral(hex), true, hex);
  // the case HSL saturation gets wrong: visually-black but HSL S = 1.0
  assert.equal(isNeutral('#100000'), true);
  for (const hex of ['#9A1115', '#86D562', '#2D567C', '#C2912F']) assert.equal(isNeutral(hex), false, hex);
});

test('normHex normalises 6-digit hex with/without # and rejects everything else', async () => {
  const { normHex } = await import('../src/js/color.js');
  assert.equal(normHex('#9a1115'), '#9A1115');
  assert.equal(normHex('9A1115'), '#9A1115');
  assert.equal(normHex(' 9a1115 '), '#9A1115');
  for (const bad of ['#abc', 'abc', '#9A111', '#9A11157', 'red', '', null, undefined, '#9A111G']) {
    assert.equal(normHex(bad), null, String(bad));
  }
});

/* ---- the wheel's lightness slider (CLAUDE.md §3.6 wheel module; mockups/lightness-slider.html bug a) ---- */
// A slider position for a colour, as the app sets it (syncWheelL): its HSL lightness in whole per
// cent, inside the slider's 6–94 range.
const sliderOf = hex => Math.min(94, Math.max(6, Math.round(rgbToHsl(hexToRgb(hex))[2] * 100)));
// The old input handler read h and s again from the 8-bit hex on every input event.
const oldPath = (hex, values) => values.reduce((cur, v) => {
  const [h, s] = rgbToHsl(hexToRgb(cur));
  return rgbToHex(hslToRgb([h, s, v / 100]));
}, hex);
// Step by step, as arrow keys (or a drag) do: every whole per cent from the start down to 6, then back.
const stepsTo6AndBack = v0 => {
  const vs = [];
  for (let v = v0 - 1; v >= 6; v--) vs.push(v);
  for (let v = 7; v <= v0; v++) vs.push(v);
  return vs;
};
// The new handler: one run from the start colour, then each slider value in turn.
const runPath = (hex, values) => {
  const run = lightnessRun(hex, sliderOf(hex));
  return values.map(v => lightnessRunHex(run, v));
};

test('lightness slider: the measured drift is real in the old handler (so these cases test the bug)', () => {
  assert.equal(sliderOf('#555E1B'), 24);
  assert.equal(sliderOf('#6B5B4B'), 36);
  assert.equal(oldPath('#555E1B', [6, 24]), '#535F1C');
  assert.equal(oldPath('#6B5B4B', [6, 36]), '#6B594D');
  assert.equal(oldPath('#555E1B', stepsTo6AndBack(24)), '#575E1C');
  assert.equal(oldPath('#6B5B4B', stepsTo6AndBack(36)), '#6C4B4B');   // hue 30° → 0°: brown to red
});

for (const hex of ['#555E1B', '#6B5B4B', '#808080', '#FF0000']) {
  test(`lightness slider: ${hex} → 6% → back in one jump gives ${hex} exactly`, () => {
    assert.equal(runPath(hex, [6, sliderOf(hex)]).at(-1), hex);
  });
  test(`lightness slider: ${hex} → 6% → back step by step gives ${hex} exactly`, () => {
    const vs = stepsTo6AndBack(sliderOf(hex)), out = runPath(hex, vs);
    assert.equal(vs.length, 2 * (sliderOf(hex) - 6));   // every whole per cent, both ways
    assert.equal(out.at(-1), hex);
    // On the way back each value shows the colour it showed on the way down (no path dependence).
    const down = new Map(vs.map((v, i) => [v, out[i]]).slice(0, vs.indexOf(6) + 1));
    vs.forEach((v, i) => { if (down.has(v)) assert.equal(out[i], down.get(v), `${hex} at ${v}%`); });
  });
}

test('lightness slider: the run holds the start hue and saturation (brown stays brown at 6%)', () => {
  const run = lightnessRun('#6B5B4B', 36);
  approx(run.h, 30, 0.01);
  assert.equal(lightnessRunHex(run, 6), rgbToHex(hslToRgb([run.h, run.s, 0.06])));
  const grey = lightnessRun('#808080', 50);
  assert.equal(grey.s, 0);
  assert.equal(lightnessRunHex(grey, 6), '#0F0F0F');   // an achromatic seed stays grey
  const red = lightnessRun('#FF0000', 50);
  assert.equal(lightnessRunHex(red, 6), '#1F0000');    // a saturated seed keeps its full saturation
});

test('lightness slider: a start outside 6–94 comes back on the slider end it started from', () => {
  // #050505 is 2% light, so the slider shows its minimum, 6: that is the start value.
  assert.equal(sliderOf('#050505'), 6);
  assert.equal(runPath('#050505', [30, 6]).at(-1), '#050505');
  assert.equal(runPath('#FAFAFA', [50, 94]).at(-1), '#FAFAFA');
});

// The app's side of a run, as wheel.js applies it: the pick is the custom hex, or the picked paint's hex.
// `paint` is the picked paint's hex (null for none); `custom` and `wheelL` are what the app stores.
const slider = ({ paint = null, custom = null }) => {
  const app = { paint, custom, wheelL: rgbToHsl(hexToRgb(custom || paint))[2] };
  let run = null;
  const pick = () => app.custom || app.paint;
  return {
    app, pick,
    get run() { return run; },
    move(v) {
      const step = lightnessInput(run, { v, pick: pick(), custom: app.custom, wheelL: app.wheelL, min: 6, max: 94 });
      run = step.run; app.custom = step.custom; app.wheelL = step.wheelL;
      return pick();
    },
    // something other than the slider writes the pick (a wheel drag, ↻), as setBase does
    writePick(hex) { app.custom = hex; },
  };
};

test('lightness run: step by step with nothing else in between gives back the start colour', () => {
  for (const hex of ['#555E1B', '#6B5B4B', '#808080', '#FF0000']) {
    const sl = slider({ custom: hex }), v0 = sliderOf(hex);
    for (const v of stepsTo6AndBack(v0)) sl.move(v);
    assert.equal(sl.pick(), hex);
    assert.equal(sl.app.custom, hex);
  }
});

test('lightness run: it holds the start hue and saturation exactly, not rounded', () => {
  for (const hex of ['#555E1B', '#6B5B4B', '#FF0000']) {
    const [h0, s0] = rgbToHsl(hexToRgb(hex)), sl = slider({ custom: hex });
    sl.move(sliderOf(hex) - 1);
    assert.equal(sl.run.h, h0);
    assert.equal(sl.run.s, s0);
    for (const v of stepsTo6AndBack(sliderOf(hex))) {
      const out = sl.move(v);
      if (v !== sliderOf(hex)) assert.equal(out, rgbToHex(hslToRgb([h0, s0, v / 100])), `${hex} at ${v}%`);
    }
  }
});

test('lightness run: back on the start value, the wheel lightness is the start lightness again', () => {
  const sl = slider({ custom: '#555E1B' }), L0 = sl.app.wheelL;   // 23.7%: not a whole per cent
  sl.move(6);
  assert.equal(sl.app.wheelL, 0.06);
  sl.move(24);
  assert.equal(sl.app.wheelL, L0);
});

test('lightness run: a picked paint stays that paint after a round trip (not a custom hex)', () => {
  const sl = slider({ paint: '#5F6772' }), v0 = sliderOf('#5F6772');
  sl.move(6);
  assert.notEqual(sl.app.custom, null);   // a custom colour while away from the start
  sl.move(v0);
  assert.equal(sl.app.custom, null);      // back on the start: the paint again, so the hero names it
  assert.equal(sl.pick(), '#5F6772');
  // and the run is still open: the next move keeps the paint's hue and saturation
  const [h0, s0] = rgbToHsl(hexToRgb('#5F6772'));
  assert.equal(sl.move(6), rgbToHex(hslToRgb([h0, s0, 0.06])));
});

test('lightness run: a pick written by something else between inputs starts a new run from it', () => {
  const sl = slider({ custom: '#6B5B4B' });
  sl.move(20);
  const first = sl.run;
  sl.writePick('#3366CC');                 // a wheel drag or ↻ (the wheel lightness stays at 20%)
  sl.move(30);
  assert.notEqual(sl.run, first);
  assert.equal(sl.run.pick, '#3366CC');
  assert.equal(sl.run.v0, 20);             // the slider showed 20 when the new run started
  assert.equal(sl.app.custom, rgbToHex(hslToRgb([rgbToHsl(hexToRgb('#3366CC'))[0], rgbToHsl(hexToRgb('#3366CC'))[1], 0.30])));
  sl.move(20);
  assert.equal(sl.pick(), '#3366CC');      // back on the new run's start: the new colour, not the old one
});

test('lightness run: a start past the slider ends begins on the end value', () => {
  const sl = slider({ custom: '#FFFFFF' });
  sl.move(93);
  assert.equal(sl.run.v0, 94);
  sl.move(94);
  assert.equal(sl.pick(), '#FFFFFF');
  assert.equal(sl.app.wheelL, 1);
});

test('lightness slider: value-text bands (very dark ≤15, dark ≤35, mid ≤65, light ≤85, very light)', () => {
  const cases = { 6: 'veryDark', 15: 'veryDark', 16: 'dark', 24: 'dark', 35: 'dark', 36: 'mid', 65: 'mid',
    66: 'light', 85: 'light', 86: 'veryLight', 94: 'veryLight' };
  for (const [v, band] of Object.entries(cases)) assert.equal(lightnessBand(+v), band, `${v}%`);
});

/* ---- ↻ on black and white (CLAUDE.md §3.6): lightnessForHue ---- */
test('↻ lightness: a mid colour keeps its lightness', async () => {
  const { lightnessForHue } = await import('../src/js/color.js');
  for (const [h, s, l] of [[200, 0.6, 0.45], [10, 0.95, 0.3], [120, 0.5, 0.7], [60, 0.8, 0.5]]) {
    assert.deepEqual(lightnessForHue(h, s, l), { l, moved: false }, `hsl(${h}, ${s}, ${l})`);
  }
});

test('↻ lightness: black, white, #050505 and #FAFAFA move the smallest step toward mid', async () => {
  const { lightnessForHue, NEUTRAL_EXIT } = await import('../src/js/color.js');
  const C = (h, s, l) => labChroma(rgbToHex(hslToRgb([h, s, l])));
  for (const hex of ['#000000', '#FFFFFF', '#050505', '#FAFAFA']) {
    const l0 = rgbToHsl(hexToRgb(hex))[2], up = l0 < 0.5;
    // every whole hue, at the ↻ strengths (50% to 95%)
    for (let h = 0; h < 360; h += 5) for (const s of [0.5, 0.72, 0.95]) {
      const r = lightnessForHue(h, s, l0), at = `${hex} hsl(${h}, ${s})`;
      assert.equal(r.moved, true, at);
      assert.ok(up ? r.l > l0 && r.l <= 0.5 : r.l < l0 && r.l >= 0.5, `${at}: toward mid (${r.l})`);
      assert.ok(Math.abs(r.l * 100 - Math.round(r.l * 100)) < 1e-9, `${at}: a whole per cent`);
      assert.ok(C(h, s, r.l) >= NEUTRAL_EXIT, `${at}: the colour shows at ${r.l}`);
      // the smallest move: one per cent less, and the colour is still neutral (unless that is the start)
      const back = r.l - (up ? 0.01 : -0.01);
      if (up ? back > l0 : back < l0) assert.ok(C(h, s, back) < NEUTRAL_EXIT, `${at}: ${back} is still grey`);
    }
  }
  // black: the colour was #000000 at every hue, so ↻ gave black again
  assert.equal(rgbToHex(hslToRgb([0, 0.95, 0])), '#000000');
  assert.notEqual(rgbToHex(hslToRgb([0, 0.95, lightnessForHue(0, 0.95, 0).l])), '#000000');
});

test('↻ lightness: no chroma at any lightness keeps the lightness; hexOf decides which colour counts', async () => {
  const { lightnessForHue } = await import('../src/js/color.js');
  assert.deepEqual(lightnessForHue(0, 0, 0), { l: 0, moved: false });   // a grey strength: nothing helps
  // hexOf: the wheel passes the scheme base as it will be stored. Here it is always grey, so nothing moves.
  const seen = [];
  const r = lightnessForHue(30, 0.9, 0.5, { hexOf: (h, s, l) => { seen.push(l); return '#808080'; } });
  assert.deepEqual(r, { l: 0.5, moved: false });
  assert.deepEqual(seen, [0.5]);
});
