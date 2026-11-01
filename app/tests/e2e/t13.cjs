const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) errors.push(m.text()) });
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`;
  // create contacts via payments without deals first
  await page.fill(F('amount'), '200000'); await page.selectOption('#addform select[data-g="people"]', 'thekedar'); await page.fill(F('vendor'), 'Ramesh Thekedar'); await page.fill(F('phone'), '9893000000');
  await page.click(F('save')); await page.waitForTimeout(300);
  await page.fill(F('amount'), '25000'); await page.selectOption('#addform select[data-g="people"]', 'engineer'); await page.fill(F('vendor'), 'Civil Er. Priya');
  await page.click(F('save')); await page.waitForTimeout(300);
  // summary hint
  await page.click('nav [data-go="sum"]'); r.sumHint = (await page.textContent('#deals')).slice(0, 60);
  // person -> add deal (rate)
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow >> nth=0');
  r.person = await page.textContent('.sheet h2');
  await page.click('.sheet [data-p="adddeal"]');
  await page.selectOption('#dl-i', 'thekedar'); r.autoTitle = await page.inputValue('#dl-t');
  await page.fill('#dl-t', 'Construction labour'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fl]', 'Rate'); await page.fill('#dl-fields .frow >> nth=0 >> [data-fv]', '285'); await page.click('[data-qf="Quantity"]'); await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '7000');
  r.dealTotal = [await page.textContent('#dl-tot'), await page.textContent('#dl-words')];
  await page.screenshot({ path: 'd1-form.png' });
  await page.click('#dl-save'); await page.waitForSelector('.sheet .deal', { timeout: 5000 }).catch(async () => { r.dbg = await page.$$eval('.sheet h2', h => h.map(x => x.textContent)) });
  r.card = await page.$eval('.sheet .deal', d => d.innerText.replace(/\s+/g, ' '));
  r.cardNote = 'old 200000 payment not linked yet';
  await page.screenshot({ path: 'd2-person.png' });
  // + Add payment from card -> add form preset
  await page.click('.sheet [data-dp]'); await page.waitForTimeout(300);
  const S = n => `.sheet [data-f="${n}"]`;
  r.preset = [await page.inputValue(S('vendor')), await page.$eval(S('deal') + ' .chip[aria-pressed="true"]', c => c.textContent), await page.isVisible(S('dealWrap'))];
  await page.fill(S('amount'), '300000'); r.hint = await page.textContent(S('dealHint'));
  await page.screenshot({ path: 'd3-add.png', fullPage: true });
  await page.click(S('save')); await page.waitForTimeout(300);
  await page.evaluate(() => [...__pe.SHEETS].forEach(x => x.close())); await page.click('nav [data-go="add"]');
  // auto-pick by typing name
  await page.fill(F('amount'), '100000'); await page.fill(F('vendor'), 'Ramesh Thekedar'); r.autoPick = await page.$eval(F('deal') + ' .chip[aria-pressed="true"]', c => c.textContent);
  await page.click(F('save')); await page.waitForTimeout(300);
  // civil deal fixed 75000
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow:has-text("Priya")'); await page.click('.sheet [data-p="adddeal"]');
  await page.click('.sheet-bg:last-child [data-dt="fixed"]'); await page.fill('#dl-t', 'Map and design'); await page.selectOption('#dl-i', 'engineer'); await page.fill('#dl-a', '75000'); await page.click('#dl-save'); await page.waitForTimeout(300);
  // link old 25000 payment to deal through edit
  await page.click('.sheet .entry'); await page.click('.sheet [data-v="edit"]');
  r.editDealShown = await page.isVisible('.sheet [data-f="dealWrap"]'); r.editDealSel = await page.$eval('.sheet [data-f="deal"] .chip[aria-pressed="true"]', c => c.textContent);
  await page.click('.sheet [data-f="deal"] .chip >> nth=1'); await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(300);
  r.viewDealRow = await page.$$eval('.sheet .vlist div', d => d.map(x => x.innerText.replace(/\s+/g, ' ')).find(t => t.startsWith('Deal')));
  await page.evaluate(() => [...__pe.SHEETS].forEach(x => x.close()));
  // change area 7000 -> 6900
  await page.click('nav [data-go="people"]'); await page.click('#contacts .crow:has-text("Ramesh")'); await page.click('.sheet [data-de]');
  await page.fill('#dl-fields .frow >> nth=1 >> [data-fv]', '6900'); r.newTotal = await page.textContent('#dl-tot'); await page.click('#dl-save'); await page.waitForTimeout(400);
  r.cardAfter = await page.$eval('.sheet .deal', d => d.innerText.replace(/\s+/g, ' '));
  await page.evaluate(() => [...__pe.SHEETS].forEach(x => x.close()));
  r.peopleRows = await page.$$eval('#contacts .crow small', s => s.map(x => x.textContent));
  // summary
  await page.click('nav [data-go="sum"]'); r.sum = await page.$eval('#deals', d => d.innerText.replace(/\s+/g, ' '));
  await page.screenshot({ path: 'd4-sum.png', fullPage: true });
  // receipt for a deal payment
  await page.click('nav [data-go="book"]');
  const ids = await page.$$eval('#book .entry', b => b.map(x => [x.dataset.id, x.innerText.replace(/\s+/g, ' ')]));
  const id = ids.find(x => x[1].includes('1,00,000'))[0];
  await page.click(`#book .ract [data-ra="share"][data-id="${id}"]`);
  await page.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rc-save')]); await dl.saveAs('d-receipt.png');
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // backup has deals; excel & pdf build
  await page.click('#m-down-b'); const [b] = await Promise.all([page.waitForEvent('download'), page.click('#backup')]); await b.saveAs('d-backup.json');
  r.backupDeals = JSON.parse(fs.readFileSync('d-backup.json')).deals.map(d => d.title + ':' + (d.rate ? d.rate + 'x' + d.qty : d.amount));
  await page.waitForTimeout(400);
  await page.click('#m-down-b'); const [x] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#excel')]); await x.saveAs('d.xlsx');
  await page.waitForTimeout(400);
  await page.click('#m-down-b'); const [pd] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#pdf')]); await pd.saveAs('d.pdf');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
