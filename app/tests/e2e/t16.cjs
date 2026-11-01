const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true, colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`, chips = () => page.$$eval(F('deal') + ' .chip', c => c.map(x => (x.getAttribute('aria-pressed') === 'true' ? '*' : '') + x.textContent));
  await page.fill(F('amount'), '500'); await page.fill(F('vendor'), 'Sharma Electricals'); await page.click(F('save')); await page.waitForTimeout(300);
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0');
  // deal 1: wire, rate x qty with custom unit + terms
  await page.click('.sheet [data-p="adddeal"]');
  r.earlierDefault1 = await page.isChecked('#dl-e');
  await page.fill('#dl-t', 'Copper wire supply'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Rate'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', '20'); await page.click('[data-qf="Quantity"]'); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '200'); await page.click('[data-qf="Unit"]'); await page.fill('#dl-fields .frow >> nth=2 >> [data-fv]', 'metre');
  await page.click('[data-qf="Brand"]'); await page.fill('#dl-fields .frow >> nth=3 >> [data-fv]', 'Polycab');
  await page.click('#dl-addf'); await page.fill('#dl-fields .frow >> nth=4 >> [data-fl]', 'Deliver by'); await page.fill('#dl-fields .frow >> nth=4 >> [data-fv]', 'March 2027');
  await page.click('#dl-addf'); // empty, ignored
  r.total1 = await page.textContent('#dl-tot');
  await page.screenshot({ path: 't16-form.png', fullPage: false });
  await page.click('#dl-uncheck').catch(() => {}); await page.uncheck('#dl-e').catch(() => {});
  await page.click('#dl-save'); await page.waitForSelector('.sheet .deal');
  // deal 2: fixed
  await page.click('.sheet [data-p="adddeal"]'); r.earlierDefault2 = await page.isChecked('#dl-e').catch(() => 'hidden');
  await page.click('.sheet-bg:last-child [data-dt="fixed"]'); await page.fill('#dl-t', 'House wiring labour'); await page.fill('#dl-a', '45000'); await page.click('#dl-save'); await page.waitForTimeout(500);
  r.cards = await page.$$eval('.sheet .deal', d => d.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 't16-person.png' });
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // payment with two deals -> General by default
  await page.click('nav [data-go="add"]'); await page.fill(F('amount'), '2000'); await page.fill(F('vendor'), 'Sharma Electricals');
  r.twoDealsChips = await chips(); r.twoDealsHint = await page.textContent(F('dealHint'));
  await page.click(F('deal') + ' .chip:has-text("Copper wire supply")'); r.afterPick = await chips(); r.pickHint = await page.textContent(F('dealHint'));
  await page.screenshot({ path: 't16-add.png', fullPage: true });
  await page.click(F('save')); await page.waitForTimeout(300);
  await page.fill(F('amount'), '700'); await page.fill(F('vendor'), 'Sharma Electricals'); await page.click(F('save')); await page.waitForTimeout(300); // general
  // book rows show deal
  await page.click('nav [data-go="book"]'); r.rows = await page.$$eval('#book .entry .s', s => s.map(x => x.textContent));
  // person: paid per deal
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0'); r.cardsAfter = await page.$$eval('.sheet .deal .dnums', d => d.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // one-deal person auto pick still works
  await page.click('nav [data-go="add"]'); await page.fill(F('amount'), '100'); await page.fill(F('vendor'), 'Solo'); await page.click(F('save')); await page.waitForTimeout(300);
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow:has-text("Solo")'); await page.click('.sheet [data-p="adddeal"]');
  await page.click('.sheet-bg:last-child [data-dt="fixed"]'); await page.fill('#dl-t', 'Plaster'); await page.fill('#dl-a', '9000'); await page.click('#dl-save'); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  await page.click('nav [data-go="add"]'); await page.fill(F('amount'), '1000'); await page.fill(F('vendor'), 'Solo'); r.oneDealChips = await chips();
  // receipt with deal summary shows terms
  await page.click('nav [data-go="book"]');
  const id = await page.$$eval('#book .entry', b => b.find(x => x.innerText.includes('2,000')).dataset.id);
  await page.click(`#book [data-ra="share"][data-id="${id}"]`); await page.waitForTimeout(500); await page.check('#rc-d'); await page.waitForTimeout(800);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rc-save')]); await dl.saveAs('t16-receipt.png');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
