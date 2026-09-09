"use strict";

const { hashPassword, nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

function list(db) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.email, u.phone, u.status, u.role_id,
              r.name AS role_name, u.last_login_at, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    )
    .all();
}

function create(db, session, payload) {
  const { username, displayName, email, phone, roleId, password } = payload;
  if (!username || !displayName || !roleId || !password) {
    throw new AppError("Username, display name, role and password are required.");
  }
  if (password.length < 6) throw new AppError("Password must be at least 6 characters.");
  const info = db
    .prepare(
      `INSERT INTO users (username, display_name, email, phone, role_id, password_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(username.trim(), displayName.trim(), email || "", phone || "", roleId, hashPassword(password), nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "users", entityId: info.lastInsertRowid, details: username });
  return { id: info.lastInsertRowid };
}

function update(db, session, id, payload) {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!existing) throw new AppError("User not found.");
  const { displayName, email, phone, roleId, status } = payload;
  db.prepare(
    `UPDATE users SET display_name = ?, email = ?, phone = ?, role_id = ?, status = ?, updated_at = ? WHERE id = ?`
  ).run(displayName ?? existing.display_name, email ?? existing.email, phone ?? existing.phone, roleId ?? existing.role_id, status ?? existing.status, nowIso(), id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "users", entityId: id });
  return { success: true };
}

function setStatus(db, session, id, status) {
  if (Number(id) === Number(session.userId) && status === "inactive") {
    throw new AppError("You cannot deactivate your own account while signed in.");
  }
  db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: status === "active" ? "activate" : "deactivate", entity: "users", entityId: id });
  return { success: true };
}

module.exports = { list, create, update, setStatus };
