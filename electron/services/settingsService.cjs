"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

const SCHOOL_COLUMNS = [
  "name", "logo_path", "address", "city", "province", "country", "phone", "email", "website",
  "principal_name", "motto", "currency", "currency_symbol", "language", "date_format", "time_format",
  "receipt_prefix", "voucher_prefix", "student_id_prefix", "admission_no_prefix", "employee_id_prefix",
  "theme_primary_color", "theme_mode", "receipt_footer", "setup_complete",
];

function getSchool(db) {
  return db.prepare("SELECT * FROM schools WHERE id = 1").get();
}

function updateSchool(db, session, payload) {
  const existing = getSchool(db);
  const next = { ...existing };
  for (const key of SCHOOL_COLUMNS) {
    if (payload[key] !== undefined) next[key] = payload[key];
  }
  const setClause = SCHOOL_COLUMNS.map((c) => `${c} = ?`).join(", ");
  db.prepare(`UPDATE schools SET ${setClause}, updated_at = ? WHERE id = 1`).run(
    ...SCHOOL_COLUMNS.map((c) => next[c]),
    nowIso()
  );
  recordAudit(db, { userId: session && session.userId, actorName: session && session.displayName, action: "update", entity: "schools", entityId: 1 });
  return getSchool(db);
}

function getMisc(db) {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function setMisc(db, session, obj) {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) upsert.run(k, String(v ?? ""));
  });
  tx(Object.entries(obj));
  recordAudit(db, { userId: session && session.userId, actorName: session && session.displayName, action: "update_settings", entity: "settings" });
  return getMisc(db);
}

function getGradingScale(db) {
  return db.prepare("SELECT * FROM grading_scales ORDER BY min_percent DESC").all();
}

function saveGradingScale(db, session, rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new AppError("Provide at least one grade band.");
  for (const r of rows) {
    if (r.min_percent === undefined || r.max_percent === undefined || !r.grade) {
      throw new AppError("Each grade band needs a minimum %, maximum % and grade label.");
    }
    if (Number(r.min_percent) >= Number(r.max_percent)) {
      throw new AppError(`Grade ${r.grade}: minimum percent must be less than maximum percent.`);
    }
  }
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM grading_scales").run();
    const insert = db.prepare(
      "INSERT INTO grading_scales (min_percent, max_percent, grade, remarks, gpa) VALUES (?, ?, ?, ?, ?)"
    );
    for (const r of rows) insert.run(r.min_percent, r.max_percent, r.grade, r.remarks || "", r.gpa || 0);
  });
  tx();
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "update_grading_scale", entity: "grading_scales" });
  return getGradingScale(db);
}

function resolveGrade(db, percent) {
  const scale = getGradingScale(db);
  const band = scale.find((s) => percent >= s.min_percent && percent < s.max_percent);
  return band || { grade: "-", remarks: "", gpa: 0 };
}

module.exports = { getSchool, updateSchool, getMisc, setMisc, getGradingScale, saveGradingScale, resolveGrade };
