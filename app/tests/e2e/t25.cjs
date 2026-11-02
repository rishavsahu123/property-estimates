// Passbook rows (no words, note highlight, file icons), entry form layout and sticky save, receipt history order and deal share.
const { chromium } = require('playwright');
const { OUT } = require('./env.cjs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errors = [], r = {};
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });
  // seed: one person, 3 payments in a deal on different days, files of several kinds, an old slip photo
  await p.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const c = document.createElement('canvas'); c.width = 60; c.height = 80; c.getContext('2d').fillRect(0, 0, 60, 80);
    const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', .8));
    const tx = db.transaction(['entries', 'slips', 'contacts', 'meta'], 'readwrite');
    const E = tx.objectStore('entries'), S = tx.objectStore('slips');
    S.put(jpg, 's1'); S.put(jpg, 'f1'); S.put(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'f2'); S.put(new Blob(['a,b'], { type: 'text/csv' }), 'f3');
    tx.objectStore('contacts').put({ id: 'c1', name: 'Ramesh', phone: '9893000000', createdAt: 1, updatedAt: 1 });
    const d = (m, dd) => new Date(2026, m - 1, dd, 11).getTime();
    const base = { projectId: pid, createdAt: 1, updatedAt: 1, qty: null, unit: null, rate: null, slipKey: null, contactId: 'c1', vendor: 'Ramesh', item: 'thekedar', cash: 0 };
    E.put({ ...base, id: 'p1', ts: d(10, 5), amount: 10000, online: 10000, note: 'advance', dealId: 'd1', slipKey: 's1' });
    E.put({ ...base, id: 'p2', ts: d(10, 20), amount: 20000, online: 20000, note: '', dealId: 'd1', files: [{ key: 'f2', name: 'bill.pdf', type: 'application/pdf', size: 8 }, { key: 'f3', name: 'list.csv', type: 'text/csv', size: 3 }] });
    E.put({ ...base, id: 'p3', ts: d(11, 1), amount: 30000, online: 30000, note: 'slab work', dealId: 'd1', files: [{ key: 'f1', name: 'photo.jpg', type: 'image/jpeg', size: 900 }] });
    tx.objectStore('meta').put([{ id: 'd1', projectId: pid, contactId: 'c1', item: 'thekedar', title: 'Labour', type: 'fixed', amount: 100000, fields: [] }], 'deals');
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' });

  // 3. passbook rows
  await p.click('nav [data-go="book"]');
  r.rowWords = await p.$$eval('#book .entry .w', x => x.length);
  r.notes = await p.$$eval('#book .entry .rnote', x => x.map(y => y.textContent));
  r.icons = await p.$$eval('#book .entry', x => x.map(y => [...y.querySelectorAll('.fic')].map(i => i.textContent).join('|')));
  r.oldClip = await p.$$eval('#book .clip', x => x.length);
  await p.screenshot({ path: OUT + '/z1-book.png' });
  await p.click('#book .entry[data-id="p3"]');
  r.viewWords = await p.$eval('.sheet .vamt .w', x => x.textContent);
  await p.click('.sheet .x');

  // 4, 5, 6. add form
  await p.click('nav [data-go="add"]');
  r.slipInput = await p.$$eval('#addform [data-f="file"]', x => x.length);
  r.attachLabel = await p.textContent('#addform .slipbtn');
  r.whoOrder = await p.evaluate(() => { const st = document.querySelector('#addform [data-f="vendorSug"]').parentElement; return [...st.children].slice(0, 2).map(x => x.className || x.dataset.f) });
  r.whoRow = await p.evaluate(() => { const a = document.querySelector('#addform [data-f="vendor"]').getBoundingClientRect(), b = document.querySelector('#addform [data-f="phone"]').getBoundingClientRect(); return Math.abs(a.top - b.top) < 2 });
  const saveVisible = async () => p.evaluate(() => { const r = document.querySelector('#addform [data-f="save"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight - 60 });
  r.saveVisibleAtTop = await saveVisible();
  await p.evaluate(() => window.scrollTo(0, 300)); r.saveVisibleMid = await saveVisible();
  await p.screenshot({ path: OUT + '/z2-form.png' });
  // edit an entry with an old slip photo: the slip shows as a file chip
  await p.click('nav [data-go="book"]'); await p.click('#book [data-ra="edit"][data-id="p1"]');
  await p.waitForTimeout(500);
  r.editChips = await p.$$eval('.sheet [data-f="doclist"] .docb', x => x.map(y => y.innerText.replace(/\n+/g, ' ')));
  r.editSaveVisible = await p.evaluate(() => { const s = document.querySelector('.sheet [data-f="save"]').getBoundingClientRect(); return s.bottom <= innerHeight + 1 && s.top > 0 });
  await p.screenshot({ path: OUT + '/z3-edit.png' });
  await p.click('.sheet [data-f="doclist"] [data-rmdoc="slip"]');
  await p.click('.sheet [data-f="save"]'); await p.waitForTimeout(300);
  r.slipRemoved = await p.evaluate(() => window.__pe.D.entries.find(e => e.id === 'p1').slipKey);
  await p.evaluate(() => [...window.__pe.SHEETS].forEach(s => s.close()));

  // 1 + 2. deal share with past payments
  await p.click('nav [data-go="people"]'); await p.click('[data-pt="deals"]'); await p.click('#alldeals [data-ds]');
  const img = async () => { await p.waitForTimeout(1500); await p.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 }); return p.$eval('#rc-img', i => i.naturalHeight) };
  r.histEnabled = await p.$eval('#rc-h', x => !x.disabled);
  if (await p.$eval('#rc-h', x => x.checked)) await p.uncheck('#rc-h');
  const h0 = await img(); await p.check('#rc-h'); const h1 = await img();
  r.histAddsTable = h1 > h0 + 200;
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#rc-save')]); await dl.saveAs(OUT + '/z4-receipt.png');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
