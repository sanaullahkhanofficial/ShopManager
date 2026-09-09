# Verification Checklist

This documents what was actually verified while building EduManage, not just
what was written.

## Automated checks (run and passing)

- `npm run check` — every Electron main-process file (`db/`, `lib/`,
  `services/`, `ipc/`, `main.cjs`, `preload.cjs`) parses with `node --check`.
- `npm run typecheck` — `tsc --noEmit` across the entire React/TypeScript
  frontend: **zero errors**.
- `npm run build:web` — production Vite build completes successfully.
- `electron-builder install-app-deps` — native `better-sqlite3` module
  rebuilds cleanly against Electron's Node ABI.

## Functional tests actually executed against the real database/services

- **DB bootstrap:** fresh SQLite file created, schema applied, 14 default
  roles + 36 permissions seeded, bootstrap admin created, demo data loader
  produced 100 students / 15 teachers / 10 classes as expected.
- **Fee lifecycle (end-to-end, via the real service layer):** created a class,
  fee structure (5000/month), student, and a 20%-off scholarship → generated
  a voucher and confirmed gross=5000, discount=1000, total=4000 → attempted
  an overpayment of 9999 and confirmed it was **rejected** with a clear
  error → collected 1500 then 2500 → confirmed the invoice reached
  `status=paid`, `balance=0`, and the student ledger's running balance was
  correct at every step (5000 → 4000 → 2500 → 0), with two distinct
  sequential receipt numbers issued.
- **Exams:** created an exam with two subjects, attempted to save marks above
  the maximum (150/100) and confirmed it was **rejected**; saved valid marks
  for two students and confirmed correct total/percentage/grade and class
  rank (position) computation, and that a report card correctly compiled a
  single student's result.
- **IPC layer:** registered all 154 IPC channels against a fake `ipcMain` and
  confirmed representative calls succeed, and that a permission-less role is
  **rejected** with `FORBIDDEN` when calling a protected channel
  (`users:list`) — proving enforcement happens in the business-logic layer,
  not only by hiding UI buttons.
- **Full app, in a real Electron renderer (via Xvfb), end to end:**
  1. Launched the packaged renderer against the compiled preload/IPC stack.
  2. Confirmed the **Setup Wizard** renders on first launch (no data yet).
  3. Drove `setup:complete` through the same `window.api.invoke` bridge the
     UI uses, creating a school, session, classes, fee categories, and an
     administrator account, with demo data loaded.
  4. Reloaded and confirmed the **Login** screen now shows the configured
     school's name and branding.
  5. Logged in as the new administrator and confirmed the returned user
     object carries the correct role and full permission set.
  6. Reloaded post-login and confirmed the **Dashboard** renders the full
     sidebar (all implemented modules) and real KPI cards reflecting the
     seeded data (Total Students: 100, Teachers: 15) — not placeholder
     numbers.

## Known gaps (intentionally not built this pass — see README)

Library, Transport, Inventory, Document Management, Certificate Generation,
Discipline tracking, and external Communication (SMS/Email/WhatsApp)
integrations have schema but no UI; they are shown as locked "planned" items
in the sidebar rather than non-functional buttons.

## Not verified in this pass

- The actual Windows NSIS installer build (`npm run dist`) — this requires a
  Windows runner; the included GitHub Actions workflow builds it in CI.
- Multi-week real-world usage / large dataset (10,000+ students) performance;
  pagination and indexed columns are in place, but load testing was not run.
