# EduManage — School Management System / School ERP

An offline-first, desktop School Management System for private schools, government
schools, academies, colleges and multi-campus institutions. Real SQLite database,
enforced role-based permissions, and end-to-end financial integrity — not a UI mockup.

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS, a small shadcn/ui-style
  component kit (Radix primitives), Recharts, React Hook Form + Zod, Zustand.
- **Desktop shell:** Electron, with `contextIsolation` on, `nodeIntegration` off,
  `sandbox` on, and a preload script that only exposes an explicit allow-list of
  IPC channels.
- **Database:** SQLite via `better-sqlite3`, WAL mode, foreign keys enforced,
  every multi-step write wrapped in a database transaction.
- **Architecture:** `electron/db` (schema/connection/seed/demo data),
  `electron/lib` (security, permissions, id generators, audit, ledger),
  `electron/services` (one file per business domain — students, fees, exams, …),
  `electron/ipc` (thin IPC routing that enforces permissions and normalizes
  errors before anything reaches the renderer). The frontend mirrors this with
  `src/pages`, `src/components`, `src/store`, `src/lib`.

## First login

After the first-run **Setup Wizard** creates your administrator account, sign in
with the username and password you chose there. Until setup is completed, a
bootstrap account (`admin` / `admin123`) exists only to be replaced by the wizard.

## What's implemented (real, functional, tested)

- **Setup & administration:** 5-step first-run wizard (school profile, academic
  session/classes/subjects, fee categories & rates, administrator account,
  optional demo data), settings center, role & granular permission management
  enforced server-side (not just hidden buttons), user management, audit log
  (read-only), database backup/restore with integrity checks, system info.
- **People:** Students (full CRUD, status lifecycle, CSV import, search/filter,
  profile with attendance/fees/exam tabs), Parents/Guardians (multi-child
  linking), Admissions pipeline (application → review → approved → enrolled/
  rejected, with automatic conversion to a Student + admission number),
  Teachers and Staff records with class/subject assignments.
- **Academic operations:** Classes/Sections/Subjects/Sessions, daily attendance
  (bulk "mark all present" + per-student override, monthly reports), a
  conflict-checked timetable builder (rejects double-booked teachers/rooms/
  sections), homework, notices with audience targeting.
- **Finance (the part that must never be wrong):** fee categories & per-class
  structures, scholarships/discounts (percentage/fixed/full) applied
  automatically, single or bulk voucher generation, a POS-style collection
  screen with auto-generated sequential receipt numbers, a strict rule against
  overpayment, and a per-student running ledger where every entry's balance is
  computed inside the same transaction as the event that caused it. Expenses
  and payroll (basic + allowances + bonuses − deductions − advances = net)
  round out the accounting side, with printable receipts, vouchers and salary
  slips (via Electron's native PDF/print pipeline — no screenshots).
- **Exams:** configurable exam types & subject max/passing marks, bulk marks
  entry that rejects marks above the maximum, a configurable grading scale,
  automatic percentage/grade/pass-fail and class-rank computation, and
  printable report cards.
- **Dashboards & reporting:** role-aware KPIs and charts computed from live
  queries (never hard-coded), a reporting center (students/attendance/finance)
  with CSV and real Excel (.xlsx) export plus print, a global Ctrl+K command
  palette with live search, and a notification center driven entirely by
  computed signals (overdue fees, low attendance, pending marks, …).

## What's intentionally marked "planned"

Per the project's own "no fake functionality" rule, Library, Transport,
Inventory, Document Management, Certificate Generation, Discipline tracking
and external Communication integrations (SMS/Email/WhatsApp) have their
database schema designed in (see `electron/db/schema.cjs`) so they can be
built without a redesign, but their UI is intentionally not wired up yet.
They appear in the sidebar as clearly locked/"planned" entries rather than as
buttons that silently do nothing.

## Development

```bash
npm install
npm run dev        # Vite dev server + Electron
npm run typecheck  # tsc --noEmit
npm run check      # syntax-checks every Electron main-process file
npm run build:web  # production Vite build
npm run dist       # Windows x64 NSIS installer (run on/for Windows)
```

## One-click installer build

The repository includes a GitHub Actions workflow that builds the Windows x64
NSIS installer on a Windows runner. End users only need the resulting
`EduManage-Setup-<version>.exe`; they do not need Node.js or a C++ toolchain.
Native modules (`better-sqlite3`) are rebuilt for Electron's ABI automatically
via `electron-builder install-app-deps` on `npm install`.

## Data & privacy

All data lives in a local SQLite database inside the OS user-data directory —
nothing is sent to an external server. Passwords are hashed with `scrypt` and
a random salt; they are never stored or logged in plain text.
