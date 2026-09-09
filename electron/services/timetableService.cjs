"use strict";

const { nowIso, AppError } = require("../lib/security.cjs");
const { recordAudit } = require("../lib/audit.cjs");

function getSectionTimetable(db, sectionId) {
  return db
    .prepare(
      `SELECT t.*, s.name AS subject_name, (te.first_name || ' ' || te.last_name) AS teacher_name
       FROM timetable_slots t
       LEFT JOIN subjects s ON s.id = t.subject_id
       LEFT JOIN teachers te ON te.id = t.teacher_id
       WHERE t.section_id = ?
       ORDER BY t.day_of_week, t.period_index`
    )
    .all(sectionId);
}

function getTeacherTimetable(db, teacherId) {
  return db
    .prepare(
      `SELECT t.*, s.name AS subject_name, c.name AS class_name, sec.name AS section_name
       FROM timetable_slots t
       LEFT JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       JOIN sections sec ON sec.id = t.section_id
       WHERE t.teacher_id = ?
       ORDER BY t.day_of_week, t.period_index`
    )
    .all(teacherId);
}

/**
 * Saves one timetable slot after checking for the two conflict types the
 * spec calls out explicitly: a teacher already booked elsewhere at the same
 * day/period, or the same section already having a period at that slot.
 * Room conflicts are checked too when a room is specified.
 */
function saveSlot(db, session, payload) {
  const { id, classId, sectionId, dayOfWeek, periodIndex, startTime, endTime, subjectId, teacherId, room } = payload;
  if (!classId || !sectionId || dayOfWeek === undefined || periodIndex === undefined || !startTime || !endTime) {
    throw new AppError("Class, section, day, period and times are required.");
  }

  if (teacherId) {
    const conflict = db
      .prepare(
        `SELECT t.id, c.name AS class_name, sec.name AS section_name FROM timetable_slots t
         JOIN classes c ON c.id = t.class_id JOIN sections sec ON sec.id = t.section_id
         WHERE t.teacher_id = ? AND t.day_of_week = ? AND t.period_index = ? AND t.id != ?`
      )
      .get(teacherId, dayOfWeek, periodIndex, id || 0);
    if (conflict) {
      throw new AppError(
        `Teacher is already scheduled for ${conflict.class_name} - ${conflict.section_name} at this period.`
      );
    }
  }

  if (room) {
    const roomConflict = db
      .prepare(
        `SELECT id FROM timetable_slots WHERE room = ? AND day_of_week = ? AND period_index = ? AND id != ?`
      )
      .get(room, dayOfWeek, periodIndex, id || 0);
    if (roomConflict) throw new AppError(`Room "${room}" is already booked at this period.`);
  }

  if (id) {
    db.prepare(
      `UPDATE timetable_slots SET start_time=?, end_time=?, subject_id=?, teacher_id=?, room=? WHERE id=?`
    ).run(startTime, endTime, subjectId || null, teacherId || null, room || "", id);
  } else {
    const existingSlot = db
      .prepare("SELECT id FROM timetable_slots WHERE section_id = ? AND day_of_week = ? AND period_index = ?")
      .get(sectionId, dayOfWeek, periodIndex);
    if (existingSlot) throw new AppError("This section already has a period scheduled at this time slot.");
    db.prepare(
      `INSERT INTO timetable_slots (class_id, section_id, day_of_week, period_index, start_time, end_time,
         subject_id, teacher_id, room, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(classId, sectionId, dayOfWeek, periodIndex, startTime, endTime, subjectId || null, teacherId || null, room || "", nowIso());
  }
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "save_slot", entity: "timetable_slots" });
  return { success: true };
}

function deleteSlot(db, session, id) {
  db.prepare("DELETE FROM timetable_slots WHERE id = ?").run(id);
  recordAudit(db, { userId: session.userId, actorName: session.displayName, action: "delete_slot", entity: "timetable_slots", entityId: id });
  return { success: true };
}

module.exports = { getSectionTimetable, getTeacherTimetable, saveSlot, deleteSlot };
