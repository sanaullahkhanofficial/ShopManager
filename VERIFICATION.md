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
