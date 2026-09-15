# ShopManager — Roadmap against the Master Development Prompt

**Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin**

The master prompt describes a full commercial-grade retail + wholesale POS/ERP
system: real database, offline-first sync, cloud, bilingual voice entry,
native ESC/POS dual-token printing, granular permissions, an AI assistant,
and more. That is genuinely months of work for a team. This document is an
honest record of what is real and working today versus what is intentionally
deferred, so future sessions ("NEXT") pick up accurately instead of assuming
things that don't exist yet.

## Done in this pass (real, tested, not a mockup)

- **Business identity** — exact name/spelling "Haji Abdul Manan & Abdul
  Hanan — Atta Dealer Pishin", Pishin/Balochistan address, PKR currency,
  agricultural green/wheat/navy palette, applied across login, sidebar,
  settings and receipts.
- **TypeScript + Tailwind frontend architecture** — `src/` restructured into
  `components/ui` (Button, Field, Modal, DataTable, StatCard, Toast,
  EmptyState), `components/layout` (Sidebar, TopBar), `pages/`, `lib/`
  (typed IPC client, i18n, formatting) and `types/`. `tsc --noEmit` and
  `vite build` both pass clean.
- **Real, transaction-safe SQLite schema** (`electron/main.cjs`) — products
  with English+Urdu names/retail/wholesale/cost pricing, customers/suppliers
  with full contact + credit-limit fields, sales & purchases with
  per-item lines, **sales_returns/purchase_returns** with over-return
  prevention, **customer_transactions/supplier_transactions** ledgers
  (signed `direction`), **cash_registers/cash_transactions** for daily
  reconciliation, **stock_movements** with previous/new stock + reason,
  **audit_logs**, and collision-free **invoice_counters** producing
  `INV-YYYYMMDD-0001` / `PUR-…` / `SR-…` / `PR-…` / `PAY-…` / `EXP-…`.
  Every financial action is one `db.transaction()` — atomic or fully rolled
  back, never a half-written sale.
- **Real accounting, verified against Section 69's exact numbers** — a
  headless integration test (`scratchpad/test-accounting.cjs`) drives the
  real IPC handlers through: opening cash 50,000 → cash sale 100,000 →
  credit sale 80,000 → customer payment 20,000 → cash purchase 40,000 →
  supplier payment 10,000 → expense 5,000 → withdrawal 10,000, and asserts
  expected closing cash = **Rs. 105,000**, credit sales are never counted as
  cash, over-quantity returns are rejected, overselling stock is rejected,
  and a denomination-counted close reports **MATCHED**. All assertions pass.
- **Product catalog** — all 21 products seeded with the exact English/Urdu
  names and pack sizes supplied (Ardawa, Chakki Atta Punjab, Chokar 17kg/
  40kg, DAP, Fatima Urea, Gandam variants, Potash, Sona Urea, Zinc, etc.),
  opening stock left at zero for the owner to set during real setup.
- **POS** — Retail/Wholesale mode toggle switches pricing per line, product
  search matches English, Urdu and SKU/barcode, cart with qty ± controls,
  customer selector, payment method (Cash/Bank Transfer/JazzCash/Easypaisa/
  Cheque/Credit/Partial), discount, and Save & Print.
- **Cash register page** — open/close with a Pakistani-denomination counter,
  live cash-in/cash-out feed, withdrawal recording, and a clear
  MATCHED/SHORT/OVER result on close.
- **Sales & purchase returns pages** — look up by invoice number, validate
  returned qty against what's left returnable, reverse stock and the
  relevant ledger.
- **Customer/supplier ledgers** — opening balance + signed transaction feed
  + running outstanding balance, rendered from real ledger rows.
- **Reports** — date-range Sales/Purchases/Expenses, a real P&L (Net Sales →
  COGS → Gross Profit → Expenses → Net Profit with margin %), cash vs
  credit and retail vs wholesale breakdowns — all live queries, no fixture
  data.
