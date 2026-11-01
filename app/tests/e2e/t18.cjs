const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) errors.push(m.text()) });
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`, sheets = () => page.$$eval('.sheet h2', h => h.map(x => x.textContent));
  await page.fill(F('amount'), '1000'); await page.selectOption('#addform select[data-g="people"]', 'thekedar'); await page.fill(F('vendor'), 'Ramesh'); await page.click(F('save')); await page.waitForTimeout(300);
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0');
  await page.click('.sheet [data-p="adddeal"]'); await page.fill('#dl-t', 'Grey box');
  await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Rate'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', '285');
  await page.click('[data-qf="Quantity"]'); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '7000'); await page.uncheck('#dl-e').catch(() => {});
  await page.click('#dl-save'); await page.waitForSelector('.sheet .deal');
  r.afterDealSave = await sheets();
  r.cardHead = await page.$eval('.sheet .deal .dhead', d => d.querySelectorAll('.ib').length + ' icons');
  // add payment in dialog
  await page.click('.sheet [data-dp]'); await page.waitForTimeout(200);
  r.payDialog = await sheets();
  r.payPreset = [await page.inputValue('.sheet-bg:nth-last-of-type(1) [data-f="vendor"]').catch(() => '?'), await page.$eval('.sheet [data-f="deal"] .chip[aria-pressed="true"]', c => c.textContent)];
  await page.fill('.sheet [data-f="amount"]', '50000'); await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(400);
  r.afterPay = await sheets(); r.view = await page.evaluate(() => [...document.querySelectorAll('main > section')].find(x => !x.hidden).id);
  r.dealNums = await page.$eval('.sheet .deal .dnums', d => d.innerText.replace(/\s+/g, ' '));
  r.rows = await page.$$eval('.sheet .book .entry', b => b.length);
  // general payment from person pill
  await page.click('.sheet [data-p="pay"]'); r.generalChip = await page.$eval('.sheet [data-f="deal"] .chip[aria-pressed="true"]', c => c.textContent);
  await page.click('.sheet [data-f="cancel"]'); r.afterCancel = await sheets();
  // edit contact on top -> person refreshes
  await page.click('.sheet [data-p="edit"]'); await page.fill('#ct-p', '9893000000'); await page.click('#ct-save'); await page.waitForTimeout(300);
  r.afterContact = [await sheets(), await page.$eval('.sheet .pmeta', p => p.textContent)];
  // tap entry -> view on top, edit, save -> back on view, close -> person still there updated
  await page.click('.sheet .book .entry >> nth=0'); r.stack = await sheets();
  await page.click('.sheet [data-v="edit"]'); await page.fill('.sheet-bg >> nth=1 >> [data-f="note"]', 'slab advance'); await page.click('.sheet-bg >> nth=1 >> [data-f="save"]'); await page.waitForTimeout(300);
  await page.click('.sheet-bg >> nth=1 >> .x'); await page.waitForTimeout(200);
  r.personRowNote = await page.$$eval('.sheet .book .entry .s', s => s.map(x => x.textContent));
  // edit deal via icon, change qty, person refreshes in place
  await page.click('.sheet .deal [data-de]'); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '6900'); await page.click('#dl-save'); await page.waitForTimeout(400);
  r.afterEditDeal = [await sheets(), await page.$eval('.sheet .deal .dnums', d => d.innerText.replace(/\s+/g, ' '))];
  // back button closes top sheet only
  await page.click('.sheet [data-p="pay"]'); await page.waitForTimeout(200); r.beforeBack = await sheets();
  await page.goBack(); await page.waitForTimeout(300); r.afterBack1 = await sheets();
  await page.goBack(); await page.waitForTimeout(300); r.afterBack2 = await sheets(); r.stillInApp = page.url().startsWith('http://localhost:8090');
  // delete deal via icon
  await page.click('#contacts .crow >> nth=0'); await page.click('.sheet .deal [data-dd]'); await page.waitForTimeout(400);
  r.afterDelete = [await sheets(), await page.$$eval('.sheet .deal', d => d.length)];
  // escape closes
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); r.afterEsc = await sheets();
  // info menu storage note
  await page.click('#m-info-b'); await page.waitForTimeout(300); r.storage = await page.textContent('#storeuse');
  await page.screenshot({ path: 'h18.png' });
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
