"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

function listForStudent(db, studentId) {
  return db.prepare("SELECT * FROM scholarships WHERE student_id = ? ORDER BY start_date DESC").all(studentId);
}

function listAll(db) {
  return db
    .prepare(
      `SELECT sc.*, s.first_name, s.last_name, s.admission_no
       FROM scholarships sc JOIN students s ON s.id = sc.student_id
       ORDER BY sc.created_at DESC`
    )
    .all();
}

function create(db, session, payload) {
  const { studentId, name, type, value, startDate, endDate, notes } = payload;
  if (!studentId || !name || !type || !startDate) throw new AppError("Student, name, type and start date are required.");
  if (!["percentage", "fixed", "full"].includes(type)) throw new AppError("Invalid scholarship type.");
  if (type === "percentage" && (value < 0 || value > 100)) throw new AppError("Percentage discount must be between 0 and 100.");
  if (type === "fixed" && value < 0) throw new AppError("Fixed discount cannot be negative.");
  const info = db
    .prepare(
      `INSERT INTO scholarships (student_id, name, type, value, start_date, end_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(studentId, name, type, type === "full" ? 100 : value, startDate, endDate || null, notes || "", nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "scholarships", entityId: info.lastInsertRowid, details: `${name} for student ${studentId}` });
  return { id: info.lastInsertRowid };
}

function setStatus(db, session, id, status) {
  if (!["active", "expired", "revoked"].includes(status)) throw new AppError("Invalid status.");
  db.prepare("UPDATE scholarships SET status = ? WHERE id = ?").run(status, id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: `status_${status}`, entity: "scholarships", entityId: id });
  return { success: true };
}

/** Computes the active discount amount for a student against a gross fee amount on a given date. */
function computeDiscount(db, studentId, grossAmount, onDate) {
  const active = db
    .prepare(
      `SELECT * FROM scholarships WHERE student_id = ? AND status = 'active'
       AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`
    )
    .all(studentId, onDate, onDate);
  let discount = 0;
  for (const s of active) {
    if (s.type === "full") discount += grossAmount;
    else if (s.type === "percentage") discount += (grossAmount * s.value) / 100;
    else discount += s.value;
  }
  return Math.min(discount, grossAmount);
}

module.exports = { listForStudent, listAll, create, setStatus, computeDiscount };
