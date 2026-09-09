"use strict";

/** Read-only access to the audit trail. Never exposed as editable via IPC. */
function list(db, { from, to, entity, userId, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = [];
  if (from) { clauses.push("created_at >= ?"); params.push(from); }
  if (to) { clauses.push("created_at <= ?"); params.push(to + "T23:59:59"); }
  if (entity) { clauses.push("entity = ?"); params.push(entity); }
  if (userId) { clauses.push("user_id = ?"); params.push(userId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) c FROM audit_logs ${where}`).get(...params).c;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
  return { rows, total, page, pageSize };
}

module.exports = { list };
