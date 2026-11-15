# Property Estimates — Production Plan

Status: **approved 2 Nov 2026.** Phase 0 done. Phase 1 in progress (milestone 1 done, see below).

## Goals

1. Same app, rewritten in TypeScript, so it is safer to change and easier to test.
2. Optional Google sign-in with Google Drive backup that works like WhatsApp's backup, so data survives a phone reset.
3. A subscription: 7-day free trial, then ₹49/month autopay. The app keeps working offline until the paid period ends, then becomes read-only, even with no internet.
4. Your existing data must never be lost. The new app opens the same database, at the same web address, with the same data shape.

## Ground rules (every phase)

- Take a backup before every release: copy the app into `old/` and export a data backup from the phone.
- Same IndexedDB name (`ghar-hisaab`) and version (2). Any schema change goes through a migration with a test.
- Same URL (`rishavsahu123.github.io/property-estimates`), so the installed app on your phone updates itself and nothing needs reinstalling.
- A phase is done only when all tests pass and you have checked it on your phone.
- I never create accounts or enter keys or passwords. You do those steps, and I give exact instructions.

---

## Phase 0 — Backup ✅ done

- Copied the current app into `old/js-v2.9.2/`. The md5 of index.html matches the live file.
- **Your part:**
  1. On the phone: ⬇ menu → Backup, then save the JSON file somewhere safe (Drive or WhatsApp to yourself).
  2. In the folder:
     ```
     git add . && git commit -m "v2.9.2 JS final" && git tag v2.9.2-js && git push --tags
     ```

## Phase 1 — TypeScript rewrite (no new features)

**What changes for you:** nothing visible. Same screens, same data, and the app should load faster.

**How:**

- Tooling: Vite + TypeScript (strict), Vitest for logic tests, Playwright for screen tests (the 20 existing tests are ported into the repo).
- Folder layout:
  ```
  src/
    types.ts            Entry, Contact, Deal, Group, Item, Project
    lib/                money, numVal, inWords, dates, ids
    data/               db.ts (IndexedDB), store.ts, migrate.ts, backup.ts
    features/           entry form, passbook, people, deals, summary,
                        receipt, export (excel/pdf), groups/items
    ui/                 sheets stack, menus, toast, charts
    styles/             tokens.css + parts
  public/               icons, manifest
  tests/                unit + e2e
  ```
- The service worker version is set automatically on each build, so no more forgetting to bump `V`.
- ExcelJS and jsPDF still load only when you export.
- Deploy: a GitHub Action builds the app and publishes it to Pages on every push to `main`.
  - **Your part:** once, set GitHub → Settings → Pages → Source to "GitHub Actions".
- Order of work: types and lib first, then the data layer (tested against a real old database and old backup files), then screens one by one, comparing screenshots with the JS version.

**Exit check:**
- All tests pass on the built app.
- A real backup from your phone restores with the same totals.
- The old installed PWA updates to the new one without losing data.

## Phase 2 — Google sign-in + Drive backup

**What you get:** Settings → "Google account & backup".

- Sign-in is optional. The app works fully without it, except for the subscription (Phase 3).
- **Drive backup is on by default once signed in.** You can turn it off, and then nothing is uploaded.
- Automatic backup: **Daily** (default) / Weekly / Monthly / Only when I tap / Off.
- Other controls:
  - **Back up now** button.
  - **Last backup** time and size.
  - **Wi-Fi only** switch (off by default).
- Backups go to a visible Drive folder named **"Property Estimates backups"** that holds the latest 3 backups (older ones are removed). Each backup is one file with entries, contacts, deals, groups, and all photos and attachments.
- **Restore on a new phone:** sign in, and the app finds the latest backup and offers "Restore 12 Oct 2026, 4.2 MB?".
- Honest limit: a web app can't run in the background when closed. "Daily" means it backs up the first time you open the app after 24 hours. It runs quietly and you keep working.

**How:**

