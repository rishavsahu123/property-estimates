const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const URL = 'http://localhost:8090/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errors = [], r = {};
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(URL + '?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`, val = n => page.inputValue(F(n)), msg = () => page.textContent(F('splitOut'));
  const stored = () => page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const a = await new Promise(res => { const q = db.transaction('entries').objectStore('entries').getAll(); q.onsuccess = () => res(q.result) }); db.close(); return a.sort((x, y) => x.createdAt - y.createdAt).map(e => [e.amount, e.cash, e.online]) });
  // 1: online known
  await page.fill(F('amount'), '25000'); await page.click('#addform [data-mode="both"]');
  r.hintStart = await msg();
  await page.fill(F('online'), '15000'); r.c1 = await val('cash');
  await page.screenshot({ path: 'b1.png', clip: { x: 0, y: 470, width: 390, height: 240 } });
  await page.click(F('save')); await page.waitForTimeout(300);
  // 2: cash known, then amount changes
  await page.fill(F('amount'), '25000'); await page.click('#addform [data-mode="both"]');
  await page.fill(F('cash'), '7000'); r.o2 = await val('online');
  await page.fill(F('amount'), '30000'); r.o2b = await val('online');
  await page.click(F('save')); await page.waitForTimeout(300);
  // 3: amount empty -> sum
  await page.click('#addform [data-mode="both"]');
  await page.fill(F('cash'), '5000'); await page.fill(F('online'), '3000'); r.a3 = await val('amount'); r.m3 = await msg();
  await page.click(F('save')); await page.waitForTimeout(300);
  // 5: too much
  await page.fill(F('amount'), '1000'); await page.click('#addform [data-mode="both"]'); await page.fill(F('online'), '1500'); r.m5 = await msg(); r.c5 = await val('cash');
  // empty both -> blocked
  await page.fill(F('online'), ''); await page.click(F('save')); r.blocked = (await stored()).length;
  r.stored = await stored();
  // 4: edit first (25000 split) via passbook
  await page.click('nav [data-go="book"]'); await page.selectOption('#sort', 'date-asc');
  await page.click('#book .entry >> nth=0'); await page.click('.sheet [data-v="edit"]');
  r.editVals = [await page.inputValue('.sheet [data-f="cash"]'), await page.inputValue('.sheet [data-f="online"]')];
  await page.fill('.sheet [data-f="online"]', '20000'); r.editCash = await page.inputValue('.sheet [data-f="cash"]');
  await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(300);
  r.storedAfterEdit = (await stored())[0];
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
