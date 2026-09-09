"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

function list(db, { audience } = {}) {
  const clauses = [];
  const params = [];
  if (audience) { clauses.push("(n.audience = ? OR n.audience = 'all')"); params.push(audience); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT n.*, c.name AS class_name, sec.name AS section_name
       FROM notices n
       LEFT JOIN classes c ON c.id = n.class_id
       LEFT JOIN sections sec ON sec.id = n.section_id
       ${where}
       ORDER BY n.publish_date DESC`
    )
    .all(...params);
}

function create(db, session, payload) {
  if (!payload.title || !payload.publishDate) throw new AppError("Title and publish date are required.");
  const info = db
    .prepare(
      `INSERT INTO notices (title, description, audience, class_id, section_id, publish_date, expiry_date,
         attachment_path, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.title, payload.description || "", payload.audience || "all", payload.classId || null,
      payload.sectionId || null, payload.publishDate, payload.expiryDate || null,
      payload.attachmentPath || "", session.userId, nowIso()
    );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "notices", entityId: info.lastInsertRowid, details: payload.title });
  return { id: info.lastInsertRowid };
}

function remove(db, session, id) {
  db.prepare("DELETE FROM notices WHERE id = ?").run(id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "delete", entity: "notices", entityId: id });
  return { success: true };
}

module.exports = { list, create, remove };
