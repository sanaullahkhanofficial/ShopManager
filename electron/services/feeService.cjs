"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

// ---------- Fee categories ----------
function listCategories(db) {
  return db.prepare("SELECT * FROM fee_categories ORDER BY name").all();
}
function createCategory(db, session, { name, isRecurring }) {
  if (!name) throw new AppError("Category name is required.");
  const info = db.prepare("INSERT INTO fee_categories (name, is_recurring, created_at) VALUES (?, ?, ?)").run(
    name.trim(), isRecurring ? 1 : 0, nowIso()
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "fee_categories", entityId: info.lastInsertRowid, details: name });
  return { id: info.lastInsertRowid };
}

// ---------- Fee structures ----------
function listStructures(db, { classId, sessionId } = {}) {
  const clauses = [];
  const params = [];
  if (classId) { clauses.push("fs.class_id = ?"); params.push(classId); }
  if (sessionId) { clauses.push("fs.session_id = ?"); params.push(sessionId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT fs.*, c.name AS class_name, fc.name AS category_name
       FROM fee_structures fs
       JOIN classes c ON c.id = fs.class_id
       JOIN fee_categories fc ON fc.id = fs.category_id
       ${where}
       ORDER BY c.sort_order, fc.name`
    )
    .all(...params);
}

function saveStructure(db, session, payload) {
  const { id, classId, categoryId, sessionId, amount, frequency } = payload;
  if (!classId || !categoryId || amount === undefined) throw new AppError("Class, category and amount are required.");
  if (Number(amount) < 0) throw new AppError("Amount cannot be negative.");
  if (!["monthly", "term", "annual", "one_time"].includes(frequency)) throw new AppError("Invalid fee frequency.");
  if (id) {
    db.prepare("UPDATE fee_structures SET amount = ?, frequency = ? WHERE id = ?").run(amount, frequency, id);
  } else {
    db.prepare(
      `INSERT INTO fee_structures (class_id, category_id, session_id, amount, frequency, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(class_id, category_id, session_id, frequency) DO UPDATE SET amount = excluded.amount`
    ).run(classId, categoryId, sessionId || null, amount, frequency, nowIso());
  }
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "save_structure", entity: "fee_structures" });
  return { success: true };
}

function deleteStructure(db, session, id) {
  db.prepare("DELETE FROM fee_structures WHERE id = ?").run(id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "delete_structure", entity: "fee_structures", entityId: id });
  return { success: true };
}

module.exports = { listCategories, createCategory, listStructures, saveStructure, deleteStructure };
