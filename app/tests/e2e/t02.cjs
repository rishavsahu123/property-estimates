// Phase 2: restore (v2 + old v1 backup), edit sheet, sort by person, service worker offline.
const { chromium } = require('playwright');
const fs = require('fs');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const URL = 'http://localhost:8090/';
(async () => {
  const browser = await chromium.launch();
  const r = {}, errors = [];
  const watch = p => { p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_INTERNET_DISCONNECTED|fonts/.test(m.text())) errors.push('console: ' + m.text()); }); p.on('dialog', d => d.accept()); };

  // A) restore v2 backup into an empty app
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let page = await ctx.newPage(); watch(page);
  await page.goto(URL); await page.waitForSelector('#boot', { state: 'detached' });
  r.emptyTotal = await page.textContent('#h-total');
  await page.click('nav [data-go="sum"]');
  await page.setInputFiles('#restorefile', OUT + '/backup.json');
  await page.waitForTimeout(1200);
  r.afterRestoreProj = await page.textContent('#projname');
  r.afterRestoreTotal = await page.evaluate(() => document.querySelector('#h-total').textContent);
  r.restoredSlip = await page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const n = await new Promise(res => { const q = db.transaction('slips').objectStore('slips').count(); q.onsuccess = () => res(q.result) }); db.close(); return n; });
  // restoring same file again should add nothing
  await page.setInputFiles('#restorefile', OUT + '/backup.json');
  await page.waitForTimeout(800);
  r.afterSecondRestoreTotal = await page.textContent('#h-total');
  // old v1 format backup
  const old = { app: 'ghar-ka-hisaab', version: 1, savedAt: 1, entries: [{ id: 'old9', ts: Date.now() - 864e5, item: 'other', itemName: 'Tanker paani', qty: 2, unit: 'trip', rate: 700, amount: 1400, cash: 1400, online: 0, vendor: 'Raju Bricks', note: '', slipKey: null, createdAt: 1, updatedAt: 1 }], slips: {} };
  fs.writeFileSync(OUT + '/old-backup.json', JSON.stringify(old));
  await page.setInputFiles('#restorefile', OUT + '/old-backup.json');
  await page.waitForTimeout(800);
  r.afterOldRestoreTotal = await page.textContent('#h-total');
  r.tankerTile = await page.$$eval('#addform option', o => o.some(x => x.textContent === 'Tanker paani'));
  // sort by person, empties last
  await page.click('nav [data-go="book"]');
  await page.selectOption('#sort', 'person');
  r.byPerson = await page.$$eval('#book .entry .s', s => s.map(x => x.textContent.trim()));
  // open edit sheet, change amount
  await page.click('#book .entry'); await page.click('.sheet [data-v="edit"]');
  r.editHasDate = !!(await page.$('.sheet [data-f="when"]'));
  r.editPhone = await page.inputValue('.sheet [data-f="phone"]');
  await page.fill('.sheet [data-f="note"]', 'edited note');
  await page.click('.sheet [data-f="save"]');
  await page.waitForTimeout(400);
  r.edited = await page.$$eval('#book .entry .s', s => s.some(x => x.textContent.includes('edited note')));
  await page.screenshot({ path: OUT + '/s7-book-person.png', fullPage: true });
  await ctx.close();

  // B) service worker: install, then offline reload
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage(); watch(page);
  await page.goto(URL); await page.waitForSelector('#boot', { state: 'detached' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800);
  r.caches = await page.evaluate(async () => { const ks = await caches.keys(); const out = {}; for (const k of ks) { const c = await caches.open(k); out[k] = (await c.keys()).map(q => new URL(q.url).pathname) } return out; });
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#boot', { state: 'detached', timeout: 8000 });
  r.offlineTitle = await page.title();
  r.offlineExcelLoads = await page.evaluate(() => new Promise(res => { const s = document.createElement('script'); s.src = 'exceljs.min.js'; s.onload = () => res(!!window.ExcelJS); s.onerror = () => res(false); document.head.appendChild(s); }));
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
