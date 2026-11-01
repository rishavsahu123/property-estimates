# Roadmap — Property Estimates on the app stores

Last updated: 1 Nov 2026

## Business model (decided)
- **7-day free trial, then ₹49 a month, auto-renewing** — like other Indian subscription apps
  (OTT apps, Microsoft/Xbox Game Pass style).
- One monthly plan to start. A yearly plan (for example ₹499) can come later as a second plan.
- The trial is for new users only (the store enforces one trial per account).
- The user adds a payment method when the trial starts; the store charges ₹49 automatically on day 8
  and every month after, until cancelled.
- Cancel any time from Play Store → Payments & subscriptions (or iPhone Settings → Subscriptions).
  The app should link there.
- Not now: build features first. But every feature should keep this plan in mind.

## How auto-pay works (handled by the stores, not by us)
- Google Play Billing / Apple StoreKit run the recurring charge, the reminders and cancellation.
  For digital features inside the app, store billing is required.
- In India the recurring charge uses an e-mandate the user approves once (card or, on Google Play,
  UPI AutoPay). The stores handle the RBI rules and the pre-debit notifications.
- Play Store setup: one subscription product, base plan "monthly-49" (auto-renewing, ₹49 a month), and an offer
  "free-trial-7d" (free for 7 days, new customers only).
  Turn on the grace period (3–7 days) and account hold so failed payments don't lock people out at once.
- App Store setup: one auto-renewable subscription group with a 1-month subscription at ₹49 and an introductory offer
  of a free trial for 1 week.
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
  States: trial (days left) · active · grace · expired.
- When expired: viewing, search, PDF, Excel, receipts and **backup and restore keep working** (never lock
  people out of their own data). Adding or editing entries is locked, and a gentle "Renew" sheet shows instead.
- Trial banner in the top bar ("5 days left in trial") and a settings screen: plan, renew, manage or cancel
  subscription, restore purchase, version, theme, backup reminder, privacy policy, support contact.
- First-run onboarding (3 screens) that explains: data stays on your phone, 7 days free, ₹49 a month after.
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
