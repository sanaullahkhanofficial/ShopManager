"use strict";

const { AppError } = require("../lib/security.cjs");

// ---------- Students ----------
function studentList(db, { classId, sectionId, status } = {}) {
  const clauses = [];
  const params = [];
  if (classId) { clauses.push("s.class_id = ?"); params.push(classId); }
  if (sectionId) { clauses.push("s.section_id = ?"); params.push(sectionId); }
  if (status) { clauses.push("s.status = ?"); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT s.student_code, s.admission_no, s.first_name, s.last_name, s.father_name, c.name AS class_name,
              sec.name AS section_name, s.gender, s.phone, s.status, s.admission_date
       FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN sections sec ON sec.id = s.section_id
       ${where} ORDER BY c.sort_order, s.first_name`
    )
    .all(...params);
}

function genderDistribution(db) {
  return db.prepare("SELECT gender, COUNT(*) count FROM students WHERE status='active' GROUP BY gender").all();
}

function newAdmissions(db, { from, to }) {
  const clauses = [];
  const params = [];
  if (from) { clauses.push("admission_date >= ?"); params.push(from); }
  if (to) { clauses.push("admission_date <= ?"); params.push(to); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT student_code, admission_no, first_name, last_name, admission_date FROM students ${where} ORDER BY admission_date DESC`).all(...params);
}

function leavingStudents(db, { from, to }) {
  const clauses = ["status IN ('graduated','transferred','left')"];
  const params = [];
  if (from) { clauses.push("archived_at >= ?"); params.push(from); }
  if (to) { clauses.push("archived_at <= ?"); params.push(to); }
  return db.prepare(`SELECT student_code, admission_no, first_name, last_name, status, archived_at FROM students WHERE ${clauses.join(" AND ")} ORDER BY archived_at DESC`).all(...params);
}

// ---------- Attendance ----------
function dailyAttendance(db, date) {
  return db
    .prepare(
      `SELECT c.name AS class_name, sec.name AS section_name,
              SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) present,
              SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) absent,
              SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) late,
              SUM(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) leave_
       FROM attendance a JOIN classes c ON c.id = a.class_id LEFT JOIN sections sec ON sec.id = a.section_id
       WHERE a.date = ? GROUP BY a.class_id, a.section_id`
    )
    .all(date);
}

// ---------- Finance ----------
function dailyCollection(db, date) {
  return db
    .prepare(
      `SELECT p.receipt_no, p.amount, p.method, s.first_name, s.last_name, s.admission_no
       FROM fee_payments p JOIN students s ON s.id = p.student_id WHERE p.paid_date = ? AND p.voided = 0 ORDER BY p.created_at`
    )
    .all(date);
}

function incomeStatement(db, { from, to }) {
  const income = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE paid_date BETWEEN ? AND ? AND voided=0").get(from, to).v;
  const expenses = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?").get(from, to).v;
  const payroll = db.prepare("SELECT COALESCE(SUM(net_salary),0) v FROM payroll_runs WHERE status='paid' AND paid_date BETWEEN ? AND ?").get(from, to).v;
  return { income, expenses, payroll, net: Math.round((income - expenses - payroll) * 100) / 100 };
}

// ---------- Academic ----------
function gradeDistribution(db, examId) {
  const { computeExamResults } = require("./examService.cjs");
  const results = computeExamResults(db, examId);
  const counts = {};
  for (const r of results) {
    if (!r.allEntered) continue;
    counts[r.grade] = (counts[r.grade] || 0) + 1;
  }
  return Object.entries(counts).map(([grade, count]) => ({ grade, count }));
}

module.exports = {
  studentList, genderDistribution, newAdmissions, leavingStudents,
  dailyAttendance, dailyCollection, incomeStatement, gradeDistribution,
};
