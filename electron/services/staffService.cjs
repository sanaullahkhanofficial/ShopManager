"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { generateEmployeeId } = require("../lib/ids.cjs");
const { getSchool } = require("./settingsService.cjs");

function search(db, { q = "", status } = {}) {
  const clauses = [];
  const params = [];
  if (q) {
    clauses.push("(first_name LIKE ? OR last_name LIKE ? OR employee_id LIKE ? OR designation LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) { clauses.push("employment_status = ?"); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM staff ${where} ORDER BY created_at DESC`).all(...params);
}

function getById(db, id) {
  const row = db.prepare("SELECT * FROM staff WHERE id = ?").get(id);
  if (!row) throw new AppError("Staff member not found.");
  return row;
}

function validate(payload) {
  if (!payload.firstName) throw new AppError("First name is required.");
  if (!payload.designation) throw new AppError("Designation is required.");
  if (payload.basicSalary !== undefined && Number(payload.basicSalary) < 0) throw new AppError("Salary cannot be negative.");
}

function create(db, session, payload) {
  validate(payload);
  const school = getSchool(db);
  const empId = payload.employeeId || generateEmployeeId(db, "staff", school.employee_id_prefix || "EMP");
  const info = db
    .prepare(
      `INSERT INTO staff (employee_id, first_name, last_name, gender, dob, phone, email, address, department,
         designation, joining_date, basic_salary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      empId, payload.firstName, payload.lastName || "", payload.gender || "Other", payload.dob || null,
      payload.phone || "", payload.email || "", payload.address || "", payload.department || "",
      payload.designation, payload.joiningDate || null, payload.basicSalary || 0, nowIso()
    );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "create", entity: "staff", entityId: info.lastInsertRowid, details: empId });
  return { id: info.lastInsertRowid, employeeId: empId };
}

function update(db, session, id, payload) {
  validate(payload);
  const existing = getById(db, id);
  db.prepare(
    `UPDATE staff SET first_name=?, last_name=?, gender=?, dob=?, phone=?, email=?, address=?, department=?,
       designation=?, joining_date=?, basic_salary=?, employment_status=?, updated_at=? WHERE id=?`
  ).run(
    payload.firstName, payload.lastName || "", payload.gender || "Other", payload.dob || null, payload.phone || "",
    payload.email || "", payload.address || "", payload.department || "", payload.designation,
    payload.joiningDate || null, payload.basicSalary || 0, payload.employmentStatus || existing.employment_status,
    nowIso(), id
  );
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update", entity: "staff", entityId: id });
  return { success: true };
}

module.exports = { search, getById, create, update };
