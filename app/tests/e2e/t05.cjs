// Upgrade from v2.2 (catalog, no groups) -> groups with Unknown, view switch, dropdown picker, group CRUD, receipt, backup.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const URL = 'http://localhost:8090/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], r = {};
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  // v2.2 app first
  fs.copyFileSync(FIX + '/index-v2.2.html', SERVE + '/index.html');
  await page.goto(URL); await page.waitForSelector('#boot', { state: 'detached' });
  await page.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const cat = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').get('catalog'); q.onsuccess = () => res(q.result) });
    cat.push({ k: 'ikh', n: 'Chowkidar kharcha', sub: '', cat: 'other', units: [] });
    const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 600, 800);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .8));
    const tx = db.transaction(['entries', 'slips', 'contacts', 'meta'], 'readwrite');
    const E = tx.objectStore('entries');
    tx.objectStore('meta').put(cat, 'catalog');
    tx.objectStore('slips').put(blob, 's1');
    tx.objectStore('contacts').put({ id: 'c1', name: 'Wonder cement', phone: '', createdAt: 1, updatedAt: 1 });
    tx.objectStore('contacts').put({ id: 'c2', name: 'Ramesh Thekedar', phone: '9893000000', createdAt: 1, updatedAt: 1 });
    const d = (m, dd) => new Date(2026, m - 1, dd, 11).getTime();
    const b = { projectId: pid, createdAt: 1, updatedAt: 1, note: '', qty: null, unit: null, rate: null, slipKey: null, contactId: null, vendor: '' };
    E.put({ ...b, id: 'a1', ts: d(10, 31), item: 'cement', qty: 50, unit: 'bag', rate: 290, amount: 14500, cash: 0, online: 14500, vendor: 'Wonder cement', contactId: 'c1', slipKey: 's1' });
    E.put({ ...b, id: 'l1', ts: d(7, 1), item: 'land', amount: 1800000, cash: 0, online: 1800000 });
    E.put({ ...b, id: 'r1', ts: d(7, 5), item: 'registry', amount: 126000, cash: 26000, online: 100000 });
    E.put({ ...b, id: 't1', ts: d(10, 8), item: 'thekedar', amount: 25000, cash: 25000, online: 0, vendor: 'Ramesh Thekedar', contactId: 'c2' });
    E.put({ ...b, id: 't2', ts: d(10, 22), item: 'thekedar', amount: 25000, cash: 25000, online: 0, vendor: 'Ramesh Thekedar', contactId: 'c2' });
    E.put({ ...b, id: 'o1', ts: d(10, 12), item: 'ikh', amount: 800, cash: 800, online: 0, note: 'chai' });
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  // upgrade
  fs.copyFileSync(DIST + '/index.html', SERVE + '/index.html');
  await page.goto(URL + '?fresh=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  r.groups = await page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const g = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').get('groups'); q.onsuccess = () => res(q.result) }); db.close(); return g.map(x => `${x.n}:${x.kind}`) });
  r.dropdowns = await page.$$eval('#addform .gs small', s => s.map(x => x.textContent));
  await page.screenshot({ path: OUT + '/g1-add.png' });
  // view construction while all Unknown -> nothing
  await page.selectOption('#viewsel', 'construction');
  r.constrTotalUnknown = await page.textContent('#h-total');
  r.constrDropdownsUnknown = await page.$$eval('#addform .gs', s => s.length);
  await page.selectOption('#viewsel', 'all');
  // edit groups: set categories
  await page.click('#addform [data-f="editItems"]');
  r.unknownTags = await page.$$eval('.sheet .tag.unk', t => t.length);
  await page.screenshot({ path: OUT + '/g2-groups.png' });
  for (const [k, kind] of [['material', 'construction'], ['people', 'construction'], ['land', 'documents'], ['other', 'construction']]) {
    await page.click(`.sheet [data-eg="${k}"]`); await page.click(`.sheet-bg:last-child [data-kd="${kind}"]`); await page.click('#gf-save'); await page.waitForTimeout(150);
  }
  // rename group 'other' to Site kharcha
  await page.click('.sheet [data-eg="other"]'); await page.fill('#gf-n', 'Site kharcha'); await page.click('#gf-save'); await page.waitForTimeout(150);
  // add new group Electrical (construction) with item
  await page.click('#gr-new'); await page.fill('#gf-n', 'Electrical'); await page.click('.sheet-bg:last-child [data-kd="construction"]'); await page.click('#gf-save'); await page.waitForTimeout(150);
  const elecKey = await page.evaluate(() => [...document.querySelectorAll('.sheet [data-eg]')].pop().dataset.eg);
  await page.click(`.sheet [data-ni="${elecKey}"]`); await page.fill('#if-n', 'Wire'); await page.fill('#if-u', 'coil, metre'); await page.click('#if-save'); await page.waitForTimeout(150);
  // try deleting used group (land) -> blocked message
  await page.click('.sheet [data-eg="land"]'); await page.click('#gf-del'); r.delBlocked = await page.textContent('#gf-msg'); await page.click('.sheet-bg:last-child .x');
  // delete an unused item (gitti) and an empty new group
  await page.click('.sheet [data-k="gitti"]'); await page.click('#if-del'); await page.waitForTimeout(150);
  await page.click('#gr-new'); await page.fill('#gf-n', 'Temp'); await page.click('.sheet-bg:last-child [data-kd="documents"]'); await page.click('#gf-save'); await page.waitForTimeout(150);
  const tempKey = await page.evaluate(() => [...document.querySelectorAll('.sheet [data-eg]')].pop().dataset.eg);
  await page.click(`.sheet [data-eg="${tempKey}"]`); await page.click('#gf-del'); await page.waitForTimeout(150);
  r.groupsAfter = await page.$$eval('.sheet .ghead', h => h.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: OUT + '/g3-groups-after.png', fullPage: true });
  await page.click('.sheet .x');
  r.dropdownsAfter = await page.$$eval('#addform .gs small', s => s.map(x => x.textContent));
  // add entry via dropdown: Electrical > Wire
  await page.selectOption(`#addform select[data-g="${elecKey}"]`, { label: 'Wire' });
  r.qtyShown = await page.isVisible('#addform [data-f="qty"]');
  await page.fill('#addform [data-f="qty"]', '2'); await page.fill('#addform [data-f="rate"]', '1450');
  await page.click('#addform [data-f="save"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/g4-add-after.png' });
  // views
  r.allTotal = await page.textContent('#h-total');
  await page.selectOption('#viewsel', 'construction');
  r.constr = [await page.textContent('#h-label'), await page.textContent('#h-total'), await page.$$eval('#addform .gs small', s => s.map(x => x.textContent))];
  await page.click('nav [data-go="book"]'); r.constrBook = await page.textContent('#b-count');
  await page.selectOption('#viewsel', 'documents');
  r.docs = [await page.textContent('#h-total'), await page.textContent('#b-count')];
  await page.click('nav [data-go="people"]'); r.peopleInDocs = await page.$$eval('#contacts .crow:not(.idle)', c => c.length);
  await page.click('nav [data-go="sum"]'); r.docsSum = await page.$$eval('#costsplit .trow', t => t.map(x => x.innerText.replace(/\s+/g, ' ')));
  await page.selectOption('#viewsel', 'all');
  r.allSum = await page.$$eval('#costsplit .trow', t => t.map(x => x.innerText.replace(/\s+/g, ' ')));
  r.legend = await page.$$eval('#glegend span:nth-child(4n+2)', s => s.map(x => x.textContent));
  await page.screenshot({ path: OUT + '/g5-sum.png', fullPage: true });
  // receipt: cement single (no footer / no slip text)
  await page.click('nav [data-go="book"]');
  await page.click('#book .entry[data-id="a1"]'); await page.click('.sheet [data-v="share"]');
  await page.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#rc-save')]); await dl.saveAs(OUT + '/g-receipt.png');
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // backup includes groups + slip
  await page.click('#m-down-b');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#backup')]);
  await dl2.saveAs(OUT + '/g-backup.json');
  const bk = JSON.parse(fs.readFileSync(OUT + '/g-backup.json'));
  r.backup = { version: bk.version, groups: bk.groups.map(g => g.n + ':' + g.kind), slips: Object.keys(bk.slips).length, slipBytes: Object.values(bk.slips)[0].length };
  // excel + pdf still work
  await page.click('#m-down-b'); const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#excel')]); r.excel = dl3.suggestedFilename();
  await page.waitForTimeout(500);
  await page.click('#m-down-b'); const [dl4] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#pdf')]); r.pdf = dl4.suggestedFilename(); await dl4.saveAs(OUT + '/g.pdf');
  // restore into a fresh context
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push('p2: ' + e.message)); p2.on('dialog', d => d.accept());
  await p2.goto(URL); await p2.waitForSelector('#boot', { state: 'detached' });
  await p2.setInputFiles('#restorefile', OUT + '/g-backup.json'); await p2.waitForTimeout(1200);
  r.restored = [await p2.textContent('#h-total'), await p2.$$eval('#addform .gs small', s => s.map(x => x.textContent))];
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
