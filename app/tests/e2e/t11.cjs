const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  for (const dark of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light', acceptDownloads: true });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
    await page.evaluate(async () => {
      const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
      const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
      const tx = db.transaction(['entries', 'contacts'], 'readwrite'), E = tx.objectStore('entries'), C = tx.objectStore('contacts');
      const P = [['Ramesh Thekedar', '9893000000'], ['Wonder Cement Store', '9826012345'], ['Raju Bricks', ''], ['Gupta Sand Supplier', '9000011111'], ['Old Plumber', '']];
      P.forEach(([n, ph], i) => C.put({ id: 'c' + i, name: n, phone: ph, createdAt: 1, updatedAt: 1 }));
      const seq = [[0, 'thekedar', 25000], [1, 'cement', 14500], [0, 'thekedar', 25000], [2, 'brick', 6000], [1, 'cement', 15150], [0, 'thekedar', 30000], [3, 'reti', 4500], [0, 'thekedar', 20000]];
      seq.forEach(([c, it, a], i) => E.put({ id: 'e' + i, projectId: pid, ts: Date.now() - (i + 1) * 5 * 864e5, item: it, amount: a, cash: a, online: 0, vendor: P[c][0], contactId: 'c' + c, createdAt: 1, updatedAt: 1, note: '', qty: null, unit: null, rate: null, slipKey: null }));
      await new Promise(r => tx.oncomplete = r); db.close();
    });
    await page.reload(); await page.waitForSelector('#boot', { state: 'detached' });
    const tag = dark ? 'dark' : 'light';
    await page.screenshot({ path: `n-add-${tag}.png` });
    await page.click('nav [data-go="people"]');
    if (!dark) {
      r.list = await page.$$eval('#contacts .crow', b => b.map(x => x.innerText.replace(/\s+/g, ' ')));
      await page.fill('#psearch', 'ram'); r.search = await page.$$eval('#contacts .crow b', b => b.map(x => x.textContent));
      await page.fill('#psearch', '9826'); r.searchPhone = await page.$$eval('#contacts .crow b', b => b.map(x => x.textContent));
      await page.fill('#psearch', '');
    }
    await page.screenshot({ path: `n-people-${tag}.png` });
    await page.click('#contacts .crow >> nth=0');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `n-person-${tag}.png` });
    if (!dark) {
      r.sheetTitle = await page.textContent('.sheet h2');
      r.pills = await page.$$eval('.sheet .pill', b => b.map(x => x.textContent.trim() + (x.href ? ' ' + x.getAttribute('href') : '')));
      r.rows = await page.$$eval('.sheet .entry', b => b.length);
      await page.click('.sheet [data-p="share"]');
      await page.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rc-save')]); await dl.saveAs('n-statement.png');
      await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
      await page.click('#contacts .crow >> nth=0'); await page.click('.sheet [data-p="book"]');
      r.bookTags = await page.$$eval('#ftags .ftag', t => t.map(x => x.textContent.trim())); r.bookCount = await page.textContent('#b-count');
      await page.screenshot({ path: `n-book-${tag}.png` });
    }
    await ctx.close();
  }
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})();
