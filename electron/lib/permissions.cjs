"use strict";

// Central permission catalog. Every entry becomes a row in `permissions`.
// Enforcement happens in electron/ipc/*.cjs via requirePermission(), never
// only by hiding buttons in the renderer.
const PERMISSIONS = [
  // Students
  ["students.view", "View students", "Students"],
  ["students.create", "Add students", "Students"],
  ["students.edit", "Edit students", "Students"],
  ["students.archive", "Archive/delete students", "Students"],
  // Parents
  ["parents.view", "View parents", "Parents"],
  ["parents.manage", "Manage parents", "Parents"],
  // Admissions
  ["admissions.view", "View admissions", "Admissions"],
  ["admissions.manage", "Manage admissions", "Admissions"],
  // Academic
  ["academic.manage", "Manage classes/sections/subjects/sessions", "Academic"],
  // Teachers / Staff
  ["teachers.manage", "Manage teachers", "People"],
  ["staff.manage", "Manage staff", "People"],
  // Attendance
  ["attendance.manage", "Manage student attendance", "Attendance"],
  ["attendance.staff", "Manage staff attendance", "Attendance"],
  // Timetable / Homework / Notices
  ["timetable.manage", "Manage timetable", "Academic"],
  ["homework.manage", "Manage homework", "Academic"],
  ["notices.manage", "Manage notices", "Communication"],
  // Fees
  ["fees.view", "View fees", "Finance"],
  ["fees.collect", "Collect fees", "Finance"],
  ["fees.manage", "Edit fee structures/vouchers", "Finance"],
  ["scholarships.manage", "Manage scholarships & discounts", "Finance"],
  // Expenses / Payroll
  ["expenses.manage", "Manage expenses", "Finance"],
  ["payroll.view", "View payroll", "Finance"],
  ["payroll.manage", "Manage payroll", "Finance"],
  // Exams
  ["exams.manage", "Manage exams", "Academic"],
  ["marks.enter", "Enter marks", "Academic"],
  ["marks.edit", "Edit marks", "Academic"],
  ["results.publish", "Publish results", "Academic"],
  // Reports
  ["reports.view", "View reports", "Reports"],
  ["reports.export", "Export reports", "Reports"],
  // Administration
  ["users.manage", "Manage users", "Administration"],
  ["roles.manage", "Manage roles & permissions", "Administration"],
  ["settings.manage", "Manage settings", "Administration"],
  ["audit.view", "View audit logs", "Administration"],
  ["backup.create", "Create backups", "Administration"],
  ["backup.restore", "Restore backups", "Administration"],
  ["dashboard.view", "View dashboard", "Dashboard"],
];

// Default role -> permission-code mapping. "*" grants everything (Super Admin / Owner).
const DEFAULT_ROLES = {
  "Super Admin": ["*"],
  "School Owner": ["*"],
  Principal: [
    "dashboard.view", "students.view", "students.create", "students.edit", "students.archive",
    "parents.view", "parents.manage", "admissions.view", "admissions.manage", "academic.manage",
    "teachers.manage", "staff.manage", "attendance.manage", "attendance.staff", "timetable.manage",
    "homework.manage", "notices.manage", "fees.view", "fees.manage", "scholarships.manage",
    "expenses.manage", "payroll.view", "payroll.manage", "exams.manage", "marks.enter", "marks.edit",
    "results.publish", "reports.view", "reports.export", "users.manage", "audit.view",
  ],
  "Vice Principal": [
    "dashboard.view", "students.view", "students.create", "students.edit", "parents.view",
    "admissions.view", "admissions.manage", "attendance.manage", "timetable.manage", "homework.manage",
    "notices.manage", "exams.manage", "marks.enter", "marks.edit", "reports.view", "reports.export",
  ],
  Administrator: [
    "dashboard.view", "students.view", "students.create", "students.edit", "students.archive",
    "parents.view", "parents.manage", "admissions.view", "admissions.manage", "academic.manage",
    "teachers.manage", "staff.manage", "attendance.manage", "attendance.staff", "timetable.manage",
    "homework.manage", "notices.manage", "reports.view", "reports.export", "users.manage",
    "settings.manage", "backup.create", "backup.restore", "audit.view",
  ],
  Accountant: [
    "dashboard.view", "students.view", "fees.view", "fees.collect", "fees.manage",
    "scholarships.manage", "expenses.manage", "payroll.view", "payroll.manage",
    "reports.view", "reports.export",
  ],
  Teacher: [
    "dashboard.view", "students.view", "attendance.manage", "homework.manage", "exams.manage",
    "marks.enter", "reports.view",
  ],
  "Class Teacher": [
    "dashboard.view", "students.view", "students.edit", "attendance.manage", "homework.manage",
    "exams.manage", "marks.enter", "marks.edit", "reports.view",
  ],
  Librarian: ["dashboard.view", "students.view", "reports.view"],
  "Transport Manager": ["dashboard.view", "students.view", "reports.view"],
  "HR Manager": ["dashboard.view", "teachers.manage", "staff.manage", "payroll.view", "payroll.manage", "reports.view"],
  Receptionist: [
    "dashboard.view", "students.view", "students.create", "parents.view", "parents.manage",
    "admissions.view", "admissions.manage", "fees.view", "fees.collect", "notices.manage",
  ],
  Parent: ["dashboard.view"],
  Student: ["dashboard.view"],
};

module.exports = { PERMISSIONS, DEFAULT_ROLES };
