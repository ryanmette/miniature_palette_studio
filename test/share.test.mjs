import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, decodeNodes, decodeOffsets } from '../src/js/share.js';
import { hslToRgb, rgbToHex, rgbToHsl, hexToRgb, labChroma } from '../src/js/color.js';
import { startsNeutral } from '../src/js/harmony.js';

/** The colour an added swatch shows on screen (app.js paletteNodes). */
const hexOf = (n, wheelL = 0.5) => rgbToHex(hslToRgb([n.h, n.s, n.l ?? wheelL]));

const V = { validHarmony: h => ['complementary', 'triadic', 'shades', 'neutral-pop'].includes(h),
            hasPaint: id => ['citadel-red', 'vallejo-blue'].includes(id),
            validTab: t => ['plan', 'equiv', 'a11y'].includes(t) };

test('a paint seed round-trips as the paint, with the hex as a fallback', () => {
  const p = encodeState({ baseId: 'citadel-red', pickHex: '#9A1115', harmony: 'triadic', tab: 'plan' });
  assert.equal(p.get('p'), 'citadel-red');
  assert.equal(p.get('c'), '9A1115');       // hex rides along for links whose paint is gone
  const back = decodeState(p, V);
  assert.equal(back.baseId, 'citadel-red');
  assert.equal(back.customHex, undefined);  // the paint won; no anonymous "Custom #…"
});

test('a custom hex seed omits the paint id', () => {
  const p = encodeState({ customHex: '#2D567C', baseId: 'citadel-red', pickHex: '#2D567C', harmony: 'complementary' });
  assert.equal(p.get('p'), null);
  assert.equal(decodeState(p, V).customHex, '#2D567C');
});

test('full round trip preserves every palette field', () => {
  const s = {
    customHex: null, baseId: 'vallejo-blue', pickHex: '#2D567C', harmony: 'shades',
    seedRole: 'accent', theme: 'dark', tab: 'equiv', mode: 'shelf',
    popHex: '#9C1626', wheelL: 0.5,
    extraNodes: [{ h: 120, s: 0.5, l: 0.4 }, { h: 300, s: 0.8, l: 0.6, locked: true }],
    dropOffsets: [180, 240],
  };
  const back = decodeState(encodeState(s), V);
  assert.equal(back.baseId, 'vallejo-blue');
  assert.equal(back.harmony, 'shades');
  assert.equal(back.seedRole, 'accent');
  assert.equal(back.theme, 'dark');
  assert.equal(back.tab, 'equiv');
  assert.equal(back.mode, 'shelf');
  assert.equal(back.popHex, '#9C1626');
  assert.deepEqual(back.dropOffsets, [180, 240]);
  // the added swatches have the same colours after the round trip, and the lock
  assert.deepEqual(back.extraNodes.map(n => hexOf(n)), s.extraNodes.map(n => hexOf(n)));
  assert.deepEqual(back.extraNodes.map(n => !!n.locked), [false, true]);
});

test('defaults are omitted from the link (short, pasteable URLs)', () => {
  const p = encodeState({ baseId: 'citadel-red', pickHex: '#9A1115', harmony: 'complementary',
    tab: 'plan', mode: 'studio', seedRole: 'main', theme: 'light' });
  assert.deepEqual([...p.keys()].sort(), ['c', 'h', 'p']);
});

test('an old link with the Target / Pot fill (f=1) still opens, and the fill is gone', () => {
  const back = decodeState('p=citadel-red&c=9A1115&f=1', V);
  assert.equal(back.baseId, 'citadel-red');
  assert.equal('showReal' in back, false);
});

test('an added swatch without its own lightness falls back to the wheel slider on encode', () => {
  const p = encodeState({ pickHex: '#000000', extraNodes: [{ h: 90, s: 0.4 }], wheelL: 0.33 });
  assert.equal(p.get('x'), '547632');   // hsl(90, 40%, 33%)
  assert.equal(hexOf(decodeNodes('547632')[0]), '#547632');
});

