"use strict";

// Full normalized relational schema for EduManage.
// Every table uses IF NOT EXISTS so this can run idempotently on every launch.
// created_at / updated_at are ISO-8601 UTC strings. Foreign keys are enforced
// (PRAGMA foreign_keys = ON is set by the connection module).
//
// SCHEMA_VERSION tracks structural migrations applied via db/migrate.cjs.
const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
-- ===================== CORE / TENANT =====================
CREATE TABLE IF NOT EXISTS schema_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'My School',
  logo_path TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  province TEXT DEFAULT '',
  country TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  principal_name TEXT DEFAULT '',
  motto TEXT DEFAULT '',
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',
  language TEXT DEFAULT 'en',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '24h',
  receipt_prefix TEXT DEFAULT 'REC',
  voucher_prefix TEXT DEFAULT 'VCH',
  student_id_prefix TEXT DEFAULT 'STU',
  admission_no_prefix TEXT DEFAULT 'ADM',
  employee_id_prefix TEXT DEFAULT 'EMP',
  theme_primary_color TEXT DEFAULT '#4f46e5',
  theme_mode TEXT DEFAULT 'system',
  receipt_footer TEXT DEFAULT 'Thank you.',
  setup_complete INTEGER DEFAULT 0,
  installed_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ===================== USERS / RBAC =====================
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  is_system INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  module TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  role_id INTEGER NOT NULL REFERENCES roles(id),
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  linked_teacher_id INTEGER,
  linked_staff_id INTEGER,
  linked_student_id INTEGER,
  linked_parent_id INTEGER,
  must_change_password INTEGER DEFAULT 0,
  failed_login_count INTEGER DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS login_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  user_id INTEGER,
  success INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

-- ===================== ACADEMIC STRUCTURE =====================
CREATE TABLE IF NOT EXISTS academic_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_teacher_id INTEGER,
  room TEXT DEFAULT '',
  capacity INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  UNIQUE(class_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  department TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER,
  UNIQUE(class_id, subject_id)
);

-- ===================== PEOPLE =====================
CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_code TEXT UNIQUE NOT NULL,
  father_name TEXT DEFAULT '',
  mother_name TEXT DEFAULT '',
  guardian_name TEXT DEFAULT '',
  relationship TEXT DEFAULT 'Father',
  phone TEXT NOT NULL,
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  occupation TEXT DEFAULT '',
  cnic TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT UNIQUE NOT NULL,
  admission_no TEXT UNIQUE NOT NULL,
  registration_no TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  father_name TEXT DEFAULT '',
  mother_name TEXT DEFAULT '',
  dob TEXT,
  gender TEXT DEFAULT 'Other' CHECK (gender IN ('Male','Female','Other')),
  blood_group TEXT DEFAULT '',
  religion TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  province TEXT DEFAULT '',
  photo_path TEXT DEFAULT '',
  admission_date TEXT NOT NULL,
  session_id INTEGER REFERENCES academic_sessions(id),
  class_id INTEGER REFERENCES classes(id),
  section_id INTEGER REFERENCES sections(id),
  roll_number TEXT DEFAULT '',
  previous_school TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','graduated','transferred','suspended','left')),
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(first_name, last_name);

CREATE TABLE IF NOT EXISTS student_parents (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  is_primary INTEGER DEFAULT 1,
  PRIMARY KEY (student_id, parent_id)
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  photo_path TEXT DEFAULT '',
  gender TEXT DEFAULT 'Other',
  dob TEXT,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  qualification TEXT DEFAULT '',
  experience_years REAL DEFAULT 0,
  joining_date TEXT,
  department TEXT DEFAULT '',
  basic_salary REAL DEFAULT 0,
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active','on_leave','terminated','resigned')),
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS teacher_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  photo_path TEXT DEFAULT '',
  gender TEXT DEFAULT 'Other',
  dob TEXT,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  department TEXT DEFAULT '',
  designation TEXT NOT NULL,
  joining_date TEXT,
  basic_salary REAL DEFAULT 0,
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active','on_leave','terminated','resigned')),
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- ===================== ADMISSIONS =====================
CREATE TABLE IF NOT EXISTS admissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_no TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  father_name TEXT DEFAULT '',
  dob TEXT,
  gender TEXT DEFAULT 'Other',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  applying_for_class_id INTEGER REFERENCES classes(id),
  session_id INTEGER REFERENCES academic_sessions(id),
  previous_school TEXT DEFAULT '',
  test_score REAL,
  interview_notes TEXT DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'application'
    CHECK (stage IN ('application','review','approved','enrolled','rejected')),
  rejection_reason TEXT DEFAULT '',
  converted_student_id INTEGER REFERENCES students(id),
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- ===================== ATTENDANCE =====================
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  section_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','leave','half_day')),
  remarks TEXT DEFAULT '',
  marked_by INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id, section_id, date);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_type TEXT NOT NULL CHECK (person_type IN ('teacher','staff')),
  person_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','leave','half_day')),
  remarks TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(person_type, person_id, date)
);

