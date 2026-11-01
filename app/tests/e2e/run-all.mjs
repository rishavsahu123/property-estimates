// Runs every end-to-end script against the built app (npm run build first).
// Usage: node tests/e2e/run-all.mjs [t05 t13 ...]
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const { DIST, SERVE, OUT, FIX } = createRequire(import.meta.url)("./env.cjs");
if (!existsSync(join(DIST, "index.html"))) { console.error("No build found. Run: npm run build"); process.exit(1); }

const fresh = () => { rmSync(SERVE, { recursive: true, force: true }); cpSync(DIST, SERVE, { recursive: true }); };
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true }); fresh();

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = normalize(join(SERVE, p));
  if (!f.startsWith(SERVE) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(f));
}).listen(8090);

// tests that start from an older version of the app on the same address
const BEFORE = { t01: () => cpSync(join(FIX, "index-v1.html"), join(SERVE, "index.html")) };
// tests that click Cancel themselves; the rest get the confirm box accepted automatically
const OWN_DIALOGS = new Set(["t21", "t22", "t23"]);

const pick = process.argv.slice(2);
const tests = readdirSync(here).filter(f => /^t\d+\.cjs$/.test(f)).sort().filter(f => !pick.length || pick.includes(f.replace(".cjs", "")));
let failed = 0;
for (const f of tests) {
  const name = f.replace(".cjs", "");
  fresh(); BEFORE[name]?.();
  const args = OWN_DIALOGS.has(name) ? [join(here, f)] : ["-r", join(here, "pw-patch.cjs"), join(here, f)];
  // async on purpose: the test server runs in this same process
  const r = await new Promise(res => {
    const c = spawn(process.execPath, args, { cwd: OUT }); let stdout = "", stderr = "";
    const t = setTimeout(() => c.kill(), 180000);
    c.stdout.on("data", d => stdout += d); c.stderr.on("data", d => stderr += d);
    c.on("close", status => { clearTimeout(t); res({ status, stdout, stderr }); });
  });
  const out = r.stdout + r.stderr;
  let errs = [];
  try { errs = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).errors || []; } catch { /* not JSON */ }
  errs = errs.filter(e => !/ERR_FAILED|ERR_TUNNEL|ERR_INTERNET_DISCONNECTED|fonts/.test(e));
  const ok = r.status === 0 && !errs.length;
  if (process.env.PE_SHOW) console.log(r.stdout);
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : "\n" + (errs.join("\n") || out.split("\n").filter(l => /FAIL|Error/.test(l)).slice(0, 4).join("\n"))}`);
}
server.close();
console.log(failed ? `\n${failed} of ${tests.length} failed. Screenshots and files: ${OUT}` : `\nAll ${tests.length} passed.`);
process.exit(failed ? 1 : 0);
