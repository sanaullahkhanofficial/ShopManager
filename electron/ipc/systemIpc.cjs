"use strict";

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
// `electron` is a devDependency only needed by the desktop app (main.cjs).
// This module is also loaded by server.cjs's plain-Node web target, where
// `electron` is never installed (a production `npm install --omit=dev`
// wouldn't have it) — so the require must not blow up module loading there.
// The handlers that actually use these APIs (backup/print/files dialogs)
// are never dispatched over HTTP (see server.cjs's EXCLUDED_CHANNELS), but
// they still guard themselves below in case this file is ever wired up
// somewhere that skips that exclusion.
let BrowserWindow, dialog, app, shell;
try {
  ({ BrowserWindow, dialog, app, shell } = require("electron"));
} catch {
  // Running outside Electron (e.g. server.cjs) — desktop-only handlers guard below.
}
const { makeWrap } = require("./wrap.cjs");
const { AppError } = require("../lib/security.cjs");
const { version: packageVersion } = require("../../package.json");

function requireElectron(fnName) {
  if (!dialog || !app) {
    throw new AppError(`${fnName} is only available in the EduManage desktop app.`);
  }
}
const dashboardService = require("../services/dashboardService.cjs");
const reportService = require("../services/reportService.cjs");
const searchService = require("../services/searchService.cjs");
const notificationService = require("../services/notificationService.cjs");
const auditService = require("../services/auditService.cjs");
const backupService = require("../services/backupService.cjs");

