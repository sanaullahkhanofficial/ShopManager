"use strict";

/** Powers the global Ctrl+K search: students, parents, teachers, staff. */
function globalSearch(db, q) {
  if (!q || q.trim().length < 2) return { students: [], parents: [], teachers: [], staff: [] };
  const like = `%${q.trim()}%`;

  const students = db
    .prepare(
      `SELECT id, first_name, last_name, admission_no, student_code FROM students
       WHERE first_name LIKE ? OR last_name LIKE ? OR admission_no LIKE ? OR student_code LIKE ? LIMIT 8`
    )
    .all(like, like, like, like);

  const parents = db
    .prepare(
      `SELECT id, father_name, mother_name, guardian_name, phone FROM parents
       WHERE father_name LIKE ? OR mother_name LIKE ? OR guardian_name LIKE ? OR phone LIKE ? LIMIT 8`
    )
    .all(like, like, like, like);

  const teachers = db
    .prepare(`SELECT id, first_name, last_name, employee_id FROM teachers WHERE first_name LIKE ? OR last_name LIKE ? OR employee_id LIKE ? LIMIT 8`)
    .all(like, like, like);

  const staff = db
    .prepare(`SELECT id, first_name, last_name, employee_id, designation FROM staff WHERE first_name LIKE ? OR last_name LIKE ? OR employee_id LIKE ? LIMIT 8`)
    .all(like, like, like);

  return { students, parents, teachers, staff };
}

module.exports = { globalSearch };
