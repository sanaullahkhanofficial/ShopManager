"use strict";

const { makeWrap } = require("./wrap.cjs");
const authService = require("../services/authService.cjs");
const userService = require("../services/userService.cjs");
const roleService = require("../services/roleService.cjs");
const settingsService = require("../services/settingsService.cjs");
const academicService = require("../services/academicService.cjs");
const setupService = require("../services/setupService.cjs");
const { loadDemoData } = require("../db/demoData.cjs");

function register(ipcMain, ctx) {
  const wrap = makeWrap(ctx);

  // ---- Setup wizard (no auth required yet) ----
  ipcMain.handle("setup:status", wrap(null, (db) => setupService.getStatus(db)));
  ipcMain.handle("setup:complete", wrap(null, (db, _s, payload) => setupService.completeSetup(db, payload)));

  // ---- Auth ----
  ipcMain.handle("auth:login", wrap(null, (db, _s, payload) => {
    const user = authService.login(db, payload);
    ctx.setSession({ userId: user.id, displayName: user.displayName, roleId: user.roleId, roleName: user.roleName });
    return user;
  }));
  ipcMain.handle("auth:logout", wrap(null, (db, session) => {
    const result = authService.logout(db, session);
    ctx.setSession(null);
    return result;
  }));
  ipcMain.handle("auth:currentUser", wrap(null, (db, session) => authService.currentUser(db, session)));
  ipcMain.handle("auth:changePassword", wrap(null, (db, session, payload) => authService.changePassword(db, session, payload)));
  ipcMain.handle("auth:resetPassword", wrap("users.manage", (db, session, payload) => authService.resetPassword(db, session, payload)));

  // ---- Users ----
  ipcMain.handle("users:list", wrap("users.manage", (db) => userService.list(db)));
  ipcMain.handle("users:create", wrap("users.manage", (db, session, payload) => userService.create(db, session, payload)));
  ipcMain.handle("users:update", wrap("users.manage", (db, session, id, payload) => userService.update(db, session, id, payload)));
  ipcMain.handle("users:setStatus", wrap("users.manage", (db, session, id, status) => userService.setStatus(db, session, id, status)));

  // ---- Roles & permissions ----
  ipcMain.handle("roles:list", wrap("roles.manage", (db) => roleService.listRoles(db)));
  ipcMain.handle("permissions:list", wrap("roles.manage", (db) => roleService.listPermissions(db)));
  ipcMain.handle("roles:getPermissions", wrap("roles.manage", (db, _s, roleId) => roleService.getRolePermissions(db, roleId)));
  ipcMain.handle("roles:create", wrap("roles.manage", (db, session, payload) => roleService.createRole(db, session, payload)));
  ipcMain.handle("roles:updatePermissions", wrap("roles.manage", (db, session, roleId, permissionIds) => roleService.updateRolePermissions(db, session, roleId, permissionIds)));
  ipcMain.handle("roles:delete", wrap("roles.manage", (db, session, roleId) => roleService.deleteRole(db, session, roleId)));
  // Roles list is also needed (read-only) by the Users page and Setup — expose a lighter public-ish variant gated by users.manage there.

  // ---- Settings ----
  ipcMain.handle("settings:getSchool", wrap(null, (db) => settingsService.getSchool(db)));
  ipcMain.handle("settings:updateSchool", wrap("settings.manage", (db, session, payload) => settingsService.updateSchool(db, session, payload)));
  ipcMain.handle("settings:getMisc", wrap(null, (db) => settingsService.getMisc(db)));
  ipcMain.handle("settings:setMisc", wrap("settings.manage", (db, session, obj) => settingsService.setMisc(db, session, obj)));
  ipcMain.handle("settings:getGradingScale", wrap(null, (db) => settingsService.getGradingScale(db)));
  ipcMain.handle("settings:saveGradingScale", wrap("settings.manage", (db, session, rows) => settingsService.saveGradingScale(db, session, rows)));

  // ---- Academic structure ----
  ipcMain.handle("academic:listSessions", wrap(null, (db) => academicService.listSessions(db)));
  ipcMain.handle("academic:createSession", wrap("academic.manage", (db, session, payload) => academicService.createSession(db, session, payload)));
  ipcMain.handle("academic:setCurrentSession", wrap("academic.manage", (db, session, id) => academicService.setCurrentSession(db, session, id)));
  ipcMain.handle("academic:listClasses", wrap(null, (db) => academicService.listClasses(db)));
  ipcMain.handle("academic:createClass", wrap("academic.manage", (db, session, payload) => academicService.createClass(db, session, payload)));
  ipcMain.handle("academic:updateClass", wrap("academic.manage", (db, session, id, payload) => academicService.updateClass(db, session, id, payload)));
  ipcMain.handle("academic:listSections", wrap(null, (db, _s, classId) => academicService.listSections(db, classId)));
  ipcMain.handle("academic:createSection", wrap("academic.manage", (db, session, payload) => academicService.createSection(db, session, payload)));
  ipcMain.handle("academic:updateSection", wrap("academic.manage", (db, session, id, payload) => academicService.updateSection(db, session, id, payload)));
  ipcMain.handle("academic:listSubjects", wrap(null, (db) => academicService.listSubjects(db)));
  ipcMain.handle("academic:createSubject", wrap("academic.manage", (db, session, payload) => academicService.createSubject(db, session, payload)));
  ipcMain.handle("academic:updateSubject", wrap("academic.manage", (db, session, id, payload) => academicService.updateSubject(db, session, id, payload)));
  ipcMain.handle("academic:listClassSubjects", wrap(null, (db, _s, classId) => academicService.listClassSubjects(db, classId)));
  ipcMain.handle("academic:assignSubject", wrap("academic.manage", (db, session, payload) => academicService.assignSubjectToClass(db, session, payload)));
  ipcMain.handle("academic:removeClassSubject", wrap("academic.manage", (db, session, id) => academicService.removeClassSubject(db, session, id)));

  // ---- Demo data (explicit, labeled action) ----
  ipcMain.handle("system:loadDemoData", wrap("settings.manage", (db) => loadDemoData(db)));
}

module.exports = { register };
