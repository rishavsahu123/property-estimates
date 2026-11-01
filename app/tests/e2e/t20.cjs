const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  await page.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const tx = db.transaction(['contacts', 'meta', 'entries'], 'readwrite');
    tx.objectStore('contacts').put({ id: 'c1', name: 'Ramesh Thekedar', phone: '9893000000', createdAt: 1, updatedAt: 1 });
    tx.objectStore('meta').put([
      { id: 'd1', projectId: pid, contactId: 'c1', item: 'thekedar', title: 'Grey box', type: 'calc', fields: [{ label: 'Rate', value: '285', mul: true }, { label: 'Quantity', value: '7000', mul: true }], createdAt: 1, updatedAt: 1 },
      { id: 'd2', projectId: pid, contactId: 'c1', item: 'thekedar', title: 'Boundary wall', type: 'fixed', amount: 90000, createdAt: 1, updatedAt: 1 }], 'deals');
    const E = tx.objectStore('entries'), b = { projectId: pid, item: 'thekedar', cash: 0, online: 0, vendor: 'Ramesh Thekedar', contactId: 'c1', createdAt: 1, updatedAt: 1, note: '', qty: null, unit: null, rate: null, slipKey: null };
    for (let i = 0; i < 7; i++) E.put({ ...b, id: 'p' + i, ts: Date.now() - i * 864e5 * 3, amount: 50000 + i * 1000, cash: 50000 + i * 1000, dealId: 'd1' });
    E.put({ ...b, id: 'w1', ts: Date.now() - 864e5, amount: 30000, cash: 30000, dealId: 'd2' });
    E.put({ ...b, id: 'g1', ts: Date.now() - 2 * 864e5, amount: 2000, cash: 2000, note: 'chai pani' });
    E.put({ ...b, id: 'g2', ts: Date.now() - 4 * 864e5, amount: 1500, online: 1500, note: 'tools' });
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await page.reload(); await page.waitForSelector('#boot', { state: 'detached' });
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0');
  r.deal1 = await page.$$eval('.sheet .deal >> nth=0', () => 0).catch(() => 0);
  r.inDeal = await page.$$eval('.sheet .deal', ds => ds.map(d => [d.querySelector('.dhead b').textContent, d.querySelectorAll('.book.mini li:not([hidden])').length, d.querySelectorAll('.book.mini li').length, d.querySelector('[data-dmore]')?.textContent || '']));
  r.other = await page.$$eval('.sheet > .body > .book > li .entry .s, .sheet .body > ul.book .entry .s', s => s.map(x => x.textContent));
  await page.click('.sheet [data-dmore]'); r.afterMore = await page.$eval('.sheet .deal', d => [d.querySelectorAll('.book.mini li:not([hidden])').length, d.querySelector('[data-dmore]').textContent]);
  await page.screenshot({ path: 'j20.png', fullPage: false });
  // tap a payment inside deal opens view on top; move it to general -> lists update in place
  await page.click('.sheet .deal .book.mini .entry >> nth=0'); await page.click('.sheet [data-v="edit"]');
  await page.click('.sheet-bg >> nth=1 >> [data-f="deal"] .chip >> nth=0'); await page.click('.sheet-bg >> nth=1 >> [data-f="save"]'); await page.waitForTimeout(300);
  await page.click('.sheet-bg >> nth=1 >> .x'); await page.waitForTimeout(200);
  r.afterMove = [await page.$$eval('.sheet .deal', ds => ds.map(d => d.querySelectorAll('.book.mini li').length)), await page.$$eval('.sheet .body > ul.book .entry', e => e.length)];
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
