// Long press starts select mode; PDF with and without photos (menu and selection).
const { chromium } = require('playwright');
const { OUT } = require('./env.cjs');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage(); const errors = [], r = {};
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });
  await p.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 600, 800);
    const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
    const tx = db.transaction(['entries', 'slips'], 'readwrite');
    tx.objectStore('slips').put(jpg, 's1');
    const base = { projectId: pid, createdAt: 1, updatedAt: 1, qty: null, unit: null, rate: null, contactId: null, vendor: 'Raju', item: 'brick', note: '', cash: 6000, online: 0, amount: 6000 };
    tx.objectStore('entries').put({ ...base, id: 'a', ts: Date.now() - 3e8, slipKey: 's1' });
    tx.objectStore('entries').put({ ...base, id: 'b', ts: Date.now() - 2e8, slipKey: null });
    tx.objectStore('entries').put({ ...base, id: 'c', ts: Date.now() - 1e8, slipKey: null });
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' });
  await p.click('nav [data-go="book"]');
  r.bookPdfGone = !(await p.$('#bookpdf'));
  // long press on entry b
  const box = await p.$eval('#book .entry[data-id="b"]', x => { const r = x.getBoundingClientRect(); return [r.x + 60, r.y + 20] });
  await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await p.waitForTimeout(200);
  r.selmode = await p.$eval('#selbar', x => !x.hidden);
  r.selected = await p.$$eval('#book .entry[aria-pressed="true"]', x => x.map(y => y.dataset.id));
  r.noViewOpened = (await p.$$('.sheet')).length === 0;
  // a short tap now adds to the selection
  await p.click('#book .entry[data-id="a"]');
  r.selected2 = await p.$$eval('#book .entry[aria-pressed="true"]', x => x.map(y => y.dataset.id).sort());
  await p.screenshot({ path: OUT + '/lp1.png' });
  // PDF of the selection, with photos
  await p.click('#sel-pdf');
  r.pdfOpts = await p.$$eval('.sheet [data-pp]', x => x.map(y => y.textContent + (y.disabled ? ' (off)' : '')));
  const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('.sheet [data-pp="1"]')]);
  await d1.saveAs(OUT + '/sel-photos.pdf');
  await p.click('#sel-x');
  // a short tap outside select mode opens the entry
  await p.click('#book .entry[data-id="c"]'); r.tapOpens = (await p.$$('.sheet')).length === 1;
  await p.click('.sheet .x');
  // menu: PDF report vs PDF with photos
  const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('#m-down-b').then(() => p.click('#pdf'))]); await d2.saveAs(OUT + '/report.pdf');
  await p.waitForTimeout(800);
  const [d3] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('#m-down-b').then(() => p.click('#pdf-photos'))]); await d3.saveAs(OUT + '/photos.pdf');
  r.sizes = { report: fs.statSync(OUT + '/report.pdf').size, photos: fs.statSync(OUT + '/photos.pdf').size, sel: fs.statSync(OUT + '/sel-photos.pdf').size };
  r.photosBigger = r.sizes.photos > r.sizes.report * 1.5;
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
