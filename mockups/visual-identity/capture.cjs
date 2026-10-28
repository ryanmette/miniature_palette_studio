// Audit capture: every surface at 6 sizes x 2 themes, plus computed-style measurements (mockups/visual-identity.html §1).
// Dev only, never shipped. It needs Playwright (not a project dependency) and a static server on src/:
//   (cd src && python3 -m http.server 8765) &
//   NODE_PATH=$(npm root -g) node mockups/visual-identity/capture.cjs OUTDIR            # measure + screenshots
//   NODE_PATH=$(npm root -g) node mockups/visual-identity/capture.cjs OUTDIR shots      # screenshots only
// OUTDIR gets <W>x<H>-<theme>-<NN>-<surface>.jpg (288 files) and measure.json. Use it again for the
// before/after shots of the build.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  { w: 360, h: 640, touch: true }, { w: 390, h: 844, touch: true }, { w: 768, h: 1024, touch: true },
  { w: 1025, h: 800, touch: true }, { w: 1180, h: 820, touch: false }, { w: 1280, h: 800, touch: false },
];
const BACKUP = JSON.stringify({ v: 1, owned: ['citadel-base-mephiston-red'], want: [], prefs: {} });
fs.writeFileSync(OUT + '/backup.json', BACKUP);
fs.writeFileSync(OUT + '/bad.json', '{not json');
const log = [];
const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name, opts = {}) {
  try { await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 62, ...opts }); }
  catch (e) { log.push(`${name}: ${e.message.split('\n')[0]}`); }
}
async function esc(page) { await page.keyboard.press('Escape'); await wait(250); }

async function run(size, theme) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: size.touch, isMobile: size.touch && size.w < 800, colorScheme: theme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const tag = `${size.w}x${size.h}-${theme}`;
  page.on('pageerror', e => log.push(`${tag} pageerror ${e.message}`));
  // loader: hold the dataset back so the loading state shows
  let held = false; await page.route('**/paints.json', async r => { if (!held) { held = true; await wait(1500); } r.continue().catch(() => {}); });
  await page.goto(BASE + 'index.html?p=citadel-base-mephiston-red');
  await wait(500); await shot(page, `${tag}-00-loading`);
  await page.waitForSelector('#livepal *', { timeout: 15000 }); await wait(900);
  await shot(page, `${tag}-01-studio`);
  await shot(page, `${tag}-02-studio-full`, { fullPage: true });
  // seed list: browse grid, then a search, then an empty search
  await page.click('#seedQ'); await page.keyboard.press('ArrowDown'); await wait(500); await shot(page, `${tag}-03-seedlist-browse`);
  await page.fill('#seedQ', 'red'); await wait(500); await shot(page, `${tag}-04-seedlist-search`);
  await page.fill('#seedQ', 'zzqqxx'); await wait(500); await shot(page, `${tag}-05-seedlist-empty`);
  await esc(page); await esc(page);
  // tabs
  for (const [id, n] of [['#tab-equiv', '06-equivalents'], ['#tab-a11y', '07-accessibility']]) {
    await page.click(id); await wait(500);
    await page.locator('.output').screenshot({ path: `${OUT}/${tag}-${n}.jpg`, type: 'jpeg', quality: 62 }).catch(e => log.push(n + e.message));
  }
  await page.click('#tab-plan'); await wait(300);
  await page.locator('#panel-plan').screenshot({ path: `${OUT}/${tag}-08-plan.jpg`, type: 'jpeg', quality: 62 }).catch(e => log.push('plan ' + e.message));
  // settings, and the matching note (Prefer)
  await page.click('#settingsBtn'); await wait(500); await shot(page, `${tag}-09-settings`);
  await page.click('[data-collection="prefer"]'); await wait(300);
  await page.click('#settingsBtn').catch(() => {}); await esc(page);
  await page.locator('.palhead').scrollIntoViewIfNeeded(); await wait(300); await shot(page, `${tag}-10-matchnote`);
  // a toast
  await page.click('#settingsBtn'); await wait(300); await page.click('#share'); await wait(350); await shot(page, `${tag}-11-toast`);
  await esc(page);
  // about, delete confirm
  await page.click('#aboutOpen'); await wait(450); await shot(page, `${tag}-12-about`);
  await page.click('#deleteOpen'); await wait(450); await shot(page, `${tag}-13-delete-confirm`);
  await esc(page); await esc(page);
  // restore confirm, and an unreadable file
  await page.click('#settingsBtn'); await wait(300);
  await page.setInputFiles('#restoreFile', OUT + '/backup.json'); await wait(700); await shot(page, `${tag}-14-restore-confirm`);
  await esc(page); await esc(page);
  await page.setInputFiles('#restoreFile', OUT + '/bad.json'); await wait(500); await shot(page, `${tag}-15-unreadable`);
  await esc(page); await esc(page);
  // neutral seed (overlay over the wheel / slider)
  await page.fill('#seedQ', '#808080'); await page.keyboard.press('Enter'); await wait(800);
  await page.locator('.studio').scrollIntoViewIfNeeded(); await shot(page, `${tag}-16-neutral`);
  // shelf
  await page.click('[data-mode="shelf"]'); await wait(800); await shot(page, `${tag}-17-shelf`);
  await page.mouse.wheel(0, 900); await wait(600); await shot(page, `${tag}-18-shelf-scrolled`);
  await page.mouse.wheel(0, -900); await wait(500);
  if (await page.isVisible('#shelfFiltersBtn')) { await page.click('#shelfFiltersBtn'); await wait(500); await shot(page, `${tag}-19-filters`); await esc(page); }
  const cell = page.locator('#shelfGrid [data-id]').nth(3);
  await cell.click({ button: 'right' }).catch(e => log.push('rc ' + e.message)); await wait(400); await shot(page, `${tag}-20-markmenu`); await esc(page);
  await page.click('[data-mark="owned"]'); await wait(500); await shot(page, `${tag}-21-shelf-empty-owned`);
  await page.click('[data-mark=""]');
  // info pages
  await page.goto(BASE + 'support.html'); await wait(500); await shot(page, `${tag}-22-support`);
  await page.goto(BASE + 'privacy.html'); await wait(500); await shot(page, `${tag}-23-privacy`);
  await b.close();
}

