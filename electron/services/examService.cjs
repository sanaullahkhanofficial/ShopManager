"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { resolveGrade } = require("./settingsService.cjs");
const { studentAttendanceSummary } = require("./attendanceService.cjs");

// ---------- Exams ----------
function list(db, { classId, sessionId } = {}) {
  const clauses = [];
  const params = [];
  if (classId) { clauses.push("e.class_id = ?"); params.push(classId); }
  if (sessionId) { clauses.push("e.session_id = ?"); params.push(sessionId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(`SELECT e.*, c.name AS class_name FROM exams e JOIN classes c ON c.id = e.class_id ${where} ORDER BY e.start_date DESC`)
    .all(...params);
}

function getById(db, id) {
  const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(id);
  if (!exam) throw new AppError("Exam not found.");
  const subjects = db
    .prepare(
      `SELECT es.*, s.name AS subject_name FROM exam_subjects es JOIN subjects s ON s.id = es.subject_id
       WHERE es.exam_id = ? ORDER BY s.name`
    )
    .all(id);
  return { ...exam, subjects };
}

function create(db, session, payload) {
  const { name, type, sessionId, classId, startDate, endDate, subjects } = payload;
  if (!name || !classId) throw new AppError("Exam name and class are required.");
  if (!Array.isArray(subjects) || subjects.length === 0) throw new AppError("Add at least one subject to the exam.");
  for (const s of subjects) {
    if (!s.subjectId || s.maxMarks === undefined || s.passingMarks === undefined) {
      throw new AppError("Each subject needs max marks and passing marks.");
    }
    if (Number(s.passingMarks) > Number(s.maxMarks)) throw new AppError("Passing marks cannot exceed maximum marks.");
    if (Number(s.maxMarks) <= 0) throw new AppError("Maximum marks must be greater than zero.");
  }
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO exams (name, type, session_id, class_id, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, type || "custom", sessionId || null, classId, startDate || null, endDate || null, nowIso());
    const examId = info.lastInsertRowid;
    const insertSubj = db.prepare(
      "INSERT INTO exam_subjects (exam_id, subject_id, exam_date, max_marks, passing_marks) VALUES (?, ?, ?, ?, ?)"
    );
    for (const s of subjects) insertSubj.run(examId, s.subjectId, s.examDate || null, s.maxMarks, s.passingMarks);
    return examId;
  });
  const examId = tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "exams", entityId: examId, details: name });
  return { id: examId };
}

function updateStatus(db, session, id, status) {
  if (!["scheduled", "ongoing", "completed", "published"].includes(status)) throw new AppError("Invalid exam status.");
  db.prepare("UPDATE exams SET status = ? WHERE id = ?").run(status, id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: `status_${status}`, entity: "exams", entityId: id });
  return { success: true };
}

// ---------- Marks ----------
function getMarksGrid(db, examSubjectId) {
  const examSubject = db.prepare("SELECT * FROM exam_subjects WHERE id = ?").get(examSubjectId);
  if (!examSubject) throw new AppError("Exam subject not found.");
  const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(examSubject.exam_id);
  const students = db
    .prepare(
      `SELECT s.id AS student_id, s.roll_number, s.first_name, s.last_name, m.obtained_marks, m.remarks
       FROM students s
       LEFT JOIN marks m ON m.student_id = s.id AND m.exam_subject_id = ?
       WHERE s.class_id = ? AND s.status = 'active'
       ORDER BY CAST(s.roll_number AS INTEGER)`
    )
    .all(examSubjectId, exam.class_id);
  return { examSubject, students };
}

