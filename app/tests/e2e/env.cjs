// Paths shared by the end-to-end scripts. run-all.mjs serves SERVE at http://localhost:8090/.
const path = require("path");
const root = path.resolve(__dirname, "../..");
module.exports = {
  DIST: path.join(root, "dist"),
  SERVE: process.env.PE_SERVE || path.join(root, "tests/.serve"),
  OUT: process.env.PE_OUT || path.join(root, "tests/.out"),
  FIX: path.join(__dirname, "fixtures"),
};
// Pick an item through the "What was it for?" picker (replaces the old group dropdowns).
module.exports.pickItem = async (page, key, root = '#addform') => {
  if (!key) { await page.click(`${root} [data-f="clearItem"]`); return; }
  await page.click(`${root} [data-f="itemBtn"]`);
  if (key.startsWith('__new:')) { await page.click(`.sheet [data-newitem="${key.slice(6)}"] >> nth=-1`); return; }
  if (key.startsWith('label:')) { await page.click(`.sheet .pk-i:has-text("${key.slice(6)}")`); return; }
  await page.click(`.sheet [data-pick="${key}"]`);
};
// group headings and item keys the picker offers (opens and closes it)
module.exports.pickerGroups = async (page, root = '#addform') => {
  if (await page.$eval(`${root} [data-f="itemBtn"]`, b => b.disabled)) return [];
  await page.click(`${root} [data-f="itemBtn"]`);
  const g = await page.$$eval('.sheet .pk-g', x => x.map(y => y.textContent.replace(/\s*Unknown$/, '').trim()));
  const items = await page.$$eval('.sheet [data-pick]', x => x.map(y => y.dataset.pick));
  await page.evaluate(() => { const s = [...window.__pe.SHEETS].pop(); s && s.close(); });
  return Object.assign(g, { items });
};
