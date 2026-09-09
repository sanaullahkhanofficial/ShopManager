"use strict";

const { hashPassword, verifyPassword, nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { clearPermissionCache, getRolePermissionCodes } = require("../lib/authz.cjs");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function publicUser(db, row) {
  if (!row) return null;
  const role = db.prepare("SELECT id, name FROM roles WHERE id = ?").get(row.role_id);
  const permissions = Array.from(getRolePermissionCodes(db, row.role_id));
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    roleId: row.role_id,
    roleName: role ? role.name : "Unknown",
    mustChangePassword: !!row.must_change_password,
    permissions,
  };
}

function login(db, { username, password }) {
  if (!username || !password) throw new AppError("Username and password are required.");
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username).trim());

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    recordAudit(db, { action: "login_blocked_locked", entity: "users", entityId: user.id, details: username });
    throw new AppError(
      `This account is temporarily locked due to failed login attempts. Try again after ${new Date(
        user.locked_until
      ).toLocaleTimeString()}.`
    );
  }

  const ok = user && user.status === "active" && verifyPassword(password, user.password_hash);

  db.prepare(
    "INSERT INTO login_activity (username, user_id, success, reason, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(username, user ? user.id : null, ok ? 1 : 0, ok ? "ok" : user ? (user.status !== "active" ? "inactive" : "bad_password") : "no_such_user", nowIso());

  if (!ok) {
    if (user) {
      const attempts = (user.failed_login_count || 0) + 1;
      let lockedUntil = null;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      }
      db.prepare("UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?").run(
        attempts,
        lockedUntil,
        user.id
      );
      recordAudit(db, { action: "login_failed", entity: "users", entityId: user.id, details: `attempt ${attempts}` });
    }
    if (!user) throw new AppError("Invalid username or password.");
    if (user.status !== "active") throw new AppError("This account has been deactivated. Contact an administrator.");
    throw new AppError("Invalid username or password.");
  }

  db.prepare(
    "UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ? WHERE id = ?"
  ).run(nowIso(), user.id);
  recordAudit(db, { userId: user.id, actorName: user.display_name, action: "login", entity: "users", entityId: user.id });

  return publicUser(db, db.prepare("SELECT * FROM users WHERE id = ?").get(user.id));
}

function logout(db, session) {
  if (session && session.userId) {
    recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "logout", entity: "users", entityId: session.userId });
  }
  return { success: true };
}

function changePassword(db, session, { currentPassword, newPassword }) {
  if (!session || !session.userId) throw new AppError("Not signed in.");
  if (!newPassword || newPassword.length < 6) throw new AppError("New password must be at least 6 characters.");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.userId);
  if (!user) throw new AppError("User not found.");
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new AppError("Current password is incorrect.");
  }
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?").run(
    hashPassword(newPassword),
    nowIso(),
    user.id
  );
  recordAudit(db, { userId: user.id, actorName: session.displayName, action: "password_changed", entity: "users", entityId: user.id });
  return { success: true };
}

function resetPassword(db, session, { userId, newPassword }) {
  if (!newPassword || newPassword.length < 6) throw new AppError("New password must be at least 6 characters.");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found.");
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?").run(
    hashPassword(newPassword),
    nowIso(),
    userId
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "password_reset", entity: "users", entityId: userId });
  return { success: true };
}

function currentUser(db, session) {
  if (!session || !session.userId) return null;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.userId);
  return publicUser(db, user);
}

module.exports = { login, logout, changePassword, resetPassword, currentUser, publicUser, clearPermissionCache };