/** Bulk-saves marks for one exam subject, rejecting any obtained value above max marks or negative. */
function saveMarks(db, session, { examSubjectId, entries }) {
  const examSubject = db.prepare("SELECT * FROM exam_subjects WHERE id = ?").get(examSubjectId);
  if (!examSubject) throw new AppError("Exam subject not found.");
  if (!Array.isArray(entries) || entries.length === 0) throw new AppError("No marks provided.");
  for (const e of entries) {
    const obtained = Number(e.obtainedMarks);
    if (Number.isNaN(obtained) || obtained < 0) throw new AppError(`Invalid marks for a student: cannot be negative.`);
    if (obtained > examSubject.max_marks) {
      throw new AppError(`Obtained marks (${obtained}) cannot exceed maximum marks (${examSubject.max_marks}).`);
    }
  }
  const upsert = db.prepare(
    `INSERT INTO marks (exam_subject_id, student_id, obtained_marks, remarks, entered_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(exam_subject_id, student_id) DO UPDATE SET obtained_marks = excluded.obtained_marks,
       remarks = excluded.remarks, entered_by = excluded.entered_by, updated_at = ?`
  );
  const now = nowIso();
  const tx = db.transaction(() => {
    for (const e of entries) upsert.run(examSubjectId, e.studentId, e.obtainedMarks, e.remarks || "", session.userId, now, now);
  });
  tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "save_marks", entity: "marks", entityId: examSubjectId, details: `${entries.length} students` });
  return { success: true };
}

/** Computes per-student totals/percentage/grade for an exam, plus class rank (position). */
function computeExamResults(db, examId) {
  const exam = getById(db, examId);
  const subjectIds = exam.subjects.map((s) => s.id);
  if (subjectIds.length === 0) return [];
  const totalMax = exam.subjects.reduce((sum, s) => sum + s.max_marks, 0);

  const students = db.prepare("SELECT id, first_name, last_name, roll_number FROM students WHERE class_id = ? AND status='active'").all(exam.class_id);
  const results = students.map((student) => {
    const subjectMarks = exam.subjects.map((es) => {
      const mark = db.prepare("SELECT obtained_marks FROM marks WHERE exam_subject_id = ? AND student_id = ?").get(es.id, student.id);
      return { subjectId: es.subject_id, subjectName: es.subject_name, maxMarks: es.max_marks, passingMarks: es.passing_marks, obtained: mark ? mark.obtained_marks : null };
    });
    const allEntered = subjectMarks.every((m) => m.obtained !== null);
    const total = subjectMarks.reduce((sum, m) => sum + (m.obtained || 0), 0);
    const percentage = totalMax ? Math.round((total / totalMax) * 10000) / 100 : 0;
    const gradeInfo = resolveGrade(db, percentage);
    const passed = subjectMarks.every((m) => m.obtained === null || m.obtained >= m.passingMarks);
    return { student, subjectMarks, total, totalMax, percentage, allEntered, grade: gradeInfo.grade, passed };
  });

  const ranked = [...results].filter((r) => r.allEntered).sort((a, b) => b.total - a.total);
  ranked.forEach((r, idx) => { r.position = idx + 1; });
  const positionByStudent = Object.fromEntries(ranked.map((r) => [r.student.id, r.position]));
  results.forEach((r) => { r.position = positionByStudent[r.student.id] || null; });

  return results.sort((a, b) => (a.position || 999) - (b.position || 999));
}

function reportCard(db, examId, studentId) {
  const exam = getById(db, examId);
  const allResults = computeExamResults(db, examId);
  const result = allResults.find((r) => r.student.id === Number(studentId));
  if (!result) throw new AppError("No results found for this student in this exam.");
  const attendance = studentAttendanceSummary(db, studentId, { from: exam.start_date, to: exam.end_date });
  const remarksRow = db.prepare("SELECT * FROM report_card_remarks WHERE exam_id = ? AND student_id = ?").get(examId, studentId);
  return { exam, result, attendance, remarks: remarksRow || { teacher_remarks: "", principal_remarks: "" } };
}

function saveRemarks(db, session, { examId, studentId, teacherRemarks, principalRemarks }) {
  db.prepare(
    `INSERT INTO report_card_remarks (exam_id, student_id, teacher_remarks, principal_remarks) VALUES (?, ?, ?, ?)
     ON CONFLICT(exam_id, student_id) DO UPDATE SET teacher_remarks = excluded.teacher_remarks, principal_remarks = excluded.principal_remarks`
  ).run(examId, studentId, teacherRemarks || "", principalRemarks || "");
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "save_remarks", entity: "report_card_remarks", details: `exam ${examId} student ${studentId}` });
  return { success: true };
}

module.exports = { list, getById, create, updateStatus, getMarksGrid, saveMarks, computeExamResults, reportCard, saveRemarks };
