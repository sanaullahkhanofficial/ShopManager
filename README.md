# ShopManager 1.0 — Windows Desktop

Offline-first inventory, POS, purchasing, customer/supplier accounts, expenses, reports, user access and SQLite backup.

## First login
Username: `admin`
Password: `admin123`

Change the password immediately from Users & Access.

## Included
- Local SQLite database; normal operation does not require internet
- Shop branding/settings and currency
- Product/category management with package sizes
- Stock ledger and manual adjustments
- POS sales with credit/customer ledger
- Purchases with weighted-average cost
- Supplier payable ledger
- Customer/supplier payments
- Expenses
- Daily dashboard and date-range reports
- Low-stock alerts
- User creation and secure scrypt password hashing
- Database backup and SQLite integrity check
- Windows x64 NSIS installer configuration

## One-click installer build
The repository includes a GitHub Actions workflow that builds the Windows x64 NSIS installer on a Windows runner. End users only need the resulting `ShopManager-Setup-1.0.0.exe`; they do not need Node.js, Python, Visual Studio, or npm.

For developers who want to build locally, use Node.js 22 LTS and the normal Windows C++ toolchain required for native SQLite/Electron modules.

## Important
This package is the final source release and installer-ready build configuration. The actual Windows `.exe` must be compiled on Windows (or a Windows CI runner) because native SQLite/Electron modules are platform-specific. The source has a syntax check via `npm run check`.
