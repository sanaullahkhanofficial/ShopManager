# ShopManager — Haji Abdul Manan & Abdul Hanan, Atta Dealer Pishin

Offline-first Retail + Wholesale POS, inventory and accounts management for
an atta/fertilizer/grains dealership in Pishin, Balochistan. Electron +
React + TypeScript + Tailwind CSS on the frontend, local SQLite
(better-sqlite3) on the backend, real transaction-based accounting.

See **[ROADMAP.md](./ROADMAP.md)** for an honest breakdown of what's fully
implemented versus intentionally deferred against the full project spec.

## First login
Username: `admin`
Password: `admin123`

Change the password immediately from Users & Permissions.

## What's included
- Local SQLite database — normal operation needs no internet
- Business branding pre-set to the correct name/address/currency
- Products with English + Urdu names, retail/wholesale/cost pricing, pack
  sizes, weighted-average cost, low-stock alerts
- Customers & suppliers with full contact fields, credit limits and ledgers
- POS with Retail/Wholesale pricing, multiple payment methods, credit sales
- Purchases with automatic weighted-average cost recalculation
- Sales & purchase returns with over-return prevention
- Daily cash register: open/close, denomination counter,
  expected-vs-actual reconciliation with a clear MATCHED/SHORT/OVER result
- Expenses by category
- Reports: date-range Sales/Purchases/Expenses and a real Profit & Loss
- Dashboard driven entirely by live database queries
- Dual-copy (Customer Copy / Office Copy) 58mm receipt printing via the
  browser print dialog, both copies from one finalized transaction
- Partial English/Urdu UI toggle with RTL layout
- Audit log covering the sensitive actions (sales, purchases, payments,
  price changes, stock adjustments, cash open/close, login, settings)
- Database backup (file copy) and SQLite integrity check
- Windows x64 NSIS installer configuration

## Development
```bash
npm install
npm run dev        # Vite + Electron, hot reload
npm run typecheck   # tsc --noEmit
npm run check       # syntax check + typecheck
npm run build:web   # production Vite build
npm run dist        # Windows x64 installer (run on/via a Windows CI runner)
```

## Verifying the accounting logic
The core accounting rules (Section 69 of the spec: opening cash, cash vs.
credit sales, customer/supplier payments, expenses, withdrawals →
expected closing cash) are covered by a headless integration test that
drives the real IPC handlers directly against a temporary SQLite database
— see `ROADMAP.md` for what it checks. It isn't wired into `npm test` yet
(no test runner is configured); run it directly with plain Node after
`npm rebuild better-sqlite3` (native module ABI must match the Node build,
not the Electron build, to run outside Electron).

## Important
The Windows `.exe` must be compiled on Windows (or a Windows CI runner)
because native SQLite/Electron modules are platform-specific. The included
GitHub Actions workflow builds the installer on a Windows runner.