test('added swatches are written as their hex, so a reload gives back the same colours', () => {
  // The PR #39 regression test: #2B5D34, + three times. The old whole-number h.s.l token
  // (131.37.39-131.37.15-131.37.49) decoded as #3F884C,#18341D,#4FAB60.
  const [h, s, l] = rgbToHsl(hexToRgb('#2B5D34'));
  const nodes = [{ h, s, l: l + 0.12 }, { h, s, l: l - 0.12 }, { h, s, l: l + 0.22 }];
  assert.deepEqual(nodes.map(n => hexOf(n)), ['#3E874B', '#18331D', '#4EAA5F']);
  const p = encodeState({ pickHex: '#2D6237', harmony: 'triadic', extraNodes: nodes, wheelL: 0.29 });
  assert.equal(p.get('x'), '3E874B-18331D-4EAA5F');
  const back = decodeState(new URLSearchParams(p.toString()), V);
  assert.deepEqual(back.extraNodes.map(n => hexOf(n)), ['#3E874B', '#18331D', '#4EAA5F']);
  // a reload writes the same link again
  assert.equal(encodeState({ pickHex: '#2D6237', harmony: 'triadic', extraNodes: back.extraNodes }).toString(), p.toString());
});

test('the hex round trip is exact for any added swatch, and keeps the lock', () => {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // fixed sequence: a failure repeats
  for (let i = 0; i < 5000; i++) {
    const n = { h: rand() * 360, s: rand(), l: rand(), ...(rand() < 0.3 ? { locked: true } : {}) };
    const [d] = decodeNodes(encodeState({ pickHex: '#000000', extraNodes: [n] }).get('x'));
    assert.equal(hexOf(d), hexOf(n), JSON.stringify(n));
    assert.equal(!!d.locked, !!n.locked);
    assert.ok(d.s >= 0 && d.s <= 1 && d.l >= 0 && d.l <= 1 && d.h >= 0 && d.h < 360);   // the old path's ranges
  }
});

test('an old link\'s h.s.l swatches still decode, also beside hex swatches', () => {
  assert.deepEqual(decodeNodes('131.37.39-131.37.15!-131.37.49'),
    [{ h: 131, s: 0.37, l: 0.39 }, { h: 131, s: 0.37, l: 0.15, locked: true }, { h: 131, s: 0.37, l: 0.49 }]);
  assert.deepEqual(decodeNodes('90.40'), [{ h: 90, s: 0.4 }]);   // no lightness: follows the wheel slider
  const mixed = decodeNodes('120.50.40-3e874b!-18331D');           // the decoder takes lower-case hex too
  assert.deepEqual(mixed[0], { h: 120, s: 0.5, l: 0.4 });
  assert.deepEqual(mixed.slice(1).map(n => [hexOf(n), !!n.locked]), [['#3E874B', true], ['#18331D', false]]);
});

test('a malformed hex swatch is dropped, not thrown on', () => {
  assert.deepEqual(decodeNodes('3E874'), []);    // 5 digits
  assert.deepEqual(decodeNodes('GGGGGG'), []);
  assert.deepEqual(decodeNodes('3E874B4'), []);  // 7 digits
  assert.equal(decodeNodes('GGGGGG-3E874B').length, 1);
});

test('a neutral-only harmony on a seed in the 10–14 band survives the link', () => {
  // The PR #39 regression test: ?c=F5DCD6 opens neutral (C* 9.76). Two lightness steps down give #F3D5CE
  // (C* 11.8), which stays neutral (hysteresis). The link has no mode in it, so the reload gets it from h.
  const VN = { ...V, validHarmony: h => ['complementary', 'neutral-pop', 'duotone', 'warm-cool'].includes(h) };
  for (const h of ['neutral-pop', 'duotone', 'warm-cool']) {
    const back = decodeState(`c=F3D5CE&h=${h}`, VN);
    assert.equal(back.harmony, h);
    assert.equal(startsNeutral(labChroma(back.customHex), back.harmony), true, h);
    assert.equal(encodeState({ customHex: back.customHex, pickHex: back.customHex, harmony: back.harmony }).get('h'), h);
  }
  // the same seed with a hue harmony stays a hue seed
  const hue = decodeState('c=F3D5CE&h=complementary', VN);
  assert.equal(startsNeutral(labChroma(hue.customHex), hue.harmony), false);
});

