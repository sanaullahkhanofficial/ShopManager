"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Every channel the renderer is allowed to call. Keeping an explicit
// allow-list (rather than a raw passthrough) means the renderer can never
// invoke an arbitrary IPC channel even though nodeIntegration is disabled
// and contextIsolation is enabled.
const ALLOWED_CHANNELS = [
  "setup:status", "setup:complete",
  "auth:login", "auth:logout", "auth:currentUser", "auth:changePassword", "auth:resetPassword",
  "users:list", "users:create", "users:update", "users:setStatus",
  "roles:list", "permissions:list", "roles:getPermissions", "roles:create", "roles:updatePermissions", "roles:delete",
  "settings:getSchool", "settings:updateSchool", "settings:getMisc", "settings:setMisc",
  "settings:getGradingScale", "settings:saveGradingScale",
  "academic:listSessions", "academic:createSession", "academic:setCurrentSession",
  "academic:listClasses", "academic:createClass", "academic:updateClass",
  "academic:listSections", "academic:createSection", "academic:updateSection",
  "academic:listSubjects", "academic:createSubject", "academic:updateSubject",
  "academic:listClassSubjects", "academic:assignSubject", "academic:removeClassSubject",
  "system:loadDemoData",
  "students:search", "students:getById", "students:create", "students:update", "students:setStatus",
  "students:linkParent", "students:unlinkParent", "students:importBulk",
  "parents:search", "parents:getById", "parents:create", "parents:update", "parents:setStatus",
  "admissions:list", "admissions:getById", "admissions:create", "admissions:moveStage", "admissions:enroll",
  "teachers:search", "teachers:getById", "teachers:create", "teachers:update", "teachers:assignClass", "teachers:removeAssignment",
  "staff:search", "staff:getById", "staff:create", "staff:update",
  "attendance:getClass", "attendance:saveClass", "attendance:studentSummary", "attendance:classMonthly",
  "attendance:getStaff", "attendance:saveStaff",
  "timetable:getSection", "timetable:getTeacher", "timetable:saveSlot", "timetable:deleteSlot",
  "homework:list", "homework:create", "homework:setStatus", "homework:delete",
  "notices:list", "notices:create", "notices:delete",
  "exams:list", "exams:getById", "exams:create", "exams:updateStatus", "exams:getMarksGrid",
  "exams:saveMarks", "exams:computeResults", "exams:reportCard", "exams:saveRemarks",
  "fees:listCategories", "fees:createCategory", "fees:listStructures", "fees:saveStructure", "fees:deleteStructure",
  "scholarships:listForStudent", "scholarships:listAll", "scholarships:create", "scholarships:setStatus",
  "invoices:listForStudent", "invoices:getById", "invoices:generate", "invoices:bulkGenerate", "invoices:outstanding", "invoices:void",
  "payments:search", "payments:collect", "payments:getReceipt", "payments:listByStudent", "payments:report",
  "ledger:getStudent", "ledger:setOpeningBalance",
  "expenses:listCategories", "expenses:createCategory", "expenses:list", "expenses:create", "expenses:delete",
  "payroll:getMonthRoster", "payroll:saveEntry", "payroll:markPaid", "payroll:getSlip", "payroll:history",
  "dashboard:kpis", "dashboard:enrollmentTrend", "dashboard:collectionTrend", "dashboard:attendanceTrend",
  "dashboard:incomeVsExpense", "dashboard:classDistribution", "dashboard:feeCollectionStatus", "dashboard:recentActivity",
  "reports:studentList", "reports:genderDistribution", "reports:newAdmissions", "reports:leavingStudents",
  "reports:dailyAttendance", "reports:dailyCollection", "reports:incomeStatement", "reports:gradeDistribution",
  "search:global", "notifications:list", "audit:list",
  "backup:create", "backup:history", "backup:lastBackup", "backup:integrityCheck", "backup:restore",
  "files:pickAndStore", "files:openExternal", "app:info", "print:exportPdf", "print:openWindow",
];

const ALLOWED_SET = new Set(ALLOWED_CHANNELS);

contextBridge.exposeInMainWorld("api", {
  invoke: (channel, ...args) => {
    if (!ALLOWED_SET.has(channel)) {
      return Promise.reject(new Error(`Blocked attempt to call unknown IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
