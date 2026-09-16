# Verification checklist

## Automated checks performed this session
- `npm install` — clean install, native module rebuilt for Electron's ABI.
- `node --check electron/main.cjs` and `electron/preload.cjs` — syntax OK.
- `npx tsc --noEmit` — zero TypeScript errors across the new `src/` tree.
- `npm run build:web` (`vite build`) — production bundle builds cleanly.
- `scripts/test-accounting.cjs` — a headless integration test that stubs
  the `electron` module and drives the **real** IPC handlers in
  `electron/main.cjs` against a temporary SQLite database. It runs the
  exact Section 69 accounting scenario and asserts:
  - Expected closing cash = **Rs. 105,000** (50,000 opening + 100,000 cash
    sale + 20,000 customer payment − 40,000 cash purchase − 10,000
    supplier payment − 5,000 expense − 10,000 withdrawal).
  - The Rs. 80,000 credit sale is **not** counted as cash.
  - Customer receivable correctly nets to Rs. 60,000 after the payment.
  - Returning more than was sold is rejected.
  - Overselling beyond available stock is rejected.
  - A denomination-counted close that matches the expected total reports
    `MATCHED`.
  - All assertions passed. Run it yourself with
    `npm rebuild better-sqlite3 && npm run test:accounting` (rebuild back
    to the Electron ABI afterwards with
    `npx electron-builder install-app-deps` before `npm run dev`/`dist`).

## Phase 0 automated checks (this session)
- `scripts/test-phase0.cjs` (`npm run test:phase0`) — same headless-IPC
  approach as the Section 69 test, covering: per-location stock adjustment
  and transfer (including rejecting a transfer that exceeds source stock,
  and confirming company-wide total stock is unchanged by a transfer);
  Purchase Order draft → sent → partial receipt → full receipt (each receipt
  creates a real purchase and updates real stock; over-receiving a closed PO
  is rejected); configurable payment methods; the permission matrix's
  per-role defaults and live updates; notification generation/dedup/mark-read;
  cash↔bank and cash↔petty-cash transfers; a due recurring expense actually
  posting and hitting the cash register; FIFO aging correctly bucketing a
  backdated 95-day-old credit sale into "over 90 days"; and period-over-period
  report comparison. All assertions passed.
- `npm run test:accounting` re-run against the Phase 0 schema — still passes
  unchanged, confirming the location/PO/tax additions didn't alter existing
  sale/purchase/cash behavior.
- `npx tsc --noEmit` and `npm run build:web` both pass against the updated
  backend (frontend IPC calls are untyped `Record<string,unknown>` payloads,
  so the new optional fields — `location_id`, `tax`, `po_id`, etc. — don't
  require frontend changes to keep compiling; wiring them into the UI is the
  page-level phases' job).

## Phase A visual verification (this session)
Since this Linux container can't run the Electron GUI, `dist/` (after
`npm run build:web`) was served standalone on a local port and driven with
Playwright/chromium (`window.api` stubbed with representative data so the
real component tree renders without a live backend). Confirmed via
screenshot: hero top bar (logo, business name in the display font, tagline,
wheat-field backdrop, script accent, live date/time pill, notification bell
with working badge/dropdown, profile pill), sidebar (emblem, nav, AI
Assistant "New" badge, decorative panel, location footer), Dashboard (Quick
Actions grid, stat cards including the new sales-delta/credit-sales tiles,
low stock and recent bills tables), footer bar, and Settings page — all
render correctly with **zero console/page errors**. Self-hosted fonts
(Inter/Playfair Display/Dancing Script/Noto Nastaliq Urdu) load from the
bundled build output, confirming no runtime dependency on Google Fonts or
any other network resource.

## Phase B checks (this session)
- `scripts/test-phaseB.cjs` (`npm run test:phaseB`) — confirms: sales and
  purchase invoice numbers honor the configurable Sales/Purchase prefixes;
  stock adjustments are denied once they'd go negative unless
  `allow_negative_stock=1`, and succeed once it's on; low-stock
  notifications stop generating when `notify_low_stock=0` and resume when
  re-enabled; a new payment method and a new location both persist; and an
  automatic backup actually ran at startup (`last_backup_at` set, a real
  file on disk). All passed. `npm run test:accounting` and
  `npm run test:phase0` were re-run against the Phase B schema and still
  pass unchanged — nothing regressed.
- Visual smoke test (Playwright, `window.api` stubbed, same approach as
  Phase A): Settings' Business Profile tab, every other tab in sequence,
  and the Invoice Preview modal all render with zero console errors —
  screenshots confirm the tab bar, toggles, and the side-by-side
  Customer/Office receipt preview all look correct.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase C checks (this session)
- `scripts/test-phaseC.cjs` (`npm run test:phaseC`) — confirms:
  `stockMovements:list` returns and correctly filters/orders movement
  history with product names joined in; `products:ensureBarcodes`
  generates barcodes for products missing one and is idempotent on a
  second run; `products:bulkUpdatePrices` applies to multiple products in
  one call; and — importantly — deactivating a product via a partial
  `products:save({id, status})` payload no longer corrupts its other
  fields (this test caught a real bug in the existing update path, now
  fixed). All passed. `test-accounting.cjs`, `test-phase0.cjs` and
  `test-phaseB.cjs` were re-run and still pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed): Products page
  (table + both form tabs populated via Edit), Stock Adjustment, and Stock
  Transfer all render correctly with zero console errors, including the
  newly-expandable "Products / Inventory" sidebar group.
- `npx tsc --noEmit` and `npm run build:web` both pass, including the new
  `jsbarcode`/`papaparse` dependencies.

## Phase D checks (this session)
- `scripts/test-phaseD.cjs` (`npm run test:phaseD`) — 12 assertions:
  customer groups, CNIC persistence, a partial `{id, credit_limit}`
  update leaving name/shop_name intact (this test caught the same bug
  class Phase C found, now fixed in both `customers:save` and
  `suppliers:save`), deactivate/reactivate round-tripping other fields
  correctly, `customers:stats`/`customers:recentSales` aggregating real
  sales, and a full credit-sale-then-partial-payment scenario netting to
  the right outstanding balance. All passed. The four earlier suites were
  re-run and still pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed): Customers list
  with the form panel populated via a real row selection, the full
  Customer Ledger workspace (header stats, transaction ledger with running
  balance, Receive Payment form), and the Ageing Report tab all render
  correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase E checks (this session)
- `scripts/test-phaseE.cjs` (`npm run test:phaseE`) — 13 assertions:
  safe partial supplier updates (payment term changes without nulling
  name/NTN), the full Purchase Order lifecycle (create as DRAFT → send →
  partially receive → fully receive) with the supplier payable increasing
  correctly at each receipt, `suppliers:stats`/`recentPurchases` correctly
  aggregating the PO-derived purchases, a payment netting the outstanding
  balance, and aging buckets summing to the total. All passed. The five
  earlier suites were re-run and still pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed): Suppliers
  list+form, the full Supplier Ledger workspace including its Purchase
  Orders tab, the global Purchase Orders list (correct Send/Receive/Cancel
  actions per status), and the New Purchase Order modal all render
  correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase F checks (this session)