test('a link naming a harmony, paint or tab this build lacks still opens', () => {
  // Forward/backward compatibility: validation failures drop the field so the caller's default
  // applies — an unknown value must never break the load.
  const back = decodeState('h=nonesuch&p=deleted-paint&v=bogus&c=9A1115', V);
  assert.equal(back.harmony, undefined);
  assert.equal(back.baseId, undefined);
  assert.equal(back.tab, undefined);
  assert.equal(back.customHex, '#9A1115');   // falls through to the hex
});

test('malformed swatch tokens are dropped, not thrown on', () => {
  assert.deepEqual(decodeNodes('abc.def.ghi'), []);
  assert.deepEqual(decodeNodes('120.50.40-garbage-300.80.60'),
    [{ h: 120, s: 0.5, l: 0.4 }, { h: 300, s: 0.8, l: 0.6 }]);
  assert.deepEqual(decodeNodes(''), []);
  assert.deepEqual(decodeNodes(null), []);
});

test('swatch values are clamped and hues wrapped', () => {
  assert.deepEqual(decodeNodes('400.150.200'), [{ h: 40, s: 1, l: 1 }]);
  assert.deepEqual(decodeNodes('30.50.50'), [{ h: 30, s: 0.5, l: 0.5 }]);
});

test('a negative hue is not representable — "-" is the swatch separator', () => {
  // encodeState always writes an already-wrapped 0-359 hue, so this can only come from a
  // hand-edited link; it splits into an empty token and is dropped rather than mis-parsed.
  assert.deepEqual(decodeNodes('-30.50.50'), [{ h: 30, s: 0.5, l: 0.5 }]);
});

test('the added-swatch cap is enforced on decode (URL length + per-frame scans)', () => {
  const many = Array.from({ length: 12 }, (_, i) => `${i * 20}.50.50`).join('-');
  assert.equal(decodeNodes(many, 6).length, 6);
});

test('an achromatic pop from a hand-edited link is clamped to a real pop', () => {
  // A grey `pp` would turn the neutral recipes into hue-0 red tints beside a grey "pop" swatch.
  const back = decodeState('pp=808080', V);
  assert.notEqual(back.popHex, '#808080');
  assert.ok(back.popHex.startsWith('#'));
});

test('decodeOffsets ignores junk', () => {
  assert.deepEqual(decodeOffsets('180.240'), [180, 240]);
  assert.deepEqual(decodeOffsets('180.x.240'), [180, 240]);
  assert.deepEqual(decodeOffsets(''), []);
});

test('shareUrl drops m (a link shared from the Shelf opens the Studio) and keeps everything else', async () => {
  const { shareUrl } = await import('../src/js/share.js');
  const href = 'https://palette.ryanmette.com/?p=citadel-red&c=9A1115&h=triadic&m=shelf&v=equiv&t=dark';
  const out = new URL(shareUrl(href));
  assert.equal(out.searchParams.get('m'), null);
  assert.equal(out.searchParams.get('v'), 'equiv');   // the tab travels
  assert.equal(out.searchParams.get('p'), 'citadel-red');
  assert.equal(out.searchParams.get('t'), 'dark');
  assert.equal(out.origin + out.pathname, 'https://palette.ryanmette.com/');
  // a Studio link is unchanged
  const studio = 'https://palette.ryanmette.com/?p=citadel-red&c=9A1115&h=triadic';
  assert.equal(shareUrl(studio), studio);
});

test('encodeState: no theme → no t (a theme that only follows the device stays out of the address bar)', () => {
  const p = encodeState({ baseId: 'citadel-red', pickHex: '#9A1115', harmony: 'triadic', theme: null });
  assert.equal(p.get('t'), null);
  assert.equal(encodeState({ pickHex: '#9A1115', theme: 'dark' }).get('t'), 'dark');
});

