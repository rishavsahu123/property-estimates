# Property Estimates (app)

Offline construction expense tracker. Vite + TypeScript, data stays on the phone (IndexedDB).

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run e2e        # build, then 22 browser tests on the built app
npm run build      # dist/ — GitHub Actions publishes this to Pages
```

- `src/types.ts` data shapes (keep backward compatible)
- `src/lib/` typed pure logic: format, deals (incl. monthly salary), constants
- `src/data/db.ts` IndexedDB ("ghar-hisaab" v2 — never rename)
- `src/legacy/app.ts` screens moved from v2.10, being converted to strict TS feature by feature
- `src/sw.template.js` offline cache; version and file list filled in at build
- `public/` icons, manifest, ExcelJS and jsPDF (loaded only when exporting)