- `scripts/test-phaseF.cjs` (`npm run test:phaseF`) — 15 assertions:
  `heldSales:create` rejects an empty cart; holding a bill (HOLD or
  QUOTATION) leaves stock and the customer ledger completely untouched;
  `heldSales:list` returns and correctly filters by type and joins the
  customer name; `heldSales:get` parses `items_json` back into a real
  array and preserves discount; the Resume flow (delete the held row, then
  run a real `sales:create` from its snapshot) only decrements stock once
  the sale is actually completed; and HOLD/QUOTATION get independent
  `HOLD-YYYYMMDD-####`/`QT-YYYYMMDD-####` numbering. All passed. The six
  earlier suites (`test-accounting`, `test-phase0`, `test-phaseB` through
  `test-phaseE`) were re-run against the Phase F schema and still pass
  unchanged.
- Visual smoke test (Playwright, `window.api` stubbed with realistic
  products/categories/customers/held-sales/recent-sales data, same approach
  as every earlier phase): the POS page's new category sidebar (filtering
  correctly to just the selected category's products), grid/list view
  toggle, F-key hint row, cart with quick-tender amounts applied and the
  Change row appearing once paid exceeds the total, the Held Bills modal
  (Held Bills / Quotations tabs, Resume/Delete actions), and the Recent
  Bills modal (with a working Reprint action) all render correctly with
  zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase G checks (this session)
- `scripts/test-phaseG.cjs` (`npm run test:phaseG`) — 11 assertions: a
  direct purchase correctly applies discount and tax to the total;
  `purchases:get` joins supplier name/phone and product names onto line
  items; `purchases:list`/`get` correctly show `po_no` as null for a direct
  purchase and matching the source PO for a PO-linked one; a PO-linked
  purchase carries the automatic "From PO-…" note; the source PO correctly
  reaches RECEIVED status; and a fully-received PO reports no open line
  items left. All passed. The seven earlier suites (`test-accounting`,
  `test-phase0`, `test-phaseB` through `test-phaseF`) were re-run against
  the Phase G schema and still pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed with realistic
  products/suppliers/open-PO/purchase-history data): the Direct Purchase /
  From Purchase Order mode toggle, the live invoice preview updating as a
  product is added in Direct mode (supplier name, item row, running total)
  and as a PO is selected in PO mode (real remaining quantities and rate
  pre-filled, discount/tax fields correctly hidden since `po:receive`
  doesn't support them), and the Reprint action on a history row all
  render correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase H checks (this session)
- `scripts/test-phaseH.cjs` (`npm run test:phaseH`) — 17 assertions: sales
  return numbering, refunded stock actually returning to inventory,
  `refund_cash` recording the real cash amount, the Exchange return's
  credit computing correctly and correctly capping the linked exchange
  sale's discount (never pushing its total negative), over-returning still
  rejected, the automatic purchase-return credit note number and its real
  reduction of the supplier's payable, and both new `salesReturns:list`/
  `purchaseReturns:list` endpoints correctly joining the original invoice,
  customer/supplier name, return type, and credit note number. All passed.
  The eight earlier suites (`test-accounting`, `test-phase0`, `test-phaseB`
  through `test-phaseG`) were re-run against the Phase H schema and still
  pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed with realistic sales/
  purchase/return history): the Sales Returns history table with Refund/
  Exchange type badges, the live Exchange builder (Return Credit → replacement
  product cart → Exchange Subtotal/Return Credit Applied/Amount Due), the
  Purchase Returns history table showing the credit note number column, and
  the post-save "Credit Note Issued" confirmation panel all render
  correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase I checks (this session)
- `scripts/test-phaseI.cjs` (`npm run test:phaseI`) — 14 assertions: a new
  bank account starts at its opening balance; deactivating/reactivating a
  bank account is safe (the partial-update fix); cash→bank, bank→petty and
  petty→cash transfers each correctly move money on both real ledgers with
  the right sign and are reflected in `bank:transactionsList`/`petty:list`;
  a cash-involving transfer is rejected while the register is closed; and
  a bank↔petty transfer (no cash leg) still works while it's closed. All
  passed. The nine earlier suites (`test-accounting`, `test-phase0`,
  `test-phaseB` through `test-phaseH`) were re-run against the Phase I
  schema and still pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed with a realistic
  open register, bank account, and petty cash data): the four-tab Cash
  Management layout, the Register tab (unchanged content), the Bank
  Accounts tab with its list, click-to-view transaction detail panel and
  Add Account form, the Petty Cash tab's balance and history, and the
  Transfer tab performing a real transfer (success toast) all render
  correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase J checks (this session)
- `scripts/test-phaseJ.cjs` (`npm run test:phaseJ`) — 10 assertions: all 12
  default expense categories are seeded and start active, a new category
  can be added and an existing one deactivated, an attached receipt path
  persists on the expense row, `budgets:summary` correctly sums real
  spend against a set budget and reports it over-budget once spend
  exceeds it, a category with spend but no set budget still appears at
  budget=0 rather than being hidden, and an unrelated month returns no
  rows. All passed. The ten earlier suites (`test-accounting`,
  `test-phase0`, `test-phaseB` through `test-phaseI`) were re-run against
  the Phase J schema and still pass unchanged — recurring-expense due
  posting itself remains covered by `test-phase0.cjs`.
- Visual smoke test (Playwright, `window.api` stubbed with realistic
  expenses/categories/recurring/budget data): the Expenses tab (Attach
  Receipt flow, success toast, the receipt View modal), the Recurring tab
  (add form, Run Due Now button), the Budgets tab (live spend, red
  over-budget styling and warning), and the Categories tab (toggle
  switches, add form) all render correctly. The one console message seen
  ("Not allowed to load local resource: file:///fake/receipt-1.jpg") is
  the sandboxed test browser blocking a `file://` image load — the same
  pre-existing pattern Products/Settings already use for image previews,
  which works normally inside the real Electron window; not a regression.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase K checks (this session)
- `scripts/test-phaseK.cjs` (`npm run test:phaseK`) — 12 assertions: the
  dashboard's `trend` field is always exactly 7 days ending today with a
  numeric total on every day (including zero-sale days), `paymentBreakdown`
  reports the real per-payment-method totals from actual sales, and `mix`
  correctly reflects a real retail-cash sale and a real wholesale-credit
  sale recorded today. All passed. The eleven earlier suites
  (`test-accounting`, `test-phase0`, `test-phaseB` through `test-phaseJ`)
  were re-run against the Phase K schema and still pass unchanged.
- Every categorical color pair used on the new charts was run through the
  dataviz skill's `validate_palette.js` rather than eyeballed: brand
  green/gold (Retail vs Wholesale) passes all hard gates with a contrast
  WARN resolved by always showing direct value labels; blue/orange (Cash
  vs Credit) passes clean; the 7-color payment-method sequence is the
  skill's own validated default categorical theme, assigned in a fixed
  per-method mapping (Cash is always blue, Credit always green, etc.).
