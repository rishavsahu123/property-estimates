import { defineConfig, type Plugin } from "vite";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
// Every build gets a new cache name, so phones always pick up the update (no more bumping V by hand).
const VERSION = `pe-v${pkg.version}-${Date.now().toString(36)}`;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? listFiles(p) : [p]; });
}

/** Writes dist/sw.js with the build version and every file of the build in the offline cache. */
function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "pe-service-worker",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = listFiles(outDir).map(p => "./" + relative(outDir, p).split("\\").join("/"))
        .filter(f => f !== "./sw.js" && !f.endsWith(".txt") && !f.endsWith(".map"));
      const shell = ["./", ...files.sort()];
      const src = readFileSync(new URL("./src/sw.template.js", import.meta.url), "utf8")
        .replace("__VERSION__", VERSION).replace("__SHELL__", JSON.stringify(shell));
      writeFileSync(join(outDir, "sw.js"), src);
    },
  };
}

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { target: "es2020", sourcemap: false, assetsInlineLimit: 0 },
  plugins: [serviceWorker()],
  server: { port: 5173 },
  preview: { port: 8090 },
});
