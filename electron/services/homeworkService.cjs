"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

function list(db, { classId, sectionId, subjectId, status } = {}) {
  const clauses = [];
  const params = [];
  if (classId) { clauses.push("h.class_id = ?"); params.push(classId); }
  if (sectionId) { clauses.push("h.section_id = ?"); params.push(sectionId); }
  if (subjectId) { clauses.push("h.subject_id = ?"); params.push(subjectId); }
  if (status) { clauses.push("h.status = ?"); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT h.*, c.name AS class_name, sec.name AS section_name, s.name AS subject_name
       FROM homework h
       JOIN classes c ON c.id = h.class_id
       LEFT JOIN sections sec ON sec.id = h.section_id
       LEFT JOIN subjects s ON s.id = h.subject_id
       ${where}
       ORDER BY h.due_date DESC`
    )
    .all(...params);
}

function create(db, session, payload) {
  if (!payload.classId || !payload.title || !payload.dueDate) {
    throw new AppError("Class, title and due date are required.");
  }
  const info = db
    .prepare(
      `INSERT INTO homework (class_id, section_id, subject_id, title, description, assigned_date, due_date,
         attachment_path, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.classId, payload.sectionId || null, payload.subjectId || null, payload.title,
      payload.description || "", payload.assignedDate || nowIso().slice(0, 10), payload.dueDate,
      payload.attachmentPath || "", session.userId, nowIso()
    );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "homework", entityId: info.lastInsertRowid });
  return { id: info.lastInsertRowid };
}

function setStatus(db, session, id, status) {
  db.prepare("UPDATE homework SET status = ? WHERE id = ?").run(status, id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: `status_${status}`, entity: "homework", entityId: id });
  return { success: true };
}

function remove(db, session, id) {
  db.prepare("DELETE FROM homework WHERE id = ?").run(id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "delete", entity: "homework", entityId: id });
  return { success: true };
}

module.exports = { list, create, setStatus, remove };
