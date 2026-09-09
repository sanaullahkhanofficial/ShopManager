"use strict";

const { makeWrap } = require("./wrap.cjs");
const attendanceService = require("../services/attendanceService.cjs");
const timetableService = require("../services/timetableService.cjs");
const homeworkService = require("../services/homeworkService.cjs");
const noticeService = require("../services/noticeService.cjs");
const examService = require("../services/examService.cjs");

function register(ipcMain, ctx) {
  const wrap = makeWrap(ctx);

  // ---- Attendance ----
  ipcMain.handle("attendance:getClass", wrap("attendance.manage", (db, _s, params) => attendanceService.getClassAttendance(db, params)));
  ipcMain.handle("attendance:saveClass", wrap("attendance.manage", (db, session, payload) => attendanceService.saveClassAttendance(db, session, payload)));
  ipcMain.handle("attendance:studentSummary", wrap("students.view", (db, _s, studentId, range) => attendanceService.studentAttendanceSummary(db, studentId, range)));
  ipcMain.handle("attendance:classMonthly", wrap("attendance.manage", (db, _s, params) => attendanceService.classMonthlyReport(db, params)));
  ipcMain.handle("attendance:getStaff", wrap("attendance.staff", (db, _s, params) => attendanceService.getStaffAttendance(db, params)));
  ipcMain.handle("attendance:saveStaff", wrap("attendance.staff", (db, session, payload) => attendanceService.saveStaffAttendance(db, session, payload)));

  // ---- Timetable ----
  ipcMain.handle("timetable:getSection", wrap(null, (db, _s, sectionId) => timetableService.getSectionTimetable(db, sectionId)));
  ipcMain.handle("timetable:getTeacher", wrap(null, (db, _s, teacherId) => timetableService.getTeacherTimetable(db, teacherId)));
  ipcMain.handle("timetable:saveSlot", wrap("timetable.manage", (db, session, payload) => timetableService.saveSlot(db, session, payload)));
  ipcMain.handle("timetable:deleteSlot", wrap("timetable.manage", (db, session, id) => timetableService.deleteSlot(db, session, id)));

  // ---- Homework ----
  ipcMain.handle("homework:list", wrap(null, (db, _s, params) => homeworkService.list(db, params)));
  ipcMain.handle("homework:create", wrap("homework.manage", (db, session, payload) => homeworkService.create(db, session, payload)));
  ipcMain.handle("homework:setStatus", wrap("homework.manage", (db, session, id, status) => homeworkService.setStatus(db, session, id, status)));
  ipcMain.handle("homework:delete", wrap("homework.manage", (db, session, id) => homeworkService.remove(db, session, id)));

  // ---- Notices ----
  ipcMain.handle("notices:list", wrap(null, (db, _s, params) => noticeService.list(db, params)));
  ipcMain.handle("notices:create", wrap("notices.manage", (db, session, payload) => noticeService.create(db, session, payload)));
  ipcMain.handle("notices:delete", wrap("notices.manage", (db, session, id) => noticeService.remove(db, session, id)));

  // ---- Exams ----
  ipcMain.handle("exams:list", wrap("exams.manage", (db, _s, params) => examService.list(db, params)));
  ipcMain.handle("exams:getById", wrap("exams.manage", (db, _s, id) => examService.getById(db, id)));
  ipcMain.handle("exams:create", wrap("exams.manage", (db, session, payload) => examService.create(db, session, payload)));
  ipcMain.handle("exams:updateStatus", wrap("exams.manage", (db, session, id, status) => examService.updateStatus(db, session, id, status)));
  ipcMain.handle("exams:getMarksGrid", wrap("marks.enter", (db, _s, examSubjectId) => examService.getMarksGrid(db, examSubjectId)));
  ipcMain.handle("exams:saveMarks", wrap("marks.enter", (db, session, payload) => examService.saveMarks(db, session, payload)));
  ipcMain.handle("exams:computeResults", wrap("exams.manage", (db, _s, examId) => examService.computeExamResults(db, examId)));
  ipcMain.handle("exams:reportCard", wrap("exams.manage", (db, _s, examId, studentId) => examService.reportCard(db, examId, studentId)));
  ipcMain.handle("exams:saveRemarks", wrap("marks.edit", (db, session, payload) => examService.saveRemarks(db, session, payload)));
}

module.exports = { register };
