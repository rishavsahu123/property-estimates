// Backup v4: one .zip (data.json + every photo/file as the real file + README), date and time in names,
// settings come back on a fresh phone, optional backup password (encrypted .pebackup), old .json still restores.
const { chromium } = require('playwright');
const { OUT, readBackup } = require('./env.cjs');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const errors = [], r = {};
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' }); return p;
  };
  const p = await mk();
  await p.evaluate(async () => {
    const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab', 2); q.onsuccess = () => res(q.result) });
    const pid = (await new Promise(res => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result) }))[0].id;
    const c = document.createElement('canvas'); c.width = 400; c.height = 500; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 400, 500);
    const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
    const tx = db.transaction(['entries', 'slips'], 'readwrite');
    tx.objectStore('slips').put(jpg, 's1'); tx.objectStore('slips').put(jpg, 'f1'); tx.objectStore('slips').put(new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'f2');
    const base = { projectId: pid, createdAt: 1, updatedAt: 1, qty: 50, unit: 'bag', rate: 303, contactId: null, note: 'slip in diary', cash: 15150, online: 0, amount: 15150 };
    tx.objectStore('entries').put({ ...base, id: 'a', ts: new Date(2026, 9, 27, 11).getTime(), item: 'cement', vendor: 'Sharma Cement', slipKey: 's1', files: [{ key: 'f1', name: 'bill photo.jpg', type: 'image/jpeg', size: 9 }, { key: 'f2', name: 'Registry deed.pdf', type: 'application/pdf', size: 13 }] });
    await new Promise(r => tx.oncomplete = r); db.close();
  });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' });
  // settings to carry over
  await p.click('#m-info-b'); await p.click('#theme [data-theme="dark"]'); await p.mouse.click(12, 700);
  await p.click('#viewseg [data-v="construction"]');
  // 1. plain zip backup
  await p.click('#m-down-b'); const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('#backup')]);
  r.name = d1.suggestedFilename(); await d1.saveAs(OUT + '/bk.zip');
  const bk = readBackup(OUT + '/bk.zip');
  r.zip = { version: bk.version, names: bk.zipNames, prefs: bk.prefs, entries: bk.entries.length };
  r.photoIntact = bk.slips.s1 && bk.slips.s1[0] === 0xff && bk.slips.s1[1] === 0xd8; // real JPEG bytes
  r.pdfIntact = Buffer.from(bk.slips.f2).toString().startsWith('%PDF');
  r.readme = Buffer.from(require('fflate').unzipSync(new Uint8Array(fs.readFileSync(OUT + '/bk.zip')))['README.txt']).toString().split('\n').slice(0, 4);
  r.toastAfter = await p.textContent('.toast').catch(() => '');
  await p.click('#m-info-b'); r.lastBackup = await p.textContent('#lastbackup'); await p.mouse.click(12, 700);
  // 2. restore on a fresh phone: data, photos and settings come back
  const p2 = await mk();
  await p2.setInputFiles('#restorefile', OUT + '/bk.zip'); await p2.waitForSelector('.cdlg');
  r.askFresh = await p2.$eval('.cdlg', x => x.innerText.replace(/\n+/g, ' | ')); await p2.click('.cdlg [data-ok]'); await p2.waitForTimeout(1200);
  r.fresh = { total: await p2.textContent('#h-total'), theme: await p2.evaluate(() => document.documentElement.getAttribute('data-theme')), view: await p2.$eval('#viewseg [aria-pressed="true"]', x => x.dataset.v),
    blobs: await p2.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const keys = await new Promise(res => { const q = db.transaction('slips').objectStore('slips').getAllKeys(); q.onsuccess = () => res(q.result) }); db.close(); return keys.sort() }) };
  // 3. backup password
  await p.click('#m-info-b'); r.bpOff = await p.textContent('#bpsum'); await p.click('#set-bpass');
  await p.fill('#bp-a', 'site2026'); await p.fill('#bp-b', 'site2026'); await p.click('#bp-save'); r.bpNoTick = await p.textContent('#bp-msg');
  await p.check('#bp-ok'); await p.click('#bp-save'); await p.waitForTimeout(200); r.bpOn = await p.textContent('.sheet .body');
  await p.evaluate(() => [...window.__pe.SHEETS].forEach(s => s.close()));
  await p.click('#m-down-b'); const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#backup')]);
  r.encName = d2.suggestedFilename(); await d2.saveAs(OUT + '/bk.pebackup');
  const enc = fs.readFileSync(OUT + '/bk.pebackup'); r.encHeader = enc.slice(0, 6).toString(); r.encNotZip = !(enc[0] === 0x50 && enc[1] === 0x4b);
  r.photoNotVisible = !enc.includes(Buffer.from(bk.slips.s1.slice(0, 64)));
  // restore encrypted on a fresh phone: wrong password, then right one
  const p3 = await mk();
  await p3.setInputFiles('#restorefile', OUT + '/bk.pebackup'); await p3.waitForSelector('#bp-in');
  await p3.fill('#bp-in', 'wrong'); await p3.click('#bp-ok'); await p3.waitForSelector('#bp-in'); r.retry = await p3.textContent('.sheet .pmeta');
  await p3.fill('#bp-in', 'site2026'); await p3.click('#bp-ok'); await p3.waitForSelector('.cdlg'); await p3.click('.cdlg [data-ok]'); await p3.waitForTimeout(1200);
  r.encRestored = await p3.textContent('#h-total');
  // 4. an old v3 .json backup still restores
  const p4 = await mk();
  fs.writeFileSync(OUT + '/old.json', JSON.stringify({ app: 'property-estimates', version: 3, savedAt: 1, projects: [], contacts: [], entries: [{ id: 'o1', ts: Date.now(), item: null, amount: 800, cash: 800, online: 0, vendor: '', note: 'chai', slipKey: null, createdAt: 1, updatedAt: 1 }], slips: {} }));
  await p4.setInputFiles('#restorefile', OUT + '/old.json'); await p4.waitForSelector('.cdlg'); await p4.click('.cdlg [data-ok]'); await p4.waitForTimeout(800);
  r.oldJson = await p4.textContent('#h-total');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
