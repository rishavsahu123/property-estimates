const { chromium } = require('playwright');
const { OUT, SERVE, DIST, FIX } = require('./env.cjs');
(async () => {
  const browser = await chromium.launch();
  for (const dark of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
    const page = await ctx.newPage(); page.on('pageerror', e => console.log('ERR', e.message));
    await page.goto('http://localhost:8090/?t=' + Date.now()); await page.waitForSelector('#boot', { state: 'detached' });
    await page.fill('#addform [data-f="amount"]', '25000'); await page.click('#addform [data-mode="both"]'); await page.fill('#addform [data-f="online"]', '15000');
    await page.focus('#addform [data-f="online"]');
    const b = await page.$('#addcard'); const box = await b.boundingBox();
    await page.screenshot({ path: `p-${dark ? 'dark' : 'light'}.png`, clip: { x: 0, y: box.y, width: 390, height: 460 } });
    await ctx.close();
  }
  await browser.close();
})();