-- ===================== TIMETABLE =====================
CREATE TABLE IF NOT EXISTS timetable_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_index INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id),
  teacher_id INTEGER REFERENCES teachers(id),
  room TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(section_id, day_of_week, period_index)
);

-- ===================== HOMEWORK / NOTICES =====================
CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  section_id INTEGER REFERENCES sections(id),
  subject_id INTEGER REFERENCES subjects(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  attachment_path TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all','teachers','students','parents','staff','class')),
  class_id INTEGER REFERENCES classes(id),
  section_id INTEGER REFERENCES sections(id),
  publish_date TEXT NOT NULL,
  expiry_date TEXT,
  attachment_path TEXT DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL
);

-- ===================== FEES =====================
CREATE TABLE IF NOT EXISTS fee_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  is_recurring INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES fee_categories(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES academic_sessions(id),
  amount REAL NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','term','annual','one_time')),
  created_at TEXT NOT NULL,
  UNIQUE(class_id, category_id, session_id, frequency)
);

CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage','fixed','full')),
  value REAL NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_no TEXT UNIQUE NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES academic_sessions(id),
  period_label TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  gross_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  late_fee_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','void')),
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON fee_invoices(status, due_date);

CREATE TABLE IF NOT EXISTS fee_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES fee_categories(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT UNIQUE NOT NULL,
  invoice_id INTEGER NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id),
  amount REAL NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','bank_transfer','card','other')),
  reference TEXT DEFAULT '',
  paid_date TEXT NOT NULL,
  received_by INTEGER,
  voided INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON fee_payments(student_id, paid_date);

CREATE TABLE IF NOT EXISTS student_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('opening_balance','invoice','discount','payment','adjustment')),
  reference_table TEXT,
  reference_id INTEGER,
  description TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  balance_after REAL NOT NULL DEFAULT 0,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_student ON student_ledger(student_id, entry_date);

-- ===================== EXPENSES / PAYROLL =====================
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_no TEXT UNIQUE NOT NULL,
  category_id INTEGER REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  vendor TEXT DEFAULT '',
  attachment_path TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  expense_date TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('teacher','staff')),
  person_id INTEGER NOT NULL,
  basic_salary REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  bonuses REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  advances REAL NOT NULL DEFAULT 0,
  net_salary REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  paid_date TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(month, person_type, person_id)
);

-- ===================== EXAMS =====================
CREATE TABLE IF NOT EXISTS grading_scales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_percent REAL NOT NULL,
  max_percent REAL NOT NULL,
  grade TEXT NOT NULL,
  remarks TEXT DEFAULT '',
  gpa REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom'
    CHECK (type IN ('monthly_test','midterm','final','quiz','assessment','custom')),
  session_id INTEGER REFERENCES academic_sessions(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','published')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date TEXT,
  max_marks REAL NOT NULL DEFAULT 100,
  passing_marks REAL NOT NULL DEFAULT 40,
  UNIQUE(exam_id, subject_id)
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_subject_id INTEGER NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  obtained_marks REAL NOT NULL DEFAULT 0,
  remarks TEXT DEFAULT '',
  entered_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(exam_subject_id, student_id)
);

CREATE TABLE IF NOT EXISTS report_card_remarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_remarks TEXT DEFAULT '',
  principal_remarks TEXT DEFAULT '',
  UNIQUE(exam_id, student_id)
);

-- ===================== FUTURE-READY MODULES (schema only; UI marked planned) ==========
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn TEXT, title TEXT NOT NULL, author TEXT, publisher TEXT, category TEXT,
  quantity INTEGER DEFAULT 0, available_copies INTEGER DEFAULT 0, shelf TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS library_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER REFERENCES books(id),
  student_id INTEGER REFERENCES students(id), issue_date TEXT, due_date TEXT,
  return_date TEXT, fine REAL DEFAULT 0, status TEXT DEFAULT 'issued', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, registration_no TEXT UNIQUE, vehicle_type TEXT,
  capacity INTEGER, driver_name TEXT, driver_phone TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, vehicle_id INTEGER REFERENCES vehicles(id),
  fee_amount REAL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS route_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT, route_id INTEGER REFERENCES routes(id), stop_name TEXT NOT NULL, stop_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS student_transport (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER REFERENCES students(id), route_id INTEGER REFERENCES routes(id),
  stop_id INTEGER REFERENCES route_stops(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, quantity REAL DEFAULT 0,
  unit TEXT DEFAULT '', min_quantity REAL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER REFERENCES inventory_items(id), type TEXT NOT NULL,
  quantity REAL NOT NULL, reference TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL, file_path TEXT NOT NULL, uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER REFERENCES students(id), type TEXT NOT NULL,
  file_path TEXT, issued_date TEXT, issued_by INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discipline_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER REFERENCES students(id), incident_date TEXT NOT NULL,
  description TEXT NOT NULL, action_taken TEXT, reported_by INTEGER, status TEXT DEFAULT 'open',
  parent_notified INTEGER DEFAULT 0, created_at TEXT NOT NULL
);

-- ===================== SYSTEM =====================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  size_bytes INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
`;

module.exports = { SCHEMA_SQL, SCHEMA_VERSION };
