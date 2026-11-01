const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  await page.selectOption('#viewsel', 'construction');
  await page.click('nav [data-go="people"]'); await page.click('#addcontact'); await page.fill('#ct-n', 'test'); await page.click('#ct-save'); await page.waitForTimeout(300);
  await page.click('#contacts .crow >> nth=0'); await page.click('.sheet [data-p="adddeal"]');
  await page.fill('#dl-t', 'Grey Box Construction');
  const ph = async i => page.getAttribute(`#dl-fields .frow >> nth=${i} >> [data-fv]`, 'placeholder');
  r.phEmpty = await ph(0);
  await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Rate'); r.phRate = await ph(0);
  await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', '285 rs');
  await page.click('[data-qf="Quantity"]'); r.phQty = await ph(1); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '7000 sq ft');
  await page.click('[data-qf="Brand"]'); r.phBrand = await ph(2);
  await page.click('#dl-addf'); await page.fill('#dl-fields .frow >> nth=3 >> [data-fl]', 'Deliver by'); r.phDeliver = await ph(3); await page.fill('#dl-fields .frow >> nth=3 >> [data-fv]', '2027');
  r.deliverMul = await page.$eval('#dl-fields .frow:nth-child(4) .mul', m => m.getAttribute('aria-pressed'));
  r.total = (await page.textContent('#dl-how')) + ' ' + (await page.textContent('#dl-tot'));
  await page.check('#dl-hasd'); await page.click('[data-dq="6m"]'); r.dl6m = await page.inputValue('#dl-date');
  await page.click('[data-dq="1y"]'); r.dl1y = await page.inputValue('#dl-date'); await page.click('[data-dq="7d"]'); r.dl7d = await page.inputValue('#dl-date');
  await page.screenshot({ path: 'i19-form.png' });
  await page.click('#dl-save'); await page.waitForTimeout(500);
  r.sheets = await page.$$eval('.sheet h2', h => h.map(x => x.textContent));
  r.cards = await page.$$eval('.sheet .deal', d => d.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 'i19-person.png' });
  // error shown in form
  await page.click('.sheet [data-p="adddeal"]'); await page.fill('#dl-t', 'Bad'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Material'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', 'sand');
  await page.click('#dl-save'); r.errMsg = await page.textContent('#dl-msg'); r.errVisible = await page.isVisible('#dl-msg');
  await page.evaluate(() => [...__pe.SHEETS].forEach(x => x.close()));
  r.peopleRow = await page.$$eval('#contacts .crow small', s => s.map(x => x.textContent));
  await page.click('nav [data-go="sum"]'); r.sumDeals = (await page.textContent('#deals')).replace(/\s+/g, ' ').slice(0, 120);
  // placeholders in add form + contact form
  await page.click('nav [data-go="add"]');
  r.addPh = await page.$$eval('#addform input[placeholder]', i => i.map(x => x.getAttribute('data-f') + ': ' + x.placeholder));
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
