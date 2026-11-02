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
- `src/state.ts` app state (`AS`: lookups, current view, visible entries), loading and saving
- `src/features/*` one file per screen or job: entry-form, passbook, people, deals, summary, receipt, export, backup, catalog, projects, trash, home, files
- `src/ui/*` dom helpers, sheets and confirm box, rows, top bar
- `src/app/boot.ts` start-up; `src/app/nav.ts` bottom tabs
- Screen modules still carry `// @ts-nocheck`; each is converted to strict TypeScript one at a time (types in `src/types.ts`)
- `src/sw.template.js` offline cache; version and file list filled in at build
- `public/` icons, manifest, ExcelJS and jsPDF (loaded only when exporting)
