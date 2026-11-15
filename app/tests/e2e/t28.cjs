// P1: passbook search, material bought, due now on Home, cost per sq ft, statement for a period.
const { chromium } = require('playwright');
const { OUT } = require('./env.cjs');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage(); const errors = [], r = {};
  p.on('pageerror', e => errors.push(e.message));
  await p.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
  await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });
  await p.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const tx = db.transaction(['entries', 'contacts', 'meta'], 'readwrite'); const E = tx.objectStore('entries'), C = tx.objectStore('contacts');
    C.put({ id: 'c1', name: 'Sharma Cement', phone: '', createdAt: 1, updatedAt: 1 }); C.put({ id: 'c2', name: 'Ramesh', phone: '', createdAt: 1, updatedAt: 1 }); C.put({ id: 'c3', name: 'Ramu watchman', phone: '', createdAt: 1, updatedAt: 1 });
    const d = (m, dd) => new Date(2026, m - 1, dd, 11).getTime();
    const base = { projectId: pid, createdAt: 1, updatedAt: 1, slipKey: null, note: '', cash: 0, qty: null, unit: null, rate: null };
    E.put({ ...base, id: 'm1', ts: d(9, 10), item: 'cement', qty: 50, unit: 'bag', rate: 290, amount: 14500, online: 14500, vendor: 'Sharma Cement', contactId: 'c1' });
    E.put({ ...base, id: 'm2', ts: d(10, 27), item: 'cement', qty: 50, unit: 'bag', rate: 303, amount: 15150, online: 15150, vendor: 'Sharma Cement', contactId: 'c1', note: 'slip in diary' });
    E.put({ ...base, id: 'm3', ts: d(11, 2), item: 'brick', qty: 1000, unit: 'piece', rate: 6, amount: 6000, online: 6000, vendor: 'Raju Bricks', contactId: null });
    E.put({ ...base, id: 't1', ts: d(10, 5), item: 'thekedar', amount: 100000, online: 100000, vendor: 'Ramesh', contactId: 'c2', dealId: 'd1' });
    E.put({ ...base, id: 't2', ts: d(11, 5), item: 'thekedar', amount: 50000, online: 50000, vendor: 'Ramesh', contactId: 'c2', dealId: 'd1' });
    E.put({ ...base, id: 'l1', ts: d(6, 1), item: 'land', amount: 1800000, online: 1800000, vendor: '', contactId: null });
    tx.objectStore('meta').put([
      { id: 'd1', projectId: pid, contactId: 'c2', item: 'thekedar', title: 'Labour', type: 'calc', fields: [{ label: 'Rate', value: '285', mul: true }, { label: 'Area', value: '7000', mul: true }], deadline: '2026-11-01' },
      { id: 'd2', projectId: pid, contactId: 'c3', item: 'chowkidar', title: 'Watchman salary', type: 'monthly', amount: 9300, start: '2026-10-23', fields: [] }], 'deals');
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' });
  // B6 due now
  r.due = await p.$eval('#duecard', x => x.hidden ? 'hidden' : x.innerText.replace(/\n+/g, ' | '));
  await p.screenshot({ path: OUT + '/p1-due.png' });
  await p.click('#duecard [data-due="d2"]'); r.payPrefill = await p.inputValue('.sheet [data-f="amount"]');
  await p.evaluate(() => [...window.__pe.SHEETS].forEach(s => s.close()));
  // B1 search
  await p.click('nav [data-go="book"]');
  const search = async q => { await p.fill('#bsearch', q); await p.waitForTimeout(100); return [await p.textContent('#b-count'), await p.$$eval('#book .entry', x => x.map(y => y.dataset.id))] };
  r.sCement = await search('cement'); r.sAmount = await search('15,150'); r.sNote = await search('diary'); r.sDeal = await search('labour'); r.sTwo = await search('sharma 303'); r.sNone = await search('xyz');
  r.noneText = await p.textContent('#book');
  await search('');
  // B4 + B8 summary
  await p.click('nav [data-go="sum"]');
  r.materials = await p.$$eval('#materials .trow', x => x.map(y => y.innerText.replace(/\n+/g, ' | ')));
  r.sqftEmpty = await p.textContent('#sqft');
  await p.fill('#sq-a', '7000'); await p.click('#sq-save'); await p.waitForTimeout(300);
  r.sqft = await p.$$eval('#sqft .trow', x => x.map(y => y.innerText.replace(/\n+/g, ' | ')));
  await p.screenshot({ path: OUT + '/p2-sum.png', fullPage: true });
  r.areaSaved = await p.evaluate(() => window.__pe.D.projects[0].area);
  // B10 statement
  await p.click('nav [data-go="people"]'); await p.click('#contacts .crow:has-text("Sharma Cement")');
  await p.click('.sheet [data-p="share"]');
  await p.click('[data-sr="all"]'); r.stAll = await p.$eval('.sheet-bg:last-of-type .sumstrip', x => x.innerText.replace(/\n+/g, ' '));
  await p.click('[data-sr="last"]'); r.stLast = await p.$eval('.sheet-bg:last-of-type .sumstrip', x => x.innerText.replace(/\n+/g, ' '));
  await p.click('[data-sr="month"]'); r.stMonth = [await p.$eval('#st-img', x => x.disabled), await p.textContent('.sheet-bg:last-of-type .body')];
  await p.click('[data-sr="custom"]'); await p.fill('#st-f', '2026-09-01'); await p.dispatchEvent('#st-f', 'change'); await p.fill('#st-t', '2026-09-30'); await p.dispatchEvent('#st-t', 'change');
  r.stCustom = await p.$eval('.sheet-bg:last-of-type .sumstrip', x => x.innerText.replace(/\n+/g, ' '));
  await p.screenshot({ path: OUT + '/p3-statement.png' });
  await p.click('[data-sr="all"]'); await p.click('#st-img');
  await p.waitForFunction(() => { const i = document.querySelector('#rc-img'); return i && i.complete && i.naturalWidth > 0 });
  r.stHistOff = await p.$eval('#rc-h', x => x.checked);
  await p.evaluate(() => [...window.__pe.SHEETS].pop().close());
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('#st-pdf').then(() => p.click('.sheet [data-pp="0"]'))]);
  await dl.saveAs(OUT + '/statement.pdf'); r.pdf = fs.statSync(OUT + '/statement.pdf').size > 1000;
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
