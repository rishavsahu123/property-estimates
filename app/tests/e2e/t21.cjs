// App confirm box, People/Deals tabs, monthly salary deal.
const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const URL = 'http://localhost:8090/?t=' + Date.now();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [], r = {};
  let nativeDialogs = 0;
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => { nativeDialogs++; d.dismiss(); });
  await page.clock.setFixedTime(new Date('2026-11-01T10:00:00'));
  await page.goto(URL); await page.waitForSelector('#boot', { state: 'detached' });

  // People tabs
  await page.click('nav [data-go="people"]');
  r.tabs = await page.$$eval('[data-pt]', b => b.map(x => x.textContent + ':' + x.getAttribute('aria-pressed')));
  await page.click('[data-pt="deals"]');
  r.emptyDeals = await page.textContent('#alldeals');
  // new monthly deal from the Deals tab
  await page.click('#adddeal2');
  await page.fill('#dl-who', 'Ramu watchman');
  await page.fill('#dl-t', 'Watchman salary');
  await page.click('[data-dt="monthly"]');
  r.deadlineHidden = await page.$eval('#dl-hasdw', x => x.hidden);
  await page.fill('#dl-ma', '9300');
  await page.fill('#dl-ms', '2026-10-23');
  r.formHow = await page.textContent('#dl-how'); r.formTot = await page.textContent('#dl-tot');
  await page.screenshot({ path: OUT + '/k1-form.png' });
  await page.click('#dl-save'); await page.waitForTimeout(300);
  r.dealCard = await page.$eval('#alldeals .deal', x => x.innerText.replace(/\n+/g, ' | '));
  r.tabCount = await page.textContent('#pt-dn');
  await page.screenshot({ path: OUT + '/k2-deals.png' });
  // pay what is due now
  await page.click('#alldeals [data-dp]');
  r.prefill = await page.inputValue('.sheet [data-f="amount"]');
  r.payHint = await page.textContent('.sheet [data-f="dealHint"]');
  await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(300);
  r.afterPay = await page.$eval('#alldeals .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  // contacts tab shows the deal badge
  await page.click('[data-pt="contacts"]');
  r.contactRow = await page.$eval('#contacts .crow', x => x.innerText.replace(/\n+/g, ' | '));
  await page.screenshot({ path: OUT + '/k3-people.png' });
  // later date: 25 Dec
  await page.clock.setFixedTime(new Date('2026-12-25T10:00:00'));
  await page.click('[data-pt="deals"]');
  r.dec25 = await page.$eval('#alldeals .deal', x => x.innerText.replace(/\n+/g, ' | '));
  // stopped working 30 Nov
  await page.click('#alldeals [data-de]');
  await page.check('#dl-hase'); await page.fill('#dl-me', '2026-11-30');
  r.endTot = await page.textContent('#dl-tot');
  await page.click('#dl-save'); await page.waitForTimeout(300);
  r.ended = await page.$eval('#alldeals .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  await page.click('nav [data-go="sum"]');
  r.sum = await page.$eval('#deals', x => x.innerText.replace(/\n+/g, ' | '));

  // confirm box: cancel, escape, back button, then delete
  await page.click('nav [data-go="people"]'); await page.click('[data-pt="deals"]');
  await page.click('#alldeals [data-dd]');
  await page.waitForSelector('.cdlg');
  r.dlg = await page.$eval('.cdlg', x => x.innerText.replace(/\n+/g, ' | '));
  r.focusOnCancel = await page.evaluate(() => document.activeElement.hasAttribute('data-no'));
  await page.screenshot({ path: OUT + '/k4-dialog.png' });
  await page.click('.cdlg [data-no]'); await page.waitForTimeout(200);
  r.afterCancel = await page.$$eval('#alldeals .deal', d => d.length);
  await page.click('#alldeals [data-dd]'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  r.afterEsc = [await page.$$eval('.cdlg', d => d.length), await page.$$eval('#alldeals .deal', d => d.length)];
  await page.click('#alldeals [data-dd]'); await page.goBack(); await page.waitForTimeout(300);
  r.afterBack = [await page.$$eval('.cdlg', d => d.length), await page.$$eval('#alldeals .deal', d => d.length), location => 0];
  r.stillInApp = await page.evaluate(() => location.hash);
  await page.click('#alldeals [data-dd]'); await page.click('.cdlg [data-ok]'); await page.waitForTimeout(300);
  r.afterOk = await page.textContent('#alldeals');
  // dark mode look
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.click('[data-pt="contacts"]'); await page.click('#contacts .crow'); await page.click('.sheet [data-p="edit"]');
  await page.click('#ct-del').catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/k5-dialog-dark.png' });
  r.nativeDialogs = nativeDialogs;
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
