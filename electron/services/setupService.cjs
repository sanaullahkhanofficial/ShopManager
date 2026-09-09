"use strict";

const { hashPassword, nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");
const { loadDemoData } = require("../db/demoData.cjs");

function getStatus(db) {
  const school = db.prepare("SELECT * FROM schools WHERE id = 1").get();
  const hasNonBootstrapAdmin = db
    .prepare("SELECT COUNT(*) c FROM users WHERE username != 'admin' OR must_change_password = 0")
    .get().c;
  return {
    setupComplete: !!(school && school.setup_complete),
    school,
  };
}

/**
 * Runs the entire first-run Setup Wizard as a single database transaction:
 * school profile -> academic session/classes/sections/subjects -> fee
 * categories/structures/late-fee rule -> administrator account -> marks
 * setup complete. If any step fails, nothing is committed.
 */
function completeSetup(db, payload) {
  const { school, academic, finance, admin, loadDemo } = payload;

  if (!school || !school.name) throw new AppError("School name is required.");
  if (!admin || !admin.username || !admin.password) throw new AppError("Administrator account details are required.");
  if (admin.password.length < 6) throw new AppError("Administrator password must be at least 6 characters.");
  if (admin.password !== admin.confirmPassword) throw new AppError("Password and confirmation do not match.");
  if (!academic || !academic.sessionName || !academic.startDate || !academic.endDate) {
    throw new AppError("Academic session name and dates are required.");
  }

  const tx = db.transaction(() => {
    // 1. School profile
    db.prepare(
      `UPDATE schools SET name=?, logo_path=?, address=?, city=?, province=?, country=?, phone=?, email=?, website=?,
         principal_name=?, motto=?, currency=?, currency_symbol=?, updated_at=? WHERE id = 1`
    ).run(
      school.name, school.logoPath || "", school.address || "", school.city || "", school.province || "",
      school.country || "", school.phone || "", school.email || "", school.website || "",
      school.principalName || "", school.motto || "",
      (finance && finance.currency) || "USD", (finance && finance.currencySymbol) || "$", nowIso()
    );

    // 2. Academic session
    db.prepare("UPDATE academic_sessions SET is_current = 0").run();
    const sessionInfo = db
      .prepare("INSERT INTO academic_sessions (name, start_date, end_date, is_current, created_at) VALUES (?, ?, ?, 1, ?)")
      .run(academic.sessionName, academic.startDate, academic.endDate, nowIso());
    const sessionId = sessionInfo.lastInsertRowid;

    // Classes + sections
    const classIds = [];
    const insertClass = db.prepare("INSERT INTO classes (name, sort_order, created_at) VALUES (?, ?, ?)");
    const insertSection = db.prepare("INSERT INTO sections (class_id, name, created_at) VALUES (?, ?, ?)");
    (academic.classes || []).forEach((cls, idx) => {
      const name = typeof cls === "string" ? cls : cls.name;
      if (!name) return;
      const existing = db.prepare("SELECT id FROM classes WHERE name = ?").get(name);
      const classId = existing ? existing.id : insertClass.run(name, idx, nowIso()).lastInsertRowid;
      classIds.push(classId);
      const sectionNames = (typeof cls === "object" && cls.sections) || ["A"];
      for (const secName of sectionNames) {
        const secExists = db.prepare("SELECT id FROM sections WHERE class_id = ? AND name = ?").get(classId, secName);
        if (!secExists) insertSection.run(classId, secName, nowIso());
      }
    });

    // Subjects
    const insertSubject = db.prepare("INSERT INTO subjects (name, created_at) VALUES (?, ?)");
    for (const subjName of academic.subjects || []) {
      if (!subjName) continue;
      const exists = db.prepare("SELECT id FROM subjects WHERE name = ?").get(subjName);
      if (!exists) insertSubject.run(subjName, nowIso());
    }

    // 3. Finance: fee categories + structures + late fee setting
    const insertCategory = db.prepare("INSERT INTO fee_categories (name, is_recurring, created_at) VALUES (?, ?, ?)");
    const catIds = {};
    for (const cat of finance && finance.feeCategories ? finance.feeCategories : ["Tuition Fee"]) {
      const existing = db.prepare("SELECT id FROM fee_categories WHERE name = ?").get(cat);
      catIds[cat] = existing ? existing.id : insertCategory.run(cat, 1, nowIso()).lastInsertRowid;
    }
    if (finance && finance.monthlyFee && classIds.length) {
      const tuitionCatId = catIds[Object.keys(catIds)[0]];
      const insertStructure = db.prepare(
        `INSERT OR IGNORE INTO fee_structures (class_id, category_id, session_id, amount, frequency, created_at)
         VALUES (?, ?, ?, ?, 'monthly', ?)`
      );
      for (const classId of classIds) insertStructure.run(classId, tuitionCatId, sessionId, Number(finance.monthlyFee), nowIso());
    }
    if (finance && finance.admissionFee) {
      const admCatId = catIds["Admission Fee"] || insertCategory.run("Admission Fee", 0, nowIso()).lastInsertRowid;
      if (classIds.length) {
        const insertStructure = db.prepare(
          `INSERT OR IGNORE INTO fee_structures (class_id, category_id, session_id, amount, frequency, created_at)
           VALUES (?, ?, ?, ?, 'one_time', ?)`
        );
        for (const classId of classIds) insertStructure.run(classId, admCatId, sessionId, Number(finance.admissionFee), nowIso());
      }
    }
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('late_fee_amount', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String((finance && finance.lateFeeAmount) || 0));
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('discount_rules', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(JSON.stringify((finance && finance.discountRules) || []));

    // 4. Administrator account: replace bootstrap admin if it is still default, else create new
    const superAdminRole = db.prepare("SELECT id FROM roles WHERE name = 'Super Admin'").get();
    const bootstrap = db.prepare("SELECT * FROM users WHERE username = 'admin' AND must_change_password = 1").get();
    if (bootstrap && bootstrap.username === admin.username) {
      db.prepare("UPDATE users SET display_name=?, password_hash=?, must_change_password=0, updated_at=? WHERE id=?").run(
        admin.displayName || admin.username, hashPassword(admin.password), nowIso(), bootstrap.id
      );
    } else {
      const clash = db.prepare("SELECT id FROM users WHERE username = ?").get(admin.username);
      if (clash) throw new AppError("This username is already taken.");
      db.prepare(
        `INSERT INTO users (username, display_name, role_id, password_hash, status, created_at)
         VALUES (?, ?, ?, ?, 'active', ?)`
      ).run(admin.username, admin.displayName || admin.username, superAdminRole.id, hashPassword(admin.password), nowIso());
      if (bootstrap) db.prepare("UPDATE users SET status = 'inactive' WHERE id = ?").run(bootstrap.id);
    }

    // 5. Mark setup complete
    db.prepare("UPDATE schools SET setup_complete = 1, updated_at = ? WHERE id = 1").run(nowIso());

    if (loadDemo) loadDemoData(db);

    recordAudit(db, { actorName: admin.displayName || admin.username, action: "setup_complete", entity: "schools", entityId: 1 });
  });

  tx();
  return { success: true };
}

module.exports = { getStatus, completeSetup };
