// qr.js — a QR code for the store link (PLAN §5 item 37): text → a square of dark and light modules. Pure (no
// DOM, no globals), so node --test checks it. The app draws the modules as an SVG (qrPath).
//
// Why not a library: §6 allows no runtime dependency, and the algorithm is fixed by a standard (ISO/IEC
// 18004:2015). Only what a link needs is here: byte mode (UTF-8), one segment, versions 1–40, the four error
// levels, and the eight masks scored by the standard's four penalty rules.
//
// The steps, as in the standard: (1) the text becomes data codewords; (2) Reed–Solomon adds error-correction
// codewords to each block, and the blocks are interleaved; (3) the fixed patterns (finders, timing, alignment)
// go on the grid; (4) the codewords fill the rest in a two-column zigzag; (5) the mask with the lowest penalty
// is applied, and its format bits are written.

const ECL = { L: 0, M: 1, Q: 2, H: 3 };
/** The two format bits of each level (§7.9.1): not in L-M-Q-H order. */
const ECL_BITS = [1, 0, 3, 2];

// Error-correction codewords in each block, and the number of blocks, by level then version (Table 9).
// Index 0 is unused, so a version is its own index.
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** The modules left for data and error correction once the fixed patterns are placed. */
function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const a = Math.floor(ver / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}
const dataCodewords = (ver, e) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * BLOCKS[e][ver];
/** Byte mode: 4 mode bits + the length (8 bits up to version 9, else 16) + 8 bits a byte. */
const bitsNeeded = (ver, n) => 4 + (ver <= 9 ? 8 : 16) + 8 * n;

// Reed–Solomon over GF(256), the field of the polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    divisor.forEach((d, i) => { r[i] ^= gfMul(d, f); });
  }
  return r;
}

/** The text as codewords for this version and level: mode, length, bytes, terminator, then pad bytes. */
function encodeData(bytes, ver, e) {
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver, e) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return out;
}

/** Split into blocks, add each block's error correction, and interleave (§7.6). Short blocks come first. */
function addEcc(data, ver, e) {
  const nBlocks = BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nBlocks - (raw % nBlocks), shortLen = Math.floor(raw / nBlocks);
  const div = rsDivisor(eccLen), blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);   // a gap, so every block has the same length; skipped below
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
  }
  return out;
}

function alignPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
  const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The grid with its fixed patterns: `fixed` marks the modules that data and masks never touch. */
function baseGrid(ver) {
  const size = ver * 4 + 17;
  const dark = new Uint8Array(size * size), fixed = new Uint8Array(size * size);
  const set = (x, y, on) => { dark[y * size + x] = on ? 1 : 0; fixed[y * size + x] = 1; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  const al = alignPositions(ver), last = al.length - 1;
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // Reserve the format areas now (written for each mask later), and write the version bits (version 7+).
  drawFormat(dark, fixed, size, 0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, on); set(b, a, on);
    }
  }
  return { size, dark, fixed };
}

/** The 15 format bits (level + mask, BCH-coded, XOR 0x5412), in both copies, and the one dark module. */
function drawFormat(dark, fixed, size, fmt) {
  let rem = fmt;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((fmt << 10) | rem) ^ 0x5412;
  const set = (x, y, i) => { dark[y * size + x] = (bits >>> i) & 1; fixed[y * size + x] = 1; };
  for (let i = 0; i <= 5; i++) set(8, i, i);
  set(8, 7, 6); set(8, 8, 7); set(7, 8, 8);
  for (let i = 9; i < 15; i++) set(14 - i, 8, i);
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, i);
  dark[(size - 8) * size + 8] = 1; fixed[(size - 8) * size + 8] = 1;
}

/** The codewords, bit by bit, up and down two columns at a time from the bottom right (§7.7.3). */
function placeData(dark, fixed, size, codewords) {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;   // the vertical timing column is skipped
    const up = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const y = up ? size - 1 - v : v;
      for (let j = 0; j < 2; j++) {
        const x = right - j, k = y * size + x;
        if (fixed[k]) continue;
        dark[k] = i < codewords.length * 8 ? (codewords[i >>> 3] >>> (7 - (i & 7))) & 1 : 0;
        i++;
      }
    }
  }
}

/** The §7.8.3 penalty: long runs, 2×2 blocks, finder-like patterns, and a dark share far from half. */
function penalty(dark, size) {
  let p = 0;
  const at = (x, y) => dark[y * size + x];
  for (let pass = 0; pass < 2; pass++) {
    const get = pass === 0 ? (a, b) => at(b, a) : (a, b) => at(a, b);
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
      // 1:1:3:1:1 with four light modules on one side (inside the grid only: the quiet zone is light).
      for (let b = 0; b + 10 < size; b++) {
        const s = [];
        for (let k = 0; k < 11; k++) s.push(get(a, b + k));
        const t = s.join('');
        if (t === '10111010000' || t === '00001011101') p += 40;
      }
    }
  }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const c = at(x, y);
    if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) p += 3;
  }
  const total = size * size;
  let nDark = 0;
  for (const d of dark) nDark += d;
  p += (Math.ceil(Math.abs(nDark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

const utf8 = s => [...new TextEncoder().encode(s)];

/**
 * Text → a QR code. The smallest version that holds the text at `ecl` is used, and then the level goes up while
 * the same version still holds it (a stronger code for free). Throws a RangeError when the text is too long
 * for version 40 (2,953 bytes at level L).
 * @returns {{ size:number, version:number, ecl:'L'|'M'|'Q'|'H', mask:number, dark:Uint8Array }} `dark` is
 *   row by row, 1 = a dark module; the quiet zone (4 modules a side) is not in it.
 */
export function qrCode(text, { ecl = 'M' } = {}) {
  const bytes = utf8(String(text));
  let e = ECL[ecl] ?? ECL.M, ver = 1;
  while (bitsNeeded(ver, bytes.length) > dataCodewords(ver, e) * 8) {
    if (++ver > 40) throw new RangeError('Too long for a QR code');
  }
  while (e < 3 && bitsNeeded(ver, bytes.length) <= dataCodewords(ver, e + 1) * 8) e++;
  const codewords = addEcc(encodeData(bytes, ver, e), ver, e);
  const { size, dark, fixed } = baseGrid(ver);
  placeData(dark, fixed, size, codewords);
  let best = null;
  for (let m = 0; m < 8; m++) {
    const d = dark.slice(), f = fixed.slice();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!fixed[y * size + x] && MASKS[m](x, y)) d[y * size + x] ^= 1;
    }
    drawFormat(d, f, size, (ECL_BITS[e] << 3) | m);
    const score = penalty(d, size);
    if (!best || score < best.score) best = { score, mask: m, dark: d };
  }
  return { size, version: ver, ecl: 'LMQH'[e], mask: best.mask, dark: best.dark };
}

/** The dark modules as one SVG path, offset by the quiet zone. Each run of dark modules in a row is one
 *  rectangle, so a version-10 code is a few hundred commands, not thousands. Draw it with a viewBox of
 *  `0 0 ${size + 2 * quiet} ${size + 2 * quiet}` and shape-rendering="crispEdges". */
export function qrPath({ size, dark }, quiet = 4) {
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!dark[y * size + x]) continue;
      let w = 1;
      while (x + w < size && dark[y * size + x + w]) w++;
      d += `M${x + quiet} ${y + quiet}h${w}v1h-${w}z`;
      x += w - 1;
    }
  }
  return d;
}
