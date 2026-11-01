const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const URL = 'http://localhost:8090/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errors = [], r = {};
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(URL + '?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  r.defaultDate = await page.inputValue('#addform [data-f="when"]');
  await page.fill('#addform [data-f="amount"]', '500'); await page.click('#addform [data-f="save"]'); await page.waitForTimeout(300);
  r.afterSaveDate = await page.inputValue('#addform [data-f="when"]');
  await page.fill('#addform [data-f="amount"]', '25000'); await page.selectOption('#addform select[data-g="people"]', 'thekedar');
  await page.fill('#addform [data-f="when"]', '2026-09-15'); await page.click('#addform [data-f="save"]'); await page.waitForTimeout(300);
  r.dateResetAfterSave = await page.inputValue('#addform [data-f="when"]');
  r.recent = await page.$$eval('#recent .entry', b => b.map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 40)));
  r.stored = await page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const a = await new Promise(res => { const q = db.transaction('entries').objectStore('entries').getAll(); q.onsuccess = () => res(q.result) }); db.close(); return a.map(e => new Date(e.ts).toString().slice(4, 21) + ' ' + e.amount) });
  // edit: change back-dated one to 2026-09-20
  await page.click('#recent .entry >> nth=1'); await page.click('.sheet [data-v="edit"]'); r.editDate = await page.inputValue('.sheet [data-f="when"]');
  await page.fill('.sheet [data-f="when"]', '2026-09-20'); await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(300);
  r.recentAfterEdit = await page.$$eval('#recent .entry .dt', b => b.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 'd-add.png', fullPage: true });
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
