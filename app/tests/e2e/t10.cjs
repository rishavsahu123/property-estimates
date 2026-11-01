const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  for (const dark of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
    if (!dark) {
      await page.evaluate(async () => {
        const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
        const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
        const tx = db.transaction(['entries', 'contacts'], 'readwrite'), E = tx.objectStore('entries'), C = tx.objectStore('contacts');
        const names = ['Ramesh Thekedar', 'Sharma Cement', 'Raju Bricks', 'Gupta Sand', 'Old Vendor'];
        names.forEach((n, i) => C.put({ id: 'c' + i, name: n, phone: '', createdAt: 1, updatedAt: 1 }));
        // newest first: R S R Raju S R Gupta S Raju R | then Old x2 (older than last 10)
        const seq = [0, 1, 0, 2, 1, 0, 3, 1, 2, 0, 4, 4]; const items = { 0: 'thekedar', 1: 'cement', 2: 'brick', 3: 'reti', 4: 'cement' };
        seq.forEach((c, i) => E.put({ id: 'e' + i, projectId: pid, ts: Date.now() - (i + 1) * 864e5, item: items[c], amount: 1000, cash: 1000, online: 0, vendor: names[c], contactId: 'c' + c, createdAt: 1, updatedAt: 1, note: '', qty: null, unit: null, rate: null, slipKey: null }));
        await new Promise(r => tx.oncomplete = r); db.close();
      });
      await page.reload(); await page.waitForSelector('#boot', { state: 'detached' });
      r.quick = await page.$$eval('#addform [data-f="vendorSug"] .chip', b => b.map(x => x.textContent));
      await page.selectOption('#addform select[data-g="material"]', 'brick');
      r.quickBricks = await page.$$eval('#addform [data-f="vendorSug"] .chip', b => b.map(x => x.textContent));
      r.caption = await page.$$eval('#addform .gs', g => g.map(x => (x.querySelector('small')?.textContent || '-') + '|' + x.querySelector('select').selectedOptions[0].textContent));
      await page.selectOption('#addform select[data-g="material"]', '');
      await page.fill('#addform [data-f="vendor"]', 'a');
      r.typedA = await page.$$eval('#addform [data-f="vendorSug"] .chip', b => b.map(x => x.textContent));
      await page.fill('#addform [data-f="vendor"]', '');
    }
    await page.fill('#addform [data-f="amount"]', '2323'); r.words = await page.textContent('#addform [data-f="words"]');
    await page.click('#addform [data-mode="both"]');
    const box = await (await page.$('#addcard')).boundingBox();
    await page.screenshot({ path: `eb-${dark ? 'dark' : 'light'}.png`, clip: { x: 0, y: box.y, width: 390, height: 560 } });
    await ctx.close();
  }
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})();