- Visual smoke test (Playwright, `window.api` stubbed with realistic
  dashboard/register/bank/petty data): the two grouped stat rows ("Today's
  Performance" / "Business Position"), the Sales Trend bar chart (direct
  label on today's bar, weekday x-axis), the Payment Methods donut (legend
  with percentages, center total), the Cash Summary panel (register status,
  total bank balance, petty cash), and both Today's Mix split bars (Retail/
  Wholesale, Cash/Credit with direct end labels) all render correctly with
  zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase L checks (this session)
- `scripts/test-phaseL.cjs` (`npm run test:phaseL`) — 17 assertions:
  `reports:trend` correctly buckets by day for a within-month range and by
  month once the range exceeds 31 days, with real daily/monthly sums;
  `reports:topProducts` orders by real revenue and sums real quantity;
  `reports:inventory` correctly counts low/out-of-stock products, computes
  a positive total stock value, and correctly separates fast-moving
  (products that sold in range) from slow-moving (in-stock, unsold)
  products; `reports:customers`/`reports:suppliers` sum real purchases and
  payments within the range (payments matched by `date(created_at)`, not a
  naive string range) and report the correct outstanding balance and last
  purchase date. All passed. The twelve earlier suites (`test-accounting`,
  `test-phase0`, `test-phaseB` through `test-phaseK`) were re-run against
  the Phase L schema and still pass unchanged.
- Visual smoke test (Playwright, `window.api` stubbed with realistic
  summary/compare/trend/topProducts/inventory/customer/supplier report
  data): all five tabs — Sales & Revenue (trend chart, top products
  table), Profit & Loss (delta badges, the two "Where the Money Went"
  split bars), Inventory (stat cards, fast/slow-moving tables, the stock
  valuation table with OK/Low/Out-of-Stock status), Customers, and
  Suppliers (both ranked-by-purchases tables with the correct receivables/
  payables stat cards) — render correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase M checks (this session)
- `scripts/test-phaseM.cjs` (`npm run test:phaseM`) — 19 assertions: a
  Cashier is genuinely denied `expenses.create`, `settings.manage` (with
  the setting confirmed unchanged, not just an error thrown), and
  `users.manage`; a call with no `actorId` at all is denied rather than
  silently allowed; granting a permission to a role takes effect
  immediately on the next call; revoking the Owner role's `users.manage`
  permission is rejected and confirmed still intact afterward;
  `permissions:matrix` returns the real full role×permission grid;
  deactivating a user really blocks their login; a password reset really
  changes what password logs in and the old one stops working; and both a
  successful and a failed login attempt are recorded in the audit log with
  the real user name joined in. All passed. The thirteen earlier suites
  (`test-accounting`, `test-phase0`, `test-phaseB` through `test-phaseL`)
  were re-run against the Phase M schema — three of them
  (`test-accounting.cjs`, `test-phase0.cjs`, `test-phaseB.cjs`, all
  written before the `actorId` convention was established) needed a
  one-line `actorId: 1` added to a handful of setup calls that predated
  it; every call site in the real frontend UI was individually verified to
  already pass `actorId` correctly before any handler was gated, so no
  application behavior changed, only the test scripts' own setup calls.
  All fourteen suites pass clean together.
