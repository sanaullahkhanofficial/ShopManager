"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

function nextParentCode(db) {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT parent_code FROM parents WHERE parent_code LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`PAR-${year}-%`);
  let next = 1;
  if (row) {
    const n = parseInt(row.parent_code.split("-").pop(), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `PAR-${year}-${String(next).padStart(5, "0")}`;
}

function search(db, { q = "" } = {}) {
  const like = `%${q}%`;
  return db
    .prepare(
      `SELECT * FROM parents
       WHERE father_name LIKE ? OR mother_name LIKE ? OR guardian_name LIKE ? OR phone LIKE ? OR parent_code LIKE ?
       ORDER BY created_at DESC LIMIT 200`
    )
    .all(like, like, like, like, like);
}

function getById(db, id) {
  const parent = db.prepare("SELECT * FROM parents WHERE id = ?").get(id);
  if (!parent) throw new AppError("Parent/guardian not found.");
  const children = db
    .prepare(
      `SELECT s.id, s.student_code, s.admission_no, s.first_name, s.last_name, s.status,
              c.name AS class_name, sec.name AS section_name
       FROM student_parents sp
       JOIN students s ON s.id = sp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE sp.parent_id = ?`
    )
    .all(id);
  return { ...parent, children };
}

function validate(payload) {
  if (!payload.phone) throw new AppError("Phone number is required.");
  if (!payload.fatherName && !payload.motherName && !payload.guardianName) {
    throw new AppError("Provide at least one of father, mother or guardian name.");
  }
  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) throw new AppError("Please enter a valid email address.");
}

function create(db, session, payload) {
  validate(payload);
  const code = nextParentCode(db);
  const info = db
    .prepare(
      `INSERT INTO parents (parent_code, father_name, mother_name, guardian_name, relationship, phone, whatsapp,
         email, address, occupation, cnic, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      code, payload.fatherName || "", payload.motherName || "", payload.guardianName || "",
      payload.relationship || "Father", payload.phone, payload.whatsapp || "", payload.email || "",
      payload.address || "", payload.occupation || "", payload.cnic || "", nowIso()
    );
  const parentId = info.lastInsertRowid;
  if (Array.isArray(payload.studentIds)) {
    const link = db.prepare("INSERT OR IGNORE INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, 1)");
    payload.studentIds.forEach((sid) => link.run(sid, parentId));
  }
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "parents", entityId: parentId, details: code });
  return { id: parentId, parentCode: code };
}

function update(db, session, id, payload) {
  validate(payload);
  const existing = db.prepare("SELECT * FROM parents WHERE id = ?").get(id);
  if (!existing) throw new AppError("Parent/guardian not found.");
  db.prepare(
    `UPDATE parents SET father_name=?, mother_name=?, guardian_name=?, relationship=?, phone=?, whatsapp=?,
       email=?, address=?, occupation=?, cnic=?, updated_at=? WHERE id=?`
  ).run(
    payload.fatherName || "", payload.motherName || "", payload.guardianName || "", payload.relationship || "Father",
    payload.phone, payload.whatsapp || "", payload.email || "", payload.address || "", payload.occupation || "",
    payload.cnic || "", nowIso(), id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "parents", entityId: id });
  return { success: true };
}

function setStatus(db, session, id, status) {
  db.prepare("UPDATE parents SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: `status_${status}`, entity: "parents", entityId: id });
  return { success: true };
}

module.exports = { search, getById, create, update, setStatus };
