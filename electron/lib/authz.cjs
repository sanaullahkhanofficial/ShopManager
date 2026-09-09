"use strict";

const { AppError } = require("./security.cjs");

/**
 * Loads the permission-code set for a role, cached per role id for the life
 * of the process (roles rarely change; callers that edit role_permissions
 * must call clearPermissionCache()).
 */
const cache = new Map();

function clearPermissionCache(roleId = null) {
  if (roleId === null) cache.clear();
  else cache.delete(roleId);
}

function getRolePermissionCodes(db, roleId) {
  if (cache.has(roleId)) return cache.get(roleId);
  const rows = db
    .prepare(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`
    )
    .all(roleId);
  const set = new Set(rows.map((r) => r.code));
  cache.set(roleId, set);
  return set;
}

/**
 * Enforces RBAC at the business-logic layer (not just hiding UI buttons).
 * `session` is the currently authenticated user context held in main.cjs.
 * Throws AppError("Not authorized...") if the permission is missing.
 */
function requirePermission(db, session, permissionCode) {
  if (!session || !session.userId) {
    throw new AppError("You must be signed in to perform this action.", "UNAUTHENTICATED");
  }
  const codes = getRolePermissionCodes(db, session.roleId);
  if (!codes.has(permissionCode)) {
    throw new AppError(
      `You do not have permission to perform this action (${permissionCode}).`,
      "FORBIDDEN"
    );
  }
}

module.exports = { requirePermission, getRolePermissionCodes, clearPermissionCache };
