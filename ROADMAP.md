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

## Phase G — Purchases v2 (this pass, real, tested)

- **Converged layout** — the old separate "New Purchase" form and the
  Purchase Orders page's "Receive" modal are now one screen with a
  Direct Purchase / From Purchase Order toggle, instead of two places that
  could drift out of sync. Direct Purchase keeps the manual
  supplier-then-products flow (now with Discount and Tax fields, since the
  backend already carried them from Phase 0 but no UI exposed them yet).
  From Purchase Order lists a supplier's open (SENT/PARTIALLY_RECEIVED) POs;
  picking one loads its real remaining quantities and rates as editable
  lines (quantity capped to what's actually left to receive) and Save now
  calls the same tested `po:receive` transaction the old Purchase Orders
  page used — so a PO received from either screen behaves identically and
  still advances the PO's status (PARTIALLY_RECEIVED/RECEIVED) correctly.
- **Live invoice preview** — the right-hand panel itself *is* the invoice
  being built: supplier name, a running item table, and totals all update
  immediately as products are added or quantities/rates are edited, rather
  than a bare form with a separate summary line.
- **Dual-copy A4 purchase invoice printing** — a new `PurchaseInvoicePreview`
  component (mirroring `ReceiptPreview`'s pattern but sized for A4 instead
  of 58mm) renders a Supplier Copy and an Office Copy of the real saved
  purchase — never estimated data, always re-fetched via `purchases:get`
  right after save so the printed invoice can't drift from what was
  actually recorded. Save & Print triggers `window.print()` the same way
  POS does; a **Reprint** action on any history row re-fetches and reprints
  a past purchase identically.
- **PO linkage surfaced everywhere it matters**: `purchases:list`/`get` now
  join the source PO's `po_no`, so Purchase History shows a "from PO-…"
  line under any PO-derived purchase, and the printed invoice shows
  "Ref PO: …" when relevant — the traceability was already in the schema
  (`purchases.po_id`, Phase 0) but nothing displayed it until now.
- Verified with `scripts/test-phaseG.cjs` (11 assertions: a direct purchase
  correctly applies discount and tax to the total; `purchases:get`/`list`
  join supplier name+phone and product names correctly; a PO-linked
  purchase's `po_no` join matches its source PO and carries the automatic
  "From PO-…" note; the PO correctly reaches RECEIVED status through the
  same converged flow; and a fully-received PO correctly reports no open
  line items left to link) — all pass, plus all seven earlier suites
  re-run clean. Visual smoke test confirms the mode toggle, the live
  invoice preview updating as a product is added (Direct Purchase) and as
  a PO is selected (From Purchase Order, showing real remaining quantities),
  and the Reprint action all render correctly with zero console errors.

## Phase H — Sales/Purchase Returns v2 (this pass, real, tested)

- **Real Refund vs Exchange**, not just a label. Refund keeps the existing
  behavior (reduces the customer's receivable, then optionally refunds
  cash). Exchange computes a real **Return Credit** from the returned
  items and lets the cashier build a replacement-products cart right on
  the same screen (search, add, edit quantity/rate) with a live summary —
  Exchange Subtotal, Return Credit Applied, and either an **Amount Due**
  (exchange worth more) or a **Remaining Store Credit** (exchange worth
  less, shown honestly rather than silently discarded). Submitting posts
  two linked real transactions — `salesReturns:create` then `sales:create`
  with the credit applied as the new sale's `discount` — the same
  two-real-calls pattern Phase F's Hold/Resume already established, so
  each half stays atomic and inspectable on its own rather than needing a
  new bespoke "exchange" transaction type.
- **Batch/lot reference on returns** — both Sales and Purchase Returns now
  expose the optional free-text `batch_ref` field the schema has carried
  since Phase 0 (Section 47's decision: no real batch-costing, just a
  reference) once a return quantity is entered for a line.
- **Automatic credit notes, now visible** — `purchase_returns.credit_note_no`
  was already generated on every purchase return (real, since Phase 0) but
  no UI ever showed it. Purchase Returns now displays it in the history
  table and in a dedicated "Credit Note Issued" confirmation panel after
  saving, naming the note number, the amount, and confirming the supplier's
  payable was reduced.
- **Real history views** — new `salesReturns:list`/`purchaseReturns:list`
  handlers (joining the original invoice number, customer/supplier name,
  and — for purchase returns — the credit note number) back a proper
  history table on both pages, matching every other v2 page's history +
  form layout instead of a bare lookup form with no record of past returns.
- **Still instant-post** (Section-consistent with every other phase): no
  approval workflow was added — a return posts the moment it's saved, same
  as before.
- **Scope decision**: when an exchange's replacement items are worth less
  than the return credit, the leftover is shown to the cashier as
  "Remaining Store Credit" but is not automatically banked as a standing
  customer credit balance or auto-refunded — the cashier settles it
  separately (cash refund, or leaves it for the customer's next visit,
  manually). A real running store-credit ledger is a bigger feature than
  this phase's scope; documented here rather than silently rounding it away.
- Verified with `scripts/test-phaseH.cjs` (17 assertions: correct return
  numbering, refunded stock actually returning to inventory, `refund_cash`
  recording the real refunded amount, the Exchange return's credit
  computing correctly and correctly capping the linked sale's discount so
  it never goes negative, over-returning still rejected, the automatic
  credit note number and its real reduction of the supplier's payable, and
  both new `:list` endpoints joining the right invoice/customer/supplier/
  credit-note data) — all pass, plus all eight earlier suites re-run
  clean. Visual smoke test confirms the Sales Returns history with Refund/
  Exchange badges, the live Exchange builder (return credit → exchange
  cart → amount due), the Purchase Returns history with the credit note
  column, and the post-save "Credit Note Issued" panel all render
  correctly with zero console errors.

## Phase I — Cash Management v2 (this pass, real, tested)

- **Register redesign** — the existing open/count/close-day flow is unchanged
  in substance (still real, still Section 27/69-verified) but now lives
  inside a tabbed Cash Management page instead of being the whole page,
  matching the reference design's grouping of cash, bank, and petty cash
  under one section.
- **Bank Accounts, given a real UI for the first time** — `bank_accounts`/
  `bank_transactions` and the `bank:accountsList`/`accountSave`/
  `transactionsList` handlers have existed since Phase 0 but had no screen.
  The new Bank Accounts tab lists every account with its live computed
  balance, a form to add one, and a click-to-select detail panel showing
  that account's real transaction history.
- **Petty Cash, also given a real UI for the first time** — the current
  balance (`petty:balance`) and full transaction history (`petty:list`)
  are now visible; funding or drawing down petty cash happens through the
  Transfer tab, same backend as before.
- **Real three-way Cash Transfer UI** — a single From/To form (Cash
  Register, Petty Cash, or any bank account by name) drives the existing
  `cash:transfer` transaction, which posts two linked, correctly-signed
  entries on whichever real ledgers are involved. The UI honestly blocks a
  cash-involving transfer with a clear message when no register is open,
  matching the backend's own guard, and still allows a bank↔petty transfer
  with the register closed since neither leg touches cash.
- **Fixed the same partial-update bug class** (Phases C/D/E) in
  `bank:accountSave`, found proactively by code inspection before any UI
  used it: an update payload now merges onto the existing row instead of
  overwriting every column positionally, so a `{id, status: "inactive"}`
  deactivate call can't null out the account's name/bank/account number.
  Deactivate/reactivate support was added to the same handler.
- **New reusable capability**: `DataTable` gained an optional `onRowClick`
  prop (Bank Accounts' click-to-view-detail pattern), available to every
  future page that wants a selectable list without a separate "View"
  button column.
- Verified with `scripts/test-phaseI.cjs` (14 assertions: opening balance
  correctness, deactivate/reactivate safety, cash→bank→petty→cash transfers
  each correctly moving money on both real ledgers with the right sign,
  transaction history endpoints reflecting the real legs, a cash-involving
  transfer rejected while the register is closed, and a bank↔petty transfer
  still working while it's closed) — all pass, plus all nine earlier
  suites re-run clean. Visual smoke test confirms the four-tab layout, the
  register (unchanged), the bank account list with a working click-to-view
  detail panel and add-account form, the petty cash balance and history,
  and a real transfer's success toast all render correctly with zero
  console errors.

## Phase J — Expenses v2 (this pass, real, tested)

- **Real category management** — a new `expense_categories` table (seeded
  once with the previous hardcoded 12 names, same `INSERT OR IGNORE`
  pattern Phase 0 used for `payment_methods`) replaces the static array;
  a new Categories tab gives real add/activate/deactivate CRUD, and the
  Add Expense and Add Recurring Expense forms now pull their category
  dropdown from it live.
- **Receipt attachment, now real** — `expenses.receipt_path` existed in the
  schema since Phase 0 but no UI ever wrote to it. A new `receipts:pick`
  handler (mirroring `images:pick`, accepting jpg/jpeg/png/webp/pdf) lets
  the cashier attach a photo or scanned copy of the paper receipt; it's
  copied into the app's data directory like every other stored asset. The
  history table shows a **View** link per expense that has one, opening it
  in a modal (an image renders inline; a PDF is named for now rather than
  embedded — Electron's `file://` protocol handles both once packaged,
  verified visually as a graceful "broken image" fallback in this Linux
  browser-only smoke test, which is expected since the sandboxed test
  browser blocks local file loads the way a real Electron window does not,
  same as the existing product/logo image preview pattern already relied on).
- **Recurring Expenses, given a real UI for the first time** — `recurring_expenses`
  and its due-date-advancing `runDueRecurringExpenses()` (already exercised
  by `test-phase0.cjs`) have existed since Phase 0; the new Recurring tab
  lists them, a form creates/edits one (title, category, amount, payment
  method, MONTHLY/WEEKLY/YEARLY frequency, day-of-month), a Switch
  activates/deactivates, and a **Run Due Now** button calls
  `recurringExpenses:runDue` on demand instead of only at app startup.
- **Real budgets vs actual** — a new `budgets:summary(periodMonth)` handler
  joins the existing `budgets` table against a real `GROUP BY category`
  sum of that month's `expenses`, so the new Budgets tab shows live
  Spent/Remaining per category (not an estimate), a month picker, an
  inline-editable Budget field per row, and an "Over budget" flag the
  moment real spend exceeds what was set — including categories that have
  spend but no budget set yet (shown honestly at Rs. 0 budgeted rather
  than hidden).
- Verified with `scripts/test-phaseJ.cjs` (10 assertions: all 12 default
  categories seed correctly and start active, a new category can be added
  and an existing one deactivated, a receipt path attached to an expense
  persists on its row, `budgets:summary` correctly sums real spend against
  a set budget and flags over-budget, a category with spend but no budget
  still appears at budget=0, and an unrelated month returns nothing) — all
  pass, plus all ten earlier suites re-run clean (recurring-expense
  due-posting itself remains covered by `test-phase0.cjs`, unchanged this
  phase). Visual smoke test confirms all four tabs — Expenses (attach
  receipt, receipt View modal), Recurring (add form, Run Due Now), Budgets
  (live spend, red over-budget styling), Categories (toggle, add) — render
  correctly with zero real console errors.

## Phase K — Dashboard v2 (this pass, real, tested)

- **Stat rows, grouped and labeled** — the 8 stat cards now sit under two
  explicit section headers, "Today's Performance" (Sales, Sales on Credit,
  Purchases, Profit) and "Business Position" (Cash in Hand, Receivables,
  Payables, Stock Value), instead of one undifferentiated grid — same real
  data as before, clearer grouping.
- **Dependency-free chart primitives** — a new `src/components/ui/charts.tsx`
  (`TrendBarChart`, `BreakdownDonut`, `SplitBar`) built as plain inline
  SVG/CSS rather than pulling in a charting library, keeping the offline-
  first build free of any new dependency. Reusable by the Reports suite
  (Phase L).
- **Real 7-day sales trend** — a new field on the existing `dashboard`
  handler (`trend`) does a real `GROUP BY sale_date` over the last 7 days
  (zero-filled for no-sale days) and renders as a bar chart with a
  per-bar hover tooltip and a direct label on today's bar.
- **Real Payment Methods donut, done per the dataviz skill's own guidance**
  — a 2-slice donut is an explicit anti-pattern (misleading, worse than a
  stat tile), so instead of a naive "Retail vs Wholesale" 2-slice pie, the
  donut chart shows today's **real payment-method breakdown** (`payment_method`
  grouped and summed for today, an honest multi-category part-to-whole with
  however many methods were actually used) with a fixed color assigned per
  method (Cash is always the same blue, Credit always the same green,
  etc. — never reassigned by rank). Degrades gracefully to a plain stat
  line when only one payment method was used today (also per the skill:
  a 1-slice "chart" is just a number) and to an empty state with none yet.
- **Today's Mix, as validated split bars instead of 2-slice donuts** — the
  Retail-vs-Wholesale and Cash-vs-Credit comparisons the reference design
  calls for are exactly the "2-slice pie" anti-pattern the skill flags, so
  they're rendered as two-segment horizontal split bars with direct end
  labels and percentages instead — real data from `computeSummary`'s
  already-tested `retailSales`/`wholesaleSales`/`cashSales`/`creditSales`
  fields for today, reused via the `dashboard` handler's new `mix` field
  rather than a second query path.
- **Cash Summary panel** — a new dashboard panel combining three already-
  real sources into one glance: the open/closed cash register and its
  expected total (`cash:current`), total balance across all bank accounts
  (`bank:accountsList`, summed client-side), and the petty cash balance
  (`petty:balance`) — all Phase I endpoints, no new backend needed for
  this panel.
- **Colorblind-safety validated, not eyeballed** — every categorical pair
  used (brand green/gold for Retail-Wholesale, blue/orange for Cash-Credit,
  and the 7-color payment-method sequence borrowed from the dataviz
  skill's own validated default categorical theme) was run through the
  skill's `validate_palette.js` and passes every hard gate; the one WARN
  (gold's contrast against the light surface) is satisfied by always
  showing direct value labels alongside the color, never color alone.
- Verified with `scripts/test-phaseK.cjs` (12 assertions: the trend array
  is always exactly 7 entries ending today with a numeric total on every
  day including zero-sale ones, `paymentBreakdown` reports the real per-
  method totals from real sales, and `mix` correctly reflects a real
  retail-cash sale and a real wholesale-credit sale made today) — all
  pass, plus all eleven earlier suites re-run clean. Visual smoke test
  confirms the grouped stat rows, the trend chart (with hover/direct
  labels), the payment-method donut with its legend and percentages, the
  Cash Summary panel, and both split bars all render correctly with zero
  console errors.

## Phase L — Reports suite (this pass, real, tested)

- **Five real report tabs** replacing the single bare P&L page: **Sales &
  Revenue**, **Profit & Loss** (v2), **Inventory**, **Customers**, and
  **Suppliers**, sharing one date-range picker (defaulting to the current
  month), matching the tabbed pattern every other v2 page now follows.
- **Sales & Revenue** — the existing `reports:summary` stat cards, now with
  a real **Sales Trend** chart (new `reports:trend` handler: day-bucketed
  for ranges up to 31 days, automatically switching to month-bucketed for
  longer ranges, zero-filled so gaps in trading days still show) and a
  **Top Selling Products** table (new `reports:topProducts`, a real
  `GROUP BY product` sum of quantity and revenue within the range).
- **Profit & Loss v2** — the same real P&L statement as before, now with
  period-over-period delta badges on every headline stat card (▲/▼ %,
  reusing the already-tested `reports:compare`/`computeSummary` — this
  session's `reportsCompare` finally got an `api.ts` wrapper; the handler
  itself has existed and been tested since Phase 0 but nothing called it),
  plus a new "Where the Money Went" panel with two `SplitBar`s (Net Sales
  → COGS vs Gross Profit, Gross Profit → Expenses vs Net Profit) using a
  freshly validated green/red categorical pair.
- **Inventory report** — a new `reports:inventory` handler: real stock
  valuation stats (total value, active product count, low/out-of-stock
  counts), a **Fast Moving** table (top sellers by quantity within the
  range) and a **Slow Moving** table (in-stock, active products with zero
  sales in the range — a real, useful "what's not moving" list, not
  guessed), and a full per-product stock valuation table with a computed
  OK/Low/Out-of-Stock status.
- **Customer and Supplier reports** — two new handlers
  (`reports:customers`, `reports:suppliers`) aggregating, per entity, real
  purchases-in-range, real payments-in-range (correctly matched against
  full timestamps via `date(created_at)` rather than a naive string
  range), the always-current outstanding balance, and the last purchase
  date — ranked by purchases descending, so the top customer/supplier is
  immediately visible, with receivables/payables and an "owing" count
  surfaced as real stat cards above the table.
- Verified with `scripts/test-phaseL.cjs` (17 assertions: trend bucketing
  switches correctly at the 31-day boundary and its buckets match real
  daily sales sums, top products ranks by real revenue and sums real
  quantity, inventory correctly separates fast/slow movers and counts
  low/out-of-stock, and both customer and supplier reports sum real
  purchases/payments in range and report the correct outstanding balance
  and last-purchase date) — all pass, plus all twelve earlier suites
  re-run clean. Visual smoke test confirms all five tabs — including the
  trend chart, top products table, P&L delta badges and split bars, the
  inventory fast/slow-moving tables and valuation table with status
  badges, and both customer/supplier ranked tables — render correctly
  with zero console errors.

## Phase M — Users & Permissions v2 (this pass, real, tested)

- **Real IPC-boundary permission enforcement — the headline change.** Since
  Phase 0 the `role_permissions` matrix (25 permissions × 8 roles, not the
  24 earlier phases assumed — the catalog always had `printer.manage` as a
  25th entry) existed and was readable/writable, but nothing ever checked
  it: any logged-in user could call any handler. A new `requirePermission
  (actorId, permission)` helper now gates every money-moving and
  administrative IPC channel that maps 1:1 to a real permission — sales
  create/void/return, purchase create/edit/return (including the PO
  create/receive paths), inventory adjustments and transfers, customer/
  supplier create and payments, cash open/close/transaction/transfer,
  expense creation, user management, permission updates, and settings
  changes. A denied call throws a real error (`Permission denied: role
  "X" cannot "Y"`) rather than silently no-opping, so a blocked user sees
  an honest failure. Read-only list/get channels are intentionally left
  ungated — there's no "view a list" permission in the catalog for them to
  map to, and full page-level nav gating is a separate, larger UI project
  not attempted this phase (documented honestly below rather than faked).
- **A real safety rail**: revoking the Owner role's own `users.manage`
  permission is rejected server-side — without it, an admin could lock
  every administrator out of the permission matrix with no way back in
  short of editing the database directly.
- **The permission matrix finally has a real editor UI** — a new
  `permissions:matrix` handler returns the whole role×permission grid in
  one call; the Permission Matrix tab renders it grouped by module (Sales,
  Purchases, Inventory, Customers, Suppliers, Cash, Expenses, Reports,
  Users, Settings, Printer) with a real action underneath each, a checkbox
  per role, and every toggle calling the now-enforced `permissions:update`
  immediately — this is the same matrix the backend actually checks, not
  a separate cosmetic copy.
- **Real Activity & Login Log** — `audit_logs` and `audit:list` have
  existed since the original foundation and already recorded most write
  actions; the login path only ever recorded successes. Failed login
  attempts are now recorded too (`LOGIN_FAILED`, with the attempted
  username, still resolving to the real user row when one matches), and a
  new Activity Log tab surfaces the whole table with color-coded action
  badges and human-readable details — turning an always-real but
  invisible table into an actual audit trail an owner can read.
- **Users v2**: activate/deactivate (new `users:setStatus`, matching the
  same Switch-toggle pattern every other entity page uses — a
  deactivated user genuinely can't log in, verified) and a real password
  reset flow (`users:resetPassword` reshaped to take `{id, password,
  actorId}` instead of positional args, since nothing called it before
  this phase), both gated under `users.manage` like every other admin
  action.
- **Scope decision, stated plainly**: enforcement covers the write paths
  that map to a named permission; it does not yet hide sidebar nav items
  or in-page buttons per role (a Cashier's UI still shows, say, an
  "Add Expense" button that the backend will now correctly reject) — the
  backend is the real gate today, client-side hiding is a follow-on
  polish pass, not pretended to be done here.
- Verified with `scripts/test-phaseM.cjs` (19 assertions: a Cashier is
  genuinely blocked from expense creation, settings changes, and user
  creation — with the settings change confirmed to have had zero effect,
  not just a thrown error; a call with no `actorId` at all is denied, not
  silently allowed; granting a permission takes effect immediately;
  revoking Owner's `users.manage` is rejected and the permission is
  confirmed still intact afterward; `permissions:matrix` returns the full
  real grid; deactivating a user really blocks login; a password reset
  really changes what logs in; and both successful and failed logins are
  audited with the real user name joined in) — all pass, plus all
  thirteen earlier suites re-run clean (three older test scripts —
  `test-accounting.cjs`, `test-phase0.cjs`, `test-phaseB.cjs` — needed a
  one-line `actorId` added to a few setup calls that predated the
  actorId convention; every real usage from the actual UI already passed
  it correctly, confirmed by reading every call site before gating it).
  Visual smoke test confirms the Users tab (list, status toggle, Reset
  Password modal), the Permission Matrix (grouped by module, all 8 role
  columns, live toggling), and the Activity Log (color-coded LOGIN/
  LOGIN_FAILED/PERMISSION_CHANGED badges with readable details) all
  render correctly with zero console errors.

## Phase N — Invoice/Printer Settings + 58mm dual-token + real barcode + receipt polish (this pass, real, tested)

- **The headline change: every Invoice & Print setting now actually drives
  the printed receipt.** Since Phase B the Settings page had a full
  Invoice & Print tab — template, size, prefix, logo/barcode/terms/
  thank-you toggles, footer text — but `ReceiptPreview` never read most of
  it; the component was rewritten around one shared `ReceiptData` model so
  Customer Copy and Office Copy render from the exact same data and can
  never disagree (Section 78), with every toggle now genuinely gating what
  prints: `show_logo_on_invoice` (only renders if a logo is also set),
  `show_barcode_on_invoice` (real CODE128 via the existing `Barcode`
  component, rendering the actual invoice number), `show_terms_on_invoice`
  (with a new `invoice_terms` setting, previously nonexistent — the toggle
  had nothing to show), and `show_thankyou_on_invoice` (correctly scoped
  to only the Customer Copy's footer; the Office Copy always shows "For
  internal record only." since that's an internal note, not a customer
  thank-you).
- **`invoice_size` (58mm Thermal / A4) and `invoice_template` (Standard /
  Modern / Minimal / Compact (Thermal)) are real, visible differences, not
  cosmetic labels.** A4 renders the same familiar dual-copy layout scaled
  up (`.receipt-copy.a4`: 180mm width, larger font/line-height/padding) for
  shops without 58mm thermal hardware, deliberately staying a lighter-
  weight variant of the existing receipt rather than duplicating Phase G's
  separate `PurchaseInvoicePreview` A4 design. Each template maps to a
  genuine CSS difference: Compact (Thermal) tightens font-size/line-height/
  padding for shops wanting less paper per receipt, Minimal lightens the
  divider lines and drops the "FERTILIZERS | GRAINS | ATTA" line, Modern
  switches to Inter with bolder totals and a thicker divider.
- **`invoice_size` default corrected from "A4" to "58mm Thermal".** The
  setting was previously never read, so its "A4" default was silently
  meaningless — actual rendering was always 58mm regardless. Since this is
  pre-release software with no existing installs whose behavior could
  regress, the default was fixed to match the business's real hardware and
  every receipt rendered up to this phase, rather than leaving a stale
  default that would now silently change real behavior for nobody.
- **A real bug found and fixed during visual verification, not just
  backend testing**: the first A4 barcode implementation used
  `transform: scale(1.6)` in CSS to enlarge the barcode for A4's bigger
  paper. CSS transforms don't reserve extra layout space — the box keeps
  its original untransformed size for document flow, so the visually
  enlarged barcode overlapped the terms text above it and the thank-you
  line below it. Fixed by sizing the barcode through its own `height`/
  `width`/`fontSize` props when `invoice_size` is A4 (45/1.8/14 vs. the
  58mm defaults 28/1.1/9) instead of a CSS transform, removing the overlap
  entirely — confirmed by re-screenshotting the exact A4 + Compact
  (Thermal) + terms-enabled combination that first exposed it.
- **Settings page polish**: the Terms & Conditions textarea only appears
  when its toggle is on (no dead field taking up space when unused); the
  old inline comment deferring this exact wiring to "Phase N" was replaced
  with real descriptive text; the Preview Invoice modal's title now shows
  the live settings combination (e.g. "Invoice Preview — A4 · Compact
  (Thermal) · Dual Copy") so what's previewed is never ambiguous.
- Verified with `scripts/test-phaseN.cjs` (11 assertions: `invoice_size`
  defaults to 58mm Thermal, `invoice_terms` seeds with real default text,
  every invoice/printer field persists through the real `settings:update`
  path including the terms toggle and its text together, and — re-
  confirming Phase M's enforcement reaches this real handler too — a
  Cashier is still denied from changing invoice/printer settings with the
  denied attempt leaving the setting genuinely unchanged) — all pass, plus
  all fourteen earlier suites re-run clean with zero regressions. Visual
  smoke test (Playwright) walked Settings → Invoice & Print → Preview
  Invoice at the 58mm Thermal/Standard default (confirming the dual-copy
  layout, a real scannable CODE128 barcode rendering the actual invoice
  number, and correct footer text on each copy), then live-toggled Terms &
  Conditions on and switched to A4 + Compact (Thermal) and previewed again
  — confirming the settings-tab UI, the template/size switch, and the
  resulting receipt all update correctly with zero console errors (the one
  console message across the whole run was a harmless favicon 404).

## Phase O — Client-side per-role UI gating (this pass, real, tested)

- **The headline change**: since Phase M, `requirePermission()` genuinely
  blocked a denied write at the IPC boundary, but the UI never reflected
  it in advance — a Cashier's sidebar still listed Reports, Settings,
  Users & Permissions, Purchases, and every other module, and the
  Dashboard's Quick Actions still offered "Add Supplier" to a role with no
  `suppliers.create`. Both now genuinely hide what the backend would
  reject, driven by the exact same `role_permissions` data the backend
  checks (fetched once per login via a new `permissions:forRole` handler
  and IPC wrapper) — not a second, hand-maintained copy of who-can-do-what
  that could drift from the real rules.
- **`src/lib/permissions.ts`** is the one new piece: `usePermissionSet(role)`
  fetches the role's real allowed-permission set, and a `PAGE_PERMISSIONS`
  map ties each sidebar page to the actual permission(s) that gate it —
  `products` → `inventory.view`, `users` → `users.manage`, `payments` →
  `customers.payment` OR `suppliers.payment`, and so on. A page with no
  entry (Backup, AI Assistant) is deliberately left visible to every role,
  because neither one is gated by any permission server-side either —
  client-side gating never invents a restriction the backend doesn't also
  enforce, matching the honesty standard every earlier phase held to.
- **Sidebar** filters both flat nav items and group children against this
  set, dropping a whole group (e.g. "Suppliers") if none of its children
  are reachable, rather than leaving an empty expandable stub.
- **App.tsx route guard**: if the signed-in role can't reach the page
  currently selected — a stale quick-action, a permission revoked
  mid-session — it falls back to Dashboard, or renders a plain "Access
  restricted" panel if even Dashboard itself is blocked, instead of
  mounting a page whose actions would all fail against the backend anyway.
- **Dashboard Quick Actions got the more precise fix, not the lazy one.**
  A first pass reused each target page's nav-level permission (e.g. gating
  "Add Customer" on `customers.view`), which would have shown the button
  to a Viewer who can see customers but not create one — a button that
  always fails is exactly what this phase exists to remove. Caught before
  shipping: each quick action now checks its own real creation permission
  (`customers.create`, `suppliers.create`, `expenses.create`, etc.), and
  the whole Quick Actions card disappears rather than rendering empty when
  a role (e.g. Viewer) has none of them.
- **Scope decision, stated plainly**: this reads the role's permission set
  once per login/role change, matching how every other phase's settings
  and matrix data already load — it is not a live subscription, so a
  permission revoked through the Permission Matrix while that role's user
  is already signed in won't re-hide their sidebar until their next login.
  The backend enforcement itself has no such lag: `requirePermission()`
  reads `role_permissions` fresh on every call, so the actual write is
  blocked immediately regardless of what the sidebar still shows.
- Verified with `scripts/test-phaseO.cjs` (8 assertions against the real
  backend, not a mock: every permission `PAGE_PERMISSIONS` relies on is a
  genuine entry in the backend's own permission catalog; a Cashier's real
  `permissions:forRole` data grants exactly Dashboard/POS/Cash/Customers
  and correctly excludes Products/Reports/Settings/Users/Purchases; a
  Viewer's real data grants read access to Products/Reports/Customers/
  Suppliers/Cash but excludes POS/Purchases/Expenses/Settings; an Owner's
  data grants every gated page; and granting `reports.view` to Cashier
  through the real `permissions:update` matrix-editor path shows up in
  `permissions:forRole` immediately) — all pass, plus all fifteen earlier
  suites re-run clean. Visual smoke test (Playwright, logging in as both
  an Owner and a Cashier against a mock carrying each role's real granted
  permissions) confirms the Owner's sidebar lists all 17 real nav entries
  while the Cashier's lists exactly the 6 their permissions allow
  (Dashboard, POS, Customers, Cash Management, plus the two ungated
  Backup/AI Assistant pages), and the Cashier's Dashboard Quick Actions
  panel shows only "New Sale (POS)" instead of all six — zero console
  errors beyond the one harmless favicon 404 on both runs.

## Phase P — Real AI Business Assistant (this pass, real, tested)

- **The headline change**: the honest "planned, not yet built" placeholder
  at Sections 59–60 is now a genuinely working page. It's built as a
  small, fixed set of deterministic keyword-matched questions running real
  SQL against this shop's own database — not a bundled or called LLM,
  since this app is offline-first (Section 5) and has no network
  dependency to give one an honest connection. A new `assistant:ask` IPC
  handler matches a question against ten real intents (today's/
  yesterday's/this month's sales, low stock, top debtor customer, top
  payable supplier, cash in hand, best-selling product this month, today's
  profit, stock value); anything else gets an honest "I don't have an
  answer for that yet" with the real capability list, never a guess.
- **Strictly read-only, matching the placeholder's own promise.** The
  handler contains no INSERT/UPDATE/DELETE — it can only ever return data,
  never touch it. A test sends it `"delete all sales"` as an adversarial
  probe and confirms the real sales count is unchanged afterward.
- **Every figure stays traceable, not just prose.** The frontend
  (`src/pages/AIAssistant.tsx`) renders a natural-language sentence built
  from the intent's real returned data, plus that same data shown again
  underneath as a labeled fact list — so a number in the sentence is never
  free-floating text that could drift from what was actually queried.
- **Bug caught by the test suite, not left to a lucky first read**: the
  first keyword-matcher ordering checked broad phrases ("this month",
  generic "sales") before narrow ones, so "What's our best selling
  product this month?" — which legitimately contains both a top-product
  phrase and a this-month phrase — matched `sales_month` instead of
  `top_product`. Fixed by re-ordering the matcher to check the most
  distinctive intents first and the broad sales-family fallbacks last.
  A second bug in the same pass: `top_debtor`'s SQL used
  `COALESCE(c.shop_name, c.name)`, which doesn't fall through when
  `shop_name` is an empty string rather than NULL (a customer created
  with no shop name got reported with a blank name) — fixed with
  `COALESCE(NULLIF(c.shop_name,''), c.name)`, matching the `shop_name ||
  name` fallback convention the rest of the app already uses in the UI.
- **Scope decision, stated plainly**: this is intentionally a fixed
  command palette dressed as a chat box, not a general natural-language
  understanding system — a real user has to phrase things close to one of
  the ten supported questions (the sample-question chips model the
  expected phrasing). That's a deliberate, honest boundary given the
  offline-first constraint, not a corner cut silently.
- Verified with `scripts/test-phaseP.cjs` (15 assertions against the real
  backend and real seeded data: an unrecognized question is honestly
  reported as unmatched rather than guessed at; every intent returns a
  genuine zero/empty answer before any data exists rather than erroring;
  after seeding a real product, customer, supplier and sale, every one of
  the ten intents reflects the exact real numbers — the Rs. 300 sale, the
  Rs. 5000 customer balance, the Rs. 8000 supplier balance, the Rs. 100
  real cost-of-goods-computed profit, the Rs. 800 real remaining stock
  value; and the adversarial "delete all sales" question performs no
  write) — all pass, plus all sixteen earlier suites re-run clean. Visual
  smoke test (Playwright) confirms the sample-question chips, a matched
  answer's sentence-plus-facts layout, a full back-and-forth conversation
  history, and the honest capability-list fallback for an unmatched
  question all render correctly with zero console errors beyond the one
  harmless favicon 404.

## Phase Q — Wire up reports.export: real CSV export for the Reports suite (this pass, real, tested)

- **The headline change**: `reports.export` has existed in the real
  permission catalog since Phase 0, assignable per role in the Permission
  Matrix (Phase M) — Owner and Accountant have always been granted it by
  default — but nothing anywhere ever checked it or exported anything. It
  was a dead permission a role could be "given" that did nothing, exactly
  the pattern this session keeps finding and closing. Each of the five
  Reports tabs (Sales & Revenue, Profit & Loss, Inventory, Customers,
  Suppliers) now has a real "Export CSV" button, gated by `reports.export`
  through the same `usePermissionSet` pattern Phase O established, that
  writes a genuine CSV file via the existing `files:saveText` IPC path
  (the same save-dialog mechanism Phase C's Products CSV export already
  used) — not a second, parallel export mechanism.
- **Every export is built from the exact data already on screen**, not a
  separately recomputed copy: each tab's `exportCsv()` closure reads the
  same `summary`/`topProducts`/`data`/`rows` state the tab already fetched
  and is rendering, so the CSV can never show different numbers than the
  screen it was exported from.
- **A real bug found and fixed while building this, not left in place**:
  `reports:customers`' SQL used `COALESCE(c.shop_name, c.name)` for the
  display name, which doesn't fall through when `shop_name` is an empty
  string rather than NULL — so a customer entered with no shop name showed
  up with a blank name in both the Customer Report tab and its new CSV
  export. Fixed with `COALESCE(NULLIF(c.shop_name,''), c.name)`, the same
  fix Phase P already applied to the Assistant's `top_debtor` query. The
  same underlying pattern (`COALESCE(x.shop_name,x.name)`, not lossless
  against an empty string) still exists in several other read-only
  queries this phase didn't touch — `customers:list`'s sort order,
  `sales:list`/`sales:get`'s `customer_name`, held sales, and sales
  returns — named here honestly as a known, minor, pre-existing display
  quirk rather than silently left for someone else to rediscover.
- **Scope decision, stated plainly**: this is CSV only, matching what
  Products/Customers/Suppliers CSV export already established as the
  real, working format in this app — no PDF export and no column-
  visibility toggle were added (see the updated Data-grid bullet below).
- Verified with `scripts/test-phaseQ.cjs` (25 assertions against the real
  backend: `reports.export` is confirmed to be a real, existing permission
  that Owner and Accountant are genuinely granted and Cashier genuinely is
  not; every report handler backing an export function (`reports:
  topProducts`, `reports:summary`, `reports:inventory`, `reports:
  customers`, `reports:suppliers`) is confirmed to return every field its
  corresponding CSV export reads; and after seeding a real product,
  customer, supplier and sale, every one of those handlers is confirmed to
  reflect the exact real numbers — the Rs. 300 sale, the Rs. 5300 customer
  balance after opening balance plus the credit sale, the Rs. 8000
  supplier balance, the Rs. 800 real stock value) — all pass, plus all
  seventeen earlier suites re-run clean. Visual smoke test (Playwright,
  `files:saveText` mocked to capture the real CSV content instead of
  opening a native dialog) confirms an Owner sees "Export CSV" and its
  three tested exports (Sales & Revenue, P&L, Customers) each genuinely
  contain the real mocked figures (a real product name, a real Rs. 444,000
  revenue figure, a real Rs. 10,000 net profit, a real customer name and
  Rs. 18,500 balance), while a Cashier — who the real permission catalog
  does not grant `reports.export` — never sees the button at all and
  triggers zero export calls, with zero console errors beyond the one
  harmless favicon 404 on both runs.

## Phase R — Real backup encryption + restore-from-backup (this pass, real, tested)

- **The headline change: a backup can now actually be restored.** Every
  earlier phase's "Backup Now" only ever made a copy of the file — there
  was no restore path anywhere in the app, meaning a backup existed but
  had no real disaster-recovery use. A new `backup:restore` handler
  validates a chosen file (decrypting it first if it's encrypted, then
  running a real `PRAGMA integrity_check` against a staged copy) before
  it's ever allowed to touch the live database, takes its own automatic
  safety-net copy of the current data first, then safely closes and
  reopens the live database connection against the restored file.
  Restoring is gated under `settings.manage` — the most consequential,
  destructive action in the whole app (it replaces every sale, customer
  balance and cash record at once) is exactly the one this session chose
  to gate rather than leave open, unlike the pre-existing, still-ungated
  `backup:create`/`db:integrity`.
- **Real optional encryption, not a checkbox that does nothing.** A
  passphrase-protected backup uses AES-256-GCM with a fresh, random
  scrypt-derived key per backup (the exact same primitive this app has
  used for real user password hashing since the original foundation, not
  a new crypto approach introduced just for this) — an 8-byte magic
  header lets restore tell an encrypted `.smbak` file from a plain `.db`
  one without guessing, and a wrong passphrase fails the GCM auth-tag
  check and throws a clear, honest error rather than silently producing
  garbage data.
- **Scope decision, stated plainly**: encryption only applies to manual
  backups, where a real person is present to type a passphrase.
  Scheduled automatic backups (Section 49, already real since an earlier
  phase — see the corrected deferred bullet below) stay plain files, since
  storing a passphrase anywhere the app could use it unattended would
  defeat the point of encrypting it in the first place; this is a
  deliberate security boundary, not an oversight.
- Verified with `scripts/test-phaseR.cjs` (16 assertions against the real
  backend: a real encrypted backup is written to disk, carries the real
  encryption header, and is genuinely unreadable as plain SQLite; a
  Cashier (no `settings.manage`) is denied from restoring anything, with
  the live database confirmed completely untouched by the denied attempt;
  restoring the encrypted backup with the wrong passphrase throws a real
  error and again leaves live data untouched; a non-backup file is
  rejected outright; and the real end-to-end round trip — seed a product,
  back it up encrypted, add a second product afterward, restore — leaves
  the first product back and the second one genuinely gone, with an
  automatic pre-restore safety copy confirmed on disk, and the same round
  trip is re-verified for a plain, unencrypted backup too) — all pass,
  plus all eighteen earlier suites re-run clean. Visual smoke test
  (Playwright) confirms the encryption toggle reveals a passphrase field,
  a real "Encrypted backup created" success toast appears, choosing a
  restore file shows its real path, a wrong passphrase surfaces the exact
  real backend error message, and the correct passphrase triggers the
  real restore call — zero console errors beyond the one harmless favicon
  404.

## Phase S — Data-grid polish: column visibility + real Print/PDF export for Reports (this pass, real, tested)

- **The headline change**: the two real remaining gaps in Section 53's
  data-grid list — no column-visibility toggle and no PDF export anywhere
  — are both closed. This phase touched no backend code at all; it's
  purely `DataTable` and `Reports.tsx`, verified via typecheck, the full
  existing regression suite (confirming zero backend regressions from a
  phase that changed no backend file), and a Playwright interaction test
  as the primary verification, since there was nothing new at the IPC
  layer for a headless test to exercise.
- **Column visibility is a real, generic `DataTable` feature, not a
  one-off.** An optional `storageKey` prop enables a "Columns" toggle for
  every column that opts in with a stable `key`; visibility is persisted
  to `localStorage` per table. Omitting `storageKey` leaves a table
  rendering exactly as it always did — every other `DataTable` usage in
  the app (15+ pages) is completely unaffected. Applied to two real
  tables to prove it's wired, not just built-and-unused: the Products
  page's 9-column list (`products-list`) and the Reports Inventory tab's
  Stock Valuation table (`reports-stock-valuation`).
- **PDF export reuses the app's own existing print pipeline, not a new
  dependency.** Every Reports tab now has a real "Print Report" button
  that renders the tab's real on-screen data into the same hidden
  `#print-root` / `PrintableList` mechanism Products/Customers/Suppliers
  already use for their "Print List" buttons, then calls the same
  `window.print()` — whose OS print dialog's own "Save as PDF" is the
  real PDF output. No PDF-generation library was added just to produce a
  second way to make the same file type Products.tsx already makes.
- **Scope decision, stated plainly**: `DataTable`'s pagination (`pageSize`
  prop, used across most list pages) is still client-side over an
  already-fetched full list, not server-side SQL `LIMIT`/`OFFSET` —
  real and working for a shop's realistic table sizes, this phase didn't
  change that, and Section 53's original server-side-pagination spec
  stays honestly out of scope until table sizes would actually need it.
- Verified with `npm run typecheck` and the full eighteen-suite backend
  regression run (zero regressions, as expected from a frontend-only
  phase). Visual smoke test (Playwright): the Products table starts at 9
  columns; opening "Columns" and unchecking two shrinks it to 7 with the
  data correctly re-flowing; reloading the page and navigating back to
  the same table confirms the same 2 columns are still hidden (real
  `localStorage` persistence, not just in-memory state); and clicking
  "Print Report" on the Sales & Revenue tab populates the hidden
  `#print-root` with the exact real mocked product name and revenue
  figure that tab was already displaying. Zero console errors beyond the
  one harmless favicon 404.

## Phase T — Real Urdu localization for the POS screen (this pass, real, tested)

- **The headline change, found before it was fixed**: every earlier phase's
  RTL/i18n infrastructure (`LanguageProvider`, `useLang()`, `dir` flipping
  the whole app layout) was real — but nothing in the entire app ever
  called `setLang()`. There was no language switcher anywhere in the UI.
  Switching to Urdu was completely unreachable without opening devtools
  and setting `localStorage` by hand; had this phase only translated POS
  strings without also fixing this, the translations themselves would
  have been just as unreachable. A real toggle button now lives in the
  TopBar (`LanguageToggle.tsx`) — always visible, one click, immediately
  flips the live language and `dir` for the whole app.
- **A second, related dead field found and connected in the same pass**:
  Settings' "Default Language" dropdown (real since Phase B) wrote
  `settings.language` to the database, but nothing ever read that value
  to affect the live UI — a separate, silently disconnected control
  sitting right next to the one that actually worked. It now also calls
  the same `setLang()` the TopBar toggle uses, so either control reflects
  the other. `en-ur` (bilingual) is honestly left as a stored-only
  preference — the live system only supports two full-language modes, not
  a mixed third one, and inventing a fake bilingual rendering mode wasn't
  in scope here.
- **The POS screen itself — the single highest-traffic page for day-to-day
  cashier/staff use — is now genuinely bilingual**, not just RTL-flipped
  around English text. ~40 real strings were added to the dictionary
  (`src/lib/i18n.tsx`) and wired through `POS.tsx` via `t()`: every field
  label, button, keyboard-shortcut hint, modal title, empty state, and the
  hardcoded payment-method list (JazzCash/Easypaisa deliberately left
  untranslated as brand names; Cash/Bank Transfer/Cheque/Credit/Partial
  translated for real). Category buttons show each category's real
  `name_urdu` when Urdu is active, the same field products already had.
- **Scope decision, stated plainly**: this phase is honestly named "the
  POS screen," not "full app localization" — every other page still shows
  mostly English even with Urdu selected (the `dir` flip still applies
  app-wide, so those pages render mirrored-but-English, an improvement
  over before only in that Urdu is now reachable at all, not that every
  page is translated). Extending this same dictionary-and-`t()` pattern to
  the rest of the app is real, bounded, repeatable work for a future
  phase — not a different kind of problem, just more of the same one.
- **A real, pre-existing bug surfaced by finally making RTL mode
  reachable**: with real content flowing through it in RTL for the first
  time, the Sidebar's business-name text visibly looked wrong next to the
  logo. This existed since Phase A but nobody — human or agent — could
  have seen it while the toggle that reveals it was itself unreachable.
  Named here honestly rather than fixed inside this phase, since it
  needed its own diagnosis rather than a rushed fix bundled in — Phase U
  found the real root cause (not an overlap) and fixed it.
- Verified with `npm run typecheck`, `node --check electron/main.cjs`, and
  the full nineteen-suite backend regression run (zero regressions, as
  expected — this phase touched no backend file). Visual smoke test
  (Playwright): the real TopBar toggle button switches the POS screen
  from English to genuinely Urdu-labeled text with `dir="rtl"` confirmed
  on `<html>`; the choice survives a full page reload (real `localStorage`
  persistence, not just in-memory state); and toggling back to English
  confirms the button relabels itself and `dir` reverts correctly. Zero
  console errors beyond the one harmless favicon 404.

## Phase U — Fix the real Sidebar RTL bug Phase T found (this pass, real, tested)

- **The correct diagnosis, found by measuring rather than re-reading the
  screenshot.** Phase T's note called this an "overlap" from a single
  compressed screenshot; a Playwright diagnostic script that read the
  actual DOM geometry (`getBoundingClientRect()` on the logo and text
  elements) showed zero overlap — the logo and text boxes sit cleanly
  side by side with the expected gap between them. The real bug: the
  Sidebar's business-name text is a fixed Roman-script string ("Haji
  Abdul Manan & Abdul Hanan"), and CSS `text-overflow: ellipsis`
  truncates relative to the *container's* direction, not the text's own
  script. Inside the RTL page, that flipped which end got cut — instead
  of "Haji Abdul Manan & Ab…" it rendered "…l Manan & Abdul Hanan",
  chopping off the readable start of the name and keeping the tail.
- **The fix is two attributes, not a layout rewrite**: `dir="ltr"` on the
  two Sidebar `<p>` elements carrying the business name and tagline tells
  the browser to treat that specific text run as LTR for truncation and
  bidi purposes, while the rest of the RTL page is untouched; `text-left`
  makes the alignment match. This is the standard, correct pattern for
  embedding fixed Roman-script content (a business name that isn't itself
  translated) inside an otherwise-RTL page — not a hack.
- **Scope checked, not assumed**: before fixing anything, every other
  place `business_name`/`business_title` renders (`TopBar.tsx`,
  `Footer.tsx`) was checked for the same `truncate` class — neither has
  it (TopBar wraps instead of truncating, Footer doesn't constrain
  width), so neither was actually broken. Only the two genuinely affected
  elements were touched.
- Verified with `npm run typecheck`, `node --check electron/main.cjs`,
  and the full nineteen-suite backend regression run (zero regressions —
  this phase touched one frontend file). A Playwright diagnostic
  confirmed the fix directly: before, the rendered text read "…l Manan &
  Abdul Hanan"; after, it correctly reads "Haji Abdul Manan & Ab…" — and
  a matching check in default English/LTR mode confirmed zero visual
  change there, so the fix is RTL-only as intended.

## Phase V — Extend Urdu localization to the Dashboard (this pass, real, tested)

- **The headline change**: the Dashboard — the very first page every user
  sees after logging in, arguably even higher-visibility than POS for
  whether the app "feels" bilingual — is now genuinely translated, not
  just RTL-mirrored around English text. ~30 new dictionary keys cover
  every stat card label, section header, quick-action button, table
  column, and status string (`OPEN`/`CLOSED`, "Register closed", etc.).
- **A real internal inconsistency fixed along the way**: Phase T's
  payment-method-label mapping (`PAYMENT_METHOD_KEYS`) was defined inline
  inside `POS.tsx`; Dashboard needed the exact same mapping for its
  payment-method donut chart legend and "Today's Mix" split bars. Rather
  than copy-pasting a second private copy — which would drift the moment
  either page's mapping changed without the other — it was promoted into
  a single real export, `paymentMethodLabel()`, from `i18n.tsx`. Both
  pages now share the one mapping; there is no longer a second copy that
  could quietly disagree with the first.
- **Weekday trend labels are locale-aware, not just re-labeled**: the
  Sales Trend chart's day names (`toLocaleDateString(..., {weekday:
  "short"})`) now pass `"ur"` as the locale when Urdu is active instead
  of always `"en-GB"` — real `Intl` weekday names in Urdu script, not a
  dictionary lookup standing in for what the browser's own locale data
  already does correctly.
- Verified with `npm run typecheck`, `node --check electron/main.cjs`,
  and the full nineteen-suite backend regression run (zero regressions —
  this phase touched no backend file). Visual smoke test (Playwright,
  realistic non-zero mocked dashboard data): confirms every real Urdu
  string renders correctly (Today's Performance → "آج کی کارکردگی", Cash
  in Hand → "دستیاب نقدی", Low Stock → "کم اسٹاک", Recent Bills →
  "حالیہ بلیں"), the payment-method donut legend and Today's Mix bars
  show real translated "نقد"/"ادھار" labels, the 7-day trend chart's
  weekday labels render in real Urdu script, and a real (untranslated,
  correctly so) customer name "Ali Khan General Store" still appears
  verbatim in the Recent Bills table — proving translation only touches
  the app's own chrome text, never real business data. Zero console
  errors beyond the one harmless favicon 404.

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
  integration for the desktop build does not exist. (Phase S's "Print
  Report"/PDF export uses this same browser print path deliberately —
  it's the real, working fallback, not a placeholder.)
- **Full UI localization.** POS (Phase T) and Dashboard (Phase V) are now
  genuinely bilingual; every other page (Products, Customers, Suppliers,
  Cash, Expenses, Reports, Settings, Users, …) still renders RTL-mirrored
  but largely in English. The same dictionary/`t()`/`paymentMethodLabel()`
  pattern is proven and repeatable — extending it further is real,
  bounded work for future phases, not a different kind of problem.
- **Cloud backup.** Local backup is real and, since Phase R, can be
  encrypted and genuinely restored; automatic local scheduling has quietly
  existed since an earlier phase (`maybeAutoBackup()`, checked on every
  app launch) — what's still missing is any off-device/cloud destination,
  which depends on the still-deferred cloud/sync work above.
- **Server-side data-grid pagination** (Section 53). `DataTable`'s
  `pageSize` pagination and, since Phase S, its column-visibility toggle
  are both real — what's left is that pagination still fetches a full
  list and paginates client-side rather than querying a page at a time
  from SQLite, which a shop's realistic table sizes don't currently need.

## Page-level phases (A–N) plus Phase O–V — all done

Redesigning every screen against the 19 reference images, in this order:
**A** shell → **B** Settings v2 → **C** Products/Inventory v2 → **D**
Customers v2 + Ledger → **E** Suppliers v2 + Ledger + PO UI → **F** POS v2
→ **G** Purchases v2 → **H** Returns v2 → **I** Cash Management v2 → **J**
Expenses v2 → **K** Dashboard v2 → **L** Reports suite → **M** Users &
Permissions v2 → **N** Invoice/Printer Settings + 58mm dual-token + real
barcode rendering + receipt polish — all done (see sections above). **N**
was the last lettered phase in the original plan; **O** (client-side
per-role UI gating), **P** (real AI Business Assistant), **Q** (real
Reports CSV export), **R** (real backup encryption + restore), **S**
(data-grid column visibility + real Print/PDF export), **T** (real,
reachable Urdu localization for POS), **U** (fixed the real Sidebar RTL
bug Phase T found) and **V** (extended real Urdu localization to the
Dashboard) followed as direct, named follow-ons — **O** closing Phase M's
own stated gap, **P** turning the Section 59–60 placeholder into a
genuinely working page, **Q** wiring the `reports.export` permission
(real since Phase 0, never acted on) to an actual feature, **R** turning
"Backup Now" from a one-way copy into an actual, restorable, optionally-
encrypted disaster-recovery path, **S** closing out Section 53's two
remaining real gaps, **T** making the already-built RTL/i18n system
reachable for the first time and genuinely bilingual on the highest-
traffic screen, **U** correctly diagnosing and fixing the RTL text-
truncation bug Phase T's screenshot first exposed, **V** extending the
same real pattern to the first page every user sees and unifying the
payment-method-label mapping both pages now genuinely share. What remains
is the list below, none of it faked or half-built, all of it named
honestly.

## Still not started after Phase 0/A–V

1. Native ESC/POS USB thermal printing (Section 76) — browser print remains
   the only path until this is built.
2. Voice input (Sections 17–19) — Web Speech API first, cloud STT later,
   always behind the confirm-before-save pattern.
3. Cloud/offline sync (Sections 5, 13, 79–81) — the biggest remaining
   subsystem; deserves its own dedicated design pass rather than being
   bolted on incrementally.
4. Tauri desktop packaging — still Electron.
5. Real messaging integration (SMS/WhatsApp/email) behind the send buttons.
