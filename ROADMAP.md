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
- **Granular permission enforcement** (Section 39). Roles exist on users,
  but there is no per-action permission matrix gating IPC calls yet — any
  logged-in user can currently call any handler.
- **AI Business Assistant** (Sections 59–60) — no page, no query layer.
- **Full UI localization.** The Urdu toggle covers navigation/chrome and
  product names, not every label in every form.
- **Backup encryption, scheduled/cloud backup.** Backup is a plain SQLite
  file copy to a location you choose; no encryption or automatic schedule.
- **Data-grid features** (Section 53): column visibility, CSV/PDF export,
  server-side pagination — tables are simple, unpaginated, client-filtered.

## Suggested next phases

1. Granular permissions (Section 39) — small, high-value, no architecture change.
2. CSV/PDF export on Reports and DataTable.
3. Native ESC/POS printing for the Electron build (node-thermal-printer or
   escpos over USB) alongside the existing browser-print path.
4. Voice input as a scoped feature (Web Speech API first, cloud STT later),
   starting with product search and customer name/address fields, always
   behind the confirm-before-save pattern from Section 19.
5. Cloud/offline sync — this is the biggest remaining subsystem and
   deserves its own dedicated design pass (server API, UUIDs, sync queue,
   conflict UI) rather than being bolted on incrementally.
