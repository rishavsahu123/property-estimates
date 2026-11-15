// Google Drive backup with a fake Google (no real account needed):
// sign in, on by default, back up now, keep latest 3, frequency / off / Wi-Fi, due bar, restore on a fresh phone, sign out.
const { chromium } = require('playwright');
const { OUT } = require('./env.cjs');

// ---- a tiny fake of Google Identity Services + Drive v3 ----
function fakeGoogle() {
  const files = new Map(); let n = 0; const log = [];
  const GIS = `window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:p=>{window.__gisCalls=(window.__gisCalls||0)+1;setTimeout(()=>o.callback({access_token:'tok'+window.__gisCalls,expires_in:3600}),20)}}),revoke:(t,d)=>d&&d()}}};`;
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Location' };
  async function route(r0) {
    const r = { request: () => r0.request(), fulfill: o => r0.fulfill({ ...o, headers: { ...CORS, ...(o.headers || {}) } }) };
    const req = r.request(), url = new URL(req.url()), m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, body: '' });
    if (url.host === 'accounts.google.com') return r.fulfill({ status: 200, contentType: 'text/javascript', body: GIS });
    // the resumable session address is already authorised (like Google's), everything else needs the token
    if (!url.pathname.startsWith('/upload/session/') && !/^Bearer tok\d+$/.test(req.headers()['authorization'] || '')) return r.fulfill({ status: 401, body: '{}' });
    if (url.pathname === '/oauth2/v3/userinfo') return r.fulfill({ json: { email: 'rishav.test@gmail.com', name: 'Rishav' } });
    if (url.pathname === '/drive/v3/files' && m === 'GET') {
      const qy = url.searchParams.get('q'); log.push('list');
      let list = [...files.values()];
      if (/mimeType='application\/vnd.google-apps.folder'/.test(qy)) list = list.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      const par = qy.match(/'([^']+)' in parents/); if (par) list = list.filter(f => (f.parents || []).includes(par[1]));
      list.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
      return r.fulfill({ json: { files: list.map(({ body, ...f }) => f) } });
    }
    if (url.pathname === '/drive/v3/files' && m === 'POST') {
      const meta = JSON.parse(req.postData()); const id = 'f' + (++n);
      files.set(id, { id, ...meta, createdTime: new Date(Date.now() + n * 1000).toISOString() }); log.push('mkdir');
      return r.fulfill({ json: { id } });
    }
    if (url.pathname === '/upload/drive/v3/files' && m === 'POST') {
      const meta = JSON.parse(req.postData()); const id = 'f' + (++n);
      files.set(id, { id, ...meta, createdTime: new Date(Date.now() + n * 1000).toISOString() });
      return r.fulfill({ status: 200, headers: { Location: `https://www.googleapis.com/upload/session/${id}`, 'Access-Control-Expose-Headers': 'Location' }, body: '' });
    }
    if (url.pathname.startsWith('/upload/session/') && m === 'PUT') {
      const id = url.pathname.split('/').pop(), f = files.get(id); f.body = req.postData(); f.size = String(f.body.length); log.push('upload');
      return r.fulfill({ json: { id, size: f.size } });
    }
    const one = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (one && m === 'DELETE') { files.delete(one[1]); log.push('delete'); return r.fulfill({ status: 204, body: '' }); }
    if (one && m === 'GET' && url.searchParams.get('alt') === 'media') return r.fulfill({ status: 200, contentType: 'application/json', body: files.get(one[1]).body });
    return r.fulfill({ status: 404, body: '{}' });
  }
  return { files, log, route };
}

