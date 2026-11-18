// UX review, November 2026 (docs/UX_REVIEW.md): the screenshots. Dev-only, never shipped (CLAUDE.md §4).
// It walks the app as the review's test painter does, on a phone (390 x 844, touch), and saves one JPEG
// for each step that the report shows.
//
// Run from the repo root, with the app served on port 8765:
//   python3 -m http.server 8765 --bind 127.0.0.1 -d src
//   node mockups/ux-review/capture.cjs
// It needs Playwright with Chromium (not a dependency of this repo). Chromium is not iOS Safari: the
// keyboard, the share sheet and long-press need a real phone (the report's hand check).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8765/';
const OUT = __dirname;
const SHELF = fs.readFileSync(path.join(__dirname, 'shelf-45.json'), 'utf8');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** A phone page. `state` is a saved shelf (the store.js JSON), or null for a device with nothing saved. */
async function phone(browser, state) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: UA, deviceScaleFactor: 2, serviceWorkers: 'block' });
  if (state) await ctx.addInitScript(s => {
    if (!localStorage.getItem('ps-state')) { localStorage.setItem('ps-state', s); localStorage.setItem('ps-seen', '1.15.0'); }
  }, state);
  const page = await ctx.newPage();
  page.open = async query => {
    await page.goto(BASE + query);
    await page.waitForFunction(() => document.querySelector('#livepal .lcol'), null, { timeout: 15000 });
    await page.waitForTimeout(800);
  };
  page.shot = name => page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 78 });
  page.tapOn = async (sel, wait = 600) => { await page.locator(sel).first().tap(); await page.waitForTimeout(wait); };
  // Put an element just under the sticky header.
  page.bring = async (sel, gap = 112) => {
    await page.evaluate(([s, g]) => scrollTo(0, document.querySelector(s).getBoundingClientRect().top + scrollY - g), [sel, gap]);
    await page.waitForTimeout(500);
  };
  return page;
}
const withMode = mode => { const s = JSON.parse(SHELF); s.prefs.collection = mode; return JSON.stringify(s); };

(async () => {
  const browser = await chromium.launch();

  // 1. A first visit, then the door to the Shelf.
  let p = await phone(browser, null);
  await p.open('?p=citadel-layer-alaitoc-blue&h=analogous');   // a fixed scheme, so the picture is the same each run
  await p.evaluate(() => { document.querySelector('#firstRun').hidden = false; });   // the band of a first visit with no paint in the link
  await p.shot('01-first-visit');
  await p.open('?m=shelf');
  await p.shot('02-shelf-grid');
  await p.tapOn('#shelfQ'); await p.keyboard.type('dawnstone', { delay: 30 }); await p.waitForTimeout(600);
  await p.shot('03-search-no-names');
  await p.context().close();

  // 2. The list view, and the Studio after the painter marked 45 pots.
  p = await phone(browser, SHELF);
  await p.open('?m=shelf&sv=list');
  await p.fill('#shelfQ', 'citadel'); await p.waitForTimeout(700); await p.evaluate(() => document.activeElement.blur());
  await p.shot('04-list-view');
  await p.open('?p=citadel-base-macragge-blue&h=triadic');
  await p.bring('#livepal'); await p.shot('05-owned-ignored');
  await p.bring('#tabs'); await p.shot('06-add-14');
  await p.evaluate(() => scrollTo(0, 0)); await p.tapOn('#settingsBtn'); await p.shot('07-settings');
  await p.context().close();

  // 3. Use my paints: Only.
  p = await phone(browser, withMode('only'));
  await p.open('?p=citadel-base-macragge-blue&h=triadic');
  await p.bring('#livepal'); await p.shot('08-only-poor');
  await p.context().close();

  // 4. Prefer: add the pots, then the shopping list and Take to the store.
  p = await phone(browser, withMode('prefer'));
  await p.open('?p=citadel-base-macragge-blue&h=triadic');
  await p.bring('#tabs'); await p.tapOn('#addGaps', 300); await p.shot('09-added-toast');
  await p.open('?m=shelf&sv=list'); await p.tapOn('#shelfMarkSeg button:nth-child(3)', 800);
  await p.bring('#shelfListView', 230); await p.shot('10-shopping-list');
  await p.evaluate(() => scrollTo(0, 0)); await p.tapOn('#shelfStore', 800); await p.tapOn('#storeSkip', 800);
  await p.shot('11-store-on-phone');
  await p.context().close();

  // 5. The lookup: Mephiston Red in other brands.
  p = await phone(browser, null);
  await p.open('?p=citadel-base-mephiston-red&h=triadic');
  await p.shot('12-lookup-first-screen');
  await p.bring('#tabs'); await p.tapOn('#tab-equiv', 800); await p.shot('13-other-brands');
  await p.context().close();

  await browser.close();
})();
