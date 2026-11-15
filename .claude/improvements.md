# Property Estimates: improvements plan

Written 2 Nov 2026. Read this together with `production-plan.md`. When asked "what is pending", use both files to plan the next phase.

## Guiding rule

**Keep every feature, remove every confusion.** Each change must make the app easier to understand than before. If a change adds a new button, word or screen, it must replace something or clearly answer a question the user already has. We fix existing problems before adding new features.

Checks for every change:

1. **One word for one thing.** Say "payment" everywhere (not entry, record or transaction), and "deal" for an agreed price. Use the same label on every screen.
2. **The user never loses their place.** No jumping to another tab after an action. Panels stack and the back button closes the top one. This is already the rule.
3. **Nothing disappears silently.** If a filter or view hides something, say so on screen, with a one-tap way to show everything.
4. **Every action can be undone or asks first.** Delete asks first and offers Undo. Edits get Undo too.
5. **Show the next step.** Empty screens explain what to do, with one button for it.
6. **Phone first.** Thumb-reachable buttons, sticky Save, big tap targets, works offline.
7. **Tested before shipping.** Every change gets an automated test, and the full suite must pass.

---

## Track A: Smooth experience (fix confusion in what exists)

Do this track before new features. Items are ordered by how often they confuse.

| # | Problem today | Fix |
|---|---|---|
| A1 | The top switch (All / Construction / Documents) hides payments silently. Payments seem lost. | When not on All, show a thin bar under the top bar: "Showing Construction only · Show all". The passbook count also says "in Construction". |
| A2 | The item picker is 3 separate dropdowns (Material / Payments to people / Land). It's hard to know which one to open. | One "What was it for?" box: search plus recent items as chips, with groups as headings inside one list. |
| A3 | Different wording: "entry", "payment", "Save entry", "Add new entry", "New entry". | Use "payment" everywhere: "Add payment", "Save payment", "3 payments". |
| A4 | Deals: "Count this payment against", "Link existing payments" and "General payment" are three different phrases for the same idea. | Use "Part of deal: [Labour] / [No deal]" everywhere. "Link existing payments" becomes "Add old payments to this deal". |
| A5 | Edits have no Undo (only delete has). | Toast "Payment updated · Undo" after edits, deal linking and restore. |
| A6 | The project switch is hidden in the top-left chip. | Show the project name as a title with a small "Change" link. "My house" becomes clearly the project. |
| A7 | First run: an empty app with many tabs. | A 3-step welcome card: add your first payment, add a person or deal, take a backup. It hides once done. |
| A8 | Toasts vanish quickly; errors are easy to miss. | Errors stay until tapped; success toasts stay short. Keep one style for all toasts. |
| A9 | The "Unknown" group tag on older data. | One-time prompt: "3 groups have no category. Set them now?" with a direct link. |
| A10 | Receipt options use ⓘ tips that need a tap to read. | A one-line grey explanation under each option, so no tap is needed. |
| A11 | Summary "Expected total cost" is not explained. | A sub-line saying "spent + what is still due on deals". The card is tappable for the breakdown. |
| A12 | Trash is a small link in the passbook header. | Keep it, and show "Trash (2)" only when it has something, plus a 30-day auto-empty note. |
| A13 | The info menu mixes the theme, storage note and backup date. | Turn it into a "Settings" panel with sections: Appearance, Backup, About. Drive backup slots in here later. |
| A14 | Long forms on small phones. | Sticky Save is done. Also collapse rarely used fields (extra people, files) behind "More details" when adding. When editing, show them if they have data. |
| A15 | Contact quick-picks change while typing, which can surprise. | Keep the chips stable: recent people, then matches under a "Matches" label. |

## Track B: New features (from the suggestions list)

Priorities: **P1** is most useful now, **P2** next, **P3** later.