test('shareUrl carries the theme on screen: t=dark when dark, no t when light, the address bar t when none is given', async () => {
  const { shareUrl } = await import('../src/js/share.js');
  const bare = 'https://palette.ryanmette.com/?p=citadel-red&c=9A1115&h=triadic';
  // following a dark device: the address bar has no t, the shared link still opens dark
  assert.equal(new URL(shareUrl(bare, 'dark')).searchParams.get('t'), 'dark');
  assert.equal(new URL(shareUrl(bare + '&t=dark', 'light')).searchParams.get('t'), null);
  assert.equal(new URL(shareUrl(bare + '&t=dark')).searchParams.get('t'), 'dark');
  assert.equal(shareUrl(bare, 'light'), bare);
});

test('holds round-trip through the link; an unknown pot becomes a lock on its hex', async () => {
  const { encodeState, decodeState, encodeHolds, decodeHolds } = await import('../src/js/share.js');
  const holds = { Secondary: { kind: 'lock', hex: '#2F4A6B' }, Metal: { kind: 'pot', id: 'citadel-base-balthasar-gold', hex: '#A77353' } };
  const p = encodeState({ harmony: 'triadic', pickHex: '#6D774D', holds });
  assert.equal(p.get('hd'), 'S.l.2F4A6B_M.p.citadel-base-balthasar-gold.A77353');
  assert.deepEqual(decodeState(p.toString()).holds, holds);
  assert.deepEqual(decodeHolds('M.p.gone.A77353', id => id !== 'gone'), { Metal: { kind: 'lock', hex: '#A77353' } });
  assert.deepEqual(decodeHolds('P.l.FFFFFF_S.l.zz_X.l.000000'), {}, 'Primary is never held; bad tokens drop');
  assert.equal(encodeHolds({}), '');
  assert.equal(encodeState({ harmony: 'triadic' }).has('hd'), false, 'no holds, no parameter');
});

test('schemeQuery is the scheme only: no mode, tab, theme or saved-scheme id', async () => {
  const { schemeQuery } = await import('../src/js/share.js');
  const base = { baseId: 'citadel-base-death-guard-green', pickHex: '#6D774D', harmony: 'triadic', seedRole: 'main' };
  const q = schemeQuery({ ...base, mode: 'shelf', tab: 'equiv', theme: 'dark' });
  assert.equal(q, '?p=citadel-base-death-guard-green&c=6D774D&h=triadic');
  assert.equal(q, schemeQuery({ ...base, mode: 'studio', tab: 'plan', theme: 'light' }), 'the same scheme in another view is the same link');
  assert.notEqual(q, schemeQuery({ ...base, harmony: 'analogous' }));
});

test('m=schemes round-trips; shareUrl drops m and s (a saved-scheme id means nothing on another device)', async () => {
  const { encodeState, decodeState, shareUrl } = await import('../src/js/share.js');
  assert.equal(encodeState({ mode: 'schemes' }).get('m'), 'schemes');
  assert.equal(decodeState('?m=schemes').mode, 'schemes');
  assert.equal(decodeState('?m=other').mode, undefined);
  const out = new URL(shareUrl('https://palette.ryanmette.com/?p=x&c=111111&h=triadic&m=schemes&s=ab12cd34'));
  assert.equal(out.searchParams.get('m'), null);
  assert.equal(out.searchParams.get('s'), null);
  assert.equal(out.searchParams.get('h'), 'triadic');
});

test('sv=list and sg=project round-trip in the address bar; a shared link and a scheme link drop them', async () => {
  const { encodeState, decodeState, shareUrl, schemeQuery } = await import('../src/js/share.js');
  const p = encodeState({ mode: 'shelf', shelfView: 'list', shelfGroup: 'project' });
  assert.equal(p.get('sv'), 'list');
  assert.equal(p.get('sg'), 'project');
  assert.equal(encodeState({ shelfView: 'grid', shelfGroup: 'rack' }).get('sv'), null, 'the defaults are not written');
  const back = decodeState(p);
  assert.equal(back.shelfView, 'list');
  assert.equal(back.shelfGroup, 'project');
  assert.equal(decodeState('?sv=table&sg=brand').shelfView, undefined);
  const out = new URL(shareUrl('https://palette.ryanmette.com/?p=x&c=111111&m=shelf&sv=list&sg=project'));
  assert.equal(out.searchParams.get('sv'), null);
  assert.equal(out.searchParams.get('sg'), null);
  assert.doesNotMatch(schemeQuery({ baseId: 'x', pickHex: '#111111', shelfView: 'list', shelfGroup: 'project' }), /sv=|sg=/);
});

