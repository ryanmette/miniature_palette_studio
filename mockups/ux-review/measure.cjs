// UX review, November 2026 (docs/UX_REVIEW.md §3): how much the test painter's 45-pot shelf changes the
// schemes. Dev-only, never shipped (CLAUDE.md §4).
//
// For each owned flat Warhammer Colour pot as the starting paint (29) x each hue harmony (7) x each
// "Use my paints" mode (off, prefer, only), it reads the Recipe's four roles from the real app: the pot,
// its match label and whether the painter owns it. Then it presses "+ Add N to the shopping list" and
// counts the pots and the brands that go on the list.
//
// Run from the repo root, with the app served on port 8765 (about 5 minutes):
//   python3 -m http.server 8765 --bind 127.0.0.1 -d src
//   node mockups/ux-review/measure.cjs
// It needs Playwright with Chromium (not a dependency of this repo).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHELF = JSON.parse(fs.readFileSync(path.join(__dirname, 'shelf-45.json'), 'utf8'));
const METALS = /retributor|leadbelcher|balthasar|ironbreaker|stormhost|auric/;
const SEEDS = SHELF.owned.filter(id => /^citadel-(base|layer)-/.test(id) && !METALS.test(id));
const HARMONIES = ['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic', 'square', 'compound'];
const GOOD = ['Indistinguishable', 'Excellent', 'Good'];
// The brand part of a paint id (ids are brand-line-name; some brand keys have two or three words).
const LONG = ['army-painter', 'ak-interactive', 'two-thin-coats', 'pro-acryl', 'ammo-by-mig'];
const brandOf = id => LONG.find(b => id.startsWith(b + '-')) || id.split('-')[0];
const median = a => a.slice().sort((x, y) => x - y)[a.length >> 1];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const mode of ['off', 'prefer', 'only']) {
    const state = JSON.stringify({ ...SHELF, prefs: { ...SHELF.prefs, collection: mode } });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    // Every load starts from the same shelf, so one scheme's "Add" does not change the next.
    await ctx.addInitScript(s => { localStorage.setItem('ps-state', s); localStorage.setItem('ps-seen', '1.15.0'); }, state);
    const page = await ctx.newPage();
    for (const seed of SEEDS) for (const h of HARMONIES) {
      await page.goto(`http://127.0.0.1:8765/?p=${seed}&h=${h}`);
      await page.waitForFunction(() => document.querySelector('#livepal .lcol'), null, { timeout: 15000 });
      rows.push({ mode, seed, h, ...await page.evaluate(() => {
        const roles = [...document.querySelectorAll('#panel-plan .slot')].map(s => ({
          role: s.querySelector('.role')?.textContent, pot: s.querySelector('.nm')?.textContent,
          label: s.querySelector('.de span:nth-child(2)')?.textContent, owned: !!s.querySelector('.owntag') }));
        const add = document.querySelector('#addGaps');
        if (add) add.click();
        return { roles, want: JSON.parse(localStorage.getItem('ps-state')).want || [] };
      }) });
    }
    await ctx.close();
  }
  await browser.close();

  const key = r => r.seed + '|' + r.h;
  const off = new Map(rows.filter(r => r.mode === 'off').map(r => [key(r), r]));
  for (const mode of ['off', 'prefer', 'only']) {
    const mine = rows.filter(r => r.mode === mode);
    const roles = mine.flatMap(r => r.roles.filter(x => x.role !== 'Primary'));
    const count = f => roles.filter(f).length;
    const pct = n => (100 * n / roles.length).toFixed(0) + '%';
    console.log(`\n${mode.toUpperCase()}: ${mine.length} schemes, ${roles.length} roles that are not Primary`);
    console.log(`  an owned pot fills the role: ${count(x => x.owned)} (${pct(count(x => x.owned))})`);
    console.log(`  Good or better: ${pct(count(x => GOOD.includes(x.label)))} | Loose: ${count(x => x.label === 'Loose')} | Poor: ${count(x => x.label === 'Poor')}`);
    console.log(`  the Metal role is an owned pot: ${count(x => x.role === 'Metal' && x.owned)} of ${count(x => x.role === 'Metal')}`);
    console.log(`  schemes with a Poor role: ${mine.filter(r => r.roles.some(x => x.label === 'Poor')).length}`);
    console.log(`  "+ Add N": median ${median(mine.map(r => r.want.length))} pots (${Math.min(...mine.map(r => r.want.length))} to ${Math.max(...mine.map(r => r.want.length))}), from a median ${median(mine.map(r => new Set(r.want.map(brandOf)).size))} brands`);
    if (mode === 'prefer') console.log(`  schemes with the same role pots as Off: ${mine.filter(r => r.roles.every((x, i) => off.get(key(r)).roles[i].pot === x.pot)).length}`);
  }
})();