(async () => {
  const b = await chromium.launch();
  const G = fakeGoogle(), errors = [], r = {};
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.route(/accounts\.google\.com|googleapis\.com/, G.route);
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://localhost:8090/?t=' + Date.now()); await p.waitForSelector('#boot', { state: 'detached' });
    return p;
  };
  const p = await mk();
  // some data
  await p.fill('#addform [data-f="amount"]', '15150'); await p.fill('#addform [data-f="vendor"]', 'Sharma Cement'); await p.click('#addform [data-f="save"]'); await p.waitForTimeout(300);
  // settings row
  await p.click('#m-info-b'); r.summaryBefore = await p.textContent('#drivesum');
  await p.click('#set-drive'); r.signedOut = await p.textContent('.sheet .body');
  await p.screenshot({ path: OUT + '/dr1-signin.png' });
  await p.click('#dr-in'); await p.waitForTimeout(1500);
  r.afterSignIn = await p.$eval('.sheet .body', x => x.innerText.replace(/\n+/g, ' | '));
  r.lastShownAfterSignIn = !(await p.textContent('.sheet .body')).includes('Not yet');
  r.firstBackup = { files: [...G.files.values()].map(f => f.name), log: [...G.log] };
  await p.screenshot({ path: OUT + '/dr2-on.png' });
  // back up now 3 more times -> keeps the latest 3 backups + folder
  for (let i = 0; i < 3; i++) { await p.click('#dr-now'); await p.waitForTimeout(700); }
  const inFolder = () => [...G.files.values()].filter(f => f.parents).length;
  r.keptBackups = inFolder();
  r.folderName = [...G.files.values()].find(f => f.mimeType === 'application/vnd.google-apps.folder').name;
  // frequency, wifi, off
  await p.click('[data-fq="weekly"]'); await p.check('#dr-wifi');
  r.state = await p.evaluate(() => JSON.parse(localStorage.getItem('pe-drive')));
  await p.uncheck('#dr-on'); r.offText = await p.textContent('.sheet .hint'); r.nowDisabled = await p.$eval('#dr-now', x => x.disabled);
  const before = G.log.filter(x => x === 'upload').length;
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('pe-drive')); s.last.at = Date.now() - 40 * 864e5; localStorage.setItem('pe-drive', JSON.stringify(s)) });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' }); await p.waitForTimeout(800);
  r.offNoUpload = G.log.filter(x => x === 'upload').length === before;
  r.dueBarWhenOff = await p.$eval('#drivedue', x => x.hidden);
  // on again, overdue: token still valid in this session -> quiet automatic backup on open
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('pe-drive')); s.on = true; s.wifiOnly = false; s.last.at = Date.now() - 40 * 864e5; localStorage.setItem('pe-drive', JSON.stringify(s)) });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' }); await p.waitForTimeout(1500);
  r.autoUploaded = G.log.filter(x => x === 'upload').length === before + 1;
  // token gone (new session) -> due bar with Back up now
  await p.evaluate(() => { sessionStorage.clear(); const s = JSON.parse(localStorage.getItem('pe-drive')); s.last.at = Date.now() - 40 * 864e5; localStorage.setItem('pe-drive', JSON.stringify(s)) });
  await p.reload(); await p.waitForSelector('#boot', { state: 'detached' }); await p.waitForTimeout(800);
  r.dueBar = await p.$eval('#drivedue', x => x.hidden ? 'hidden' : x.innerText.replace(/\n+/g, ' | '));
  await p.screenshot({ path: OUT + '/dr3-due.png' });
  await p.click('#dd-go'); await p.waitForTimeout(1500);
  r.dueBarAfter = await p.$eval('#drivedue', x => x.hidden);
  // fresh phone: sign in -> offered restore of the latest backup
  const p2 = await mk();
  await p2.click('#m-info-b'); await p2.click('#set-drive'); await p2.click('#dr-in');
  await p2.waitForSelector('.cdlg'); r.restoreAsk = await p2.$eval('.cdlg', x => x.innerText.replace(/\n+/g, ' | '));
  await p2.click('.cdlg [data-ok]'); await p2.waitForSelector('.cdlg'); r.restoreAsk2 = await p2.$eval('.cdlg', x => x.innerText.replace(/\n+/g, ' | '));
  await p2.click('.cdlg [data-ok]'); await p2.waitForTimeout(1200);
  r.restoredTotal = await p2.textContent('#h-total');
  // sign out
  await p2.click('#dr-out'); await p2.click('.cdlg [data-ok]'); await p2.waitForTimeout(300);
  r.afterSignOut = (await p2.textContent('.sheet .body')).includes('Sign in with Google');
  r.errors = errors; console.log(JSON.stringify(r, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
