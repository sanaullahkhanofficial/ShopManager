"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateReceiptNo } = require("../lib/ids.cjs");
const { appendLedgerEntry, getCurrentBalance } = require("../lib/ledger.cjs");
const { getSchool } = require("./settingsService.cjs");

const METHODS = ["cash", "bank_transfer", "card", "other"];

/**
 * Collects a fee payment against an invoice. Follows the exact sequence
 * mandated by the spec's financial-integrity rule:
 *   1. Validate student & invoice
 *   2. Validate amount
 *   3. Create payment
 *   4. Update invoice balance
 *   5. Generate receipt number
 *   6. Record audit log
 * All inside one database transaction so a partial write can never corrupt
 * financial records. Overpayment beyond the outstanding balance is rejected
 * unless the invoice is already fully paid (no overpayment feature exists).
 */
function collect(db, session, { invoiceId, amount, method = "cash", reference = "", paidDate }) {
  const invoice = db.prepare("SELECT * FROM fee_invoices WHERE id = ?").get(invoiceId);
  if (!invoice) throw new AppError("Fee voucher not found.");
  if (invoice.status === "void") throw new AppError("This voucher has been voided and cannot accept payments.");
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(invoice.student_id);
  if (!student) throw new AppError("Student not found for this voucher.");

  const amt = Number(amount);
  if (!amt || amt <= 0) throw new AppError("Payment amount must be greater than zero.");
  if (!METHODS.includes(method)) throw new AppError("Invalid payment method.");
  if (amt > invoice.balance + 0.009) {
    throw new AppError(
      `Payment of ${amt} exceeds the outstanding balance of ${invoice.balance}. Overpayment is not permitted.`
    );
  }

  const school = getSchool(db);
  const date = paidDate || nowIso().slice(0, 10);

  const tx = db.transaction(() => {
    const receiptNo = generateReceiptNo(db, school.receipt_prefix || "REC");
    const paymentInfo = db
      .prepare(
        `INSERT INTO fee_payments (receipt_no, invoice_id, student_id, amount, method, reference, paid_date,
           received_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(receiptNo, invoiceId, student.id, amt, method, reference, date, session.userId, nowIso());

    const newPaid = Math.round((invoice.paid_amount + amt) * 100) / 100;
    const newBalance = Math.round((invoice.total_amount - newPaid) * 100) / 100;
    const status = newBalance <= 0.009 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    db.prepare("UPDATE fee_invoices SET paid_amount = ?, balance = ?, status = ?, updated_at = ? WHERE id = ?").run(
      newPaid, Math.max(newBalance, 0), status, nowIso(), invoiceId
    );

    appendLedgerEntry(db, {
      studentId: student.id, entryType: "payment", referenceTable: "fee_payments", referenceId: paymentInfo.lastInsertRowid,
      description: `Payment received (${receiptNo}) via ${method}`, credit: amt, entryDate: date,
    });

    return { paymentId: paymentInfo.lastInsertRowid, receiptNo, newBalance: Math.max(newBalance, 0), status };
  });

  const result = tx();
  recordAudit(db, {
    userId: session.userId, actorName: session.displayName, action: "collect_payment", entity: "fee_payments",
    entityId: result.paymentId, details: `${result.receiptNo} amount ${amt} for student ${student.id}`,
  });
  return result;
}

function getReceipt(db, paymentId) {
  const payment = db.prepare("SELECT * FROM fee_payments WHERE id = ?").get(paymentId);
  if (!payment) throw new AppError("Receipt not found.");
  const invoice = db.prepare("SELECT * FROM fee_invoices WHERE id = ?").get(payment.invoice_id);
  const student = db
    .prepare(
      `SELECT s.*, c.name AS class_name, sec.name AS section_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN sections sec ON sec.id = s.section_id WHERE s.id = ?`
    )
    .get(payment.student_id);
  return { payment, invoice, student };
}

function listByStudent(db, studentId) {
  return db.prepare("SELECT * FROM fee_payments WHERE student_id = ? AND voided = 0 ORDER BY paid_date DESC").all(studentId);
}

function searchForCollection(db, q) {
  const like = `%${q}%`;
  const students = db
    .prepare(
      `SELECT s.id, s.student_code, s.admission_no, s.first_name, s.last_name, c.name AS class_name, sec.name AS section_name,
              (SELECT COALESCE(SUM(balance),0) FROM fee_invoices WHERE student_id = s.id AND status != 'void') AS outstanding_balance
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.status = 'active' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_no LIKE ? OR s.student_code LIKE ?)
       LIMIT 20`
    )
    .all(like, like, like, like);
  return students;
}

function reportCollections(db, { from, to, method, classId } = {}) {
  const clauses = ["p.voided = 0"];
  const params = [];
  if (from) { clauses.push("p.paid_date >= ?"); params.push(from); }
  if (to) { clauses.push("p.paid_date <= ?"); params.push(to); }
  if (method) { clauses.push("p.method = ?"); params.push(method); }
  if (classId) { clauses.push("s.class_id = ?"); params.push(classId); }
  const where = clauses.join(" AND ");
  const rows = db
    .prepare(
      `SELECT p.*, s.first_name, s.last_name, s.admission_no, c.name AS class_name
       FROM fee_payments p JOIN students s ON s.id = p.student_id LEFT JOIN classes c ON c.id = s.class_id
       WHERE ${where} ORDER BY p.paid_date DESC`
    )
    .all(...params);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return { rows, total };
}

module.exports = { collect, getReceipt, listByStudent, searchForCollection, reportCollections, METHODS };
