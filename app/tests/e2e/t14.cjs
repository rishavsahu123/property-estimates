const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true, colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`;
  await page.fill(F('amount'), '1000'); await page.selectOption('#addform select[data-g="people"]', 'thekedar'); await page.fill(F('vendor'), 'Ramesh'); await page.click(F('save')); await page.waitForTimeout(300);
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0'); await page.click('.sheet [data-p="adddeal"]');
  await page.fill('#dl-t', 'Grey Box Construction'); await page.selectOption('#dl-i', 'thekedar'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Rate'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', '285'); await page.click('[data-qf="Quantity"]'); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '7000'); await page.click('#dl-save'); await page.waitForSelector('.sheet .deal');
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // slip entry for another person, no deal
  await page.click('nav [data-go="add"]');
  await page.fill(F('amount'), '14500'); await page.fill(F('vendor'), 'Wonder Cement');
  await page.setInputFiles(F('file'), { name: 's.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.click(F('save')); await page.waitForTimeout(500);
  await page.click('nav [data-go="book"]');
  const ids = await page.$$eval('#book .entry', b => b.map(x => [x.dataset.id, x.innerText]));
  const opts = () => page.$$eval('.sheet .rcopt', l => l.map(x => `${x.querySelector('input').checked ? '[x]' : '[ ]'}${x.querySelector('input').disabled ? '(off)' : ''} ${x.innerText.replace(/\s+/g, ' ')}`));
  const deal = ids.find(x => x[1].includes('1,000'))[0], slip = ids.find(x => x[1].includes('14,500'))[0];
  await page.click(`#book .ract [data-ra="share"][data-id="${deal}"]`); await page.waitForTimeout(700);
  r.dealEntry = await opts(); const h1 = await page.$eval('#rc-img', i => i.naturalHeight);
  await page.check('#rc-d'); await page.waitForTimeout(700); const h2 = await page.$eval('#rc-img', i => i.naturalHeight); r.heights = [h1, h2];
  await page.screenshot({ path: 'o1.png' });
  await page.click('.sheet .x');
  await page.click(`#book .ract [data-ra="share"][data-id="${slip}"]`); await page.waitForTimeout(700); r.slipEntry = await opts(); await page.click('.sheet .x');
  await page.click('#selbtn'); await page.click(`#book .entry[data-id="${deal}"]`); await page.click(`#book .entry[data-id="${slip}"]`); await page.click('#sel-share'); await page.waitForTimeout(700);
  r.mixed = await opts();
  // remembered deal choice
  await page.click('.sheet .x'); await page.click('#sel-x');
  await page.click(`#book .ract [data-ra="share"][data-id="${deal}"]`); await page.waitForTimeout(500); r.remembered = (await opts())[1];
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
