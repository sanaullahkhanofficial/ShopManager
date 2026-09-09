"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

const VALID_STATUSES = ["present", "absent", "late", "leave", "half_day"];

/** Returns the roster for a class/section on a date, with any existing attendance marks joined in. */
function getClassAttendance(db, { classId, sectionId, date }) {
  if (!classId || !date) throw new AppError("Class and date are required.");
  const students = db
    .prepare(
      `SELECT s.id AS student_id, s.student_code, s.admission_no, s.first_name, s.last_name, s.roll_number,
              a.status, a.remarks
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
       WHERE s.class_id = ? AND (? IS NULL OR s.section_id = ?) AND s.status = 'active'
       ORDER BY CAST(s.roll_number AS INTEGER), s.first_name`
    )
    .all(date, classId, sectionId || null, sectionId || null);
  return students;
}

/** Bulk-saves a full day's attendance for a class/section inside one transaction. */
function saveClassAttendance(db, session, { classId, sectionId, date, entries }) {
  if (!classId || !date) throw new AppError("Class and date are required.");
  if (!Array.isArray(entries) || entries.length === 0) throw new AppError("No attendance entries provided.");
  for (const e of entries) {
    if (!VALID_STATUSES.includes(e.status)) {
      throw new AppError(`Invalid attendance status "${e.status}".`);
    }
  }
  const upsert = db.prepare(
    `INSERT INTO attendance (student_id, class_id, section_id, date, status, remarks, marked_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, remarks = excluded.remarks,
       marked_by = excluded.marked_by, class_id = excluded.class_id, section_id = excluded.section_id`
  );
  const tx = db.transaction(() => {
    for (const e of entries) {
      upsert.run(e.studentId, classId, sectionId || null, date, e.status, e.remarks || "", session.userId, nowIso());
    }
  });
  tx();
  recordAudit(db, {
    userId: session.userId, actorName: session.displayName, action: "mark_attendance", entity: "attendance",
    details: `class ${classId} on ${date}, ${entries.length} students`,
  });
  return { success: true, count: entries.length };
}

function studentAttendanceSummary(db, studentId, { from, to } = {}) {
  const clauses = ["student_id = ?"];
  const params = [studentId];
  if (from) { clauses.push("date >= ?"); params.push(from); }
  if (to) { clauses.push("date <= ?"); params.push(to); }
  const where = clauses.join(" AND ");
  const rows = db.prepare(`SELECT date, status, remarks FROM attendance WHERE ${where} ORDER BY date DESC`).all(...params);
  const total = rows.length;
  const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const percentage = total ? Math.round((present / total) * 1000) / 10 : 0;
  return { rows, total, present, percentage };
}

function classMonthlyReport(db, { classId, sectionId, month }) {
  // month = 'YYYY-MM'
  const rows = db
    .prepare(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.roll_number,
              SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS present_days,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
              COUNT(a.id) AS marked_days
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id AND a.date LIKE ?
       WHERE s.class_id = ? AND (? IS NULL OR s.section_id = ?) AND s.status = 'active'
       GROUP BY s.id
       ORDER BY CAST(s.roll_number AS INTEGER)`
    )
    .all(`${month}%`, classId, sectionId || null, sectionId || null);
  return rows.map((r) => ({
    ...r,
    percentage: r.marked_days ? Math.round((r.present_days / r.marked_days) * 1000) / 10 : 0,
  }));
}

// ---------- Staff / Teacher attendance ----------
function getStaffAttendance(db, { date, personType = "teacher" }) {
  const table = personType === "teacher" ? "teachers" : "staff";
  return db
    .prepare(
      `SELECT p.id AS person_id, p.employee_id, p.first_name, p.last_name, sa.status, sa.remarks
       FROM ${table} p
       LEFT JOIN staff_attendance sa ON sa.person_id = p.id AND sa.person_type = ? AND sa.date = ?
       WHERE p.employment_status = 'active'
       ORDER BY p.first_name`
    )
    .all(personType, date);
}

function saveStaffAttendance(db, session, { date, personType, entries }) {
  if (!date || !Array.isArray(entries)) throw new AppError("Date and attendance entries are required.");
  const upsert = db.prepare(
    `INSERT INTO staff_attendance (person_type, person_id, date, status, remarks, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(person_type, person_id, date) DO UPDATE SET status = excluded.status, remarks = excluded.remarks`
  );
  const tx = db.transaction(() => {
    for (const e of entries) {
      if (!VALID_STATUSES.includes(e.status)) throw new AppError(`Invalid attendance status "${e.status}".`);
      upsert.run(personType, e.personId, date, e.status, e.remarks || "", nowIso());
    }
  });
  tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "mark_staff_attendance", entity: "staff_attendance", details: `${personType} on ${date}` });
  return { success: true };
}

module.exports = {
  getClassAttendance, saveClassAttendance, studentAttendanceSummary, classMonthlyReport,
  getStaffAttendance, saveStaffAttendance, VALID_STATUSES,
};