- **Dashboard** — today's sales/purchases/profit, cash in hand (from the
  open register), receivables, payables, stock value, low-stock list — all
  real queries against the same tables the transactions write to.
- **Shared receipt engine + dual-copy printing (browser path)** —
  `ReceiptPreview` renders one `ReceiptData` object into a Customer Copy and
  an Office Copy that always carry the same invoice number, styled for
  58mm paper, triggered by `window.print()` on Save & Print.
- **Partial bilingual UI** — an English/Urdu toggle switches the sidebar,
  top bar and key labels with RTL layout; product Urdu names are shown
  throughout POS/Products.
- **Audit log table** wired into sale/purchase/payment/expense/price-change/
  stock-adjustment/cash-open/cash-close/login/settings actions.

## Phase 0 — Backend v2 (this pass, real, tested)

Driven by 19 reference-design images covering the full page list, plus
explicit scope decisions made with the owner. Backend only — no UI yet; the
page-level phases (A–N, tracked as tasks) build the screens on top of this.

- **Per-location stock.** New `locations` + `product_location_stock` tables;
  every stock movement, sale, purchase and adjustment now carries a
  `location_id`. `products.stock`/`avg_cost` stay as the authoritative
  cached **total** across locations (weighted-average cost is a single
  company-wide basis, not per-location), so every existing total-stock query
  kept working unchanged. Real stock **transfers** between locations
  (the `TRANSFER` movement type, defined since Phase 3 but unused until now)
  post as two linked movements and net to zero on the total.
- **Real Purchase Orders** — `po_orders`/`po_items`: DRAFT → SENT →
  PARTIALLY_RECEIVED/RECEIVED → converts into a real `purchases` row (full
  or partial receipt) through the same atomic purchase-creation transaction
  used by the direct Purchases flow, so PO-sourced stock/ledger/cash effects
  are identical to a manual purchase.
- **Configurable payment methods** — `payment_methods` table replaces the
  hardcoded list; sales/purchases/expenses still store the method as text so
  history is unaffected by later renames.
- **Tax & discount settings** — `sales`/`purchases` gained `discount`/`tax`
  columns; settings gained sales/purchase tax rate + discount-cap toggles.
- **Notifications** — a real `notifications` table (not cosmetic): low-stock
  and >90-day-overdue-receivable alerts generate automatically (dedup'd
  against existing unread ones), plus a notification on every PO receipt.
- **Permission matrix (data layer)** — `role_permissions` (24 Section-39
  permissions × 8 roles) seeded with sensible per-role defaults and a working
  read/update API. IPC-boundary *enforcement* and the matrix editor UI are
  Phase M — today any logged-in user can still call any handler.
- **Bank accounts, petty cash, and cash transfers** — `bank_accounts`/
  `bank_transactions`, `petty_cash`, and a `cash:transfer` IPC that moves
  money between the cash register / a bank account / petty cash as two
  linked, correctly-signed entries.
- **Recurring expenses & budgets** — `recurring_expenses` auto-posts a real
  expense (and hits the cash register if paid in cash) when due, advancing
  its own next-run date; `budgets` stores a per-category monthly cap.
- **Customer/supplier depth** — CNIC, customer groups, supplier NTN/payment
  terms/products-supplied. An optional free-text `batch_ref` on return line
  items (no real batch costing — see decisions below).
- **FIFO aging** for both customer and supplier ledgers (0-30/31-60/61-90/
  90+ buckets), and **period-over-period report comparison**
  (`reports:compare`) for the "vs last period" deltas every report mockup
  shows.
- All of the above verified by a dedicated integration test
  (`scripts/test-phase0.cjs`, run with `npm run test:phase0`) exercising the
  real IPC handlers: location transfer math, PO partial/full receipt, permission
  grants taking effect, notification generation/dedup, cash↔bank↔petty
  transfers, a recurring expense actually firing, 95-day aging landing in the
  over-90 bucket, and period comparison producing real deltas. The original
  Section 69 test (`npm run test:accounting`) still passes unchanged —
  Phase 0 didn't alter existing behavior, only added onto it.

