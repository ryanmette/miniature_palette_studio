import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../src/js/version.js';
import { appVersionProblem } from '../scripts/check-docs.mjs';

// About & data shows the app's version from ONE constant (src/js/version.js). check-docs.mjs (CI) must
// fail when that constant and package.json disagree — a release that bumps one and not the other.

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('APP_VERSION matches package.json', () => {
  assert.equal(APP_VERSION, pkg.version);
});

test('check-docs: appVersionProblem passes when they agree and fails when they differ', () => {
  assert.equal(appVersionProblem('1.9.0', "export const APP_VERSION = '1.9.0';"), null);
  assert.match(appVersionProblem('1.10.0', "export const APP_VERSION = '1.9.0';"), /APP_VERSION is 1\.9\.0 but package\.json is 1\.10\.0/);
  assert.match(appVersionProblem('1.9.0', '// no constant here'), /no `export const APP_VERSION/);
});

test('check-docs: the real version.js passes', () => {
  const src = readFileSync(new URL('../src/js/version.js', import.meta.url), 'utf8');
  assert.equal(appVersionProblem(pkg.version, src), null);
});

test('WHATS_NEW is for this version: a release updates About’s “What’s new” with the version (CLAUDE.md §8)', async () => {
  const { WHATS_NEW } = await import('../src/js/version.js');
  assert.equal(WHATS_NEW.version, APP_VERSION);
  assert.ok(WHATS_NEW.items.length >= 1 && WHATS_NEW.items.length <= 5, 'a few short lines');
  for (const line of WHATS_NEW.items) assert.ok(line.length <= 120, `short: ${line}`);
});

// ---- The update log (About's "Earlier updates"; CLAUDE.md §8 checklist) ----
test('the update log keeps every earlier release since 1.13.0, newest first, each with a date and a few short lines', async () => {
  const { WHATS_NEW, EARLIER_NEWS } = await import('../src/js/version.js');
  const num = v => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);
  assert.match(WHATS_NEW.date, /^\d{4}-\d{2}-\d{2}$/);
  for (let i = 0; i < EARLIER_NEWS.length; i++) {
    const r = EARLIER_NEWS[i];
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, r.version);
    assert.ok(num(r.version) < num(WHATS_NEW.version), `${r.version} is older than What's new`);
    if (i) assert.ok(num(r.version) < num(EARLIER_NEWS[i - 1].version), 'newest first');
    assert.ok(r.items.length >= 1 && r.items.length <= 5, r.version);
    for (const line of r.items) assert.ok(line.length <= 120, `short: ${line}`);
  }
  // A release moves the What's new it replaces into the log: every CHANGELOG release from 1.13.0 up to (not
  // including) this one must be there, with the date its CHANGELOG heading gives.
  const { readFileSync } = await import('node:fs');
  const log = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const released = [...log.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm)].map(m => ({ version: m[1], date: m[2] }));
  const want = released.filter(r => num(r.version) >= num('1.13.0') && num(r.version) < num(WHATS_NEW.version));
  assert.deepEqual(EARLIER_NEWS.map(r => [r.version, r.date]), want.map(r => [r.version, r.date]));
  const cur = released.find(r => r.version === WHATS_NEW.version);
  if (cur) assert.equal(WHATS_NEW.date, cur.date, "What's new carries its release's date");
});
