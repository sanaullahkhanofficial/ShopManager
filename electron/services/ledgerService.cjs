"use strict";

const { AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { appendLedgerEntry, getLedger, getCurrentBalance } = require("../lib/ledger.cjs");

function getStudentLedger(db, studentId) {
  const student = db.prepare("SELECT id, first_name, last_name, admission_no FROM students WHERE id = ?").get(studentId);
  if (!student) throw new AppError("Student not found.");
  return { student, entries: getLedger(db, studentId), currentBalance: getCurrentBalance(db, studentId) };
}

/** One-time opening balance entry, typically set when migrating a student from a previous system. */
function setOpeningBalance(db, session, { studentId, amount, entryDate, description }) {
  if (amount === undefined) throw new AppError("Amount is required.");
  const existing = db.prepare("SELECT COUNT(*) c FROM student_ledger WHERE student_id = ? AND entry_type = 'opening_balance'").get(studentId).c;
  if (existing > 0) throw new AppError("An opening balance has already been recorded for this student.");
  const tx = db.transaction(() =>
    appendLedgerEntry(db, {
      studentId, entryType: "opening_balance", description: description || "Opening balance",
      debit: Number(amount) > 0 ? Number(amount) : 0, credit: Number(amount) < 0 ? -Number(amount) : 0,
      entryDate: entryDate || new Date().toISOString().slice(0, 10),
    })
  );
  const balance = tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "set_opening_balance", entity: "student_ledger", entityId: studentId, details: amount });
  return { balance };
}

module.exports = { getStudentLedger, setOpeningBalance };
