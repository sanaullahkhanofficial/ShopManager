"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateApplicationNo, generateStudentCode, generateAdmissionNo } = require("../lib/ids.cjs");
const { getSchool } = require("./settingsService.cjs");

const STAGES = ["application", "review", "approved", "enrolled", "rejected"];

function list(db, { stage, q = "" } = {}) {
  const clauses = [];
  const params = [];
  if (stage) { clauses.push("a.stage = ?"); params.push(stage); }
  if (q) {
    clauses.push("(a.first_name LIKE ? OR a.last_name LIKE ? OR a.application_no LIKE ? OR a.father_name LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT a.*, c.name AS applying_for_class_name
       FROM admissions a LEFT JOIN classes c ON c.id = a.applying_for_class_id
       ${where} ORDER BY a.created_at DESC`
    )
    .all(...params);
}

function getById(db, id) {
  const row = db.prepare("SELECT * FROM admissions WHERE id = ?").get(id);
  if (!row) throw new AppError("Admission application not found.");
  return row;
}

function create(db, session, payload) {
  if (!payload.firstName) throw new AppError("Applicant first name is required.");
  const appNo = generateApplicationNo(db);
  const info = db
    .prepare(
      `INSERT INTO admissions (application_no, first_name, last_name, father_name, dob, gender, phone, email,
         address, applying_for_class_id, session_id, previous_school, stage, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'application', ?)`
    )
    .run(
      appNo, payload.firstName, payload.lastName || "", payload.fatherName || "", payload.dob || null,
      payload.gender || "Other", payload.phone || "", payload.email || "", payload.address || "",
      payload.applyingForClassId || null, payload.sessionId || null, payload.previousSchool || "", nowIso()
    );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "admissions", entityId: info.lastInsertRowid, details: appNo });
  return { id: info.lastInsertRowid, applicationNo: appNo };
}

function moveStage(db, session, id, stage, extra = {}) {
  if (!STAGES.includes(stage)) throw new AppError("Invalid admission stage.");
  const app = getById(db, id);
  if (app.stage === "enrolled") throw new AppError("This application has already been enrolled and cannot be changed.");
  if (stage === "enrolled") {
    return enroll(db, session, id, extra);
  }
  db.prepare("UPDATE admissions SET stage=?, test_score=?, interview_notes=?, rejection_reason=?, updated_at=? WHERE id=?").run(
    stage, extra.testScore ?? app.test_score, extra.interviewNotes ?? app.interview_notes,
    extra.rejectionReason ?? app.rejection_reason, nowIso(), id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: `stage_${stage}`, entity: "admissions", entityId: id });
  return { success: true };
}

/** Converts an approved admission application into a full Student record + admission number, inside one transaction. */
function enroll(db, session, id, { classId, sectionId, admissionDate } = {}) {
  const app = getById(db, id);
  if (app.stage === "rejected") throw new AppError("A rejected application cannot be enrolled.");
  const school = getSchool(db);
  const tx = db.transaction(() => {
    const studentCode = generateStudentCode(db, school.student_id_prefix || "STU");
    const admissionNo = generateAdmissionNo(db, school.admission_no_prefix || "ADM");
    const info = db
      .prepare(
        `INSERT INTO students (student_code, admission_no, first_name, last_name, father_name, dob, gender, phone,
           email, address, admission_date, session_id, class_id, section_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(
        studentCode, admissionNo, app.first_name, app.last_name, app.father_name, app.dob, app.gender, app.phone,
        app.email, app.address, admissionDate || nowIso().slice(0, 10), app.session_id,
        classId || app.applying_for_class_id, sectionId || null, nowIso()
      );
    const studentId = info.lastInsertRowid;
    db.prepare("UPDATE admissions SET stage='enrolled', converted_student_id=?, updated_at=? WHERE id=?").run(
      studentId, nowIso(), id
    );
    return { studentId, studentCode, admissionNo };
  });
  const result = tx();
  recordAudit(db, {
    userId: session.userId, actorName: session.displayName, action: "enroll", entity: "admissions",
    entityId: id, details: `-> student ${result.admissionNo}`,
  });
  return result;
}

module.exports = { list, getById, create, moveStage, enroll, STAGES };
