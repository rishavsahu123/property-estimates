const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch(); const r = {}, errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
  const F = n => `#addform [data-f="${n}"]`;
  const count = () => page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('ghar-hisaab'); q.onsuccess = () => res(q.result) }); const n = await new Promise(res => { const q = db.transaction('slips').objectStore('slips').count(); q.onsuccess = () => res(q.result) }); db.close(); return n });
  await page.fill(F('amount'), '126000'); await page.selectOption('#addform select[data-g="land"]', 'registry'); await page.fill(F('vendor'), 'Adv. Jain');
  await page.setInputFiles(F('docs'), [
    { name: 'Sale deed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') },
    { name: 'Agreement.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.alloc(3000, 1) },
    { name: 'call.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') },
    { name: 'site.mp4', mimeType: 'video/mp4', buffer: Buffer.from('x') }]);
  r.toast = await page.textContent('.toast');
  r.chips = await page.$$eval('#addform [data-f="doclist"] .dn', d => d.map(x => x.textContent));
  r.blobsBeforeSave = await count();
  await page.screenshot({ path: 'f1-form.png', fullPage: true });
  await page.click(F('save')); await page.waitForTimeout(400);
  r.blobsAfterSave = await count();
  r.recentClip = await page.$eval('#recent .clip', c => c.textContent);
  // view
  await page.click('nav [data-go="book"]'); await page.click('#book .entry');
  r.viewFiles = await page.$$eval('.sheet .docs .dn', d => d.map(x => x.textContent));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.sheet .docs .docb >> nth=0')]); r.opened = dl.suggestedFilename();
  await page.screenshot({ path: 'f2-view.png' });
  // edit: remove one file then cancel -> still 2; then remove + save -> 1
  await page.click('.sheet [data-v="edit"]'); await page.click('.sheet [data-rmdoc] >> nth=1'); await page.click('.sheet [data-f="cancel"]');
  r.afterCancel = await page.$$eval('.sheet .docs .dn', d => d.length);
  await page.click('.sheet [data-v="edit"]'); await page.click('.sheet [data-rmdoc] >> nth=1'); await page.click('.sheet [data-f="save"]'); await page.waitForTimeout(400);
  r.afterRemove = [await page.$$eval('.sheet .docs .dn', d => d.map(x => x.textContent)), await count()];
  await page.click('.sheet [data-v="share"]'); await page.waitForTimeout(700);
  r.opts = await page.$$eval('.sheet .rcopt', l => l.map(x => `${x.querySelector('input').checked ? '[x]' : '[ ]'}${x.querySelector('input').disabled ? '(off)' : ''} ${x.querySelector('.check').innerText} | ${x.querySelector('.tipi').dataset.tip}`));
  await page.click('.sheet .rcopt:nth-child(2)'); r.tipShown = await page.$eval('.sheet .rcopt:nth-child(2) .tipi', t => t.classList.contains('show'));
  await page.screenshot({ path: 'f3-share.png' });
  await page.evaluate(() => document.querySelectorAll('.sheet-bg').forEach(x => x.remove()));
  // filter attachments
  await page.click('#openfilters'); await page.click('.sheet [data-fs="yes"]'); r.filterBtn = await page.textContent('.sheet [data-w="apply"]'); await page.click('.sheet .x');
  // backup + restore elsewhere
  await page.click('#m-down-b'); const [b] = await Promise.all([page.waitForEvent('download'), page.click('#backup')]); await b.saveAs('f-backup.json');
  const bk = JSON.parse(fs.readFileSync('f-backup.json')); r.backup = { files: bk.entries[0].files.map(x => x.name), blobs: Object.keys(bk.slips).length };
  const p2 = await (await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true })).newPage(); p2.on('dialog', d => d.accept()); p2.on('pageerror', e => errors.push('p2 ' + e.message));
  await p2.goto('http://localhost:8090/?t=' + Date.now()); await p2.waitForSelector('#boot', { state: 'detached' });
  await p2.setInputFiles('#restorefile', 'f-backup.json'); await p2.waitForTimeout(1200);
  await p2.click('nav [data-go="book"]'); await p2.click('#book .entry');
  const [d2] = await Promise.all([p2.waitForEvent('download'), p2.click('.sheet .docs .docb')]); await d2.saveAs('f-restored.pdf'); r.restoredFile = [d2.suggestedFilename(), fs.readFileSync('f-restored.pdf', 'utf8')];
  // trash + delete forever removes blobs
  await page.click('#book .ract [data-ra="del"]'); await page.waitForTimeout(300); await page.click('#trashlink'); await page.click('#trash [data-purge]'); await page.waitForTimeout(400);
  r.blobsAfterPurge = await count();
  // excel builds
  await page.click('#m-down-b'); const [x] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#excel')]).catch(e => [null]); r.excel = x ? x.suggestedFilename() : 'no entries (expected after purge)';
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