/* ---- the store trip (PLAN §5 item 37) ---- */
import { encodeList, decodeList, encodeBought, decodeBought, shareUrl, schemeQuery } from '../src/js/share.js';

test('store list: round trip with counts, projects and names', () => {
  const projects = [{ link: '?p=citadel-base-death-guard-green&c=6D774D&h=triadic', name: 'Plague Marine' },
    { link: '?c=1E357B&h=complementary', name: '' }];
  const items = [{ id: 'citadel-base-mephiston-red', qty: 2, project: 0 }, { id: 'vallejo-model-color-ivory' },
    { id: 'citadel-layer-kantor-blue', project: 1 }];
  const q = encodeList(items, projects);
  assert.match(q, /^m=shelf&sv=list&j=/);
  assert.match(q, /l=citadel-base-mephiston-red\*2_0\.vallejo-model-color-ivory\.citadel-layer-kantor-blue_1$/);
  const back = decodeList(q);
  assert.deepEqual(back.items, [{ id: 'citadel-base-mephiston-red', qty: 2, project: 0 },
    { id: 'vallejo-model-color-ivory', qty: 1, project: -1 }, { id: 'citadel-layer-kantor-blue', qty: 1, project: 1 }]);
  assert.deepEqual(back.projects, [{ link: projects[0].link, name: 'Plague Marine' }, { link: projects[1].link, name: '' }]);
});

test('store list: the name never stays in the scheme link, and a name with spaces and & survives', () => {
  const q = encodeList([{ id: 'a', project: 0 }], [{ link: '?c=112233&h=triadic&n=old', name: '  Rock & roll   army ' }]);
  const back = decodeList(q);
  assert.equal(back.projects[0].name, 'Rock & roll army');
  assert.equal(back.projects[0].link, '?c=112233&h=triadic');
});

test('store list: bad tokens, unknown paints, repeats and bad indexes are dropped, not thrown on', () => {
  const back = decodeList('l=good*3_5.BAD..unknown.good.ok*0.also*999', { hasPaint: id => id !== 'unknown' });
  assert.deepEqual(back.items, [{ id: 'good', qty: 3, project: -1 }, { id: 'ok', qty: 1, project: -1 }]);
  assert.equal(decodeList('c=112233'), null);              // no list: not a store link
  assert.deepEqual(decodeList('l=').items, []);
});

test('bought link: ids each once, known ones only; no b → null', () => {
  const q = encodeBought(['a-1', 'b-2', 'a-1']);
  assert.equal(q, 'm=shelf&b=a-1.b-2');
  assert.deepEqual(decodeBought(q), ['a-1', 'b-2']);
  assert.deepEqual(decodeBought('b=a-1.X.zz', { hasPaint: id => id !== 'zz' }), ['a-1']);
  assert.equal(decodeBought('m=shelf'), null);
});

test('n: a saved scheme’s name goes in the shared link, is read back, and a trip never rides along', () => {
  const u = shareUrl('https://x.test/?c=112233&h=triadic&m=shelf&l=a.b&j=c%3D1&b=a', 'light', 'Blue knight');
  assert.equal(u, 'https://x.test/?c=112233&h=triadic&n=Blue+knight');
  assert.equal(shareUrl('https://x.test/?c=112233&n=Old', 'light'), 'https://x.test/?c=112233');
  assert.equal(decodeState('c=112233&n=%20Blue%20%20knight').name, 'Blue knight');
  assert.equal(schemeQuery({ pickHex: '#112233', harmony: 'triadic', name: 'X' }), '?c=112233&h=triadic');
});
