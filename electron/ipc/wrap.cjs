"use strict";

const { friendlyDbError } = require("../lib/security.cjs");

/**
 * Wraps a service call as an ipcMain.handle callback. Every handler either
 * returns { success: true, data } or { success: false, error } — the
 * renderer never sees a raw exception or a driver-level error string.
 * If `permissionCode` is provided, RBAC is enforced here before the handler
 * runs (never only by hiding UI buttons).
 */
function makeWrap(ctx) {
  return function wrap(permissionCode, handler) {
    return async (_event, ...args) => {
      try {
        const db = ctx.getDb();
        const session = ctx.getSession();
        if (permissionCode) {
          const { requirePermission } = require("../lib/authz.cjs");
          requirePermission(db, session, permissionCode);
        }
        const data = await handler(db, session, ...args);
        return { success: true, data };
      } catch (err) {
        if (err && err.isAppError) {
          return { success: false, error: err.message, code: err.code };
        }
        // eslint-disable-next-line no-console
        console.error("[IPC ERROR]", err);
        return { success: false, error: friendlyDbError(err) };
      }
    };
  };
}

module.exports = { makeWrap };
