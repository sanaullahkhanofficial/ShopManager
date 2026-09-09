"use strict";

const { nowIso } = require("./security.cjs");

/**
 * Appends one entry to a student's financial ledger, computing the new
 * running balance from the student's last entry. Must always be called
 * from inside the same db.transaction() as the event that caused it
 * (invoice created, discount applied, payment received) so the ledger can
 * never drift from the source records.
 */
function appendLedgerEntry(db, { studentId, entryType, referenceTable, referenceId, description, debit = 0, credit = 0, entryDate }) {
  const last = db
    .prepare("SELECT balance_after FROM student_ledger WHERE student_id = ? ORDER BY id DESC LIMIT 1")
    .get(studentId);
  const previousBalance = last ? last.balance_after : 0;
  const balanceAfter = Math.round((previousBalance + debit - credit) * 100) / 100;
  db.prepare(
    `INSERT INTO student_ledger (student_id, entry_type, reference_table, reference_id, description, debit,
       credit, balance_after, entry_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, entryType, referenceTable || null, referenceId || null, description, debit, credit, balanceAfter, entryDate || nowIso().slice(0, 10), nowIso());
  return balanceAfter;
}

function getLedger(db, studentId) {
  return db.prepare("SELECT * FROM student_ledger WHERE student_id = ? ORDER BY entry_date, id").all(studentId);
}

function getCurrentBalance(db, studentId) {
  const last = db
    .prepare("SELECT balance_after FROM student_ledger WHERE student_id = ? ORDER BY id DESC LIMIT 1")
    .get(studentId);
  return last ? last.balance_after : 0;
}

module.exports = { appendLedgerEntry, getLedger, getCurrentBalance };