### Quick wins
| # | Feature | Priority |
|---|---|---|
| B1 | Search in the passbook (item, person, note, amount) | P1 |
| B2 | Duplicate a payment ("same as last time": person, item and rate, with today's date) | P2 |
| B3 | Month headers in the passbook with the month total | P2 |
| B4 | Material summary: quantity and average rate per item (for example 350 bags, avg ₹298/bag) | P1 |

### Money and planning
| # | Feature | Priority |
|---|---|---|
| B5 | Budget per group with a spent-vs-budget bar (amber at 80%, red when over) | P2 |
| B6 | "Due now" card on Home: overdue deals and salary due today, with one tap to pay | P1 |
| B7 | Advance / credit given to a shop, settled against later bills | P3 |
| B8 | Cost per sq ft: enter the built-up area once and see "₹X per sq ft so far" and the projected total | P1 |
| B9 | In-app payment reminders (pay the watchman on the 23rd) | P3 |

### Records and sharing
| # | Feature | Priority |
|---|---|---|
| B10 | Statement for a date range per person (this month, or a custom range) | P1 |
| B11 | Hindi / English switch for receipts | P2 |
| B12 | QR code on receipts (total, date, app) | P3 |
| B13 | Material received vs paid (ordered 50, received 48) | P3 |

### Safety
| # | Feature | Priority |
|---|---|---|
| B14 | Drive backup with a schedule (Phase 2 of the production plan) | P1 |
| B15 | Backup reminder banner after 7 days without a backup | P1 (with Phase 2) |
| B16 | App lock with fingerprint or PIN | P3 |

### UI polish
| # | Feature | Priority |
|---|---|---|
| B17 | Swipe on passbook rows (left: delete, right: share) | P3 |
| B18 | "+" on each person in the People list to add a payment fast | P2 |
| B19 | Bigger text setting | P3 |

---

## Suggested order

1. **Track A, all items.** Ideally one or two sessions, so the app is calm and clear before it grows.
2. **Production Phase 2:** Drive backup (B14 + B15) and the Settings panel (A13).
3. **P1 features:** B1 search, B4 material summary, B6 due now, B8 cost per sq ft, B10 statements.
4. **Production Phase 3:** subscription.
5. **P2 features,** then P3 features.
6. **Production Phase 4:** release and Play Store.

Finishing the type-checking of the code (the rest of Phase 1) happens inside these sessions: each file is fully typed when a change touches it.

## Done log

- 15 Nov 2026 (v2.12.0), P1 features done:
  - **B1:** passbook search box (item, group, person, extra people, note, deal, unit, amount, rate, quantity; several words must all match).
  - **B4:** "Material bought" card in Summary (quantity, average per unit, number of purchases, last rate and date).
  - **B6:** "Due now" card on Home: overdue deals and earned-but-unpaid salary; tap to pay, with the amount prefilled.
  - **B8:** "Cost per sq ft" card in Summary. The built-up area is saved on the project (`area`). It shows construction so far, everything so far, and the expected cost when deals are paid.
  - **B10:** person page → "Statement (share or PDF)": This month / Last month / Last 3 months / This year / All time / Custom; share as a receipt image (past payments off) or a PDF.

- 15 Nov 2026 (v2.11.0), Track A done:
  - **A1:** the top-bar All/Construction/Documents dropdown is now an always-visible segmented switch (yellow when not All).
  - **A2:** one "What was it for?" picker, with search, groups as headings, + New item per group, "Add “x” as a new item", and recent-item chips under the button.
  - **A3:** "payment" wording everywhere.
  - **A4:** "Part of deal: No deal / [deal]" and "Add old payments to this deal".
  - **A5:** Undo after edits (unless a file was removed) and after deal linking.
  - **A6:** a "Project" label on the project chip.
  - **A7:** a Getting started card (3 steps) that hides when done or closed.
  - **A8:** problem toasts are red, stay 9 seconds and close on tap.
  - **A9:** a notice when groups have no category, with Set now / Later.
  - **A10:** receipt options explained in grey text, with no ⓘ.
  - **A11:** already explained ("spent so far + balance still to pay").
  - **A12:** the Trash link shows only when trash has something.
  - **A13:** the ⓘ menu is now Settings (gear icon) with Appearance / Backup (Back up now, Restore) / Help / About (version, storage).
  - **A14:** handled by the sticky Save. The date and files stay visible, because they are used often.
  - **A15:** people chips stay the same while typing; matches show after a "Matches" label.

- 2 Nov 2026 (v2.10.x), done:
  - Own confirm box.
  - People/Deals tabs.
  - Monthly salary.
  - Filter dropdown for every name.
  - Deal share.
  - Delete confirm and multi-delete.
  - View-aware payments.
  - New total card.
  - Link old payments to a deal.
  - Receipts newest first, with no repeats when past payments are shown.
  - Passbook: note highlight and file icons; amount in words only in the detail view.
  - Single attach button.
  - Sticky Save.
  - PDF with or without photos.
  - Long-press select.
  - Download icon in the select bar.
