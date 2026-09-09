"use strict";

const { hashPassword, nowIso } = require("../lib/security.cjs");
const { PERMISSIONS, DEFAULT_ROLES } = require("../lib/permissions.cjs");

/**
 * First-launch seeding: permission catalog, default roles + role_permissions,
 * a bootstrap Super Admin account (only if there truly are zero users yet —
 * the real admin account normally gets created by the Setup Wizard, which
 * then this bootstrap account can be deactivated or replaced by the school).
 * Also seeds the singleton `schools` row and a sane default grading scale.
 * Nothing here is demo/fake business data — see demoData.cjs for that,
 * which is only invoked explicitly from the Setup Wizard's "load sample data"
 * option and is clearly labeled as such in the UI.
 */
function seedIfEmpty(db) {
  const tx = db.transaction(() => {
    seedPermissions(db);
    seedRoles(db);
    seedSchoolRow(db);
    seedGradingScale(db);
    seedBootstrapAdmin(db);
  });
  tx();
}

function seedPermissions(db) {
  const existing = db.prepare("SELECT COUNT(*) c FROM permissions").get().c;
  if (existing > 0) return;
  const insert = db.prepare("INSERT INTO permissions (code, label, module) VALUES (?, ?, ?)");
  for (const [code, label, module] of PERMISSIONS) insert.run(code, label, module);
}

function seedRoles(db) {
  const existing = db.prepare("SELECT COUNT(*) c FROM roles").get().c;
  if (existing > 0) return;
  const insertRole = db.prepare("INSERT INTO roles (name, description, is_system, created_at) VALUES (?, ?, 1, ?)");
  const allPermIds = db.prepare("SELECT id, code FROM permissions").all();
  const permByCode = Object.fromEntries(allPermIds.map((p) => [p.code, p.id]));
  const linkPerm = db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");

  for (const [roleName, codes] of Object.entries(DEFAULT_ROLES)) {
    const info = insertRole.run(roleName, `${roleName} (default role)`, nowIso());
    const roleId = info.lastInsertRowid;
    const grantAll = codes.includes("*");
    const grantCodes = grantAll ? allPermIds.map((p) => p.code) : codes;
    for (const code of grantCodes) {
      if (permByCode[code]) linkPerm.run(roleId, permByCode[code]);
    }
  }
}

function seedSchoolRow(db) {
  const existing = db.prepare("SELECT id FROM schools WHERE id = 1").get();
  if (existing) return;
  db.prepare(
    `INSERT INTO schools (id, name, currency, currency_symbol, setup_complete, installed_at, updated_at)
     VALUES (1, 'My School', 'USD', '$', 0, ?, ?)`
  ).run(nowIso(), nowIso());
}

function seedGradingScale(db) {
  const existing = db.prepare("SELECT COUNT(*) c FROM grading_scales").get().c;
  if (existing > 0) return;
  const insert = db.prepare(
    "INSERT INTO grading_scales (min_percent, max_percent, grade, remarks, gpa) VALUES (?, ?, ?, ?, ?)"
  );
  const rows = [
    [90, 100.01, "A+", "Outstanding", 4.0],
    [80, 90, "A", "Excellent", 3.7],
    [70, 80, "B", "Very Good", 3.3],
    [60, 70, "C", "Good", 3.0],
    [50, 60, "D", "Satisfactory", 2.0],
    [0, 50, "F", "Fail", 0.0],
  ];
  for (const r of rows) insert.run(...r);
}

function seedBootstrapAdmin(db) {
  const existing = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  if (existing > 0) return;
  const superAdminRole = db.prepare("SELECT id FROM roles WHERE name = 'Super Admin'").get();
  if (!superAdminRole) return;
  db.prepare(
    `INSERT INTO users (username, display_name, role_id, password_hash, status, must_change_password, created_at)
     VALUES (?, ?, ?, ?, 'active', 1, ?)`
  ).run("admin", "Administrator", superAdminRole.id, hashPassword("admin123"), nowIso());
}

module.exports = { seedIfEmpty };