async function measure() {
  const b = await chromium.launch();
  const res = {};
  for (const [w, h, touch] of [[1280, 800, false], [390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    await page.goto(BASE + 'index.html?p=citadel-base-mephiston-red'); await page.waitForSelector('#livepal *'); await wait(900);
    const m = async () => page.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const sel = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      const ctrls = [...document.querySelectorAll('button, a.btn, select, input:not([type=hidden]):not([type=file]):not([type=color])')].filter(vis);
      const combos = {};
      for (const el of ctrls) {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        const k = `r=${s.borderTopLeftRadius} h=${Math.round(r.height)} pad=${s.paddingTop}/${s.paddingRight}/${s.paddingBottom}/${s.paddingLeft} fs=${s.fontSize} fw=${s.fontWeight}`;
        (combos[k] ||= []).push(sel(el));
      }
      const all = [...document.querySelectorAll('body *')].filter(vis);
      const radii = {}; for (const el of all) { const r = getComputedStyle(el).borderTopLeftRadius; if (r !== '0px') radii[r] = (radii[r] || 0) + 1; }
      const cards = all.filter(el => { const s = getComputedStyle(el); return s.borderTopWidth !== '0px' && parseFloat(s.borderTopLeftRadius) >= 10 && s.boxShadow !== 'none' && el.getBoundingClientRect().width > 120; });
      const nested = cards.filter(c => cards.some(o => o !== c && o.contains(c))).map(sel);
      const caps = all.filter(el => { const s = getComputedStyle(el); return s.textTransform === 'uppercase' && el.textContent.trim(); });
      const pills = all.filter(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) >= 100 && el.textContent.trim());
      const glyphs = {}; for (const el of all) for (const n of el.childNodes) if (n.nodeType === 3) for (const ch of n.textContent.match(/[☰⋯↻✓⚓⚠○⌕◐↶↷✕▾⇧⌘·→←]/g) || []) glyphs[ch] = (glyphs[ch] || 0) + 1;
      const shadows = {}; for (const el of all) { const s = getComputedStyle(el).boxShadow; if (s !== 'none') shadows[s] = (shadows[s] || 0) + 1; }
      const fonts = {}; for (const el of all) { const s = getComputedStyle(el); if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) { const k = s.fontFamily.split(',')[0] + ' ' + s.fontWeight; fonts[k] = (fonts[k] || 0) + 1; } }
      const texts = [...document.querySelectorAll('button, .micro, h2, h3, label, .tabs [role=tab]')].filter(vis).map(e => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean);
      return { controls: ctrls.length, combos, radii, cards: cards.map(sel), nested, caps: caps.map(e => sel(e) + ' "' + e.textContent.trim().slice(0, 40) + '"'), pills: pills.map(e => sel(e) + ' "' + e.textContent.trim().slice(0, 30) + '"'), glyphs, shadows, fonts, texts: [...new Set(texts)] };
    });
    res[`${w}-studio`] = await m();
    await page.click('[data-mode="shelf"]'); await wait(800);
    res[`${w}-shelf`] = await m();
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT + '/measure.json', JSON.stringify(res, null, 1));
}

(async () => {
  const only = process.argv[3];
  if (only !== 'shots') await measure();
  if (only !== 'measure') for (const s of SIZES) for (const t of ['light', 'dark']) { await run(s, t).catch(e => log.push(`${s.w} ${t} FAIL ${e.message.split('\n')[0]}`)); }
  fs.writeFileSync(OUT + '/log.txt', log.join('\n'));
  console.log('done', log.length, 'issues');
})();
