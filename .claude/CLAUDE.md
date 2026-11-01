# Property Estimates — project notes for Claude

Read this first, then `roadmap.md` in this folder.

## What it is
Offline construction-expense diary (PWA) for Rishav's house project, used on an Android phone.
Hosted on GitHub Pages (repo rishavsahu123/property-estimates), installed from Chrome.
Planned for Google Play / App Store later with a subscription (see roadmap.md).

## Files
- `index.html` — the whole app: HTML, CSS and JS in one file, no framework, no build step.
- `sw.js` — service worker: cache-first for the app shell, network-first for index.html.
  **Bump `const V` on every change to any file** (currently pe-v2.10.2).
- `manifest.webmanifest` — name "Property Estimates", short name "Estimates".
- `exceljs.min.js` (ExcelJS 4.4.0) and `jspdf.umd.min.js` (jsPDF 2.5.2) — loaded lazily, cached by the SW.
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- `old/` — the original Ghar ka Hisaab v1 files (gitignored).

## Data (never lose it)
- IndexedDB name **"ghar-hisaab"**, version **2**. Keep the name and only add stores or fields.
- Stores: `entries` (keyPath id), `slips` (photo blobs, out-of-line key), `projects`, `contacts`,
  `meta` (`catalog` = items, `groups` = groups with kind "construction" | "documents" | null,
  `deals` = agreed prices paid in parts).
- An entry has: id, projectId, ts, item, qty, unit, rate, amount, cash, online, vendor, contactId, note,
  slipKey, createdAt, updatedAt, deletedAt (trash), and optional `others: [{contactId, role}]` for extra people
  (broker, owner, advocate…). Totals count only the main payee (contactId); others are "involved".
  Optional `dealId` links a payment to a deal. Optional `files: [{key,name,type,size}]` are attached documents
  (pdf, office, text, images; no audio or video; 15 MB each), with blobs stored in the `slips` store under `key`.
- A deal has: id, projectId, contactId, item, title, type "calc" | "fixed", `fields: [{label, value, mul}]` the user
  creates (Rate 285, Quantity 7000, Unit sq ft, Brand…), amount (fixed), optional deadline "YYYY-MM-DD", note, closed.
  Agreed = product of number fields with mul=true (calc) or amount (fixed). Old "rate"/"terms" deals are converted
  on load by `normDeal`. Paid = sum of live entries with that dealId; balance = agreed − paid.
- Old v1 data is upgraded on start (`upgradeLegacy`): "other" items become catalog items, vendor names become contacts.
- Backup JSON: app "property-estimates", version 3, includes slips as data URLs. Restore also accepts the old
  "ghar-ka-hisaab" app id.
- localStorage keys: pe-project, pe-view, pe-theme, ghk-mode, ghk-backup.

## TypeScript app (Phase 1, in app/)
- The source of truth is moving to `app/` (see app/README.md). Root index.html/sw.js are the old live JS app until Pages is switched to GitHub Actions.
- Make new changes in `app/src`. Run `npm test`, then `npm run e2e`. Don't bump versions by hand: the build names the SW cache.
- Tests poke state through `window.__pe` (D, SHEETS, dealAgreed).

## Features in place
- v2.10.2: each deal card has "Link existing payments" (`openLinkPays`). Tick or untick payments to put them in or take them out of the deal. It shows this person's payments, or everyone's; a payment already in another deal moves here when ticked.
- v2.10.1: entries made while Construction/Documents is picked get `kind` (used when the item gives none), so they stay in that view. Deleting an entry asks first. Select mode can move many entries to trash, with Undo. Receipts use every payment in the project, whatever the view. The total card is a dark banner, and "Add new entry" has a yellow marker.
- Workflow: change the root index.html, then run `python3 split.py` (cloud scratchpad) to regenerate app/src/legacy/app.ts, app.css and index.html until the screens are split into typed modules.

- v2.10.0: confirm boxes are the app's own `ask(title,msg,{ok,danger})` (Promise<boolean>; no native confirm/alert anywhere; back button and Escape cancel).
- People page has tabs People | Deals (`PTAB`, saved in pe-ptab). Deals tab lists all deals (Open/All), "+ New deal" asks who the deal is with. Contact rows show a "N deals" badge.
- Deal type "monthly" (salary): {amount per month, start, end?}. `salaryCalc` counts day by day per monthly period from start (23 Oct to 22 Nov is month 1), inclusive of today. Earned replaces Agreed; negative balance shows "paid ahead". Pay sheet prefills what is due now.
- Every deal card has Share (receipt of all its payments with Deal summary on), Edit, Delete.
- Passbook filter: Shop or person is a dropdown of every name (with entry counts); picked names show as removable chips.
- Add screen: one box for the amount (with amount in words) and paid-by (Cash / Online / Both, with a linked cash and online split).
  Item picker is one dropdown per group, a date field (today by default), shop or person with 3 quick picks
  (most frequent in the last 10 entries), mobile number, note, slip photo.
- Groups and items: full add, edit and delete in "Edit groups"; each group belongs to Construction or Documents (Unknown until set).
- Top bar: project switcher, All / Construction / Documents view (filters the whole app), and download
  (PDF / Excel / full backup), restore and info menus.
- Passbook: filters sheet with removable tags, sorting, running total, multi-select, then Share receipt (an image with the
  person's history), and PDF of the filtered list. Each row has share / edit / delete icons; tapping a row opens a
  read-only view (share, pencil, delete in the header); the pencil turns it into the form with Save / Cancel.
  Delete moves the entry to trash with Undo.
- People and shops: one list (shows "Balance ₹x" for open deals), and a person sheet (call, WhatsApp, edit, deals with progress,
  + Add deal / Edit deal / + Add payment, statement, show in passbook).
- Deals: thekedar ₹285/sq ft × 7,000 sq ft or civil ₹75,000 fixed. The Add form shows chips: General payment + each deal.
  A deal is auto-picked only when it's clear (one open deal, or one matching the item); otherwise it stays General
  (shows in the passbook but doesn't count against any deal). A new deal can count earlier payments. Receipts show a
  Deal box (agreed / paid till date / balance). Summary has "Deals and balances" with the expected total cost.
- Summary: construction / documents / not-sorted totals, group share bar, monthly stacked chart, cash vs
  online, by item.
- Trash, multiple projects, light and dark mode, Indian rupee formatting.

## Navigation rule (important)
- Never move the user to another tab after an action. Actions open panels (`openSheet`) on top; every panel sets
  `s.refresh` and `emit()` redraws open panels in place (scroll kept). Payments from a person or deal use
  `openPaySheet({deal|contact})`. The only tab switch is the explicit "Show in passbook".
- The phone back button closes the top panel (history state per panel); Escape does the same on desktop.

## Style
Fonts Hind (text) and Teko (numbers). Sage-paper background, navy ink, construction-yellow accent, hazard stripe.
Mobile-first, simple, modern (rounded cards, no underlined links, pill buttons). Chart colours follow the
validated categorical palette, with the slot picked by the group's position.

## How we work
- Test locally: `python3 -m http.server 8080` in this folder, open http://localhost:8080.
- After changes: check for JS errors (headless Chromium tests), bump the SW version, then
  `git add . && git commit && git push origin main`.
- Don't use `git checkout`, `git restore` or `git stash` on uncommitted work.
- Receipts never show "made on" dates or app branding (old entries are often added later).
