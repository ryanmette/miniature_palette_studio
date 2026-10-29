// help.js — the support details line (mockups/help-about.html, answer 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDevice, supportLine } from '../src/js/help.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1',
  ipadApp: 'Mozilla/5.0 (iPad; CPU OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

test('describeDevice: the browser and the system, in words a person reads', () => {
  assert.equal(describeDevice(UA.iphoneSafari), 'Safari 27 on iOS 27');
  assert.equal(describeDevice(UA.macSafari), 'Safari 27 on macOS');
  assert.equal(describeDevice(UA.macChrome), 'Chrome 141 on macOS');
  assert.equal(describeDevice(UA.winEdge), 'Edge 141 on Windows', 'Edge says Chrome too: Edge wins');
  assert.equal(describeDevice(UA.winFirefox), 'Firefox 140 on Windows');
  assert.equal(describeDevice(UA.android), 'Chrome 141 on Android 15');
  assert.equal(describeDevice(UA.iphoneChrome), 'Chrome 141 on iOS 27');
  assert.equal(describeDevice(''), 'Unknown browser');
});

test('describeDevice: inside the iOS app it names the app and the system, not a browser', () => {
  assert.equal(describeDevice(UA.iphoneSafari, { native: true }), 'iPhone app, iOS 27');
  assert.equal(describeDevice(UA.ipadApp, { native: true }), 'iPad app, iOS 27');
});

test('supportLine: only what is known, in a fixed order; the scheme only when given', () => {
  assert.equal(supportLine({ version: '1.13.0', dataVersion: '1.6.0', device: 'Safari 27 on macOS', width: 1180, height: 900.4, theme: 'dark', locale: 'en-GB' }),
    'Palette Studio 1.13.0 · paint data 1.6.0 · Safari 27 on macOS · 1180 × 900 · dark theme · en-GB');
  assert.equal(supportLine({ version: '1.13.0' }), 'Palette Studio 1.13.0');
  assert.equal(supportLine({ version: '1.13.0', scheme: 'https://x.test/?c=112233' }), 'Palette Studio 1.13.0\nScheme: https://x.test/?c=112233');
});