- Google Identity Services (token flow). Permissions requested: name, email, and `drive.file`, which can **only see files this app created**, not the rest of your Drive.
- `drive.file` is a non-sensitive scope, so Google's verification is the basic free one (no security audit).
- **Cost: ₹0.** The Drive API is free, and backups use each user's own 15 GB.
- **Your part (about 20 minutes, I'll give click-by-click steps):**
  1. Google Cloud project, then enable the Drive API.
  2. OAuth consent screen: app name, logo, privacy policy link, your email.
  3. Web OAuth client ID with allowed origins `https://rishavsahu123.github.io` and `http://localhost:5173`.
  4. Send me the **client ID** (it's public, not a secret).

**Exit check:**
- Back up on one browser, restore on a fresh one, and totals and photos match.
- Turn backup off, and confirm no upload happens.
- The schedule is respected, and the app still works offline.

## Phase 3 — Subscription (Razorpay now, Play Billing later)

**Model (decided 15 Nov 2026):** Free / Basic / Royal / Custom add-ons. The full table is in `roadmap.md` → Business model.

**What you get:**

- New users get **30 days of Royal free**. No card is needed.
- **Free:** add payments (edit or delete within 10 minutes of saving), passbook, search, summary, local backup and restore.
- **Basic (₹29 a month):** Free, plus edit and delete, receipts, PDF and Excel, attachments.
- **Royal (₹59 a month or ₹499 a year):** everything, including deals and salary, Drive sync, multiple projects and future features.
- **Custom:** add-ons one by one, costlier in total than Royal.
- Every feature is visible. Locked ones show a 🔒 that opens Plans. There are no pop-ups or notifications about plans.
- Data is never locked or deleted. Local backup and restore stay free.
- Paid plans work **fully offline** until the paid date plus 3 days of grace.
- Cancel anytime; the plan stays until the end of the paid period.

**How it works:**

```
Phone app ──sign in──▶ Google ──ID token──▶ Our small server (Cloudflare Worker, free)
                                                │  creates Razorpay subscription
Phone app ◀──Razorpay checkout (UPI/card)───────┘
Razorpay ──webhook "charged"──▶ Server ──▶ signs a licence:
           { email, plan, features[], paidUntil, issuedAt }  (digital signature)
Phone app stores the licence and checks the signature OFFLINE with a built-in public key.
```

- **Trial:**
  - Tied to the Google account (stored on the server), so reinstalling doesn't give another free trial.
  - The trial start date also goes inside backups, so restoring old data never restarts the trial.
  - In the Android app, a hash of `ANDROID_ID` is stored with the trial, so a second Gmail on the same phone doesn't get another trial.
- **Offline rule:** `can(feature) = licence.features includes feature && now <= paidUntil + 3 days` (the trial works the same way, with all features). The licence can't be edited, because the signature check fails.
- **Clock trick guard:** the app remembers the latest time it has ever seen. Setting the phone date backwards doesn't extend access.
- **Renewal:** whenever the app is online, it quietly fetches a fresh licence. Each month's autopay extends `paidUntil`.
- **Server endpoints:**
  - `/session` checks Google sign-in.
  - `/subscribe` starts the trial or plan.
  - `/webhook` receives Razorpay events.
  - `/license` returns the latest licence.
  - `/cancel` cancels the subscription.
- All gating goes through one function: `entitlement.can(feature)`, which covers trial, premium, grace and free.
- **Legal pages** (needed by Razorpay and Google): Privacy policy, Terms, Refund/cancellation, Contact. I draft them; you review them.

**Your part:**

1. **Razorpay account plus KYC** (PAN, bank account; usually 1–3 days). Turn on Subscriptions, create plans for Basic ₹29 a month, Royal ₹59 a month and ₹499 a year, and one plan for each add-on (the 30-day trial is handled by our server), and give me the **test** key ID. The secret goes only into Cloudflare, never into the app.
2. **Cloudflare account** (free). I give you the Worker code and a one-page setup guide. You paste the secrets into Cloudflare settings.
3. Test with Razorpay **test mode** first, then switch to live keys.

**What I can and can't test:** I build everything with fake Google and Razorpay responses and test all the cases (trial, paid, expired, offline, clock rollback, cancel). You do the real end-to-end run in test mode.

**Later (Play Store):**
- Wrap the app with Capacitor and swap Razorpay for Google Play Billing inside the Android app. Google requires this for in-app subscriptions.
- The licence and read-only logic stays the same; only the "pay" step changes.

## Phase 4 — Release & hardening

- A `preview` branch deploys to a test URL first. You try it on your phone, then it merges to `main`.
- Each release gets:
  - A version number and changelog.
  - The in-app "New version ready · Reload" prompt.
  - An automatic backup before migrations.
- Error log: a local-only list of recent errors in Settings, which you can copy and send me. No tracking service.
- Update `.claude/CLAUDE.md` and the roadmap after each phase.

---

## Order & rough effort

| Phase | What | Needs from you | Effort (my side) |
|---|---|---|---|
| 0 | Backup | git tag + data backup | done |
| 1 | TypeScript rewrite | Pages → Actions | biggest: several sessions |
| 2 | Google + Drive backup | Google Cloud client ID | 1–2 sessions |
| 3 | Subscription | Razorpay KYC + keys, Cloudflare | 2–3 sessions |
| 4 | Release process | test on phone | ongoing |

You can start the Razorpay KYC and Google Cloud setup now, in parallel with Phase 1, since KYC takes days.

## Decisions taken

- Payments: Razorpay now, Play Billing later.
- When not paying: on Free, editing or deleting is allowed only within 10 minutes of saving. All features stay visible with a 🔒. No nagging (15 Nov 2026).
- Identity: Google sign-in (optional until the trial ends).
- Drive backup: on by default after sign-in, can be disabled, frequency Daily/Weekly/Monthly/Only when I tap/Off, plus Wi-Fi only.
- Price: 30 days of Royal free, then Free / Basic ₹29 / Royal ₹59 (₹499 a year) / Custom add-ons (decided 15 Nov 2026).

- Drive folder: visible "Property Estimates backups" folder (approved).
- Grace after a missed payment: 3 days (approved).

## Phase 1 progress

- Milestone 1 (2 Nov 2026), done:
  - New project in `app/` (Vite 6 + TypeScript 5 strict, Vitest).
  - Typed core in `src/types.ts`, `src/lib/{format,deals,constants}.ts`, `src/data/db.ts`.
  - Screens moved unchanged into `src/legacy/app.ts` (`@ts-nocheck`).
  - The service worker version and file list are generated at build.
  - 20 unit tests and 22 browser tests (`npm run e2e`) pass on the build.
  - `.github/workflows/deploy.yml` deploys `app/dist` to Pages.
  - The old root files stay live until Pages is switched to "GitHub Actions".
- Milestone 2 (2 Nov 2026), done:
  - Live site switched to the Actions build. Old root files moved to `old/js-v2.10.2/`.
  - `legacy/app.ts` split into 20 modules: state, ui/{dom,sheets,rows,topbar}, features/{deals,entry-form,passbook,people,projects,summary,home,trash,export,receipt,backup,catalog,files}, app/{nav,boot}.
  - All 24 browser tests pass.
- Next milestones:
  1. Remove @ts-nocheck module by module (strict types), starting with state, deals, passbook.
  2. Turn the test scripts into assertion-based Playwright tests.

