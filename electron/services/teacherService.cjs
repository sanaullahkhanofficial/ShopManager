"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateEmployeeId } = require("../lib/ids.cjs");
const { getSchool } = require("./settingsService.cjs");

function search(db, { q = "", status } = {}) {
  const clauses = [];
  const params = [];
  if (q) {
    clauses.push("(first_name LIKE ? OR last_name LIKE ? OR employee_id LIKE ? OR phone LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) { clauses.push("employment_status = ?"); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM teachers ${where} ORDER BY created_at DESC`).all(...params);
}

function getById(db, id) {
  const teacher = db.prepare("SELECT * FROM teachers WHERE id = ?").get(id);
  if (!teacher) throw new AppError("Teacher not found.");
  const assignments = db
    .prepare(
      `SELECT tc.*, c.name AS class_name, sec.name AS section_name, s.name AS subject_name
       FROM teacher_classes tc
       JOIN classes c ON c.id = tc.class_id
       LEFT JOIN sections sec ON sec.id = tc.section_id
       LEFT JOIN subjects s ON s.id = tc.subject_id
       WHERE tc.teacher_id = ?`
    )
    .all(id);
  return { ...teacher, assignments };
}

function validate(payload) {
  if (!payload.firstName) throw new AppError("First name is required.");
  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) throw new AppError("Please enter a valid email address.");
  if (payload.basicSalary !== undefined && Number(payload.basicSalary) < 0) throw new AppError("Salary cannot be negative.");
}

function create(db, session, payload) {
  validate(payload);
  const school = getSchool(db);
  const empId = payload.employeeId || generateEmployeeId(db, "teachers", school.employee_id_prefix || "EMP");
  const info = db
    .prepare(
      `INSERT INTO teachers (employee_id, first_name, last_name, gender, dob, phone, email, address,
         qualification, experience_years, joining_date, department, basic_salary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      empId, payload.firstName, payload.lastName || "", payload.gender || "Other", payload.dob || null,
      payload.phone || "", payload.email || "", payload.address || "", payload.qualification || "",
      payload.experienceYears || 0, payload.joiningDate || null, payload.department || "",
      payload.basicSalary || 0, nowIso()
    );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "teachers", entityId: info.lastInsertRowid, details: empId });
  return { id: info.lastInsertRowid, employeeId: empId };
}

function update(db, session, id, payload) {
  validate(payload);
  const existing = db.prepare("SELECT * FROM teachers WHERE id = ?").get(id);
  if (!existing) throw new AppError("Teacher not found.");
  db.prepare(
    `UPDATE teachers SET first_name=?, last_name=?, gender=?, dob=?, phone=?, email=?, address=?, qualification=?,
       experience_years=?, joining_date=?, department=?, basic_salary=?, employment_status=?, updated_at=? WHERE id=?`
  ).run(
    payload.firstName, payload.lastName || "", payload.gender || "Other", payload.dob || null, payload.phone || "",
    payload.email || "", payload.address || "", payload.qualification || "", payload.experienceYears || 0,
    payload.joiningDate || null, payload.department || "", payload.basicSalary || 0,
    payload.employmentStatus || existing.employment_status, nowIso(), id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "teachers", entityId: id });
  return { success: true };
}

function assignClass(db, session, teacherId, { classId, sectionId, subjectId }) {
  if (!classId) throw new AppError("Class is required.");
  db.prepare("INSERT INTO teacher_classes (teacher_id, class_id, section_id, subject_id) VALUES (?, ?, ?, ?)").run(
    teacherId, classId, sectionId || null, subjectId || null
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "assign_class", entity: "teachers", entityId: teacherId });
  return { success: true };
}

function removeAssignment(db, session, assignmentId) {
  db.prepare("DELETE FROM teacher_classes WHERE id = ?").run(assignmentId);
  return { success: true };
}

module.exports = { search, getById, create, update, assignClass, removeAssignment };
