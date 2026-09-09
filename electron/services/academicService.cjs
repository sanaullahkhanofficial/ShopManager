"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

// ---------- Sessions ----------
function listSessions(db) {
  return db.prepare("SELECT * FROM academic_sessions ORDER BY start_date DESC").all();
}
function createSession(db, session, { name, startDate, endDate, isCurrent }) {
  if (!name || !startDate || !endDate) throw new AppError("Session name, start date and end date are required.");
  if (new Date(startDate) >= new Date(endDate)) throw new AppError("Start date must be before end date.");
  const tx = db.transaction(() => {
    if (isCurrent) db.prepare("UPDATE academic_sessions SET is_current = 0").run();
    const info = db
      .prepare("INSERT INTO academic_sessions (name, start_date, end_date, is_current, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(name, startDate, endDate, isCurrent ? 1 : 0, nowIso());
    return info.lastInsertRowid;
  });
  const id = tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "academic_sessions", entityId: id, details: name });
  return { id };
}
function setCurrentSession(db, session, id) {
  const tx = db.transaction(() => {
    db.prepare("UPDATE academic_sessions SET is_current = 0").run();
    db.prepare("UPDATE academic_sessions SET is_current = 1 WHERE id = ?").run(id);
  });
  tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "set_current", entity: "academic_sessions", entityId: id });
  return { success: true };
}

// ---------- Classes ----------
function listClasses(db) {
  return db.prepare("SELECT * FROM classes ORDER BY sort_order ASC, name ASC").all();
}
function createClass(db, session, { name, sortOrder }) {
  if (!name) throw new AppError("Class name is required.");
  const info = db.prepare("INSERT INTO classes (name, sort_order, created_at) VALUES (?, ?, ?)").run(name.trim(), sortOrder || 0, nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "classes", entityId: info.lastInsertRowid, details: name });
  return { id: info.lastInsertRowid };
}
function updateClass(db, session, id, { name, sortOrder, status }) {
  const existing = db.prepare("SELECT * FROM classes WHERE id = ?").get(id);
  if (!existing) throw new AppError("Class not found.");
  db.prepare("UPDATE classes SET name = ?, sort_order = ?, status = ? WHERE id = ?").run(
    name ?? existing.name, sortOrder ?? existing.sort_order, status ?? existing.status, id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "classes", entityId: id });
  return { success: true };
}

// ---------- Sections ----------
function listSections(db, classId) {
  const where = classId ? "WHERE cl.class_id = ?" : "";
  const rows = db
    .prepare(
      `SELECT cl.*, c.name AS class_name,
              (t.first_name || ' ' || t.last_name) AS class_teacher_name,
              (SELECT COUNT(*) FROM students s WHERE s.section_id = cl.id AND s.status='active') AS student_count
       FROM sections cl
       JOIN classes c ON c.id = cl.class_id
       LEFT JOIN teachers t ON t.id = cl.class_teacher_id
       ${where}
       ORDER BY c.sort_order, cl.name`
    );
  return classId ? rows.all(classId) : rows.all();
}
function createSection(db, session, { classId, name, classTeacherId, room, capacity }) {
  if (!classId || !name) throw new AppError("Class and section name are required.");
  const info = db
    .prepare("INSERT INTO sections (class_id, name, class_teacher_id, room, capacity, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(classId, name.trim(), classTeacherId || null, room || "", capacity || 0, nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "sections", entityId: info.lastInsertRowid, details: name });
  return { id: info.lastInsertRowid };
}
function updateSection(db, session, id, payload) {
  const existing = db.prepare("SELECT * FROM sections WHERE id = ?").get(id);
  if (!existing) throw new AppError("Section not found.");
  const next = { ...existing, ...payload };
  db.prepare("UPDATE sections SET name=?, class_teacher_id=?, room=?, capacity=?, status=? WHERE id=?").run(
    next.name, next.classTeacherId ?? next.class_teacher_id, next.room, next.capacity, next.status, id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "sections", entityId: id });
  return { success: true };
}

// ---------- Subjects ----------
function listSubjects(db) {
  return db.prepare("SELECT * FROM subjects ORDER BY name").all();
}
function createSubject(db, session, { name, code, department }) {
  if (!name) throw new AppError("Subject name is required.");
  const info = db.prepare("INSERT INTO subjects (name, code, department, created_at) VALUES (?, ?, ?, ?)").run(
    name.trim(), code || null, department || "", nowIso()
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "subjects", entityId: info.lastInsertRowid, details: name });
  return { id: info.lastInsertRowid };
}
function updateSubject(db, session, id, { name, code, department, status }) {
  const existing = db.prepare("SELECT * FROM subjects WHERE id = ?").get(id);
  if (!existing) throw new AppError("Subject not found.");
  db.prepare("UPDATE subjects SET name=?, code=?, department=?, status=? WHERE id=?").run(
    name ?? existing.name, code ?? existing.code, department ?? existing.department, status ?? existing.status, id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "subjects", entityId: id });
  return { success: true };
}

// ---------- Class <-> Subject assignment ----------
function listClassSubjects(db, classId) {
  return db
    .prepare(
      `SELECT cs.*, s.name AS subject_name, (t.first_name || ' ' || t.last_name) AS teacher_name
       FROM class_subjects cs
       JOIN subjects s ON s.id = cs.subject_id
       LEFT JOIN teachers t ON t.id = cs.teacher_id
       WHERE cs.class_id = ?
       ORDER BY s.name`
    )
    .all(classId);
}
function assignSubjectToClass(db, session, { classId, subjectId, teacherId }) {
  if (!classId || !subjectId) throw new AppError("Class and subject are required.");
  db.prepare(
    "INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?, ?, ?) ON CONFLICT(class_id, subject_id) DO UPDATE SET teacher_id = excluded.teacher_id"
  ).run(classId, subjectId, teacherId || null);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "assign_subject", entity: "class_subjects", entityId: classId });
  return { success: true };
}
function removeClassSubject(db, session, id) {
  db.prepare("DELETE FROM class_subjects WHERE id = ?").run(id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "remove_subject", entity: "class_subjects", entityId: id });
  return { success: true };
}

module.exports = {
  listSessions, createSession, setCurrentSession,
  listClasses, createClass, updateClass,
  listSections, createSection, updateSection,
  listSubjects, createSubject, updateSubject,
  listClassSubjects, assignSubjectToClass, removeClassSubject,
};
