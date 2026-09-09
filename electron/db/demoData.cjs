"use strict";

const { nowIso } = require("../lib/security.cjs");
const { generateStudentCode, generateAdmissionNo, generateEmployeeId } = require("../lib/ids.cjs");

/**
 * Loads clearly-labeled realistic demo data (Bright Future Public School).
 * Only ever invoked explicitly by the Setup Wizard's "Load sample data" step
 * or from Settings > System Information > "Load demo data" — never silently.
 * Idempotent-ish: skips classes/subjects that already exist by name.
 */
function loadDemoData(db) {
  const tx = db.transaction(() => {
    const sessionId = ensureSession(db);
    const classIds = ensureClasses(db);
    const sectionIds = ensureSections(db, classIds);
    const subjectIds = ensureSubjects(db);
    ensureClassSubjects(db, classIds, subjectIds);
    ensureFeeCategoriesAndStructures(db, classIds, sessionId);
    const teacherIds = ensureTeachers(db);
    ensureStudents(db, classIds, sectionIds, sessionId);
  });
  tx();
  return { message: "Demo data loaded: Bright Future Public School sample records." };
}

function ensureSession(db) {
  let row = db.prepare("SELECT id FROM academic_sessions WHERE is_current = 1").get();
  if (row) return row.id;
  const year = new Date().getFullYear();
  const info = db
    .prepare(
      "INSERT INTO academic_sessions (name, start_date, end_date, is_current, created_at) VALUES (?, ?, ?, 1, ?)"
    )
    .run(`${year}-${year + 1}`, `${year}-08-01`, `${year + 1}-06-30`, nowIso());
  return info.lastInsertRowid;
}

function ensureClasses(db) {
  const names = Array.from({ length: 10 }, (_, i) => `Grade ${i + 1}`);
  const ids = {};
  const insert = db.prepare("INSERT INTO classes (name, sort_order, created_at) VALUES (?, ?, ?)");
  names.forEach((name, i) => {
    let row = db.prepare("SELECT id FROM classes WHERE name = ?").get(name);
    if (!row) {
      const info = insert.run(name, i, nowIso());
      row = { id: info.lastInsertRowid };
    }
    ids[name] = row.id;
  });
  return ids;
}

function ensureSections(db, classIds) {
  const ids = {};
  const insert = db.prepare("INSERT INTO sections (class_id, name, created_at) VALUES (?, ?, ?)");
  for (const [className, classId] of Object.entries(classIds)) {
    for (const secName of ["A", "B"]) {
      let row = db.prepare("SELECT id FROM sections WHERE class_id = ? AND name = ?").get(classId, secName);
      if (!row) {
        const info = insert.run(classId, secName, nowIso());
        row = { id: info.lastInsertRowid };
      }
      ids[`${className}-${secName}`] = row.id;
    }
  }
  return ids;
}

function ensureSubjects(db) {
  const names = ["English", "Mathematics", "Science", "Computer Studies", "Social Studies", "Art"];
  const ids = {};
  const insert = db.prepare("INSERT INTO subjects (name, code, created_at) VALUES (?, ?, ?)");
  names.forEach((name) => {
    let row = db.prepare("SELECT id FROM subjects WHERE name = ?").get(name);
    if (!row) {
      const info = insert.run(name, name.slice(0, 3).toUpperCase(), nowIso());
      row = { id: info.lastInsertRowid };
    }
    ids[name] = row.id;
  });
  return ids;
}

function ensureClassSubjects(db, classIds, subjectIds) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO class_subjects (class_id, subject_id) VALUES (?, ?)"
  );
  for (const classId of Object.values(classIds)) {
    for (const subjectId of Object.values(subjectIds)) insert.run(classId, subjectId);
  }
}

function ensureFeeCategoriesAndStructures(db, classIds, sessionId) {
  const cats = ["Tuition Fee", "Examination Fee", "Library Fee"];
  const catIds = {};
  const insertCat = db.prepare("INSERT INTO fee_categories (name, is_recurring, created_at) VALUES (?, ?, ?)");
  cats.forEach((name, i) => {
    let row = db.prepare("SELECT id FROM fee_categories WHERE name = ?").get(name);
    if (!row) {
      const info = insertCat.run(name, i === 0 ? 1 : 0, nowIso());
      row = { id: info.lastInsertRowid };
    }
    catIds[name] = row.id;
  });
  const insertStruct = db.prepare(
    `INSERT OR IGNORE INTO fee_structures (class_id, category_id, session_id, amount, frequency, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  let base = 3000;
  for (const classId of Object.values(classIds)) {
    insertStruct.run(classId, catIds["Tuition Fee"], sessionId, base, "monthly", nowIso());
    insertStruct.run(classId, catIds["Examination Fee"], sessionId, 1500, "term", nowIso());
    insertStruct.run(classId, catIds["Library Fee"], sessionId, 500, "annual", nowIso());
    base += 200;
  }
}

function ensureTeachers(db) {
  const existing = db.prepare("SELECT COUNT(*) c FROM teachers").get().c;
  if (existing >= 15) return;
  const firstNames = ["Sara", "Ahmed", "Ayesha", "Bilal", "Fatima", "Hassan", "Zainab", "Omar", "Hira", "Usman", "Mariam", "Kashif", "Nida", "Adeel", "Sana"];
  const insert = db.prepare(
    `INSERT INTO teachers (employee_id, first_name, last_name, gender, joining_date, department, basic_salary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const ids = [];
  firstNames.forEach((fn, i) => {
    const empId = generateEmployeeId(db, "teachers", "EMP");
    const info = insert.run(empId, fn, "Khan", i % 2 === 0 ? "Female" : "Male", "2024-08-01", "Academics", 45000 + i * 1000, nowIso());
    ids.push(info.lastInsertRowid);
  });
  return ids;
}

function ensureStudents(db, classIds, sectionIds, sessionId) {
  const existing = db.prepare("SELECT COUNT(*) c FROM students").get().c;
  if (existing >= 100) return;
  const firstNames = ["Ali", "Zara", "Danish", "Mahnoor", "Hamza", "Areeba", "Bilawal", "Komal", "Talha", "Iqra"];
  const lastNames = ["Raza", "Sheikh", "Malik", "Butt", "Chaudhry", "Qureshi", "Baig", "Awan"];
  const insertStudent = db.prepare(
    `INSERT INTO students (student_code, admission_no, first_name, last_name, father_name, dob, gender,
       admission_date, session_id, class_id, section_id, roll_number, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  );
  const classEntries = Object.entries(classIds);
  let count = 0;
  for (let i = 0; i < 100; i++) {
    const [className, classId] = classEntries[i % classEntries.length];
    const sectionKey = `${className}-${i % 2 === 0 ? "A" : "B"}`;
    const sectionId = sectionIds[sectionKey];
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const studentCode = generateStudentCode(db, "STU");
    const admissionNo = generateAdmissionNo(db, "ADM");
    insertStudent.run(
      studentCode,
      admissionNo,
      fn,
      ln,
      `Mr. ${ln}`,
      `${2010 + (i % 8)}-0${(i % 9) + 1}-1${i % 9}`,
      i % 2 === 0 ? "Male" : "Female",
      "2024-08-01",
      sessionId,
      classId,
      sectionId,
      String((i % 40) + 1),
      nowIso()
    );
    count++;
  }
  return count;
}

module.exports = { loadDemoData };
