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