**Explicit scope decisions behind Phase 0** (owner-confirmed): multi-location
stock and Purchase Orders were built for real; batch/lot tracking stayed as
an optional free-text reference rather than real FIFO batch costing; returns
post instantly rather than requiring a second-user approval step; SMS/
WhatsApp/email "send" buttons seen in the reference images will be stubbed
in the UI (Phase D/E) until a real messaging provider is connected.

## Phase A — Shell v2 (this pass, real, tested)

- **Self-hosted fonts, fully offline** — Inter, Playfair Display (business
  name/display headings), Dancing Script (the "From Our Fields to a Better
  Future" accent) and Noto Nastaliq Urdu, all bundled via `@fontsource`
  packages rather than a Google Fonts CDN link, because Section 4 requires
  the app to keep working with zero internet. `vite build` embeds the woff2
  files locally — verified nothing in the shell depends on network access.
- **Hero top bar** — business identity in the display font, tagline row,
  a code-generated wheat-field backdrop (gradient + SVG wheat-ear glyphs —
  see the imagery note below) behind the script-font accent line, a live
  Asia/Karachi date/time pill, a real notification bell (unread badge,
  dropdown, mark-read/mark-all-read, all wired to the Phase 0
  `notifications:*` IPC — not cosmetic), and a profile pill with logout.
- **Sidebar v2** — the circular emblem badge (`Logo`, also reused on
  Login), same code-generated wheat motif in a small decorative panel,
  location footer, and a new **AI Assistant** nav item. It links to a real
  page that honestly states the feature is planned rather than a dead
  button (Section 59's "distinguish real data from AI explanation" and
  "never invent" principles apply even to the placeholder).
- **Footer bar** on every page (business name · page label · version).
- **Quick Actions** panel added to the Dashboard (New Sale, New Purchase,
  Add Product, Add Customer, Add Supplier, Expense) — real navigation, no
  auto-opened modals yet (that refinement waits for Phase K).
- Dashboard KPIs now show the Phase 0 `salesDeltaPct`/`salesOnCredit`
  fields the backend already computed.
- **Verified visually**, not just by `tsc`/`vite build`: since this
  session's Linux container can't run the Electron GUI, the built `dist/`
  was served standalone and driven with Playwright (chromium), stubbing
  `window.api` so the real component tree renders without a live backend.
  Screenshots confirm the hero banner, sidebar, fonts, notification bell,
  quick actions and footer all render correctly with zero console errors
  across Dashboard and a few other pages.

**Placeholder imagery note:** per the owner's decision, real business
photography isn't available yet. Rather than fetch unlicensed stock photos
(and break offline mode, since a live fetch would depend on network at
runtime), the wheat-field backdrop is generated at build time from SVG
gradients and simple wheat-ear glyphs — visually evokes the mockups'
photography without any licensing risk or runtime dependency. Swap
`WheatFieldBackdrop.tsx` for real photography (as a bundled image asset,
still offline-safe) whenever it's supplied.

## Phase B — Settings v2 (this pass, real, tested)

A tabbed Settings & Business Configuration page matching the reference
design's structure (10 tabs), built on real backend wiring rather than
inert form fields:

- **Business Profile** — full identity form (owner, CNIC/NTN, email,
  timezone, description) plus a real logo upload via the existing
  `images:pick` native file dialog.
- **System Settings** — date/time format, fiscal year start, and 8 feature
  toggles persisted as real settings (multi-location's toggle documents
  honestly that the DB support is real from Phase 0 but the POS/Purchases
  location picker UI is still Phase F/G work).
- **Invoice & Print** — separate configurable Sales/Purchase invoice
  prefixes that now actually drive numbering (`sales:create`/
  `purchases:create` read `invoice_prefix`/`invoice_prefix_purchase` from
  settings instead of a hardcoded string), plus a **Preview Invoice** button
  that renders the real `ReceiptPreview` component on-screen (new `variant`
  prop) with sample data — proving the dual-copy Customer/Office layout
  without needing a real sale.
- **Payment Methods** and **Locations & Warehouses** — real CRUD tables
  wired straight to the Phase 0 `paymentMethods:*`/`locations:*` IPC, with
  a working active/inactive toggle.
- **Tax & Discounts** — the Phase 0 tax/discount settings, now editable.
- **Notifications** — toggles that actually gate `generateNotifications()`
  (verified: a low-stock item generates no notification while its toggle
  is off, and does once re-enabled).
- **Backup & Data** — a real **automatic backup** implementation (not just
  a toggle): on startup, if enabled and the configured Daily/Weekly
  interval has elapsed, the app copies the database into
  `<userData>/backups/`, records the timestamp, and prunes to the most
  recent 10 automatic backups. The tab shows the real last-backup time and
  file count.
- **System Preferences** — a real **negative-stock policy** toggle
  (Section 47): `applyStock()` now denies any movement that would take
  stock below zero unless the owner explicitly allows it here.
- **Integrations** — SMS/WhatsApp/Email provider fields persist for later
  use, with an honest "not connected — sending isn't implemented yet"
  banner rather than pretending the buttons elsewhere in the app work.
- All settings keys are seeded via `INSERT OR IGNORE` on every startup
  (not just on a fresh install), so upgrading from Phase A doesn't leave
  any new Phase B setting missing.
- Verified with `scripts/test-phaseB.cjs` (configurable invoice prefixes,
  negative-stock toggle, notification-type toggles, payment method/location
  CRUD, automatic backup actually running and leaving a file on disk) and
  visually with the same stubbed-`window.api` Playwright approach as Phase
  A — screenshots confirm every tab renders correctly, including the
  invoice preview modal showing both receipt copies side by side.

## Phase C — Products/Inventory v2 (this pass, real, tested)

- **Paginated data table** — `DataTable` gained built-in client-side
  pagination (page-size selector, page numbers) as a generic, reusable
  prop, matching the reference design's "Showing 1 to 20 of 22" pattern;
  every future table gets this for free.
- **Tabbed Add/Edit panel** ("Product Details" / "Pricing & Stock"),
  always visible next to the table rather than a modal, matching the
  reference layout — editing existing stock explicitly says to use Stock
  Adjustment/Transfer instead of the price form, so nobody expects editing
  min/max fields to move physical stock.
- **Real barcode rendering** (`jsbarcode`, CODE128, self-hosted — no CDN)
  via a reusable `Barcode` component. "Generate Barcodes" backfills any
  product missing one (defaulting to its SKU) and opens a printable label
  sheet.
- **CSV import/export** (`papaparse`, per the owner's "CSV first" decision)
  — export produces a CSV of the current catalog; import matches existing
  products by SKU (updates them) or creates new ones, auto-creating
  missing categories by name. Both go through real native file dialogs
  (new `files:pickCsv`/`files:saveText` IPC).
- **Print List** and a reusable `PrintableList` component (A4-oriented,
  shares the same hidden-until-print mechanism as receipts via a new
  `.print-a4` CSS modifier) — the same component every future "Print
  Customer List"/"Print Supplier List" button will reuse.
- **Bulk price update** — a modal listing every product with inline-editable
  retail/wholesale prices, saved in one batch.
- **Stock Adjustment and Stock Transfer as real dedicated pages** (not
  modals), reachable through a new collapsible sidebar group — the first
  real use of multi-item nav groups (built as reusable infrastructure in
  Sidebar.tsx). Stock Transfer correctly no-ops with an explanatory message
  until a second location exists and multi-location is turned on.
- **Real per-location stock display** (`stock:byLocation`) surfaced in both
  new pages.
- **Fixed a real bug found while testing this phase**: `products:save`'s
  update path previously overwrote every column positionally, so a partial
  payload like `{id, status: "inactive"}` (used by the new product
  deactivate action) would have nulled out the product's name, category,
  prices, etc. — instead of throwing loudly (better-sqlite3 rejects
  `undefined` binds) it would have silently corrupted the row. Fixed by
  merging onto the existing row before writing; covered by a new test
  asserting deactivation doesn't touch other fields.
- Verified with `scripts/test-phaseC.cjs` (stock movement history +
  filtering, idempotent barcode generation, bulk price update, soft
  deactivate) — all pass, plus the three earlier suites re-run clean. Visual
  smoke test confirms Products (both form tabs), Stock Adjustment, and
  Stock Transfer all render correctly with zero console errors, including
  the newly-expandable sidebar group.

## Phase D — Customers v2 + Customer Ledger (this pass, real, tested)

- **Customers page rebuilt**: 5 summary cards (all computed from real data —
  total customers, active shops, total credit limit, outstanding balance,
  new this month), a real filter bar (search + customer type + area,
  derived from actual customer data), the same always-visible tabbed
  panel pattern as Products (now showing live stats — total purchases,
  total invoices, recent transactions — once a customer is selected),
  customer groups (real CRUD), and CSV import/export matching by phone.
- **Customer Ledger & Payments**: a new dedicated page (reachable via a
  second real item in the Customers sidebar group) with a customer
  picker, 5 tabs (Transaction Ledger with a real chronological running
  balance, Account Summary, Payment History, Sales History, Ageing
  Report using the Phase 0 FIFO aging), a live Receive Payment form, and
  Print/Export via the shared `PrintableList`.
- **New backend**: `customers:stats` (real lifetime purchase/payment
  aggregates from `sales` and `customer_transactions`, not estimates) and
  `customers:recentSales`.
- **Fixed the same partial-update bug in `customers:save` and
  `suppliers:save`** that Phase C found in `products:save` — both now
  merge onto the existing row before writing, so "Set Credit Limit" or
  "Deactivate Customer" (partial payloads) can no longer null out a
  customer's or supplier's other fields. Fixed proactively in both places
  since the same bug pattern existed in both handlers, even though
  Suppliers' UI is Phase E.
- Verified with `scripts/test-phaseD.cjs` (customer groups, CNIC
  persistence, safe partial credit-limit/deactivate/reactivate updates
  confirming other fields survive, real stats aggregation, and a full
  credit-sale-then-payment scenario netting to the correct balance) — all
  12 assertions pass, plus all four earlier suites re-run clean. Visual
  smoke test confirms the Customers list+form, the full ledger workspace,
  and the aging report tab all render correctly with zero console errors.

## Phase E — Suppliers v2 + Supplier Ledger + real Purchase Orders (this pass, real, tested)

- **Suppliers page rebuilt**: same proven list+always-visible-form pattern
  as Products/Customers, now with NTN, payment terms, products supplied,
  and real summary cards (total suppliers, this month's purchases —
  computed from real purchase records, not a placeholder, outstanding
  payable, and advance payments where a supplier's balance has gone
  negative from overpayment). CSV import/export matching by phone.
- **Supplier Ledger & Payments**: a new dedicated page mirroring the
  Customer Ledger workspace — picker, header stats, 5 tabs (Ledger with a
  real running balance, **Purchase Orders** scoped to this supplier,
  Payments, Purchase History, Ageing Report), a live Make Payment form,
  Print/Export.
- **The real Purchase Orders workflow, end to end in the UI**: a new
  Purchase Orders page lists every PO with status-appropriate actions
  (Send for DRAFT, Receive for SENT/PARTIALLY_RECEIVED, Cancel for
  DRAFT/SENT). "New Purchase Order" builds a draft with line items against
  real products. "Receive" shows ordered/already-received/remaining per
  item, accepts a partial or full quantity, a payment method and amount,
  and calls the Phase 0 `po:receive` transaction — which creates a real
  purchase, moves real stock, and updates the PO's status precisely as
  tested.
- **New backend**: `suppliers:stats` and `suppliers:recentPurchases` (real
  aggregates from `purchases`, matching the Customers pattern).
- **Same partial-update safety fix, retroactively verified**: the
  `suppliers:save` fix made proactively in Phase D is now exercised for
  real by the Suppliers UI (e.g. editing just the payment term) — covered
  by this phase's own test.
- Verified with `scripts/test-phaseE.cjs` (13 assertions: safe partial
  supplier updates, the full PO lifecycle create → send → partially
  receive → fully receive with correct payable increases at each step,
  `suppliers:stats`/`recentPurchases` reflecting the PO-derived purchases,
  a payment netting the balance correctly, and aging buckets summing to
  the outstanding total) — all pass, plus all five earlier suites re-run
  clean. Visual smoke test confirms Suppliers, the full Supplier Ledger
  workspace (including its Purchase Orders tab), the Purchase Orders list
  (correct per-status actions), and the New Purchase Order modal all
  render correctly with zero console errors.

## Phase F — POS v2 (this pass, real, tested)

- **Category sidebar** — a real column on the POS page (not a dropdown)
  driven by `categories:list`, filtering the product grid/list; "All
  Products" stays the default so nothing is hidden behind a category by
  surprise.
- **Grid/List view toggle** for the product listing, matching the reference
  design's two layouts — both share the same `addToCart`/pricing logic, so
  Retail/Wholesale mode and stock limits behave identically in either view.
- **Barcode-scan behavior** — pressing Enter in the search box does an exact
  SKU/barcode match and adds the product straight to the cart, so a USB
  barcode scanner (which types the code then sends Enter) "just works"
  without a separate scan mode.
- **F-key shortcuts**, scoped to the POS page via a page-level `keydown`
  listener with `preventDefault()` so the browser's own F-key behavior
  never fires underneath: **F2** new sale (clear cart, focus search), **F3**
  Hold Bill, **F4** Recent Bills, **F5** Quotation, **F6** focus product
  search, **F8** re-print the last receipt, **F9** complete the sale. A
  visible key-hint row under the search bar documents them in the UI itself.
- **Quick-tender buttons** (+100/+500/+1000/+5000/+10000, plus an "Exact"
  button) add straight onto the Paid Amount field; once paid exceeds the
  total the summary panel swaps the "Remaining" row for a real **Change**
  row instead of showing a nonsensical negative remaining balance.
- **Real Hold Bill / Resume and Quotation workflow** — a new `held_sales`
  table stores a cart **snapshot** (`items_json`, customer, mode, discount)
  that touches neither stock nor any ledger until it's resumed. Hold Bill
  (F3) and Quotation (F5) both go through the same `heldSales:create`
  handler, numbered independently (`HOLD-YYYYMMDD-####` / `QT-…`) via the
  existing collision-free counter. A "Held Bills / Quotations" modal
  (opened from the cart panel or F4→Recent for sales, a separate icon for
  held/quotations) lists open ones with a **Resume** action that repopulates
  the cart and deletes the held row — only the eventual Save & Print runs
  the real, atomic sale transaction, so a resumed quotation still goes
  through every stock/ledger/cash check a normal sale does.
- **Recent Bills (F4)** — the last 10 real sales with a one-click
  **Reprint** that re-fetches the sale via `sales:get` and feeds it back
  into the same `ReceiptPreview`/`window.print()` path as a fresh sale, so
  a reprinted receipt is guaranteed to match what was actually saved (no
  separately-maintained "reprint" template that could drift).
- **Deliberately not built**: a fabricated "next invoice number" preview
  before saving (real numbering is assigned atomically server-side at save
  time; showing a guess risks it not matching the real number the moment
  two terminals are in play) and the reference mockup's decorative gear
  icon next to "Current Sale" (no real action was defined for it, and this
  project's standing rule is no decorative/dead controls).
- Verified with `scripts/test-phaseF.cjs` (15 assertions: `heldSales:create`
  rejects an empty cart; holding a bill leaves stock and the customer ledger
  completely untouched; `heldSales:list` both returns and correctly filters
  by HOLD vs QUOTATION type and joins the customer name;
  `heldSales:get` parses `items_json` back into a real array; the full
  Resume flow — delete the held row, then run a real `sales:create` from its
  snapshot — actually decrements stock only at that point; and HOLD/QUOTATION
  get independent invoice-style numbering) — all pass, plus all six earlier
  suites re-run clean, confirming nothing regressed. Visual smoke test
  (Playwright, stubbed `window.api`, same approach as every earlier phase)
  confirms the category sidebar, grid/list toggle, F-key hint row, cart with
  quick-tender applied, the Held Bills modal, the Quotations tab within it,
  and the Recent Bills modal (with a working Reprint button) all render
  correctly against realistic seeded data with zero console errors.

## Deliberately deferred — not implemented, not faked

These are named explicitly so nobody mistakes silence for "it exists":

- **Tauri desktop packaging.** The app still ships as Electron (which was
  already working and cross-platform-capable) rather than being rewritten
  onto Tauri/Rust. Windows installer workflow is unchanged.
- **Cloud mode, offline sync queue, PostgreSQL, UUID/device-id conflict
  resolution.** Today there is exactly one authoritative local SQLite
  database per install; none of the `sync_status`/`PENDING_SYNC`/conflict
  machinery in Sections 5, 13, 79–81 exists yet.
- **Voice data entry** (Sections 17–19) — no microphone capture, STT, or
  bilingual field parser anywhere in the app yet.
- **Native ESC/POS USB thermal printing.** Dual-copy printing works through
  the browser print dialog (`window.print()`), which is the documented
  fallback for the web/PWA path (Section 76); real USB ESC/POS device
  integration for the desktop build does not exist.
- **Granular permission *enforcement*** (Section 39). The `role_permissions`
  matrix now exists and is readable/writable (Phase 0), but no IPC handler
  actually checks it yet — any logged-in user can still call any handler.
  Real enforcement + the editor UI land in Phase M.
- **AI Business Assistant** (Sections 59–60) — no page, no query layer.
- **Full UI localization.** The Urdu toggle covers navigation/chrome and
  product names, not every label in every form.
- **Backup encryption, scheduled/cloud backup.** Backup is a plain SQLite
  file copy to a location you choose; no encryption or automatic schedule.
- **Data-grid features** (Section 53): column visibility, CSV/PDF export,
  server-side pagination — tables are simple, unpaginated, client-filtered.

## Page-level phases (A–N), queued as tasks, next up

Redesigning every screen against the 19 reference images, in this order:
**A** shell → **B** Settings v2 → **C** Products/Inventory v2 → **D**
Customers v2 + Ledger → **E** Suppliers v2 + Ledger + PO UI → **F** POS v2
— all done (see sections above). Next: **G** Purchases v2 (converged
layout, live invoice preview, dual print, PO linkage) → **H** Returns v2 →
**I** Cash Management v2 → **J** Expenses v2 → **K** Dashboard v2 → **L**
Reports suite → **M** Users & Permissions v2 (real matrix enforcement) →
**N** Invoice/Printer Settings + 58mm dual-token + real barcode rendering +
receipt polish to match the physical mockup.

## Still not started after Phase 0/A–N

1. Native ESC/POS USB thermal printing (Section 76) — browser print remains
   the only path until this is built.
2. Voice input (Sections 17–19) — Web Speech API first, cloud STT later,
   always behind the confirm-before-save pattern.
3. Cloud/offline sync (Sections 5, 13, 79–81) — the biggest remaining
   subsystem; deserves its own dedicated design pass rather than being
   bolted on incrementally.
4. Tauri desktop packaging — still Electron.
5. AI Business Assistant (Sections 59–60).
6. Real messaging integration (SMS/WhatsApp/email) behind the send buttons.
