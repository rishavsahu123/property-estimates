// Track A: view bar, "payment" wording, deal wording, undo after edit and linking, project title, error toast,
// trash link, item picker, welcome steps, categories notice, receipt option text, Settings, stable people chips.
const { chromium } = require('playwright');
const { OUT, pickItem } = require('./env.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage(); const errors = [], r = {};
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => { errors.push('native dialog'); d.dismiss(); });
  await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });

  // A7 welcome, A6 project title, A12 trash hidden
  r.welcome = await p.$eval('#welcome', x => x.hidden ? 'hidden' : x.innerText.replace(/\n+/g, ' | '));
  r.projTitle = await p.$eval('#projbtn', x => x.innerText.replace(/\n+/g, ' | '));
  r.addHeading = await p.textContent('#addcard h2');
  await p.screenshot({ path: OUT + '/ta1-home.png' });

  // A2 picker: button, sheet with search and groups, pick, recent chips
  r.itemBtn = await p.textContent('#addform [data-f="itemBtn"]');
  await p.click('#addform [data-f="itemBtn"]');
  r.pickerGroups = await p.$$eval('.sheet .pk-g', x => x.map(y => y.textContent));
  await p.fill('#pk-q', 'cem'); r.search = await p.$$eval('.sheet [data-pick]', x => x.map(y => y.dataset.pick));
  await p.fill('#pk-q', 'zzz'); r.noMatch = await p.textContent('.sheet #pk-list');
  await p.screenshot({ path: OUT + '/ta2-picker.png' });
  await p.fill('#pk-q', ''); await p.click('.sheet [data-pick="cement"]');
  r.picked = await p.textContent('#addform [data-f="itemTxt"]');
  await p.fill('#addform [data-f="qty"]', '50'); await p.fill('#addform [data-f="rate"]', '303');
  await p.fill('#addform [data-f="vendor"]', 'Sharma Cement'); await p.click('#addform [data-f="save"]'); await p.waitForTimeout(300);
  r.saveToast = await p.textContent('.toast');
  r.recentChips = await p.$$eval('#addform [data-f="itemRecent"] .chip', x => x.map(y => y.textContent));
  await p.click('#addform [data-f="itemRecent"] .chip'); r.chipPicked = await p.textContent('#addform [data-f="itemTxt"]');
  await pickItem(p, ''); await p.fill('#addform [data-f="amount"]', '800'); await p.fill('#addform [data-f="vendor"]', 'Ramu'); await p.click('#addform [data-f="save"]'); await p.waitForTimeout(300);
  r.welcomeAfter = await p.$eval('#welcome', x => x.hidden ? 'hidden' : x.innerText.replace(/\n+/g, ' | '));

  // A15 people chips stay, matches on their own row
  await p.fill('#addform [data-f="amount"]', '1');
  r.chipsIdle = await p.$$eval('#addform [data-f="vendorSug"] .chip', x => x.map(y => y.textContent));
  await p.fill('#addform [data-f="vendor"]', 'sh');
  r.chipsTyping = await p.$eval('#addform [data-f="vendorSug"]', x => x.innerText.replace(/\n+/g, ' | '));
  await p.fill('#addform [data-f="vendor"]', ''); await p.fill('#addform [data-f="amount"]', '');

  // A1 view bar
  await p.click('#viewseg [data-v=\"documents\"]');
  r.viewbar = await p.$eval('#viewseg', x => x.className + ' ' + x.querySelector('[aria-pressed="true"]').textContent);
  await p.screenshot({ path: OUT + '/ta3-viewbar.png' });
  await p.click('#viewseg [data-v="all"]'); r.afterShowAll = await p.$eval('#viewseg [aria-pressed="true"]', x => x.dataset.v);

  // A5 undo after edit
  await p.click('nav [data-go="book"]');
  r.bookCount = await p.textContent('#b-count');
  r.trashLinkHidden = await p.$eval('#trashlink', x => x.hidden);
  const id = await p.$eval('#book .entry', x => x.dataset.id);
  await p.click(`#book [data-ra="edit"][data-id="${id}"]`); await p.fill('.sheet [data-f="note"]', 'changed'); await p.click('.sheet [data-f="save"]'); await p.waitForTimeout(300);
  r.editToast = await p.textContent('.toast');
  await p.click('.toast .tact'); await p.waitForTimeout(300);
  r.noteAfterUndo = await p.evaluate(i => window.__pe.D.entries.find(e => e.id === i).note, id);
  await p.evaluate(() => [...window.__pe.SHEETS].forEach(s => s.close()));
  // delete -> trash link appears
  await p.click(`#book [data-ra="del"][data-id="${id}"]`); await p.click('.cdlg [data-ok]'); await p.waitForTimeout(300);
  r.trashLink = await p.$eval('#trashlink', x => x.hidden ? 'hidden' : x.textContent);

  // A4 deal wording + undo after linking
  await p.click('nav [data-go="people"]'); await p.click('[data-pt="deals"]'); await p.click('#adddeal2');
  await p.fill('#dl-who', 'Ramu'); await p.click('[data-dt="fixed"]'); await p.fill('#dl-a', '5000'); await p.uncheck('#dl-e').catch(() => {}); await p.click('#dl-save'); await p.waitForTimeout(300);
  r.linkBtn = await p.textContent('#alldeals [data-dk]');
  await p.click('#alldeals [data-dk]'); r.linkTitle = await p.textContent('.sheet-bg:last-of-type .sheet-top h2');
  await p.click('[data-lw="all"]'); await p.click('.lrow >> nth=0'); await p.click('#lk-save'); await p.waitForTimeout(300);
  r.linkToast = await p.textContent('.toast'); const paid1 = await p.$eval('#alldeals .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  await p.click('.toast .tact'); await p.waitForTimeout(300); const paid2 = await p.$eval('#alldeals .deal .dnums', x => x.innerText.replace(/\n+/g, ' '));
  r.linkUndo = [paid1, paid2];
  // payment form deal chips
  await p.click('#alldeals [data-dp]'); r.dealChips = await p.$$eval('.sheet [data-f="deal"] .chip', x => x.map(y => y.textContent)); r.dealLabel = await p.textContent('.sheet [data-f="dealWrap"] .lbl');
  await p.evaluate(() => [...window.__pe.SHEETS].forEach(s => s.close()));

  // A10 receipt option text
  await p.click('#alldeals [data-ds]').catch(() => {}); await p.waitForTimeout(600);
  r.rcopts = await p.$$eval('.sheet .rcopt', x => x.map(y => y.innerText.replace(/\n+/g, ' | ')));
  await p.evaluate(() => [...window.__pe.SHEETS].forEach(s => s.close()));

  // A13 Settings
  await p.click('#m-info-b');
  r.settings = await p.$eval('#m-info', x => [...x.querySelectorAll('.lbl')].map(l => l.textContent));
  r.ver = await p.textContent('#appver');
  await p.screenshot({ path: OUT + '/ta4-settings.png' });
  await p.mouse.click(12, 700);

  // A8 error toast style
  await p.evaluate(() => { const e = new Error('x'); setTimeout(() => { throw e }, 0) });
  await p.waitForTimeout(300);
  r.errToast = await p.$eval('.toast', x => [x.className, x.textContent]);
  await p.click('.toast.bad', { position: { x: 5, y: 5 } }); await p.waitForTimeout(100);
  r.errClosed = !(await p.$('.toast.bad'));

  // A9 categories notice (simulate an older install: one group without category)
  await p.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const g = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').get('groups'); q.onsuccess = () => res(q.result) }); g[0].kind = null;
    await new Promise(res => { const t = db.transaction('meta', 'readwrite'); t.objectStore('meta').put(g, 'groups'); t.oncomplete = res }); db.close() });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' });
  r.catNote = await p.$eval('#catnote', x => x.hidden ? 'hidden' : x.innerText.replace(/\n+/g, ' | '));
  await p.screenshot({ path: OUT + '/ta5-notice.png' });
  r.errors = errors.filter(e => e !== 'x'); console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
