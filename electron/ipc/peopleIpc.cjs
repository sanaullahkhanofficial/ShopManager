"use strict";

const { makeWrap } = require("./wrap.cjs");
const studentService = require("../services/studentService.cjs");
const parentService = require("../services/parentService.cjs");
const admissionService = require("../services/admissionService.cjs");
const teacherService = require("../services/teacherService.cjs");
const staffService = require("../services/staffService.cjs");

function register(ipcMain, ctx) {
  const wrap = makeWrap(ctx);

  // ---- Students ----
  ipcMain.handle("students:search", wrap("students.view", (db, _s, params) => studentService.search(db, params)));
  ipcMain.handle("students:getById", wrap("students.view", (db, _s, id) => studentService.getById(db, id)));
  ipcMain.handle("students:create", wrap("students.create", (db, session, payload) => studentService.create(db, session, payload)));
  ipcMain.handle("students:update", wrap("students.edit", (db, session, id, payload) => studentService.update(db, session, id, payload)));
  ipcMain.handle("students:setStatus", wrap("students.archive", (db, session, id, status) => studentService.setStatus(db, session, id, status)));
  ipcMain.handle("students:linkParent", wrap("students.edit", (db, session, studentId, parentId, isPrimary) => studentService.linkParent(db, session, studentId, parentId, isPrimary)));
  ipcMain.handle("students:unlinkParent", wrap("students.edit", (db, session, studentId, parentId) => studentService.unlinkParent(db, session, studentId, parentId)));
  ipcMain.handle("students:importBulk", wrap("students.create", (db, session, rows) => studentService.importBulk(db, session, rows)));

  // ---- Parents ----
  ipcMain.handle("parents:search", wrap("parents.view", (db, _s, params) => parentService.search(db, params)));
  ipcMain.handle("parents:getById", wrap("parents.view", (db, _s, id) => parentService.getById(db, id)));
  ipcMain.handle("parents:create", wrap("parents.manage", (db, session, payload) => parentService.create(db, session, payload)));
  ipcMain.handle("parents:update", wrap("parents.manage", (db, session, id, payload) => parentService.update(db, session, id, payload)));
  ipcMain.handle("parents:setStatus", wrap("parents.manage", (db, session, id, status) => parentService.setStatus(db, session, id, status)));

  // ---- Admissions ----
  ipcMain.handle("admissions:list", wrap("admissions.view", (db, _s, params) => admissionService.list(db, params)));
  ipcMain.handle("admissions:getById", wrap("admissions.view", (db, _s, id) => admissionService.getById(db, id)));
  ipcMain.handle("admissions:create", wrap("admissions.manage", (db, session, payload) => admissionService.create(db, session, payload)));
  ipcMain.handle("admissions:moveStage", wrap("admissions.manage", (db, session, id, stage, extra) => admissionService.moveStage(db, session, id, stage, extra)));
  ipcMain.handle("admissions:enroll", wrap("admissions.manage", (db, session, id, extra) => admissionService.enroll(db, session, id, extra)));

  // ---- Teachers ----
  ipcMain.handle("teachers:search", wrap("teachers.manage", (db, _s, params) => teacherService.search(db, params)));
  ipcMain.handle("teachers:getById", wrap("teachers.manage", (db, _s, id) => teacherService.getById(db, id)));
  ipcMain.handle("teachers:create", wrap("teachers.manage", (db, session, payload) => teacherService.create(db, session, payload)));
  ipcMain.handle("teachers:update", wrap("teachers.manage", (db, session, id, payload) => teacherService.update(db, session, id, payload)));
  ipcMain.handle("teachers:assignClass", wrap("teachers.manage", (db, session, teacherId, payload) => teacherService.assignClass(db, session, teacherId, payload)));
  ipcMain.handle("teachers:removeAssignment", wrap("teachers.manage", (db, session, assignmentId) => teacherService.removeAssignment(db, session, assignmentId)));

  // ---- Staff ----
  ipcMain.handle("staff:search", wrap("staff.manage", (db, _s, params) => staffService.search(db, params)));
  ipcMain.handle("staff:getById", wrap("staff.manage", (db, _s, id) => staffService.getById(db, id)));
  ipcMain.handle("staff:create", wrap("staff.manage", (db, session, payload) => staffService.create(db, session, payload)));
  ipcMain.handle("staff:update", wrap("staff.manage", (db, session, id, payload) => staffService.update(db, session, id, payload)));
}

module.exports = { register };
