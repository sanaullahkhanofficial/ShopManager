"use strict";

/**
 * Sequential, human-readable ID generators.
 * All are computed from the current max in the DB inside the same
 * transaction as the insert that consumes them, so they stay gapless
 * per calendar year and collision-free even under WAL concurrency
 * (better-sqlite3 transactions on a single connection are serialized).
 */

function nextSequence(db, table, column, prefix, year, pad = 5) {
  const like = `${prefix}-${year}-%`;
  const row = db
    .prepare(
      `SELECT ${column} AS code FROM ${table} WHERE ${column} LIKE ? ORDER BY id DESC LIMIT 1`
    )
    .get(like);
  let next = 1;
  if (row && row.code) {
    const parts = row.code.split("-");
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(pad, "0")}`;
}

function generateStudentCode(db, prefix) {
  const year = new Date().getFullYear();
  return nextSequence(db, "students", "student_code", prefix, year, 5);
}

function generateAdmissionNo(db, prefix) {
  const year = new Date().getFullYear();
  return nextSequence(db, "students", "admission_no", prefix, year, 5);
}

function generateApplicationNo(db) {
  const year = new Date().getFullYear();
  return nextSequence(db, "admissions", "application_no", "APP", year, 5);
}

function generateEmployeeId(db, table, prefix) {
  const year = new Date().getFullYear();
  return nextSequence(db, table, "employee_id", prefix, year, 4);
}

function generateReceiptNo(db, prefix) {
  const year = new Date().getFullYear();
  return nextSequence(db, "fee_payments", "receipt_no", prefix, year, 6);
}

function generateVoucherNo(db, prefix) {
  const year = new Date().getFullYear();
  return nextSequence(db, "fee_invoices", "voucher_no", prefix, year, 6);
}

function generateExpenseNo(db) {
  const year = new Date().getFullYear();
  return nextSequence(db, "expenses", "expense_no", "EXP", year, 5);
}

module.exports = {
  generateStudentCode,
  generateAdmissionNo,
  generateApplicationNo,
  generateEmployeeId,
  generateReceiptNo,
  generateVoucherNo,
  generateExpenseNo,
};