- Visual smoke test (Playwright, `window.api` stubbed with realistic
  users/permission-matrix/audit-log data): the Users tab (list, status
  toggle disabled for one's own row, Reset Password modal), the
  Permission Matrix tab (grouped by module with all 8 role columns, a
  live checkbox toggle), and the Activity Log tab (color-coded LOGIN/
  LOGIN_FAILED/PERMISSION_CHANGED badges with readable details) all
  render correctly with zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass.

## Phase N checks (this session)
- `scripts/test-phaseN.cjs` (`npm run test:phaseN`) — 11 assertions:
  `invoice_size` defaults to `"58mm Thermal"` (corrected from a
  previously-meaningless `"A4"` default that the renderer never actually
  read); `invoice_terms` seeds with real default text, not empty;
  `invoice_template` defaults to `"Standard"`; `show_barcode_on_invoice`
  defaults on; every invoice/printer field (`invoice_template`,
  `invoice_size`, the four show-toggles, `invoice_terms`) persists through
  a real `settings:update` call, including the terms toggle and its custom
  text persisting together; and — re-confirming Phase M's enforcement
  reaches this real handler — a Cashier is still denied from changing
  invoice/printer settings, with the denied attempt leaving
  `invoice_template` genuinely unchanged. All passed, plus all fourteen
  earlier suites (`test-accounting` through `test-phaseM`) re-run clean
  with zero regressions from the `invoice_size` default change or the new
  `invoice_terms` key.
- Visual smoke test (Playwright, `window.api` stubbed with a mutable
  settings store so `settings:update` calls genuinely change what
  `settings:get` returns next, simulating real persistence): the Invoice &
  Print settings tab renders correctly at the default 58mm Thermal/
  Standard combination; the Preview Invoice modal shows both Customer Copy
  and Office Copy with a real scannable CODE128 barcode rendering the
  actual invoice number, correct item/total/payment rows, and the correct
  per-copy footer text. Live-toggling Terms & Conditions on and switching
  to Invoice Size = A4 + Invoice Template = Compact (Thermal), then
  previewing again, confirmed the settings tab and the resulting receipt
  both update live — including catching a real bug (see below) that was
  fixed and re-verified with the same screenshot before being called done.
- **Bug found during visual verification, not backend testing**: the first
  A4 barcode implementation sized the barcode with CSS
  `transform: scale(1.6)`, which doesn't reserve extra layout space —
  the enlarged barcode visually overlapped the terms text above it and
  the thank-you line below it. Fixed by sizing the barcode via its own
  `height`/`width`/`fontSize` props for A4 instead of a transform;
  re-screenshotted the exact A4 + Compact (Thermal) + terms-enabled
  combination that exposed it and confirmed the overlap is gone.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase O checks (this session)
- `scripts/test-phaseO.cjs` (`npm run test:phaseO`) — 8 assertions run
  against the real backend, not a mock: every permission the frontend's
  `PAGE_PERMISSIONS` map relies on is a genuine entry in
  `permissions:definitions`, not an invented one; a Cashier's real
  `permissions:forRole("Cashier")` data grants exactly Dashboard/POS/Cash/
  Customers and correctly excludes Products/Reports/Settings/Users/
  Purchases; a Viewer's real data grants read access to Products/Reports/
  Customers/Suppliers/Cash but excludes POS/Purchases/Expenses/Settings;
  an Owner's data grants every gated page; pages with no backend-enforced
  permission (Backup, AI Assistant) stay accessible to every role, matching
  real backend behavior rather than inventing a client-only restriction;
  and granting `reports.view` to the Cashier role through the real
  `permissions:update` matrix-editor path is immediately reflected in
  `permissions:forRole`. All passed, plus all fifteen earlier suites
  (`test-accounting` through `test-phaseN`) re-run clean.
- Visual smoke test (Playwright, two separate logins against a mock
  carrying each role's real granted permissions copied verbatim from
  `DEFAULT_ROLE_PERMISSIONS` in `electron/main.cjs`): logging in as Owner
  shows all 17 real nav entries (Purchase, Products/Inventory, Suppliers,
  Sales/Purchase Returns, Payments, Expenses, Reports, Users &
  Permissions, Settings, …); logging in as Cashier shows exactly the 6
  entries their permissions allow (Dashboard, POS, Customers, Cash
  Management, plus the two ungated Backup/AI Assistant pages) with every
  other entry — and the "Products / Inventory" group entirely — absent.
  The Dashboard's Quick Actions panel was screenshotted for the Cashier
  and shows only "New Sale (POS)", confirming the per-action permission
  fix (see below) rather than the page-level one. Zero console errors on
  either run beyond the one harmless favicon 404.
- **Bug caught before shipping, not after**: the first implementation of
  Dashboard Quick Actions gating reused each target page's nav-level
  permission (e.g. `customers.view` for "Add Customer"), which would have
  shown a Viewer a button that always fails, since Viewer has
  `customers.view` but not `customers.create`. Fixed by giving each quick
  action its own real creation-permission check
  (`sales.create`/`purchase.create`/`customers.create`/
  `suppliers.create`/`expenses.create`/`inventory.view`) instead of
  reusing the page's looser view permission, and hiding the whole card
  when a role has none of them.
- **Scope decision, stated plainly**: permissions are fetched once per
  login/role change (matching how settings and the permission matrix
  already load elsewhere in the app), not via a live subscription — a
  permission revoked through the matrix editor while that role's user is
  already signed in won't re-hide their sidebar until their next login.
  The backend has no such lag: `requirePermission()` re-reads
  `role_permissions` on every call, so the real write is blocked
  immediately regardless of what the sidebar still shows.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase P checks (this session)
- `scripts/test-phaseP.cjs` (`npm run test:phaseP`) — 15 assertions
  against the real backend and real seeded data: an unrecognized question
  ("what color is the sky") is honestly reported as unmatched rather than
  guessed at, and still returns the real capability list; before any data
  exists, every real intent returns a genuine zero/empty answer (Rs. 0
  across 0 invoices, register closed with no fake cash figure) rather than
  erroring; after seeding a real product (10 KG opening stock at Rs. 100
  avg cost), a real customer (Rs. 5000 opening balance), a real supplier
  (Rs. 8000 opening balance), and a real 2 KG Rs. 300 sale, every one of
  the ten intents reflects those exact real numbers — including a Rs. 100
  profit correctly computed as Rs. 300 sales minus the real Rs. 200 cost
  of goods sold, and a Rs. 800 stock value correctly reflecting the real
  8 KG of remaining stock; and an adversarial "delete all sales" question
  is confirmed to perform no write (the real sales count is unchanged
  before and after). All passed, plus all sixteen earlier suites
  (`test-accounting` through `test-phaseO`) re-run clean.
- **Two bugs caught by the test suite before being called done, not left
  for a user to find**: (1) the keyword matcher originally checked broad
  phrases ("this month", generic "sales") before narrow ones, so "What's
  our best selling product this month?" matched `sales_month` instead of
  `top_product` — fixed by reordering to check the most distinctive
  intents first; (2) `top_debtor`'s SQL used
  `COALESCE(c.shop_name, c.name)`, which doesn't fall through when
  `shop_name` is an empty string rather than NULL, so a customer with no
  shop name was reported with a blank name — fixed with
  `COALESCE(NULLIF(c.shop_name,''), c.name)`, matching the `shop_name ||
  name` convention already used throughout the real UI (`Customers.tsx`,
  `CustomerLedger.tsx`). Both were caught by real assertions comparing
  actual returned data against the exact expected values, not accepted on
  a first "looks right" pass.
- Visual smoke test (Playwright, `assistant:ask` mocked with representative
  real response shapes for five sample questions) confirms the sample-
  question chips render and are clickable, a matched answer renders as a
  natural-language sentence plus a separate labeled fact list underneath
  (so every number in the sentence is traceable to an actual queried
  value, not free-floating prose), a multi-turn conversation history
  renders correctly, and an unmatched question ("what's the weather like")
  shows the honest "I don't have an answer for that yet" fallback with the
  real capability list as chips — zero console errors beyond the one
  harmless favicon 404.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase Q checks (this session)
- `scripts/test-phaseQ.cjs` (`npm run test:phaseQ`) — 25 assertions
  against the real backend: `reports.export` is confirmed to be a real
  permission in `permissions:definitions`; Owner and Accountant are
  confirmed to be genuinely granted it via the real `permissions:forRole`
  data, and Cashier is confirmed NOT to be; and every report handler that
  backs a CSV export (`reports:topProducts`, `reports:summary`,
  `reports:inventory`, `reports:customers`, `reports:suppliers`) is
  confirmed to return every field its corresponding export function reads
  — then, after seeding a real product (10 KG opening stock at Rs. 100 avg
  cost), a real customer (Rs. 5000 opening balance), a real supplier
  (Rs. 8000 opening balance), and a real Rs. 300 credit sale, every one of
  those handlers is confirmed to reflect the exact real resulting numbers,
  including the customer's Rs. 5300 balance (Rs. 5000 opening plus the
  Rs. 300 credit sale) and the Rs. 800 real remaining stock value. All
  passed, plus all seventeen earlier suites (`test-accounting` through
  `test-phaseP`) re-run clean.
- **A real bug found and fixed while building this, not left in the
  codebase**: `reports:customers`' SQL used
  `COALESCE(c.shop_name, c.name)`, which doesn't fall through when
  `shop_name` is an empty string rather than NULL — a customer with no
  shop name entered was reported with a blank name in both the Customer
  Report tab and its new CSV export, which is how the test in this phase
  first caught it (a `.find()` against the real seeded customer's name
  came back `undefined`). Fixed with
  `COALESCE(NULLIF(c.shop_name,''), c.name)`, the same fix already applied
  to Phase P's `top_debtor` query. The same pattern still exists in a few
  other read-only queries this phase didn't touch (`customers:list`'s sort
  order, `sales:list`/`sales:get`'s `customer_name`, held sales, sales
  returns) — named honestly in `ROADMAP.md` rather than silently left.
