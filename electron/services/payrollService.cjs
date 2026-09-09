"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

/** Returns the roster (teachers+staff) for a given month with any existing payroll run rows joined in. */
function getMonthRoster(db, month) {
  const teachers = db
    .prepare(
      `SELECT t.id AS person_id, 'teacher' AS person_type, t.employee_id, t.first_name, t.last_name, t.basic_salary,
              pr.id AS run_id, pr.allowances, pr.bonuses, pr.deductions, pr.advances, pr.net_salary, pr.status
       FROM teachers t
       LEFT JOIN payroll_runs pr ON pr.person_id = t.id AND pr.person_type = 'teacher' AND pr.month = ?
       WHERE t.employment_status = 'active'`
    )
    .all(month);
  const staff = db
    .prepare(
      `SELECT s.id AS person_id, 'staff' AS person_type, s.employee_id, s.first_name, s.last_name, s.basic_salary,
              pr.id AS run_id, pr.allowances, pr.bonuses, pr.deductions, pr.advances, pr.net_salary, pr.status
       FROM staff s
       LEFT JOIN payroll_runs pr ON pr.person_id = s.id AND pr.person_type = 'staff' AND pr.month = ?
       WHERE s.employment_status = 'active'`
    )
    .all(month);
  return [...teachers, ...staff];
}

/** basic + allowances + bonuses - deductions - advances = net salary. */
function computeNet({ basicSalary, allowances = 0, bonuses = 0, deductions = 0, advances = 0 }) {
  return Math.round((Number(basicSalary) + Number(allowances) + Number(bonuses) - Number(deductions) - Number(advances)) * 100) / 100;
}

function saveEntry(db, session, payload) {
  const { month, personType, personId, basicSalary, allowances = 0, bonuses = 0, deductions = 0, advances = 0, notes } = payload;
  if (!month || !personType || !personId || basicSalary === undefined) {
    throw new AppError("Month, person and basic salary are required.");
  }
  if ([allowances, bonuses, deductions, advances].some((v) => Number(v) < 0)) {
    throw new AppError("Payroll amounts cannot be negative.");
  }
  const netSalary = computeNet({ basicSalary, allowances, bonuses, deductions, advances });
  if (netSalary < 0) throw new AppError("Net salary cannot be negative — check deductions and advances.");
  db.prepare(
    `INSERT INTO payroll_runs (month, person_type, person_id, basic_salary, allowances, bonuses, deductions,
       advances, net_salary, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(month, person_type, person_id) DO UPDATE SET
       basic_salary=excluded.basic_salary, allowances=excluded.allowances, bonuses=excluded.bonuses,
       deductions=excluded.deductions, advances=excluded.advances, net_salary=excluded.net_salary, notes=excluded.notes`
  ).run(month, personType, personId, basicSalary, allowances, bonuses, deductions, advances, netSalary, notes || "", nowIso());
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "save_payroll", entity: "payroll_runs", details: `${personType}:${personId} ${month}` });
  return { netSalary };
}

function markPaid(db, session, runId, paidDate) {
  db.prepare("UPDATE payroll_runs SET status='paid', paid_date=? WHERE id=?").run(paidDate || nowIso().slice(0, 10), runId);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "mark_paid", entity: "payroll_runs", entityId: runId });
  return { success: true };
}

function getSlip(db, runId) {
  const run = db.prepare("SELECT * FROM payroll_runs WHERE id = ?").get(runId);
  if (!run) throw new AppError("Salary slip not found.");
  const table = run.person_type === "teacher" ? "teachers" : "staff";
  const person = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(run.person_id);
  return { run, person };
}

function history(db, { personType, personId } = {}) {
  const clauses = [];
  const params = [];
  if (personType) { clauses.push("person_type = ?"); params.push(personType); }
  if (personId) { clauses.push("person_id = ?"); params.push(personId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM payroll_runs ${where} ORDER BY month DESC`).all(...params);
}

module.exports = { getMonthRoster, saveEntry, markPaid, getSlip, history, computeNet };
