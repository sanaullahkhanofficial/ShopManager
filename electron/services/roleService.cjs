"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { clearPermissionCache } = require("../lib/authz.cjs");

function listRoles(db) {
  return db.prepare("SELECT * FROM roles ORDER BY is_system DESC, name ASC").all();
}

function listPermissions(db) {
  return db.prepare("SELECT * FROM permissions ORDER BY module, label").all();
}

function getRolePermissions(db, roleId) {
  return db
    .prepare("SELECT permission_id FROM role_permissions WHERE role_id = ?")
    .all(roleId)
    .map((r) => r.permission_id);
}

function createRole(db, session, { name, description }) {
  if (!name) throw new AppError("Role name is required.");
  const info = db
    .prepare("INSERT INTO roles (name, description, is_system, created_at) VALUES (?, ?, 0, ?)")
    .run(name.trim(), description || "", nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "roles", entityId: info.lastInsertRowid, details: name });
  return { id: info.lastInsertRowid };
}

function updateRolePermissions(db, session, roleId, permissionIds) {
  const role = db.prepare("SELECT * FROM roles WHERE id = ?").get(roleId);
  if (!role) throw new AppError("Role not found.");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
    const insert = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const pid of permissionIds) insert.run(roleId, pid);
  });
  tx();
  clearPermissionCache(roleId);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update_permissions", entity: "roles", entityId: roleId });
  return { success: true };
}

function deleteRole(db, session, roleId) {
  const role = db.prepare("SELECT * FROM roles WHERE id = ?").get(roleId);
  if (!role) throw new AppError("Role not found.");
  if (role.is_system) throw new AppError("System roles cannot be deleted.");
  const inUse = db.prepare("SELECT COUNT(*) c FROM users WHERE role_id = ?").get(roleId).c;
  if (inUse > 0) throw new AppError("Unable to delete this role because it is assigned to one or more users.");
  db.prepare("DELETE FROM roles WHERE id = ?").run(roleId);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "delete", entity: "roles", entityId: roleId, details: role.name });
  return { success: true };
}

module.exports = { listRoles, listPermissions, getRolePermissions, createRole, updateRolePermissions, deleteRole };