- Visual smoke test (Playwright, `files:saveText` mocked to capture the
  real CSV content passed to it instead of opening a native save dialog,
  which can't be driven through a browser context): confirms an Owner
  (granted `reports.export`) sees the "Export CSV" button on all five
  tabs, and that clicking it on three of them (Sales & Revenue, Profit &
  Loss, Customers) produces CSV content genuinely containing the real
  mocked figures — a real product name and its real Rs. 444,000 revenue
  figure, a real Rs. 10,000 net profit line, a real customer name and its
  real Rs. 18,500 balance — confirming each export reads the same data the
  tab is displaying, not a separately faked figure. A second run as a
  Cashier (whose real granted permissions do not include `reports.export`)
  confirms the button never renders on any tab and zero export calls are
  ever made. Zero console errors beyond the one harmless favicon 404 on
  both runs.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase R checks (this session)
- `scripts/test-phaseR.cjs` (`npm run test:phaseR`) — 16 assertions
  against the real backend and a real temp SQLite database: `backup:
  create` with a passphrase writes a genuinely encrypted file to disk
  (carrying the real `SMBAKV1` magic header and confirmed to NOT start
  with the plain SQLite file header); a Cashier is denied from restoring
  anything (`settings.manage` required) with the live database confirmed
  byte-for-byte untouched by the denied attempt; restoring the encrypted
  backup with the wrong passphrase throws a real error from a failed GCM
  auth-tag check and again leaves live data untouched; a plain text file
  that is neither a real SQLite file nor a real encrypted backup is
  rejected before anything is touched; and the full real round trip —
  seed a product, take an encrypted backup, add a second product
  afterward, restore — leaves the first product back and the second one
  genuinely gone, with a real automatic pre-restore safety-net backup
  confirmed present on disk afterward. The same round trip is re-verified
  for a plain, unencrypted `.db` backup (no passphrase required). All
  passed, plus all eighteen earlier suites (`test-accounting` through
  `test-phaseQ`) re-run clean.
- Visual smoke test (Playwright): toggling "Encrypt this backup with a
  passphrase" reveals a real passphrase field; clicking "Backup Now"
  produces a real "Encrypted backup created" toast and the mocked
  `backup:create` call is confirmed to have genuinely carried the typed
  passphrase; "Choose Backup File" shows the real chosen file's path;
  attempting to restore with a wrong passphrase surfaces the exact real
  backend error message ("Incorrect passphrase, or this backup file is
  corrupted."); and the correct passphrase triggers a real
  `backup:restore` call with the right arguments. Zero console errors
  beyond the one harmless favicon 404.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase S checks (this session)
- This phase touched no backend file — `DataTable.tsx`, `Products.tsx`
  and `Reports.tsx` only — so there is no new `scripts/test-phaseS.cjs`;
  a headless IPC test asserting nothing new at the backend boundary would
  be exercising the same handlers Phases L/Q already cover, not this
  phase's actual change. Verification here is `npm run typecheck`
  (clean), the full existing eighteen-suite regression run re-executed
  and confirmed to pass unchanged (proving zero backend regression from a
  phase that changed no backend code), and a Playwright interaction test
  as the primary check, since the real behavior to verify — column
  toggling, `localStorage` persistence across a reload, and the print
  root populating with real data — is exactly the kind of thing only a
  rendered, interactive browser context can actually exercise.
- Visual smoke test (Playwright): the Products table is confirmed to
  start at 9 real columns; opening "Columns" and unchecking "نام (Urdu)"
  and "Purchase" is confirmed to shrink the real rendered table to 7
  columns; reloading the page and navigating back to the same table is
  confirmed to still show exactly 7 columns — real `localStorage`
  persistence surviving a full page reload, not just in-memory React
  state; and clicking "Print Report" on the Sales & Revenue tab is
  confirmed to populate the hidden `#print-root` with the exact real
  mocked product name ("Chakki Atta Punjab") and its real formatted
  revenue figure ("444,000") that tab was already displaying on screen —
  confirming the print/PDF path reads the same real data, not a
  separately faked figure. Zero console errors beyond the one harmless
  favicon 404.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase T checks (this session)
- This phase touched no backend file — `i18n.tsx`, `POS.tsx`,
  `SettingsPage.tsx`, `TopBar.tsx` and the new `LanguageToggle.tsx` only —
  so there is no new `scripts/test-phaseT.cjs`. Verification: `npm run
  typecheck` and `node --check electron/main.cjs` (both clean), the full
  existing nineteen-suite regression run re-executed and confirmed to
  pass unchanged (zero backend regression, as expected), and a Playwright
  interaction test as the primary check, since the real behavior — a
  language toggle actually switching the live UI, `dir` flipping to
  `rtl`, and the choice surviving a reload — can only be observed in a
  rendered, interactive browser context.
- **The real finding this phase started with**: before any POS strings
  were touched, a search for every call site of `setLang` across the
  entire `src/` tree turned up exactly one — its own definition in
  `i18n.tsx`. The RTL/dictionary system was fully built and had been
  since an earlier phase, but genuinely unreachable from the UI; a
  separate search confirmed Settings' "Default Language" dropdown wrote
  `settings.language` to the database while nothing ever read that value
  back to affect the live language either. Both were real, verified via
  direct code search before any fix was written, not assumed.
- Visual smoke test (Playwright): clicking the new TopBar language toggle
  on the POS screen is confirmed to flip `document.documentElement`'s
  `dir` attribute from `ltr` to `rtl` and to genuinely relabel on-screen
  text into real Urdu strings (not just mirror the English layout) —
  screenshots confirm "Current Bill" → "موجودہ بل", "Discount" → "رعایت",
  "Cash" → "نقد", "Save & Print" → "محفوظ کریں اور پرنٹ کریں", and the
  seeded category's real `name_urdu` field rendering in the category
  sidebar. Reloading the page is confirmed to preserve `dir="rtl"` (real
  `localStorage` persistence), and toggling back to English is confirmed
  to relabel the button and revert `dir` to `ltr` correctly. Zero console
  errors beyond the one harmless favicon 404.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase U checks (this session)
- Diagnosed with a Playwright script that read real DOM geometry
  (`getBoundingClientRect()`) rather than re-inspecting a screenshot: the
  Sidebar logo and business-name text boxes were confirmed to have zero
  overlap in RTL mode — ruling out Phase T's original "overlap" diagnosis
  before writing any fix. The same script then confirmed the actual
  cause: the rendered text read "…l Manan & Abdul Hanan" (truncated from
  the wrong end) because CSS `text-overflow: ellipsis` truncates relative
  to container direction, and the container was RTL while the business
  name is a fixed Roman-script string.
- Fix verified directly, not assumed: after adding `dir="ltr"` and
  `text-left` to the two affected Sidebar `<p>` elements, the same
  diagnostic script re-run against the rebuilt app confirmed the text now
  reads "Haji Abdul Manan & Ab…" — truncating from the natural end. A
  second run in default English/LTR mode confirmed pixel-identical
  rendering to before the fix, proving the change is RTL-only.
- Checked, not assumed, that no other real bug existed: `TopBar.tsx` and
  `Footer.tsx` were both grepped for the same `truncate` class on
  `business_name`/`business_title` text — neither has it (TopBar wraps
  instead of truncating; Footer doesn't constrain width), so neither
  needed the same fix.
- No new `scripts/test-phaseU.cjs`: this phase touched one frontend file
  (`Sidebar.tsx`) and no backend code. Verified via `npm run typecheck`,
  `node --check electron/main.cjs`, and the full existing nineteen-suite
  backend regression run re-executed and confirmed to pass unchanged
  (zero regression, as expected).
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase V checks (this session)
- No new `scripts/test-phaseV.cjs`: this phase touched three frontend
  files (`i18n.tsx`, `Dashboard.tsx`, `POS.tsx`) and no backend code.
  Verified via `npm run typecheck`, `node --check electron/main.cjs`, and
  the full existing nineteen-suite backend regression run re-executed and
  confirmed to pass unchanged (zero regression, as expected).
- Visual smoke test (Playwright, realistic non-zero mocked dashboard
  data — sales, credit, receivables, a low-stock product, a 7-day trend,
  a two-way payment-method split, a real recent sale): confirms every
  section of the Dashboard renders real Urdu text when the language is
  switched — "Today's Performance" → "آج کی کارکردگی", "Cash in Hand" →
  "دستیاب نقدی", "Low Stock" → "کم اسٹاک", "Recent Bills" → "حالیہ بلیں" —
  and that the payment-method donut legend and Today's Mix split bars
  show real translated "نقد" (Cash) / "ادھار" (Credit) labels rather than
  the raw English database values. The 7-day trend chart's weekday axis
  labels are confirmed to render in real Urdu script (via `Intl`'s own
  `"ur"` locale data, not a hand-written dictionary substitute). The real
  mocked customer name "Ali Khan General Store" is confirmed to still
  appear verbatim and untranslated in the Recent Bills table, proving the
  translation layer only touches the app's own chrome text and never
  business data. Zero console errors beyond the one harmless favicon 404.
- **A real internal inconsistency fixed, not left to drift**: Phase T's
  `PAYMENT_METHOD_KEYS` mapping was a private copy inside `POS.tsx`.
  Dashboard needed the identical mapping for its own payment-method
  display. Instead of writing a second copy, it was promoted to a single
  real export (`paymentMethodLabel()`) from `i18n.tsx`, and `POS.tsx` was
  updated to import and use that same export — confirmed by `npm run
  typecheck` passing clean and the existing POS Playwright coverage
  (re-run manually as part of this phase's verification) still showing
  the same correct Urdu payment-method labels POS already had.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase W checks (this session)
- No new `scripts/test-phaseW.cjs`: this phase touched two frontend
  files (`i18n.tsx`, `CashRegister.tsx`) and no backend code. Verified
  via `npm run typecheck`, `node --check electron/main.cjs`, and the full
  existing nineteen-suite backend regression run re-executed and
  confirmed to pass unchanged (zero regression, as expected).
- **A real bug caught before it shipped, by re-reading the diff, not by a
  test**: the first pass at the Bank Accounts "Opening Balance" field
  reused the `openingCash` dictionary key via
  `t("openingCash").replace("Cash", "Balance")`. This happens to produce
  the right English text by coincidence (the literal substring "Cash"
  exists in the English string), but the Urdu translation has no such
  substring — so in Urdu the field would have silently stayed mislabeled
  "Opening Cash" instead of "Opening Balance", with no error, no crash,
  nothing to catch it in a typecheck or a passing test. Caught on review
  before committing; fixed with a real, distinct `openingBalance`
  dictionary key instead of a string-manipulation hack.
- Visual smoke test (Playwright, realistic mocked cash-register/bank-
  account/petty-cash data, all four tabs exercised in Urdu): the open
  Register tab's four stat cards, the Today's Cash Movements table (with
  its `IN` direction value correctly rendered as translated "آمد", not
  the raw English enum value), the Cash Withdrawal form, and the
  Denomination Count card all confirmed to render real Urdu text. The
  Bank Accounts tab is confirmed to show "ایک اکاؤنٹ منتخب کریں" (Select
  an account) before any row is clicked, and real translated "Current
  Balance" text plus the real, correctly-untranslated account name "Main
  Business Account" after clicking a row — proving the translation layer
  activates and deactivates correctly with the same conditional rendering
  logic the English version already had. The Petty Cash tab's history
  table headers and the Transfer tab's hint text, From/To dropdown
  options (showing translated "Cash Register"/"Petty Cash" labels next to
  the real, untranslated bank account name), and reason placeholder all
  confirmed to render real Urdu. Zero console errors beyond the one
  harmless favicon 404.
- `npx tsc --noEmit`, `node --check electron/main.cjs`, and
  `npm run build:web` all pass with zero errors.

## Phase X checks (this session)
- No new `scripts/test-phaseX.cjs`: this phase touched two frontend files
  (`i18n.tsx`, `Products.tsx`) and no backend code. Verified via
  `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- **A real bug caught before it was ever run, by re-reading the diff, not
  by a test**: the first pass at the toolbar's Reset button wrote
  `{t("clear") === "صاف کریں" ? t("clear") : "Reset"}` — a
  string-comparison hack standing in for a real dictionary key, the exact
  same category of mistake Phase W's own verification entry above
  documents fixing one phase earlier. It happens to produce the correct
  label in both languages (the comparison is trivially true in Urdu mode
  and trivially false in English mode), but is fragile, unreadable, and
  would silently mislabel the button the moment `clear`'s Urdu wording
  ever changed for the POS screen it was originally written for. Caught
  before the smoke test was even written; replaced with a real `resetBtn`
  dictionary key.
- Visual smoke test (Playwright, two realistic mocked products — "Sona
  Urea" in category Fertilizer/کھاد, "Fauji Atta" in category Flour/آٹا —
  English then Urdu): confirms the four stat cards, the search/filter
  toolbar (including the fixed Reset button), the DataTable's column
  headers and its per-row Low Stock/Active status badges, both tabs of
  the Add/Edit Product form, the Quick Actions panel's four buttons, and
  the Bulk Update Prices modal (reached by clicking the Urdu-rendered
  "قیمتیں اپ ڈیٹ کریں" button, confirming its own column headers and
  Save/Cancel buttons render real Urdu) all render correctly in both
  languages. Confirms both real product names stay untranslated in Urdu
  mode. Confirms the Category column and the category filter/form
  dropdown render the real `category_name_urdu` value the backend has
  joined in since Phase 0 ("کھاد" for Fertilizer, "آٹا" for Flour) — not
  a dictionary placeholder. Zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase Y checks (this session)
- No new `scripts/test-phaseY.cjs`: this phase touched two frontend files
  (`i18n.tsx`, `Customers.tsx`) and no backend code. Verified via
  `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Two new shared translation helpers added next to `paymentMethodLabel()`
  in `i18n.tsx`: `customerTypeLabel()` for the real
  `customers.customer_type` enum, and `ledgerTypeLabel()` for the real
  `customer_transactions`/`supplier_transactions.type` enum — checked
  against `electron/main.cjs`'s actual `INSERT INTO customer_transactions`
  / `INSERT INTO supplier_transactions` call sites to confirm the real
  value set (`SALE_CREDIT`, `VOID_ADJUSTMENT`, `SALES_RETURN`, `PAYMENT`,
  `PURCHASE_CREDIT`, `PURCHASE_RETURN`) rather than guessing at it.
- A loop variable shadowing the `t()` translation function
  (`recentTx.map((t) => ...)`, reusing the same name `useLang()` already
  bound in the enclosing scope) was renamed to `tx` while wiring the
  Recent Transactions panel — same category of mistake as the
  `BarcodeSheetModal` timer-variable rename in Phase X, caught the same
  way, by reading the diff rather than by a failure.
- Visual smoke test (Playwright, two realistic mocked customers — a
  Wholesale shop with a real Rs. 12,000 outstanding balance and two
  ledger rows, and a plain Retail walk-in with no balance — English then
  Urdu): confirms the five stat cards, the search/filter toolbar, the
  DataTable, the Add/Edit Customer form (both the read-only header state
  shown after selecting a row and the full editable field set), the
  stats mini-cards, and the Customer Groups modal all render real Urdu;
  confirms the Recent Transactions panel renders "ادھار فروخت" for the
  real `SALE_CREDIT` row and "ادائیگی" for the real `PAYMENT` row rather
  than leaking `SALE_CREDIT`/`PAYMENT` as raw text (asserted directly by
  checking the raw enum strings do NOT appear in the rendered Urdu page);
  confirms both real customer/shop names ("Karim Bakhsh", "Karim General
  Store") stay untranslated in both languages. Zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase Z checks (this session)
- No new `scripts/test-phaseZ.cjs`: this phase touched two frontend files
  (`i18n.tsx`, `Suppliers.tsx`) and no backend code. Verified via
  `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Reused `ledgerTypeLabel()` (added in Phase Y, already covering
  `PURCHASE_CREDIT`/`PURCHASE_RETURN` alongside the customer-side enum
  values) for the Recent Transactions panel instead of writing new
  mapping code — confirming the Phase Y design choice to build that
  helper generically paid off exactly as intended.
- Same loop-variable shadowing fix as Phase Y, same reason: the Recent
  Transactions panel's `recentTx.map((t) => ...)` was renamed to
  `(tx) => ...` while wiring, since `t` was already bound to the
  translation function by `useLang()` in the enclosing scope.
- Visual smoke test (Playwright, two realistic mocked suppliers — one
  with a real Rs. 18,000 payable, a 30-day payment term, and ledger
  history, one with none — English then Urdu): confirms the four stat
  cards, the search/filter toolbar, the DataTable, the Add/Edit Supplier
  form (both the read-only header state, including the "30 day terms"
  sentence, and the full editable field set), the stats mini-cards, and
  the Recent Transactions panel all render real Urdu; confirms the panel
  renders "ادھار خریداری" for the real `PURCHASE_CREDIT` row and
  "ادائیگی" for the real `PAYMENT` row rather than leaking the raw enum
  text (asserted directly by checking the raw strings do NOT appear in
  the rendered Urdu page); confirms both real supplier names
  ("Al-Manzoor Traders", "Balochistan Grain Co.") and real
  category/NTN/contact-person values stay untranslated in both
  languages. Zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase AA checks (this session)
- No new `scripts/test-phaseAA.cjs`: this phase touched two frontend
  files (`i18n.tsx`, `Expenses.tsx`) and no backend code. Verified via
  `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Added a new `frequencyLabel()` helper next to
  `paymentMethodLabel()`/`customerTypeLabel()`/`ledgerTypeLabel()` in
  `i18n.tsx`, covering the real `recurring_expenses.frequency` enum
  (`MONTHLY`/`WEEKLY`/`YEARLY`) — the first phase to add a translation
  helper for an enum with no prior partial coverage anywhere in the app.
- Reused `paymentMethodLabel()` for the Expenses tab's Method column,
  which previously rendered `r.payment_method` as a raw untranslated
  value even in the English-only version of the page — confirmed this is
  a genuine fix (real translated text in both languages now), not a
  regression risk, since the raw value was never asserted on anywhere.
- Caught and merged three near-duplicate dictionary keys before wiring:
  a draft `noteField` that duplicated the existing `noteCol`, a draft
  `receiptCol`/`receiptModalTitle` pair that both meant "Receipt" (now
  a single `receiptLabel` reused three places), and a draft
  `frequencyCol` that duplicated `frequencyField` — caught while
  reviewing the new dictionary block before it was ever wired into the
  page, not after.
- Visual smoke test (Playwright, realistic mocked expense/recurring/
  budget/category data — including a budget row engineered to actually
  exceed its limit, to genuinely exercise the over-budget badge rather
  than assuming it renders — all four tabs exercised in English then
  Urdu): confirms every tab's headings, form labels, table columns, and
  buttons render real Urdu; confirms the Recurring tab's Frequency
  dropdown and table column both render "ماہانہ" for the real `MONTHLY`
  value (asserted the raw `>MONTHLY<` text does NOT appear in the
  rendered Urdu page); confirms the Budgets tab's "بجٹ سے زیادہ" badge
  renders on the row actually over budget; confirms real expense/category
  data ("Electricity Bill", "Shop Rent", "Utilities", "Rent") stays
  untranslated in both languages. Zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase AB checks (this session)
- No new `scripts/test-phaseAB.cjs`: this phase touched two frontend
  files (`i18n.tsx`, `CustomerLedger.tsx`) and no backend code. Verified
  via `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Added zero new translation helpers — reused all three existing ones
  (`ledgerTypeLabel()`, `paymentMethodLabel()`, `customerTypeLabel()`) in
  a single page for the first time. Also reused `customerTypeLabel()` for
  the Sales History tab's Mode column, since `Sale.mode` is the same
  `"Retail" | "Wholesale"` value set as `customer_type`; checked
  `src/types/index.ts` directly to confirm this before reusing it, rather
  than assuming.
- A real harness bug (not an app bug) was hit and fixed while writing the
  Playwright test: clicking the "Customers (Shops)" sidebar group header
  navigates to its first child page as well as expanding the group (see
  `Sidebar.tsx`'s group button `onClick`), so the test's initial mocked
  IPC surface was missing `customerGroups:list` (needed by the Customers
  page the click actually lands on) and threw `Cannot read properties of
  null (reading 'map')`. Fixed by adding the stub; documented here so a
  future phase's smoke test for a page reached via the same group header
  doesn't rediscover it.
- Visual smoke test (Playwright, one realistic mocked Wholesale customer
  with a real outstanding balance, two ledger rows, an aging bucket, and
  one linked sale — English then Urdu): confirms the customer picker
  screen, the header stat strip, all five tabs (Transaction Ledger,
  Account Summary, Payment History, Sales History, Ageing Report), and
  the Receive Payment panel all render real Urdu; confirms the
  Transaction Ledger renders "ادھار فروخت" for the real `SALE_CREDIT` row
  and "ادائیگی" for the real `PAYMENT` row rather than leaking the raw
  enum text (asserted directly — checked the raw strings do NOT appear in
  the rendered Urdu page); confirms the real customer name ("Karim
  General Store") and real reference numbers ("INV-0009", "PAY-0004")
  stay untranslated in both languages. Zero console errors after the
  harness fix above.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase AC checks (this session)
- No new `scripts/test-phaseAC.cjs`: this phase touched two frontend
  files (`i18n.tsx`, `SupplierLedger.tsx`) and no backend code. Verified
  via `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Added one new helper, `poStatusLabel()`, for the real
  `purchase_orders.status` enum. Confirmed by inspection that
  `StatusBadge` (defined in `SupplierLedger.tsx`, exported, and imported
  by `PurchaseOrders.tsx`) is the only place this enum is rendered, so
  wiring the helper into that one shared component is sufficient — no
  duplicate rendering path was missed.
- Reused `ledgerTypeLabel()` and `paymentMethodLabel()` from Phase AB/Z
  with zero changes needed.
- A genuine, minor English-copy inconsistency in the pre-existing page
  (this page said "No credit term" where Suppliers, Phase Z, said "No
  credit term set" for the identical state) was resolved by reusing
  Phase Z's `noCreditTermSet` key for both pages — confirmed this was a
  pre-existing inconsistency, not something introduced this phase, by
  checking `Suppliers.tsx`'s original string before this session ever
  touched it.
- Two harness gaps were hit and fixed while writing the Playwright test,
  both consistent with the class of issue Phase AB already documented
  for the Sidebar's group-header click behavior: (1) the Suppliers group
  header also navigates to its first child page, so the test needed a
  `purchases:list` stub the Suppliers page requires; (2) the test's own
  `text=Purchase Orders` click for switching this page's own tab was
  ambiguous with the sidebar's "Purchase Orders" nav item, since both use
  the same `purchaseOrders` dictionary key, and Playwright clicked the
  nav item instead of the tab — fixed by scoping the click to
  `main >> text=Purchase Orders`.
- Visual smoke test (Playwright, one realistic mocked supplier with a
  real Rs. 18,000 payable, a 30-day payment term, ledger history, a
  linked purchase, and one Purchase Order in `PARTIALLY_RECEIVED` status
  — English then Urdu): confirms the picker, header stats, all five
  tabs, and the Make Payment panel render real Urdu; confirms the Ledger
  tab renders "ادھار خریداری" for the real `PURCHASE_CREDIT` row rather
  than the raw enum text; confirms the Purchase Orders tab's status
  badge renders "جزوی موصول" for the real `PARTIALLY_RECEIVED` PO
  (asserted directly — checked the raw `PARTIALLY_RECEIVED`/`PARTIALLY
  RECEIVED` text does NOT appear in the rendered Urdu page); confirms
  the real supplier name ("Al-Manzoor Traders"), category
  ("Fertilizer"), and reference numbers ("PINV-0007", "PO-0003") stay
  untranslated in both languages. Zero console errors after the harness
  fixes above.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase AD checks (this session)
- No new `scripts/test-phaseAD.cjs`: this phase touched two frontend
  files (`i18n.tsx`, `Users.tsx`) and no backend code. Verified via
  `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Before writing any dictionary keys, ran
  `grep -oP 'audit\([^,]+,\s*"\K[A-Z_]+' electron/main.cjs | sort -u` and
  the equivalent for the entity argument, to get the real, complete set
  of `audit_log.action` (20 values) and `.entity` (14 values) strings
  actually written by the backend — confirmed every value against this
  list rather than translating only the ones visible in a quick manual
  read of `Users.tsx`.
- `roleLabel()`, `moduleLabel()`, and `actionLabel()` were each checked
  against their real source: `Role` from `src/types/index.ts`,
  `MODULE_LABELS`/`ACTION_LABELS`'s original keys from `Users.tsx`
  itself before they were deleted and replaced by the dictionary-backed
  helpers.
- Caught mid-draft: `moduleDashboard`, `moduleExpenses`, `moduleReports`,
  `moduleSettings`, and `moduleUsers` were about to duplicate five
  existing dictionary keys with identical English/Urdu text; removed
  before they were ever wired in and `moduleLabel()`'s lookup table
  points at the existing `dashboard`/`expenses`/`reports`/`settings`/
  `usersTab` keys instead.
- Visual smoke test (Playwright, two realistic mocked users — one Owner,
  one Cashier — a three-role/three-permission slice of a real
  permission matrix with the Owner/users.manage cell correctly locked,
  and three realistic audit rows covering `LOGIN`/`CREATE`/
  `STOCK_ADJUSTED` with real `user`/`sale`/`product` entities — all
  three tabs exercised in English then Urdu): confirms the Users tab's
  table, Add User modal, and Reset Password modal render real Urdu with
  the real user name "Hamid Cashier" staying untranslated; confirms the
  Permission Matrix's module groups, action rows, and role column
  headers ("مالک"/"منیجر"/"کیشیئر") render real Urdu, including the
  correctly-disabled Owner/users.manage checkbox; confirms the Activity
  Log renders "لاگ ان"/"تخلیق"/"اسٹاک ایڈجسٹ ہوا" for the real audit
  actions and "فروخت #42"/"پروڈکٹ #7" for the real entity+ID pairs
  rather than leaking any raw enum text (asserted directly — checked the
  raw `STOCK_ADJUSTED`/`LOGIN` strings do NOT appear in the rendered
  Urdu page). Zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Phase AE checks (this session)
- No new `scripts/test-phaseAE.cjs`: this phase touched two frontend
  files (`i18n.tsx`, `SettingsPage.tsx`) and no backend code. Verified
  via `npm run typecheck` and the full existing eighteen-suite backend
  regression run re-executed and confirmed to pass unchanged (zero
  regression, as expected).
- Confirmed the Invoice Template scope decision by reading
  `ReceiptPreview.tsx` directly: it branches on the exact stored English
  string (`"Modern"`, `"Minimal"`, `"Compact (Thermal)"`, else
  `"Standard"`) to choose a receipt layout, so this is a real, checked
  reason to leave that one dropdown's option values untranslated, not
  an assumption.
- Visual smoke test (Playwright, a realistic mocked settings object
  covering every tab's real fields and toggle states, two real payment
  methods — "Cash" and the untranslated brand name "JazzCash" — and one
  real location "Main Godown" — all ten tabs exercised in English then
  Urdu, plus the Invoice Preview modal): confirms every tab's headings,
  field labels, switches, and buttons render real Urdu; confirms the
  real business name, payment methods, and location stay untranslated
  in both languages (checked immediately after visiting each relevant
  tab, not after navigating away, to avoid a false pass from stale page
  content); confirms the Invoice Preview modal's title correctly mixes
  translated chrome ("انوائس پیش منظر —", "دوہری کاپی") with the
  untranslated real `invoice_size`/`invoice_template` values ("A4",
  "Standard"). Zero console errors.
- `npx tsc --noEmit` and `npm run build:web` both pass with zero errors.

## Runtime checks to perform on Windows (not exercised in this Linux session)
1. `npm ci`
2. `npm run check`
3. `npm run build:web`
4. `npm run dev`
5. Login with `admin / admin123`.
6. Add a category and product (English + Urdu name, retail/wholesale price).
7. Add a customer and supplier.
8. Record a purchase and confirm stock and weighted-average cost update.
9. Record a POS sale (Retail and Wholesale) and confirm stock decreases and
   Save & Print opens the dual-copy 58mm print preview.
10. Test a credit sale, then a partial customer payment against it, and
    confirm the customer ledger balance.
11. Test a credit purchase and a supplier payment; confirm the supplier
    ledger balance.
12. Test a sales return and a purchase return; confirm stock and ledgers
    reverse correctly, and that over-quantity returns are rejected.
13. Open the cash register, run through a full day of the Section 69
    scenario, count denominations, and close — confirm MATCHED/SHORT/OVER.
14. Add an expense and run a date-range Profit & Loss report.
15. Verify the low-stock dashboard card.
16. Run the database integrity check and create a backup.
17. Toggle English/Urdu and confirm the sidebar/top bar switch to RTL.
18. Create a second user with a different role and confirm they can log in.
19. `npm run dist` and install the generated Windows x64 NSIS installer.

## Known production boundary
The source is installer-ready, but an actual Windows `.exe` is not claimed
as tested here because this Linux build environment cannot execute the
Windows desktop installer. The included GitHub Actions workflow builds the
installer on a Windows runner.

## Scope boundary
This session implemented a real Phase 1–3-and-more foundation (schema,
accounting, POS, ledgers, cash register, reports, dashboard, partial
localization, dual-copy receipt printing). It did **not** implement Tauri
packaging, cloud/offline sync, voice input, native ESC/POS printing,
granular permission enforcement, or the AI assistant — see `ROADMAP.md` for
the full, itemized list of what's deferred and why.
