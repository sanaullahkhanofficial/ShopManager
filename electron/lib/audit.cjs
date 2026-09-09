"use strict";

const { nowIso } = require("./security.cjs");

/** Records an immutable audit trail entry. Never exposed as editable to normal users. */
function recordAudit(db, { userId = null, actorName = "", action, entity = null, entityId = null, details = "" }) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, actorName, action, entity, entityId, typeof details === "string" ? details : JSON.stringify(details), nowIso());
}

module.exports = { recordAudit };
