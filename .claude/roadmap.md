# Roadmap — Property Estimates on the app stores

Last updated: 15 Nov 2026 (Play Store first)

## Developer / studio (decided 15 Nov 2026)
- Studio name: **Hurdle Labs** ("apps that remove everyday hurdles"). It is used for the Play developer name, and later the company (proprietorship, then possibly Pvt Ltd).
- One dedicated Gmail (for example hurdlelabs@gmail.com) for Play Console, Google Cloud and RevenueCat, with 2-step verification on.
- Play account type: **Personal** for now (each new app needs a closed test with at least 12 testers for 14 days). Later, an Organization account once the business is registered (it can't be converted, so it would be a new account).
- Before finalising, check: Gmail, hurdlelabs.in/.com, the Play developer name, and an IP India trademark search.

## Where we sell (decided 15 Nov 2026)
- **Now: Google Play Store only**, using **Google Play Billing** (UPI AutoPay and cards, trials, renewals and cancellation are all handled by Google). Purchase checks go through RevenueCat (free up to $2,500 a month of revenue). No Razorpay, no KYC, no payment server.
- **Website (GitHub Pages):** stays live, with the free features; paid features show "Get the app on Play Store".
- **Later (once Play earns money):** website payments with Razorpay (about 3.5% fee vs 15% on Play), Razorpay KYC, a Cloudflare Worker for licences and webhooks, and a `.in` domain. After that, the iPhone app ($99 a year Apple account).
- **Costs now:** $25 one-time Play developer account. Hosting, server, Drive and RevenueCat (to start) are ₹0. The domain is optional.

## Business model (decided 15 Nov 2026; replaces earlier versions)

**Idea:** every feature is visible to everyone. Paid features show a 🔒. Tapping one opens the **Plans** screen. The limits themselves sell the upgrade: no pop-ups, no notifications, no nagging.

- New users get **30 days of Royal free** (no card needed). Then they choose a plan, or stay on Free.

| Feature | Free | Basic ₹29/mo | Royal ₹59/mo (₹499/yr) | Custom add-on (each, per month) |
|---|---|---|---|---|
| Add payments, passbook, search, summary | ✓ | ✓ | ✓ | — |
| Local backup file + restore (own data is never locked) | ✓ | ✓ | ✓ | — |
| Edit and delete payments | within 10 min of saving | ✓ | ✓ | ₹15 |
| Share receipts (with past payments) | — | ✓ | ✓ | ₹15 |
| PDF + Excel export | — | ✓ | ✓ | ₹15 |
| Slip photos and file attachments | — | ✓ | ✓ | ₹15 |
| Deals + monthly salary + linking payments | — | — | ✓ | ₹19 |
| Google Drive auto-sync | — | — | ✓ | ₹19 |
| Multiple projects | — | — | ✓ | ₹15 |
| Future features (budgets, statements, cost per sq ft, due now, Hindi receipts) | — | — | ✓ | — |

Prices are placeholders, open to change before launch.

- **Custom:** pick add-ons one by one. The screen shows a running total and says "Royal is cheaper" once the total passes Royal (all add-ons together are ₹113 vs ₹59). It's shown as one combined monthly total.
- **Free plan rules (decided 15 Nov 2026):**
  - A payment can be **edited or deleted within 10 minutes of saving**, so typos can be fixed.
  - The saved toast says "Saved · You can edit for 10 minutes".
  - After 10 minutes the payment locks: Edit and Delete show a 🔒 that opens Plans.
  - The 10 minutes are counted from the payment's `createdAt`, using the guarded clock, so changing the phone time doesn't extend them.
- **After a plan ends:** nothing is deleted. Everything stays viewable; locked actions show the 🔒 and open Plans.
- **No nagging:** no notifications or pop-ups about plans. The only prompts are the 🔒 on locked features and a quiet "Plan: Free · See plans" line in Settings, plus a small trial-days-left line in Settings during the trial.
- **Store setup:**
  - Subscription products: basic (monthly-29), royal (monthly-59, yearly-499), plus one product for each add-on.
  - The 30-day trial offer is on Royal, for new customers only.
  - Gating goes through `entitlement.can(feature)`, with features: edit, receipts, export, files, deals, drive, projects, future.

## Stopping repeat free trials (uninstall + new Gmail)
- **Web (Razorpay):**
  - The trial belongs to the Google account and is stored on our server.
  - The trial start date also goes inside every backup file. Restoring an old backup carries the old trial date, so the clock doesn't restart.
  - A new Gmail with no old data gets a new trial. That's acceptable, because they start from an empty app.
- **Android app (Play):**
  - Google allows one trial per Google account for each subscription.
  - We add the Android device ID (`ANDROID_ID`, which survives uninstall and reinstall of the same app, and resets only on factory reset). The server stores a hash of it with the trial; a second account on the same phone then gets "Trial already used on this phone".
- **Policy:** no heavy anti-abuse measures. Someone who resets the whole phone to save ₹49 isn't the customer to chase. Keep family members on one phone fair through Play's family sharing later.

## How auto-pay works (handled by the stores, not by us)
- Google Play Billing / Apple StoreKit run the recurring charge, the reminders and cancellation.
  For digital features inside the app, store billing is required.
- In India the recurring charge uses an e-mandate the user approves once (card or, on Google Play,
  UPI AutoPay). The stores handle the RBI rules and the pre-debit notifications.
- Play Store setup: one subscription product with base plans "monthly-49" and "yearly-399", and an offer
  "trial-30d" (free for 30 days, new customers only).
  Turn on the grace period (3–7 days) and account hold so failed payments don't lock people out at once.
- App Store setup: one auto-renewable subscription group with a 1-month subscription at ₹49 and an introductory offer
  of a free trial for 1 month.
- Recommended: RevenueCat (free at the start) to handle trial, renewal, grace period, restore purchase and
  status on both stores with one SDK.

## Phase 1 — Features (now)
- Next: photos of the handwritten diary, so the app matches how entries are really recorded.
- Done: deals (agreed price vs paid, balance due, expected total cost).
- Ideas: material received vs used,
  reminders for pending payments, Hindi language option, app lock (PIN or fingerprint), recurring
  entries (chowkidar monthly).

## Tech decision (Nov 2026)
- Keep the current stack for now: one index.html, plain JavaScript, IndexedDB, service worker. It is fast, fully
  offline, and wraps cleanly with Capacitor, so it doesn't block the store launch.
- Before the store launch (start of Phase 2), move to Vite + TypeScript with the code split into modules
  (storage, deals, receipts, exports, UI), no heavy framework. Benefits: type-checked data model (entries, deals,
  groups), easier changes, smaller files. Keep the same IndexedDB name and data shape.
- Bring the headless-browser tests into the repo (Playwright) and run them on every push (GitHub Actions).
- Production basics already in place (v2.9.0): back button closes panels, "new version ready" reload prompt,
  error safety net, storage usage shown, persistent storage requested, offline cache, backups include all files.

## Phase 2 — Ready for subscription (no payments yet)
- One `entitlement` module with a single function, `can(feature)`, used everywhere features might be gated.
  States: trial · basic · royal · custom (add-ons) · grace · free.
- On Free: add, passbook, search, summary, local backup and restore. Everything else shows a 🔒 that opens Plans.
  Data is never locked.
- Trial banner in the top bar ("5 days of Royal trial left", shown in Settings only) and a settings screen: plan, renew, manage or cancel
  subscription, restore purchase, version, theme, backup reminder, privacy policy, support contact.
- First-run onboarding (3 screens) that explains: data stays on your phone, and you get 30 days of Royal free, then choose Free, Basic, Royal or Custom.
- Privacy policy and terms pages (both stores require them). No account, no tracking.
- App id, for example `in.propertyestimates.app`; store icon, screenshots, feature graphic, short and long descriptions.

## Phase 3 — Wrap and publish
- Wrap the same web code with **Capacitor** (Android and iOS). Keep index.html as the single source.
- Add native pieces: billing plugin (RevenueCat Capacitor SDK), camera for slips, share sheet, file save.
- Check subscription status on each launch when online; cache it for offline use with a grace window
  (for example 7 days) so the app works on site without internet.
- Google Play first (internal testing → closed testing → production), then the App Store. Apple rejects
  thin web wrappers, so offline use, receipts, PDF and the camera must all work natively.

## Phase 4 — Optional later
- Optional sign-in with encrypted cloud backup and sync between phones (could be a higher tier).
- Sharing a project with a family member or engineer (read-only).

## Open questions
- Should the yearly plan be offered at launch?
- Hindi UI at launch, or later?
