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
