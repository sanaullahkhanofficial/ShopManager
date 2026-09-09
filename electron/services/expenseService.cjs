"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateExpenseNo } = require("../lib/ids.cjs");

function listCategories(db) {
  return db.prepare("SELECT * FROM expense_categories ORDER BY name").all();
}
function createCategory(db, session, name) {
  if (!name) throw new AppError("Category name is required.");
  const info = db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run(name.trim());
  return { id: info.lastInsertRowid };
}

function list(db, { from, to, categoryId } = {}) {
  const clauses = [];
  const params = [];
  if (from) { clauses.push("e.expense_date >= ?"); params.push(from); }
  if (to) { clauses.push("e.expense_date <= ?"); params.push(to); }
  if (categoryId) { clauses.push("e.category_id = ?"); params.push(categoryId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT e.*, c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id
       ${where} ORDER BY e.expense_date DESC`
    )
    .all(...params);
}

function create(db, session, payload) {
  const { categoryId, description, amount, paymentMethod, vendor, attachmentPath, notes, expenseDate } = payload;
  if (!description || !amount || !expenseDate) throw new AppError("Description, amount and date are required.");
  if (Number(amount) <= 0) throw new AppError("Amount must be greater than zero.");
  const expenseNo = generateExpenseNo(db);
  const info = db
    .prepare(
      `INSERT INTO expenses (expense_no, category_id, description, amount, payment_method, vendor, attachment_path,
         notes, expense_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(expenseNo, categoryId || null, description, amount, paymentMethod || "cash", vendor || "", attachmentPath || "", notes || "", expenseDate, session.userId, nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "expenses", entityId: info.lastInsertRowid, details: `${expenseNo} ${amount}` });
  return { id: info.lastInsertRowid, expenseNo };
}

function remove(db, session, id) {
  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  if (!existing) throw new AppError("Expense not found.");
  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "delete", entity: "expenses", entityId: id, details: existing.expense_no });
  return { success: true };
}

module.exports = { listCategories, createCategory, list, create, remove };
