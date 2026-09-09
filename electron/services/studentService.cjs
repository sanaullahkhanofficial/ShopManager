"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateStudentCode, generateAdmissionNo } = require("../lib/ids.cjs");
const { getSchool } = require("./settingsService.cjs");

const STATUSES = ["active", "inactive", "graduated", "transferred", "suspended", "left"];

function search(db, { q = "", classId, sectionId, status, page = 1, pageSize = 25 } = {}) {
  const clauses = [];
  const params = [];
  if (q) {
    clauses.push(
      "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_no LIKE ? OR s.student_code LIKE ? OR s.father_name LIKE ? OR s.phone LIKE ?)"
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (classId) { clauses.push("s.class_id = ?"); params.push(classId); }
  if (sectionId) { clauses.push("s.section_id = ?"); params.push(sectionId); }
  if (status) { clauses.push("s.status = ?"); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const total = db.prepare(`SELECT COUNT(*) c FROM students s ${where}`).get(...params).c;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT s.*, c.name AS class_name, sec.name AS section_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);
  return { rows, total, page, pageSize };
}

function getById(db, id) {
  const student = db
    .prepare(
      `SELECT s.*, c.name AS class_name, sec.name AS section_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = ?`
    )
    .get(id);
  if (!student) throw new AppError("Student not found.");
  const parents = db
    .prepare(
      `SELECT p.*, sp.is_primary FROM student_parents sp JOIN parents p ON p.id = sp.parent_id WHERE sp.student_id = ?`
    )
    .all(id);
  return { ...student, parents };
}

function validate(payload) {
  if (!payload.firstName) throw new AppError("First name is required.");
  if (!payload.admissionDate) throw new AppError("Admission date is required.");
  if (payload.gender && !["Male", "Female", "Other"].includes(payload.gender)) {
    throw new AppError("Gender must be Male, Female or Other.");
  }
  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) throw new AppError("Please enter a valid email address.");
  if (payload.phone && !/^[0-9+\-() ]{6,20}$/.test(payload.phone)) throw new AppError("Please enter a valid phone number.");
  if (payload.dob && Number.isNaN(Date.parse(payload.dob))) throw new AppError("Please enter a valid date of birth.");
}

function create(db, session, payload) {
  validate(payload);
  const school = getSchool(db);
  const tx = db.transaction(() => {
    const studentCode = payload.studentCode || generateStudentCode(db, school.student_id_prefix || "STU");
    const admissionNo = payload.admissionNo || generateAdmissionNo(db, school.admission_no_prefix || "ADM");
    const info = db
      .prepare(
        `INSERT INTO students (
          student_code, admission_no, registration_no, first_name, last_name, father_name, mother_name,
          dob, gender, blood_group, religion, nationality, phone, email, address, city, province, photo_path,
          admission_date, session_id, class_id, section_id, roll_number, previous_school, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(
        studentCode, admissionNo, payload.registrationNo || "", payload.firstName, payload.lastName || "",
        payload.fatherName || "", payload.motherName || "", payload.dob || null, payload.gender || "Other",
        payload.bloodGroup || "", payload.religion || "", payload.nationality || "", payload.phone || "",
        payload.email || "", payload.address || "", payload.city || "", payload.province || "",
        payload.photoPath || "", payload.admissionDate, payload.sessionId || null, payload.classId || null,
        payload.sectionId || null, payload.rollNumber || "", payload.previousSchool || "", nowIso()
      );
    const studentId = info.lastInsertRowid;
    if (Array.isArray(payload.parentIds)) {
      const link = db.prepare("INSERT OR IGNORE INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, ?)");
      payload.parentIds.forEach((pid, idx) => link.run(studentId, pid, idx === 0 ? 1 : 0));
    }
    return { studentId, studentCode, admissionNo };
  });
  const result = tx();
  recordAudit(db, {
    userId: session.userId, actorName: session.displayName, action: "create", entity: "students",
    entityId: result.studentId, details: `${payload.firstName} ${payload.lastName || ""} (${result.admissionNo})`,
  });
  return result;
}

function update(db, session, id, payload) {
  validate(payload);
  const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(id);
  if (!existing) throw new AppError("Student not found.");
  db.prepare(
    `UPDATE students SET first_name=?, last_name=?, father_name=?, mother_name=?, dob=?, gender=?, blood_group=?,
       religion=?, nationality=?, phone=?, email=?, address=?, city=?, province=?, photo_path=?, class_id=?,
       section_id=?, roll_number=?, previous_school=?, updated_at=? WHERE id=?`
  ).run(
    payload.firstName, payload.lastName || "", payload.fatherName || "", payload.motherName || "",
    payload.dob || null, payload.gender || "Other", payload.bloodGroup || "", payload.religion || "",
    payload.nationality || "", payload.phone || "", payload.email || "", payload.address || "",
    payload.city || "", payload.province || "", payload.photoPath || existing.photo_path,
    payload.classId || null, payload.sectionId || null, payload.rollNumber || "", payload.previousSchool || "",
    nowIso(), id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "students", entityId: id });
  return { success: true };
}

function setStatus(db, session, id, status) {
  if (!STATUSES.includes(status)) throw new AppError("Invalid student status.");
  db.prepare("UPDATE students SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?").run(
    status, ["inactive", "graduated", "transferred", "suspended", "left"].includes(status) ? nowIso() : null, nowIso(), id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: `status_${status}`, entity: "students", entityId: id });
  return { success: true };
}

function linkParent(db, session, studentId, parentId, isPrimary = false) {
  db.prepare("INSERT OR IGNORE INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, ?)").run(
    studentId, parentId, isPrimary ? 1 : 0
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "link_parent", entity: "students", entityId: studentId });
  return { success: true };
}

function unlinkParent(db, session, studentId, parentId) {
  db.prepare("DELETE FROM student_parents WHERE student_id = ? AND parent_id = ?").run(studentId, parentId);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "unlink_parent", entity: "students", entityId: studentId });
  return { success: true };
}

function importBulk(db, session, rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new AppError("No rows to import.");
  const school = getSchool(db);
  const results = { created: 0, errors: [] };
  const tx = db.transaction(() => {
    rows.forEach((row, idx) => {
      try {
        if (!row.firstName) throw new AppError(`Row ${idx + 2}: first name is required.`);
        if (!row.admissionDate) throw new AppError(`Row ${idx + 2}: admission date is required.`);
        let classId = null;
        if (row.className) {
          const cls = db.prepare("SELECT id FROM classes WHERE name = ?").get(row.className);
          if (!cls) throw new AppError(`Row ${idx + 2}: class "${row.className}" does not exist.`);
          classId = cls.id;
        }
        let sectionId = null;
        if (row.sectionName && classId) {
          const sec = db.prepare("SELECT id FROM sections WHERE class_id = ? AND name = ?").get(classId, row.sectionName);
          if (sec) sectionId = sec.id;
        }
        const studentCode = generateStudentCode(db, school.student_id_prefix || "STU");
        const admissionNo = generateAdmissionNo(db, school.admission_no_prefix || "ADM");
        db.prepare(
          `INSERT INTO students (student_code, admission_no, first_name, last_name, father_name, gender, dob,
             phone, email, address, admission_date, class_id, section_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
        ).run(
          studentCode, admissionNo, row.firstName, row.lastName || "", row.fatherName || "", row.gender || "Other",
          row.dob || null, row.phone || "", row.email || "", row.address || "", row.admissionDate, classId, sectionId, nowIso()
        );
        results.created++;
      } catch (err) {
        results.errors.push({ row: idx + 2, message: err.message || String(err) });
      }
    });
  });
  tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "bulk_import", entity: "students", details: `created ${results.created}` });
  return results;
}

module.exports = { search, getById, create, update, setStatus, linkParent, unlinkParent, importBulk, STATUSES };
