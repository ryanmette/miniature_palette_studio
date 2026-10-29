// qr.js — the QR code for the store link. The fixture below is the same text encoded by an independent
// encoder (the Python qrcode library 8.x, version 5, level M, mask 3), so a match means the code scans.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrCode, qrPath } from '../src/js/qr.js';

const TEXT = 'https://palette.ryanmette.com/?m=shelf&l=citadel-base-mephiston-red*2';
const FIXTURE = [
  '1111111011111101101011011100101111111',
  '1000001010000111000110110100001000001',
  '1011101001010010101010001100101011101',
  '1011101011101010010110001110001011101',
  '1011101001101111010101001101001011101',
  '1000001000001001100111100100001000001',
  '1111111010101010101010101010101111111',
  '0000000010100001011000011000100000000',
  '1011011101101101100011100010101001011',
  '1110100100001001110000110010110101010',
  '0010101100100011010001111110010111000',
  '0010110101101101000100101100100101100',
  '1110011010001100010010100111011111111',
  '1000010001001011100110001001111111011',
  '0111111100100010011111100000100010110',
  '1100100001010101111011000011110110001',
  '0101011001100101111110010100100001100',
  '0101100110011110100110111011001001111',
  '1000001101001111100100001001101011011',
  '0000100010001000011100100000100011010',
  '0111001001011010011001001010010110001',
  '0111000110010100001110010000100001010',
  '1111111111111010010001111000000100000',
  '0001100101111000001011101100010011110',
  '1110101111100100001111100111001010100',
  '0110000100111010101011001011111111011',
  '0110111000001111101111001100011001110',
  '1000110000110100101001100011101110011',
  '0010101000010111001001100101111110100',
  '0000000010101001010000111001100010101',
  '1111111011010001010011000110101010111',
  '1000001011000011100100111001100010001',
  '1011101001110110001000110010111111000',
  '1011101010100001001010111100011010101',
  '1011101010110110101110110101011010000',
  '1000001000010000100010011100011110100',
  '1111111011100011011100011110011011111',
];

test('the code matches an independent encoder, module for module', () => {
  const q = qrCode(TEXT);
  assert.equal(q.version, 5);
  assert.equal(q.ecl, 'M');
  assert.equal(q.mask, 3);
  assert.equal(q.size, 37);
  const rows = [];
  for (let y = 0; y < q.size; y++) rows.push([...q.dark.slice(y * q.size, (y + 1) * q.size)].join(''));
  assert.deepEqual(rows, FIXTURE);
});

test('the smallest version that holds the text, then a stronger level if it still fits', () => {
  assert.deepEqual([qrCode('hello').version, qrCode('hello').ecl], [1, 'H']);   // 5 bytes fit v1 even at H
  const long = qrCode('x'.repeat(400), { ecl: 'L' });
  assert.equal(long.version, 13);
  assert.equal(qrCode('x'.repeat(100), { ecl: 'L' }).size, 5 * 4 + 17);
});

test('text is UTF-8: a name with accents is longer in bytes than in letters', () => {
  assert.ok(qrCode('é'.repeat(60)).version > qrCode('e'.repeat(60)).version);
});

test('too long for version 40 throws a RangeError, not a broken code', () => {
  assert.throws(() => qrCode('w'.repeat(3000), { ecl: 'L' }), RangeError);
  assert.equal(qrCode('w'.repeat(2900), { ecl: 'L' }).version, 40);
});

test('the fixed patterns: three finders and the timing lines', () => {
  const q = qrCode('hello'), at = (x, y) => q.dark[y * q.size + x];
  for (const [ox, oy] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]]) {
    assert.equal(at(ox, oy), 1); assert.equal(at(ox + 1, oy + 1), 0); assert.equal(at(ox + 3, oy + 3), 1);
  }
  for (let i = 8; i < q.size - 8; i++) { assert.equal(at(i, 6), i % 2 === 0 ? 1 : 0); assert.equal(at(6, i), i % 2 === 0 ? 1 : 0); }
});

test('qrPath: one rectangle for each run of dark modules, inside the quiet zone', () => {
  const q = { size: 3, dark: Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 1, 1]) };
  assert.equal(qrPath(q), 'M4 4h2v1h-2zM5 6h2v1h-2z');
  assert.equal(qrPath(q, 0), 'M0 0h2v1h-2zM1 2h2v1h-2z');
});
