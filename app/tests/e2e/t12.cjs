const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true, colorScheme: 'dark' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`;
  // registry entry with main payee + 2 more people
  await page.fill(F('amount'), '126000'); await page.click('#addform [data-mode="online"]');
  await page.selectOption('#addform select[data-g="land"]', 'registry');
  await page.fill(F('vendor'), 'Sub Registrar Office');
  await page.click(F('addOther'));
  await page.fill('#addform .xp >> nth=0 >> [data-xn]', 'Mahesh Broker'); await page.fill('#addform .xp >> nth=0 >> [data-xp]', '9811122233'); await page.fill('#addform .xp >> nth=0 >> [data-xr]', 'Broker');
  await page.click(F('addOther'));
  await page.fill('#addform .xp >> nth=1 >> [data-xn]', 'Adv. Jain'); await page.fill('#addform .xp >> nth=1 >> [data-xr]', 'Advocate');
  await page.click(F('addOther')); // empty row ignored
  await page.screenshot({ path: 'v1-form.png', fullPage: true });
  await page.click(F('save')); await page.waitForTimeout(400);
  r.othersAfterSave = await page.$$eval('#addform .xp', x => x.length);
  r.stored = await page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const a = await new Promise(res => { const q = db.transaction('entries').objectStore('entries').getAll(); q.onsuccess = () => res(q.result) }); db.close(); return a.map(e => ({ v: e.vendor, others: e.others })) });
  // another simple entry
  await page.fill(F('amount'), '5000'); await page.selectOption('#addform select[data-g="people"]', 'thekedar'); await page.fill(F('vendor'), 'Ramesh'); await page.click(F('save')); await page.waitForTimeout(300);
  // passbook
  await page.click('nav [data-go="book"]');
  r.rowText = await page.$$eval('#book .entry .s', s => s.map(x => x.textContent));
  r.icons = await page.$$eval('#book .ract', a => a.map(x => x.querySelectorAll('.ib').length));
  await page.screenshot({ path: 'v2-book.png' });
  // tap -> read only view
  await page.click('#book .entry >> nth=1');
  r.viewTitle = await page.textContent('.sheet h2');
  r.viewHasInputs = await page.$$eval('.sheet input', i => i.length);
  r.viewRows = await page.$$eval('.sheet .vlist dt', d => d.map(x => x.textContent));
  r.alsoInvolved = await page.$$eval('.sheet .vp b', b => b.map(x => x.textContent));
  await page.screenshot({ path: 'v3-view.png' });
  // pencil -> edit form, cancel -> back to view
  await page.click('.sheet [data-v="edit"]');
  r.editTitle = await page.textContent('.sheet h2'); r.editActsHidden = await page.$eval('.sheet .vacts', a => a.hidden);
  r.editBtns = await page.$$eval('.sheet .primary, .sheet .second, .sheet .danger', b => b.map(x => x.textContent));
  r.editOthers = await page.$$eval('.sheet .xp [data-xn]', i => i.map(x => x.value));
  await page.screenshot({ path: 'v4-edit.png' });
  await page.click('.sheet [data-f="cancel"]'); r.afterCancel = await page.textContent('.sheet h2');
  // edit -> change note -> save -> view shows note
  await page.click('.sheet [data-v="edit"]'); await page.fill('.sheet [data-f="note"]', 'Registry day 1'); await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(300);
  r.afterSave = [await page.textContent('.sheet h2'), await page.$$eval('.sheet .vlist dd', d => d.map(x => x.textContent).pop())];
  // delete from view -> undo
  await page.click('.sheet [data-v="del"]'); await page.waitForTimeout(300);
  r.sheetClosed = !(await page.$('.sheet-bg')); r.toast = await page.textContent('.toast');
  r.countAfterDel = await page.$$eval('#book .entry', b => b.length);
  await page.click('.toast .tact'); await page.waitForTimeout(300); r.countAfterUndo = await page.$$eval('#book .entry', b => b.length);
  // row icons: delete second row via icon, edit via icon
  await page.click('#book .ract >> nth=0 >> [data-ra="edit"]'); r.iconEdit = await page.textContent('.sheet h2'); await page.click('.sheet .x');
  await page.click('#book .ract >> nth=0 >> [data-ra="share"]'); await page.waitForTimeout(600); r.iconShare = await page.textContent('.sheet h2'); await page.click('.sheet .x');
  await page.click('#book .ract >> nth=0 >> [data-ra="del"]'); await page.waitForTimeout(300); r.iconDel = await page.$$eval('#book .entry', b => b.length);
  await page.click('.toast .tact'); await page.waitForTimeout(300);
  // filter by other person
  await page.click('#openfilters'); r.filterPeople = await page.$$eval('#fp-sel option', b => b.map(x => x.textContent));
  await page.selectOption('#fp-sel', 'adv. jain'); r.fpChip = await page.textContent('#fp-on'); await page.click('.sheet [data-w="apply"]'); r.filtered = await page.textContent('#b-count');
  // people
  await page.click('nav [data-go="people"]'); r.people = await page.$$eval('#contacts .crow', b => b.map(x => x.innerText.replace(/\s+/g, ' ')));
  // receipt for registry
  await page.click('nav [data-go="book"]'); await page.click('#book .ract >> nth=0 >> [data-ra="share"]');
  await page.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rc-save')]); await dl.saveAs('v-receipt.png');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
