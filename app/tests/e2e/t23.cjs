// Delete asks first, delete many in select mode, entries without an item stay in the picked view, receipts for them work.
const { chromium } = require('playwright');
const { OUT } = require('./env.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errors = [], r = {};
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });
  await p.screenshot({ path: OUT + '/x1-home-light.png' });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await p.screenshot({ path: OUT + '/x2-home-dark.png' });
  await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // 4. Documents view, entry with no item stays in Documents
  await p.selectOption('#viewsel', 'documents');
  await p.fill('#addform [data-f="amount"]', '1500'); await p.fill('#addform [data-f="note"]', 'notary');
  await p.click('#addform [data-f="save"]'); await p.waitForTimeout(300);
  r.docTotal = await p.textContent('#h-total');
  await p.click('nav [data-go="book"]'); r.docBook = await p.textContent('#b-count');
  await p.selectOption('#viewsel', 'construction'); r.constrBook = await p.textContent('#b-count');
  // construction: a deal payment without an item
  await p.click('nav [data-go="people"]'); await p.click('[data-pt="deals"]'); await p.click('#adddeal2');
  await p.fill('#dl-who', 'Ramesh'); await p.click('[data-dt="fixed"]'); await p.fill('#dl-a', '100000'); await p.click('#dl-save'); await p.waitForTimeout(300);
  await p.click('#alldeals [data-dp]'); await p.fill('.sheet [data-f="amount"]', '25000'); await p.click('.sheet [data-f="save"]'); await p.waitForTimeout(300);
  r.dealPaid = await p.$eval('#alldeals .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  await p.click('nav [data-go="book"]'); r.constrBook2 = await p.textContent('#b-count');
  await p.selectOption('#viewsel', 'all'); r.allBook = await p.textContent('#b-count');
  // 3. share the deal from the Construction view
  await p.selectOption('#viewsel', 'construction');
  await p.click('nav [data-go="people"]'); await p.click('[data-pt="deals"]'); await p.click('#alldeals [data-ds]');
  await p.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 });
  r.receipt = await p.$eval('#rc-d', x => x.checked);
  await p.click('.sheet .x');
  // 1. row delete asks first; cancel keeps it
  await p.selectOption('#viewsel', 'all'); await p.click('nav [data-go="book"]');
  await p.click('#book [data-ra="del"] >> nth=0');
  await p.waitForSelector('.cdlg'); r.delAsk = await p.$eval('.cdlg', x => x.innerText.replace(/\n+/g, ' | '));
  await p.click('.cdlg [data-no]'); await p.waitForTimeout(200); r.afterCancel = await p.textContent('#b-count');
  await p.click('#book [data-ra="del"] >> nth=0'); await p.click('.cdlg [data-ok]'); await p.waitForTimeout(300);
  r.afterDel = await p.textContent('#b-count');
  await p.click('.toast .tact'); await p.waitForTimeout(300); r.afterUndo = await p.textContent('#b-count');
  // 2. select mode delete
  await p.click('#selbtn'); r.delDisabled = await p.$eval('#sel-del', x => x.disabled);
  await p.click('#book .entry >> nth=0'); await p.click('#book .entry >> nth=1');
  await p.screenshot({ path: OUT + '/x3-select.png' });
  await p.click('#sel-del'); r.multiAsk = await p.$eval('.cdlg', x => x.innerText.replace(/\n+/g, ' | '));
  await p.click('.cdlg [data-ok]'); await p.waitForTimeout(300);
  r.afterMulti = await p.textContent('#b-count'); r.selbarHidden = await p.$eval('#selbar', x => x.hidden);
  r.trash = await p.textContent('#trashlink');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
