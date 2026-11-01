const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  // old-format deal in storage
  await page.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const tx = db.transaction(['contacts', 'meta', 'entries'], 'readwrite');
    tx.objectStore('contacts').put({ id: 'c1', name: 'Ramesh Thekedar', phone: '', createdAt: 1, updatedAt: 1 });
    tx.objectStore('meta').put([{ id: 'd1', projectId: pid, contactId: 'c1', item: 'thekedar', title: 'Grey box', type: 'rate', rate: 285, qty: 7000, unit: 'sq ft', terms: [{ label: 'Includes', value: 'labour only' }], createdAt: 1, updatedAt: 1 }], 'deals');
    tx.objectStore('entries').put({ id: 'e1', projectId: pid, ts: Date.now(), item: 'thekedar', amount: 100000, cash: 100000, online: 0, vendor: 'Ramesh Thekedar', contactId: 'c1', dealId: 'd1', createdAt: 1, updatedAt: 1, note: '', qty: null, unit: null, rate: null, slipKey: null });
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await page.reload(); await page.waitForSelector('#boot', { state: 'detached' });
  r.migrated = await page.evaluate(() => JSON.stringify(__pe.D.deals[0].fields) + ' ' + __pe.D.deals[0].type + ' ' + __pe.dealAgreed(__pe.D.deals[0]));
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0');
  r.oldCard = await page.$eval('.sheet .deal', d => d.innerText.replace(/\s+/g, ' '));
  // edit: change quantity 7000 -> 6900 in fields; add deadline in the past
  await page.click('.sheet [data-de]');
  r.editRows = await page.$$eval('#dl-fields .frow', rs => rs.map(x => x.querySelector('[data-fl]').value + '=' + x.querySelector('[data-fv]').value + (x.querySelector('.mul').classList.contains('na') ? '' : (x.querySelector('.mul').getAttribute('aria-pressed') === 'true' ? ' [×]' : ' [ ]'))));
  await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '6900');
  r.how = await page.textContent('#dl-how') + ' ' + await page.textContent('#dl-tot');
  await page.check('#dl-hasd'); await page.fill('#dl-date', '2026-10-01');
  await page.screenshot({ path: 'g17-edit.png', fullPage: false });
  await page.click('#dl-save'); await page.waitForSelector('.sheet .deal');
  r.cardAfter = await page.$eval('.sheet .deal', d => d.innerText.replace(/\s+/g, ' '));
  // new deal with custom fields: wire 20 x 200, plus Brand; toggle off a numeric field
  await page.click('.sheet [data-p="adddeal"]');
  await page.fill('#dl-t', 'Copper wire');
  await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Rate per metre'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', '20');
  await page.click('[data-qf="Quantity"]'); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '200');
  await page.click('[data-qf="Brand"]'); await page.fill('#dl-fields .frow >> nth=2 >> [data-fv]', 'Polycab');
  await page.click('#dl-addf'); await page.fill('#dl-fields .frow >> nth=3 >> [data-fl]', 'Advance'); await page.fill('#dl-fields .frow >> nth=3 >> [data-fv]', '1000');
  r.advanceMul = await page.$eval('#dl-fields .frow:nth-child(4) .mul', m => m.getAttribute('aria-pressed'));
  r.wireTotal = await page.textContent('#dl-how') + ' ' + await page.textContent('#dl-tot');
  await page.click('#dl-fields .frow >> nth=3 >> .mul'); r.withAdvance = await page.textContent('#dl-tot');
  await page.click('#dl-fields .frow >> nth=3 >> .mul');
  await page.screenshot({ path: 'g17-new.png', fullPage: false });
  await page.click('#dl-save'); await page.waitForTimeout(500);
  r.cards = await page.$$eval('.sheet .deal', d => d.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 'g17-person.png' });
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // new contact with inline deal (fixed + future deadline)
  await page.click('#addcontact'); await page.fill('#ct-n', 'Civil Er. Priya'); await page.fill('#ct-p', '9000012345');
  await page.click('#ct-adddeal');
  await page.fill('#ct-deal #dl-t', 'Map and design'); await page.click('#ct-deal [data-dt="fixed"]'); await page.fill('#ct-deal #dl-a', '75000');
  await page.check('#ct-deal #dl-hasd'); await page.fill('#ct-deal #dl-date', '2027-11-01');
  await page.screenshot({ path: 'g17-contact.png', fullPage: false });
  await page.click('#ct-save'); await page.waitForTimeout(400); r.toast = await page.textContent('.toast');
  r.peopleRow = await page.$$eval('#contacts .crow small', s => s.map(x => x.textContent));
  await page.click('#contacts .crow:has-text("Priya")'); r.priyaCard = await page.$eval('.sheet .deal', d => d.innerText.replace(/\s+/g, ' '));
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // contact without deal still fine; validation error when deal opened but empty
  await page.click('#addcontact'); await page.fill('#ct-n', 'Empty Deal'); await page.click('#ct-adddeal'); await page.click('#ct-save'); r.emptyErr = await page.textContent('.toast');
  await page.click('#ct-nodeal'); await page.click('#ct-save'); await page.waitForTimeout(300); r.noDeal = await page.textContent('.toast');
  await page.click('nav [data-go="sum"]'); r.sum = await page.$eval('#deals', d => d.innerText.replace(/\s+/g, ' '));
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