function register(ipcMain, ctx) {
  const wrap = makeWrap(ctx);

  // ---- Dashboard ----
  ipcMain.handle("dashboard:kpis", wrap("dashboard.view", (db) => dashboardService.getKpis(db)));
  ipcMain.handle("dashboard:enrollmentTrend", wrap("dashboard.view", (db, _s, months) => dashboardService.enrollmentTrend(db, months)));
  ipcMain.handle("dashboard:collectionTrend", wrap("dashboard.view", (db, _s, months) => dashboardService.collectionTrend(db, months)));
  ipcMain.handle("dashboard:attendanceTrend", wrap("dashboard.view", (db, _s, days) => dashboardService.attendanceTrend(db, days)));
  ipcMain.handle("dashboard:incomeVsExpense", wrap("dashboard.view", (db, _s, months) => dashboardService.incomeVsExpense(db, months)));
  ipcMain.handle("dashboard:classDistribution", wrap("dashboard.view", (db) => dashboardService.classDistribution(db)));
  ipcMain.handle("dashboard:feeCollectionStatus", wrap("dashboard.view", (db) => dashboardService.feeCollectionStatus(db)));
  ipcMain.handle("dashboard:recentActivity", wrap("dashboard.view", (db, _s, limit) => dashboardService.recentActivity(db, limit)));

  // ---- Reports ----
  ipcMain.handle("reports:studentList", wrap("reports.view", (db, _s, params) => reportService.studentList(db, params)));
  ipcMain.handle("reports:genderDistribution", wrap("reports.view", (db) => reportService.genderDistribution(db)));
  ipcMain.handle("reports:newAdmissions", wrap("reports.view", (db, _s, params) => reportService.newAdmissions(db, params)));
  ipcMain.handle("reports:leavingStudents", wrap("reports.view", (db, _s, params) => reportService.leavingStudents(db, params)));
  ipcMain.handle("reports:dailyAttendance", wrap("reports.view", (db, _s, date) => reportService.dailyAttendance(db, date)));
  ipcMain.handle("reports:dailyCollection", wrap("reports.view", (db, _s, date) => reportService.dailyCollection(db, date)));
  ipcMain.handle("reports:incomeStatement", wrap("reports.view", (db, _s, params) => reportService.incomeStatement(db, params)));
  ipcMain.handle("reports:gradeDistribution", wrap("reports.view", (db, _s, examId) => reportService.gradeDistribution(db, examId)));

  // ---- Global search ----
  ipcMain.handle("search:global", wrap(null, (db, _s, q) => searchService.globalSearch(db, q)));

  // ---- Notifications ----
  ipcMain.handle("notifications:list", wrap(null, (db) => notificationService.getNotifications(db)));

  // ---- Audit log ----
  ipcMain.handle("audit:list", wrap("audit.view", (db, _s, params) => auditService.list(db, params)));

  // ---- Backup & restore ----
  ipcMain.handle("backup:create", wrap("backup.create", async (db, session) => {
    requireElectron("Creating a backup via a save dialog");
    const win = ctx.getWin();
    const defaultName = `edumanage-backup-${new Date().toISOString().slice(0, 10)}.db`;
    const result = await dialog.showSaveDialog(win, {
      title: "Save Database Backup",
      defaultPath: path.join(ctx.getDataDir(), "backups", defaultName),
      filters: [{ name: "EduManage Backup", extensions: ["db"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const backup = backupService.createBackup(db, session, ctx.getDbPath(), result.filePath);
    return { canceled: false, backup };
  }));
  ipcMain.handle("backup:history", wrap("backup.create", (db) => backupService.history(db)));
  ipcMain.handle("backup:lastBackup", wrap(null, (db) => backupService.lastBackup(db)));
  ipcMain.handle("backup:integrityCheck", wrap("backup.create", (db) => backupService.integrityCheck(db)));
  ipcMain.handle("backup:restore", wrap("backup.restore", async (db, session) => {
    requireElectron("Restoring a backup via a file dialog");
    const win = ctx.getWin();
    const result = await dialog.showOpenDialog(win, {
      title: "Select Backup File to Restore",
      properties: ["openFile"],
      filters: [{ name: "EduManage Backup", extensions: ["db"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const sourcePath = result.filePaths[0];
    backupService.validateBackupFile(sourcePath);
    // Safety-net backup of the current database before overwriting it.
    const safetyPath = path.join(ctx.getDataDir(), "backups", `pre-restore-${Date.now()}.db`);
    backupService.createBackup(db, session, ctx.getDbPath(), safetyPath);
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    fs.copyFileSync(sourcePath, ctx.getDbPath());
    setTimeout(() => { app.relaunch(); app.exit(0); }, 300);
    return { canceled: false, restarting: true };
  }));

  // ---- File uploads (photos/documents) ----
  ipcMain.handle("files:pickAndStore", wrap(null, async (_db, _session, { kind = "image" } = {}) => {
    requireElectron("Picking a file via a native dialog");
    const win = ctx.getWin();
    const filters = kind === "image"
      ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
      : [{ name: "Documents", extensions: ["pdf", "png", "jpg", "jpeg", "doc", "docx"] }];
    const result = await dialog.showOpenDialog(win, { properties: ["openFile"], filters });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const source = result.filePaths[0];
    const ext = path.extname(source);
    const destName = `${crypto.randomBytes(8).toString("hex")}${ext}`;
    const destPath = path.join(ctx.getDataDir(), "uploads", destName);
    fs.copyFileSync(source, destPath);
    return { canceled: false, path: destPath, fileName: path.basename(source) };
  }));
  ipcMain.handle("files:openExternal", wrap(null, async (_db, _s, filePath) => {
    if (!shell) throw new AppError("Opening local files is only available in the EduManage desktop app.");
    if (!filePath || !fs.existsSync(filePath)) throw new AppError("File not found.");
    await shell.openPath(filePath);
    return { success: true };
  }));

  // ---- System info ----
  ipcMain.handle("app:info", wrap(null, (db) => {
    const dbPath = ctx.getDbPath();
    const stat = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
    return {
      version: app ? app.getVersion() : packageVersion,
      dataPath: ctx.getDataDir(),
      dbPath,
      dbSizeBytes: stat ? stat.size : 0,
      lastBackup: backupService.lastBackup(db),
      integrity: backupService.integrityCheck(db),
    };
  }));

  // ---- Print to PDF (Electron's built-in renderer -> PDF) ----
  ipcMain.handle("print:exportPdf", wrap(null, async (_db, _s, { html, suggestedName = "document.pdf" } = {}) => {
    requireElectron("Exporting a PDF via Electron's renderer");
    if (!html) throw new AppError("Nothing to export.");
    const win = ctx.getWin();
    const saveResult = await dialog.showSaveDialog(win, {
      title: "Export PDF",
      defaultPath: suggestedName,
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false },
    });
    try {
      await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true, pageSize: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      fs.writeFileSync(saveResult.filePath, pdfBuffer);
    } finally {
      printWin.destroy();
    }
    return { canceled: false, path: saveResult.filePath };
  }));

  ipcMain.handle("print:openWindow", wrap(null, async (_db, _s, { html } = {}) => {
    requireElectron("Opening a print window via Electron");
    if (!html) throw new AppError("Nothing to print.");
    const printWin = new BrowserWindow({
      width: 800, height: 900,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    printWin.webContents.print({ printBackground: true });
    return { success: true };
  }));
}

module.exports = { register };
