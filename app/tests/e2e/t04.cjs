// Receipts, multi-select, top menus, summary charts.
const { chromium } = require('playwright');
const fs = require('fs');
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
  await page.goto(URL); await page.waitForSelector('#boot', { state: 'detached' });
  await page.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#f4e9c8'; g.fillRect(0, 0, 900, 1200); g.fillStyle = '#000'; g.font = '60px sans-serif'; g.fillText('SLIP', 300, 600);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .8));
    const tx = db.transaction(['entries', 'slips', 'contacts'], 'readwrite');
    const E = tx.objectStore('entries'), S = tx.objectStore('slips'), C = tx.objectStore('contacts');
    S.put(blob, 's1');
    C.put({ id: 'c1', name: 'Sharma Cement Store', phone: '9826012345', createdAt: 1, updatedAt: 1 });
    C.put({ id: 'c2', name: 'Ramesh Thekedar', phone: '9893000000', createdAt: 1, updatedAt: 1 });
    const d = (y, m, dd) => new Date(y, m - 1, dd, 11).getTime();
    const base = { projectId: pid, createdAt: 1, updatedAt: 1, note: '', qty: null, unit: null, rate: null, slipKey: null, contactId: null, vendor: '' };
    E.put({ ...base, id: 'r1', ts: d(2026, 6, 10), item: 'land', amount: 1800000, cash: 0, online: 1800000 });
    E.put({ ...base, id: 'r2', ts: d(2026, 6, 20), item: 'registry', amount: 126000, cash: 26000, online: 100000 });
    E.put({ ...base, id: 'a1', ts: d(2026, 10, 27), item: 'cement', qty: 50, unit: 'bag', rate: 303, amount: 15150, cash: 10000, online: 5150, vendor: 'Sharma Cement Store', contactId: 'c1', note: 'slip kept in book', slipKey: 's1' });
    E.put({ ...base, id: 'a2', ts: d(2026, 10, 25), item: 'brick', qty: 1000, unit: 'piece', rate: 6, amount: 6000, cash: 6000, online: 0 });
    E.put({ ...base, id: 'a3', ts: d(2026, 9, 22), item: 'tmt', qty: 1.2, unit: 'ton', rate: 58000, amount: 69600, cash: 0, online: 69600 });
    E.put({ ...base, id: 'e1', ts: d(2026, 8, 5), item: 'engineer', amount: 30000, cash: 0, online: 30000 });
    const tk = [[8, 14, 20000], [8, 28, 25000], [9, 10, 25000], [9, 24, 30000], [10, 8, 25000], [10, 22, 25000]];
    tk.forEach(([m, dd, a], i) => E.put({ ...base, id: 't' + i, ts: d(2026, m, dd), item: 'thekedar', amount: a, cash: i % 2 ? a : 10000, online: i % 2 ? 0 : a - 10000, vendor: 'Ramesh Thekedar', contactId: 'c2', note: i === 5 ? 'slab work' : '' }));
    E.put({ ...base, id: 'o1', ts: d(2026, 10, 12), item: null, amount: 800, cash: 800, online: 0, note: 'chai' });
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await page.reload(); await page.waitForSelector('#boot', { state: 'detached' });

  // menus
  await page.click('#m-down-b');
  r.downMenu = await page.$$eval('#m-down .mi b', b => b.map(x => x.textContent));
  await page.screenshot({ path: OUT + '/r1-menu.png' });
  await page.click('#m-info-b');
  r.downClosedWhenInfoOpens = await page.$eval('#m-down', m => m.hidden);
  r.infoBackup = await page.textContent('#lastbackup');
  await page.screenshot({ path: OUT + '/r2-info.png' });
  await page.mouse.click(12, 400); // outside click closes
  r.infoClosed = await page.$eval('#m-info', m => m.hidden);
  await page.click('#m-down-b');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#pdf')]);
  r.pdfFromMenu = dl.suggestedFilename();

  // summary charts
  await page.click('nav [data-go="sum"]');
  await page.waitForTimeout(200);
  r.legend = await page.$$eval('#glegend span', s => s.map(x => x.textContent).join(' | '));
  r.bars = await page.$$eval('#mchart .hit', b => b.length);
  await page.screenshot({ path: OUT + '/r3-sum.png', fullPage: true });
  await page.click('#mchart .hit[data-i="2"]');
  r.tip = await page.$eval('#mchart .tip', t => t.hidden ? 'hidden' : t.innerText.replace(/\n/g, ' / '));
  await page.screenshot({ path: OUT + '/r4-tip.png', clip: { x: 0, y: 380, width: 390, height: 460 } });
  await page.click('#mtoggle');
  r.table = await page.$$eval('#mtable .trow', t => t.map(x => x.innerText.replace(/\n/g, ' ')).slice(0, 3));
  await page.click('#mtoggle');

  // passbook select
  await page.click('nav [data-go="book"]');
  await page.click('#selbtn');
  await page.click('#book .entry >> nth=0');
  r.selOne = await page.textContent('#sel-n');
  // find thekedar 22 Oct (25000) and 8 Oct entries
  const ids = await page.$$eval('#book .entry', b => b.map(x => [x.dataset.id, x.innerText.replace(/\n/g, ' ')]));
  r.firstRow = ids[0][1];
  await page.click('#book .entry >> nth=0'); // unselect
  await page.click('#book .entry[data-id="t5"]');
  await page.click('#book .entry[data-id="t4"]');
  r.selBar = (await page.textContent('#sel-n')) + ' ' + (await page.textContent('#sel-t'));
  await page.screenshot({ path: OUT + '/r5-select.png' });
  await page.click('#sel-share');
  await page.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.src && i.complete && i.naturalWidth > 0 });
  r.receiptSize = await page.$eval('#rc-img', i => [i.naturalWidth, i.naturalHeight]);
  r.hasHistoryOpt = !!(await page.$('#rc-h'));
  await page.screenshot({ path: OUT + '/r6-sheet.png' });
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#rc-save')]);
  await dl2.saveAs(OUT + '/receipt-hist.png'); r.receiptName = dl2.suggestedFilename();
  await page.uncheck('#rc-h');
  await page.waitForTimeout(600);
  const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#rc-save')]);
  await dl3.saveAs(OUT + '/receipt-plain.png');
  await page.click('.sheet .x');
  // mixed selection: add cement entry
  await page.click('#book .entry[data-id="a1"]');
  await page.click('#sel-share');
  await page.waitForTimeout(800);
  r.mixedHasHistoryOpt = !!(await page.$('#rc-h'));
  r.mixedSlipOpt = await page.$eval('#rc-s', x => x.parentElement.textContent.trim()).catch(() => null);
  const [dl4] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#rc-save')]);
  await dl4.saveAs(OUT + '/receipt-mixed.png');
  await page.click('.sheet .x');
  await page.click('#sel-x');
  r.selbarHidden = await page.$eval('#selbar', x => x.hidden);
  // edit sheet share receipt for single entry (cement w/ slip)
  await page.click('#book .entry[data-id="a1"]');
  await page.click('.sheet [data-v="share"]');
  await page.waitForTimeout(800);
  const [dl5] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#rc-save')]);
  await dl5.saveAs(OUT + '/receipt-single.png');
  // dark summary
  await page.evaluate(() => { document.querySelectorAll('.sheet-bg').forEach(x => x.remove()) });
  await page.click('#m-info-b'); await page.click('#theme [data-theme="dark"]'); await page.mouse.click(12, 400);
  await page.click('nav [data-go="sum"]');
  await page.screenshot({ path: OUT + '/r7-sum-dark.png', fullPage: true });
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
