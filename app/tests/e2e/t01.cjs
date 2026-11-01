// Phase 1: seed v1 data with the OLD app, then swap in the new app and check migration + features.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const URL = 'http://localhost:8090/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  // old app seeds data
  await page.goto(URL);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ghar-hisaab', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    // small red jpeg slip
    const c = document.createElement('canvas'); c.width = 300; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 300, 400); g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText('SLIP', 90, 200);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .8));
    const tx = db.transaction(['entries', 'slips'], 'readwrite');
    const E = tx.objectStore('entries'), S = tx.objectStore('slips');
    S.put(blob, 'sOLD1');
    const d = (y, m, dd) => new Date(y, m - 1, dd, 11).getTime();
    E.put({ id: 'e1', ts: d(2026, 10, 27), item: 'cement', itemName: '', qty: 50, unit: 'bag', rate: 303, amount: 15150, cash: 10000, online: 5150, vendor: 'Sharma Cement', note: 'slip in book', slipKey: 'sOLD1', createdAt: 1, updatedAt: 1 });
    E.put({ id: 'e2', ts: d(2026, 10, 25), item: 'brick', itemName: '', qty: 1000, unit: 'piece', rate: 6, amount: 6000, cash: 6000, online: 0, vendor: 'Raju Bricks', note: '', slipKey: null, createdAt: 1, updatedAt: 1 });
    E.put({ id: 'e3', ts: d(2026, 10, 20), item: 'other', itemName: 'Chowkidar kharcha', qty: null, unit: null, rate: null, amount: 500, cash: 500, online: 0, vendor: '', note: 'chai', slipKey: null, createdAt: 1, updatedAt: 1 });
    E.put({ id: 'e4', ts: d(2026, 10, 18), item: 'engineer', itemName: '', qty: null, unit: null, rate: null, amount: 20000, cash: 0, online: 20000, vendor: 'sharma cement', note: 'wrong case to test dedupe', slipKey: null, createdAt: 1, updatedAt: 1 });
    E.put({ id: 'e5', ts: d(2026, 9, 1), item: 'registry', itemName: '', qty: null, unit: null, rate: null, amount: 80000, cash: 0, online: 80000, vendor: '', note: '', slipKey: null, createdAt: 1, updatedAt: 1 });
    E.put({ id: 'e6', ts: d(2026, 10, 10), item: 'other', itemName: 'binding wire', qty: 5, unit: 'kg', rate: 90, amount: 450, cash: 450, online: 0, vendor: '', note: '', slipKey: null, createdAt: 1, updatedAt: 1, deletedAt: 5 });
    E.put({ id: 'e7', ts: d(2026, 10, 5), item: null, itemName: '', qty: null, unit: null, rate: null, amount: 300, cash: 300, online: 0, vendor: '', note: '', slipKey: null, createdAt: 1, updatedAt: 1 });
    await new Promise(r => tx.oncomplete = r);
    db.close();
  });

  // swap in new app
  for (const f of ['index.html', 'sw.js']) fs.copyFileSync(path.join(DIST, f), path.join(SERVE, f));
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 8000 });
  const r = {};
  r.title = await page.title();
  r.proj = await page.textContent('#projname');
  r.heroTotal = await page.textContent('#h-total');
  r.dbInfo = await page.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result); });
    const out = { version: db.version, stores: [...db.objectStoreNames] };
    const all = s => new Promise(res => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); });
    out.entries = (await all('entries')).map(e => ({ id: e.id, item: e.item, vendor: e.vendor, contactId: !!e.contactId, projectId: !!e.projectId, itemName: e.itemName }));
    out.contacts = (await all('contacts')).map(c => c.name);
    out.projects = (await all('projects')).map(p => p.name);
    const cat = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').get('catalog'); q.onsuccess = () => res(q.result); });
    out.catalog = cat.map(i => i.n + '/' + i.cat + '/' + (i.units || []).join('|'));
    db.close(); return out;
  });
  await page.screenshot({ path: OUT + '/s1-add.png', fullPage: true });

  // add a new entry: pick Reti, qty/rate, both, new vendor with phone
  await page.selectOption('#addform select[data-g="material"]','reti');
  await page.fill('#addform [data-f="qty"]', '100');
  await page.fill('#addform [data-f="rate"]', '45');
  r.autoAmount = await page.inputValue('#addform [data-f="amount"]');
  await page.click('#addform [data-mode="both"]');
  await page.fill('#addform [data-f="cash"]', '1500');
  await page.fill('#addform [data-f="vendor"]', 'Gupta Sand Supplier');
  await page.fill('#addform [data-f="phone"]', '98260 12345');
  await page.click('#addform [data-f="save"]');
  await page.waitForTimeout(400);
  r.heroAfterAdd = await page.textContent('#h-total');

  // vendor suggestion chips: pick Sharma for a new entry
  await page.selectOption('#addform select[data-g="material"]','cement');
  r.sugChips = await page.$$eval('#addform [data-f="vendorSug"] .chip', b => b.map(x => x.textContent));
  // "+ New" item
  await page.selectOption('#addform select[data-g="material"]','__new');
  await page.fill('#if-n', 'Plumbing fittings');
  await page.fill('#if-u', 'piece, set');
  await page.click('#if-save');
  await page.waitForTimeout(300);
  r.newItemSelected = await page.$eval('#addform .gs.on select', s => s.selectedOptions[0].textContent);
  await page.fill('#addform [data-f="amount"]', '2400');
  await page.click('#addform [data-mode="online"]');
  await page.click('#addform [data-f="save"]');
  await page.waitForTimeout(400);

  // edit items: hide Gitti
  await page.click('#addform [data-f="editItems"]');
  await page.click('.sheet [data-k="gitti"]');
  await page.check('#if-h');
  await page.click('#if-save');
  await page.waitForTimeout(300);
  await page.click('.sheet .x');
  r.gittiHidden = !(await page.$('#addform option[value="gitti"]'));
  await page.screenshot({ path: OUT + '/s2-add-after.png', fullPage: true });

  // passbook + filters
  await page.click('nav [data-go="book"]');
  r.bookCount = await page.textContent('#b-count');
  await page.click('#openfilters');
  await page.click('.sheet [data-fi="cement"]');
  await page.click('.sheet [data-fi="reti"]');
  await page.click('.sheet [data-fs="yes"]');
  r.applyBtnSlip = await page.textContent('.sheet [data-w="apply"]');
  await page.click('.sheet [data-fs="any"]');
  await page.fill('.sheet [data-w="min"]', '5000');
  r.applyBtn = await page.textContent('.sheet [data-w="apply"]');
  await page.click('.sheet [data-w="apply"]');
  r.tags = await page.$$eval('#ftags .ftag', b => b.map(x => x.textContent.trim()));
  r.filteredTotal = await page.textContent('#b-total');
  await page.screenshot({ path: OUT + '/s3-book.png', fullPage: true });
  await page.click('#ftags .ftag'); // remove first tag (cement)
  r.tagsAfterRemove = await page.$$eval('#ftags .ftag', b => b.map(x => x.textContent.trim()));
  await page.selectOption('#sort', 'person');
  r.emptyMsg = await page.textContent('#book'); await page.click('#ftags [data-t="all"]').catch(()=>{}); await page.click('#ftags .ftag').catch(()=>{}); r.firstByPerson = await page.$$eval('#book .entry .s', s => s.map(x=>x.textContent));

  // trash view
  await page.click('#trashlink');
  r.trash = await page.$$eval('#trash .entry .t', b => b.map(x => x.textContent.trim()));
  // people
  await page.click('nav [data-go="people"]');
  r.peopleCards = await page.$$eval('#people .pcard h3', b => b.map(x => x.textContent));
  r.contacts = await page.$$eval('#contacts .pcard h3', b => b.map(x => x.textContent));
  r.telLinks = await page.$$eval('#v-people a[href^="tel:"]', b => b.map(x => x.getAttribute('href')));
  await page.screenshot({ path: OUT + '/s4-people.png', fullPage: true });
  // summary
  await page.click('nav [data-go="sum"]');
  r.cost = await page.$$eval('#costsplit .trow', b => b.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: OUT + '/s5-sum.png', fullPage: true });
  // excel
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#m-down-b').then(()=>page.click('#excel'))]);
  r.excelName = dl.suggestedFilename();
  await dl.saveAs(OUT + '/out.xlsx');
  // backup
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#m-down-b').then(()=>page.click('#backup'))]);
  r.backupName = dl2.suggestedFilename();
  await dl2.saveAs(OUT + '/backup.json');
  // projects: create a second project
  await page.click('#projbtn');
  await page.fill('#pj-n', 'Shop at Indore');
  await page.click('#pj-ns');
  await page.waitForTimeout(300);
  r.proj2 = await page.textContent('#projname');
  r.proj2Total = await page.textContent('#h-total');
  // dark mode
  await page.click('#m-info-b'); await page.click('#theme [data-theme="dark"]'); await page.mouse.click(12,400);
  await page.click('nav [data-go="add"]');
  await page.screenshot({ path: OUT + '/s6-dark-proj2.png', fullPage: false });
  // switch back
  await page.click('#projbtn');
  await page.click('.sheet .prow');
  r.backTo = await page.textContent('#projname');
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
