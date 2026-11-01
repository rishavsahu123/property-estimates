// Link payments already in the passbook to a deal from the deal card.
const { chromium } = require('playwright');
const { OUT } = require('./env.cjs');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  const errors = [], r = {}; p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });
  const add = async (amt, who, note) => { await p.fill('#addform [data-f="amount"]', amt); await p.fill('#addform [data-f="vendor"]', who); await p.fill('#addform [data-f="note"]', note); await p.click('#addform [data-f="save"]'); await p.waitForTimeout(250); };
  await add('20000', 'Ramesh', 'week 1'); await add('15000', 'Ramesh', 'week 2'); await add('5000', 'Suresh', 'helper');
  await p.click('nav [data-go="people"]'); await p.click('#contacts .crow >> text=Ramesh');
  await p.click('.sheet [data-p="adddeal"]'); await p.click('[data-dt="fixed"]');
  await p.fill('#dl-t', 'Labour'); await p.fill('#dl-a', '100000');
  await p.uncheck('#dl-e').catch(() => {}); // don't auto-count earlier payments
  await p.click('#dl-save'); await p.waitForTimeout(300);
  r.before = await p.$eval('.sheet .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  await p.click('.sheet [data-dk]');
  r.rows = await p.$$eval('.lrow', x => x.map(y => y.innerText.replace(/\n+/g, ' ')));
  await p.click('.lrow >> nth=0'); await p.click('.lrow >> nth=1');
  await p.click('[data-lw="all"]');
  r.rowsAll = await p.$$eval('.lrow', x => x.length);
  r.saveText = await p.textContent('#lk-save');
  await p.screenshot({ path: OUT + '/y1-link.png' });
  await p.click('#lk-save'); await p.waitForTimeout(300);
  r.after = await p.$eval('.sheet .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  r.otherPays = await p.$$eval('.sheet .book:not(.mini) .entry', x => x.length);
  // untick one
  await p.click('.sheet [data-dk]'); await p.click('.lrow[aria-pressed="true"] >> nth=0'); await p.click('#lk-save'); await p.waitForTimeout(300);
  r.afterUntick = await p.$eval('.sheet .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  await p.screenshot({ path: OUT + '/y2-person.png' });
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
