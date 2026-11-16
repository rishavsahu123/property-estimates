# Property Estimates: future plan (what is still pending)

Written 15 Nov 2026, after v2.13.0 (Drive backup). This is separate from `roadmap.md` (business model, stores, pricing) and `production-plan.md` (phases). When asked "what is pending", start from this file and keep it up to date: tick items off here and add them to the done log in `improvements.md`.

Billing (Phase 3) and the Play Store release are tracked in `production-plan.md`. This file lists everything else.

## 1. Finish what we started
- [ ] **Type-check the rest of the code:** 19 screen files still carry `// @ts-nocheck`. Already strict: lib/*, data/db, types, features/drive. Convert one group at a time:
  1. state + deals
  2. entry-form, passbook, people
  3. summary, receipt, export, backup, catalog, projects, trash, home, files, ui/*, app/*
- [ ] **Stricter app tests:** most e2e scripts only check that nothing crashes. Turn them into Playwright tests that assert numbers and texts, so a wrong total fails the GitHub deploy.
- [ ] **Backup reminder (B15):** if not signed in to Drive and no backup file has been saved for 7 days, show a gentle banner on Home ("Save a backup · Turn on Drive backup").
- [x] **Encrypted backups:** done in v2.14.0 (option A, backup password, for both file and Drive). See section 6.

## 2. Needed before launch (not billing)
- [ ] **Privacy policy and terms pages:** draft both, host them on GitHub Pages, and link them from Settings → About.
- [ ] **Publish the Google sign-in screen:** in Google Auth Platform, go from Testing to Published. Needs the privacy page, an app logo and the home page link. drive.file is non-sensitive, so it gets a light brand check only.
- [ ] **Store listing:**
  - 512 px icon
  - 1024×500 feature graphic
  - phone screenshots
  - short and full descriptions
  - Data safety form
  - content rating
- [ ] **Testers:** with a Personal Play account, 12 testers stay in a closed test for 14 days. An Organization account doesn't need this.
- [ ] **Android sign-in client:** in Google Cloud, create an Android OAuth client with package `com.hurdlelabs.propertyestimates` and the SHA-1 from Play Console → App signing.
- [ ] **Owner access:** the developer's own Gmail always gets Royal (built with Phase 3). Add license testers in Play Console.

## 3. P2 features (next most useful)
- [ ] **B2** Duplicate a payment ("same as last time": person, item, rate; today's date).
- [ ] **B3** Month headers in the passbook with each month's total.
- [ ] **B5** Budget per group, with a spent-vs-budget bar (amber at 80%, red when over).
- [ ] **B11** Hindi / English switch for receipts.
- [ ] **B18** A "+" next to each person in the People list to add a payment quickly.

## 4. P3 features (later)
- [ ] **B7** Advance or credit given to a shop, settled against later bills.
- [ ] **B9** In-app payment reminders (for example, pay the watchman on the 23rd).
- [ ] **B12** QR code on receipts (total, date, app).
- [ ] **B13** Material received vs paid (ordered 50, received 48).
- [ ] **B16** App lock (fingerprint or PIN).
- [ ] **B17** Swipe on passbook rows (left: delete, right: share).
- [ ] **B19** Bigger text setting.
- [ ] Recurring payments (monthly chowkidar and similar). Monthly salary deals already cover the main case.
- [ ] Hindi for the app screens (not only receipts).
- [ ] Photos of the handwritten diary: match how entries are really recorded (from the original roadmap).

## 5. Future roadmap (after the Play launch)
- [ ] **Website payments** with Razorpay (about 3.5% fee vs 15% on Play), once Play earns money. Needs Razorpay KYC, a Cloudflare Worker for licences and webhooks, and a `.in` domain.
- [ ] **iPhone app** ($99/year Apple developer account, StoreKit billing).
- [ ] **Organization account:** if the app starts on a Personal account, transfer it to a "Hurdle Labs" Organization account once the business is registered (Udyam + D-U-N-S). Apps, users, reviews and subscriptions move with it.
- [ ] **Release process:**
  - preview link (branch deploy) before each update goes live
  - changelog
  - local error log in Settings that you can copy and send

## 6. Backup encryption (done in v2.14.0: option A)
Also done in 2.14.0: backups are a .zip with every photo and file as the real file, and backup times show date and time.

Today a backup is a plain JSON file in the user's own Google Drive:
- Other apps can't read it, because the app uses drive.file.
- Strangers can't see it either.
- Anyone who can open the user's Google account can open the file, and Google stores it unencrypted from our side.

Options:
- **A. Backup password (recommended, like WhatsApp's encrypted backup):**
  - The user sets a password once.
  - Backups are encrypted on the phone (AES-256-GCM, with the key made from the password by PBKDF2 or Argon2) before upload.
  - Only the app plus that password can open them.
  - Trade-off: **a forgotten password means the backup can't be opened**, and no one, including us, can recover it.
  - Optional, off by default, with a clear warning. Also offer it for the local backup file.
- **B. Hidden key inside the app:** not real protection, because anyone can read the app's code. Rejected.
- **C. Keep plain JSON** (current): simplest, and restorable anywhere, even by hand.
