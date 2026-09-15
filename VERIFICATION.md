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
