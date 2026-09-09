"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateVoucherNo } = require("../lib/ids.cjs");
const { appendLedgerEntry } = require("../lib/ledger.cjs");
const { computeDiscount } = require("./scholarshipService.cjs");
const { getSchool } = require("./settingsService.cjs");
const { getMisc } = require("./settingsService.cjs");

function listForStudent(db, studentId) {
  return db.prepare("SELECT * FROM fee_invoices WHERE student_id = ? ORDER BY issue_date DESC").all(studentId);
}

function getById(db, id) {
  const invoice = db.prepare("SELECT * FROM fee_invoices WHERE id = ?").get(id);
  if (!invoice) throw new AppError("Fee voucher not found.");
  const items = db.prepare("SELECT * FROM fee_invoice_items WHERE invoice_id = ?").all(id);
  const student = db
    .prepare(
      `SELECT s.*, c.name AS class_name, sec.name AS section_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = ?`
    )
    .get(invoice.student_id);
  const payments = db.prepare("SELECT * FROM fee_payments WHERE invoice_id = ? AND voided = 0 ORDER BY paid_date").all(id);
  return { ...invoice, items, student, payments };
}

/**
 * Generates one fee voucher for a student for a given period, pulling the
 * applicable fee structures for the student's class, applying any active
 * scholarship/discount, and recording an `invoice` + `discount` entry in the
 * student's ledger — all inside a single transaction.
 */
function generateForStudent(db, session, { studentId, periodLabel, issueDate, dueDate, frequency = "monthly", extraItems = [] }) {
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
  if (!student) throw new AppError("Student not found.");
  if (!student.class_id) throw new AppError("Student is not assigned to a class; cannot generate a fee voucher.");
  if (!periodLabel || !issueDate || !dueDate) throw new AppError("Period, issue date and due date are required.");

  const structures = db
    .prepare(`SELECT fs.*, fc.name AS category_name FROM fee_structures fs JOIN fee_categories fc ON fc.id = fs.category_id
               WHERE fs.class_id = ? AND fs.frequency = ?`)
    .all(student.class_id, frequency);

  if (structures.length === 0 && extraItems.length === 0) {
    throw new AppError("No fee structure is defined for this student's class and frequency.");
  }

  const misc = getMisc(db);
  const lateFeeAmount = Number(misc.late_fee_amount || 0);
  const isOverdue = new Date(dueDate) < new Date(nowIso().slice(0, 10)) && false; // late fee applied only when explicitly collected past due, not at generation

  const grossAmount =
    structures.reduce((sum, s) => sum + s.amount, 0) + extraItems.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const discountAmount = Math.round(computeDiscount(db, studentId, grossAmount, issueDate) * 100) / 100;
  const totalAmount = Math.round((grossAmount - discountAmount) * 100) / 100;

  const school = getSchool(db);
  const tx = db.transaction(() => {
    const voucherNo = generateVoucherNo(db, school.voucher_prefix || "VCH");
    const info = db
      .prepare(
        `INSERT INTO fee_invoices (voucher_no, student_id, session_id, period_label, issue_date, due_date,
           gross_amount, discount_amount, late_fee_amount, total_amount, paid_amount, balance, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'unpaid', ?)`
      )
      .run(voucherNo, studentId, student.session_id, periodLabel, issueDate, dueDate, grossAmount, discountAmount, totalAmount, totalAmount, nowIso());
    const invoiceId = info.lastInsertRowid;

    const insertItem = db.prepare(
      "INSERT INTO fee_invoice_items (invoice_id, category_id, description, amount) VALUES (?, ?, ?, ?)"
    );
    for (const s of structures) insertItem.run(invoiceId, s.category_id, s.category_name, s.amount);
    for (const i of extraItems) insertItem.run(invoiceId, null, i.description || "Other charge", Number(i.amount || 0));

    appendLedgerEntry(db, {
      studentId, entryType: "invoice", referenceTable: "fee_invoices", referenceId: invoiceId,
      description: `Fee voucher ${voucherNo} (${periodLabel})`, debit: grossAmount, entryDate: issueDate,
    });
    if (discountAmount > 0) {
      appendLedgerEntry(db, {
        studentId, entryType: "discount", referenceTable: "fee_invoices", referenceId: invoiceId,
        description: `Scholarship/discount on ${voucherNo}`, credit: discountAmount, entryDate: issueDate,
      });
    }
    return { invoiceId, voucherNo, totalAmount };
  });

  const result = tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "generate_voucher", entity: "fee_invoices", entityId: result.invoiceId, details: result.voucherNo });
  return result;
}

/** Bulk-generates the same voucher for every active student in a class (or all classes if omitted). */
function bulkGenerate(db, session, { classId, periodLabel, issueDate, dueDate, frequency = "monthly" }) {
  const students = classId
    ? db.prepare("SELECT id FROM students WHERE class_id = ? AND status = 'active'").all(classId)
    : db.prepare("SELECT id FROM students WHERE status = 'active'").all();
  if (students.length === 0) throw new AppError("No active students found for this selection.");

  const results = { generated: 0, skipped: 0, errors: [] };
  for (const s of students) {
    try {
      generateForStudent(db, session, { studentId: s.id, periodLabel, issueDate, dueDate, frequency });
      results.generated++;
    } catch (err) {
      results.skipped++;
      results.errors.push({ studentId: s.id, message: err.message || String(err) });
    }
  }
  return results;
}

function outstanding(db, { classId, sectionId } = {}) {
  const clauses = ["fi.balance > 0", "fi.status != 'void'"];
  const params = [];
  if (classId) { clauses.push("s.class_id = ?"); params.push(classId); }
  if (sectionId) { clauses.push("s.section_id = ?"); params.push(sectionId); }
  const where = clauses.join(" AND ");
  return db
    .prepare(
      `SELECT fi.*, s.first_name, s.last_name, s.admission_no, c.name AS class_name, sec.name AS section_name
       FROM fee_invoices fi
       JOIN students s ON s.id = fi.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE ${where}
       ORDER BY fi.due_date ASC`
    )
    .all(...params);
}

function voidInvoice(db, session, id, reason) {
  const invoice = db.prepare("SELECT * FROM fee_invoices WHERE id = ?").get(id);
  if (!invoice) throw new AppError("Fee voucher not found.");
  if (invoice.paid_amount > 0) throw new AppError("Cannot void a voucher that already has payments recorded against it.");
  db.prepare("UPDATE fee_invoices SET status='void', updated_at=? WHERE id=?").run(nowIso(), id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "void_voucher", entity: "fee_invoices", entityId: id, details: reason || "" });
  return { success: true };
}

module.exports = { listForStudent, getById, generateForStudent, bulkGenerate, outstanding, voidInvoice };
