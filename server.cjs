"use strict";

// Web/server deployment target for EduManage.
//
// This process serves the exact same business logic used by the Electron
// desktop app (electron/db, electron/lib, electron/services, electron/ipc)
// over plain HTTP instead of Electron's IPC — so the app can be deployed to
// any Node host and used from a normal browser, with no desktop install.
//
// Every electron/ipc/*.cjs module registers channels via `ipcMain.handle`;
// here we hand it a stand-in "ipcMain" that just records the handlers, then
// dispatch to them from a single POST /api/invoke route. The one thing that
// genuinely differs between desktop and web is *whose* session a request
// belongs to: Electron has exactly one signed-in user per running app, so
// main.cjs keeps `session` in a plain variable. A web server can have many
// concurrent browsers, so per-request session state is threaded through
// AsyncLocalStorage and backed by a signed, httpOnly cookie (express-session).
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");

const express = require("express");
const session = require("express-session");
const multer = require("multer");

const { initDatabase, getDb, getDataDir, getDbPath } = require("./electron/db/connection.cjs");
const { registerAllIpc } = require("./electron/ipc/index.cjs");
const backupService = require("./electron/services/backupService.cjs");
const { requirePermission } = require("./electron/lib/authz.cjs");
const { AppError, friendlyDbError, nowIso } = require("./electron/lib/security.cjs");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const isProd = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
  console.warn(
    "[server] SESSION_SECRET is not set — using a random secret generated at startup. " +
      "Everyone will be signed out on restart. Set SESSION_SECRET in your hosting provider's " +
      "environment variables for stable sessions across deploys/restarts."
  );
}

fs.mkdirSync(DATA_DIR, { recursive: true });
initDatabase(DATA_DIR);

const als = new AsyncLocalStorage();

/** ctx handed to every electron/ipc/*.cjs registration — identical shape to main.cjs's ctx. */
const ctx = {
  getDb: () => getDb(),
  getSession: () => als.getStore()?.session ?? null,
  setSession: (s) => {
    const store = als.getStore();
    if (store) store.session = s;
  },
  getWin: () => null, // no native dialogs on the web target; systemIpc's dialog-based handlers aren't reachable via /api/invoke (see EXCLUDED_CHANNELS below)
  getDataDir: () => DATA_DIR,
  getDbPath: () => getDbPath(),
};

// backup:create / backup:restore / print:* / files:* use Electron's native
// dialog/BrowserWindow APIs and have dedicated web-native replacements below
// (or in src/lib/api.ts's browser fallbacks) — never dispatch them here.
const EXCLUDED_CHANNELS = new Set([
  "backup:create", "backup:restore", "print:exportPdf", "print:openWindow",
  "files:pickAndStore", "files:openExternal",
]);

const handlers = {};
registerAllIpc({ handle: (channel, fn) => { handlers[channel] = fn; } }, ctx);

const app = express();
app.set("trust proxy", 1); // most hosts (Render/Railway/Fly) terminate TLS at a proxy in front of Node
app.use(express.json({ limit: "5mb" }));
app.use(
  session({
    secret: SESSION_SECRET,
    name: "edumanage.sid",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: isProd, sameSite: "lax", maxAge: 1000 * 60 * 60 * 12 },
  })
);

// ---------- Generic IPC-over-HTTP dispatch ----------
app.post("/api/invoke", async (req, res) => {
  const { channel, args } = req.body || {};
  if (typeof channel !== "string" || EXCLUDED_CHANNELS.has(channel) || !handlers[channel]) {
    return res.status(404).json({ success: false, error: "Unknown request." });
  }
  const store = { session: req.session.authedUser || null };
  try {
    const result = await als.run(store, () => handlers[channel](null, ...(Array.isArray(args) ? args : [])));
    // Persist any session mutation the handler made (auth:login / auth:logout) back to the cookie session.
    req.session.authedUser = store.session;
    res.json(result);
  } catch (err) {
    console.error(`[api:invoke] ${channel}`, err);
    res.status(200).json({ success: false, error: err && err.isAppError ? err.message : friendlyDbError(err) });
  }
});

// ---------- Backup export/import (web-native replacements for the desktop dialogs) ----------
app.get("/api/backup/export", async (req, res) => {
  try {
    const db = getDb();
    const authedUser = req.session.authedUser;
    requirePermission(db, authedUser, "backup.create");
    const tmpName = `web-export-${Date.now()}.db`;
    const tmpPath = path.join(DATA_DIR, "backups", tmpName);
    backupService.createBackup(db, authedUser, getDbPath(), tmpPath);
    res.setHeader("X-Backup-Filename", `edumanage-backup-${nowIso().slice(0, 10)}.db`);
    res.download(tmpPath, `edumanage-backup-${nowIso().slice(0, 10)}.db`);
  } catch (err) {
    res.status(err.isAppError ? 400 : 500).json({ success: false, error: err.isAppError ? err.message : friendlyDbError(err) });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
app.post("/api/backup/import", upload.single("backup"), async (req, res) => {
  try {
    const db = getDb();
    const authedUser = req.session.authedUser;
    requirePermission(db, authedUser, "backup.restore");
    if (!req.file) throw new AppError("No backup file was uploaded.");

    const uploadedPath = path.join(DATA_DIR, "backups", `uploaded-${Date.now()}.db`);
    fs.writeFileSync(uploadedPath, req.file.buffer);
    backupService.validateBackupFile(uploadedPath);

    // Safety-net backup of the current database before overwriting it.
    const safetyPath = path.join(DATA_DIR, "backups", `pre-restore-${Date.now()}.db`);
    backupService.createBackup(db, authedUser, getDbPath(), safetyPath);

    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    fs.copyFileSync(uploadedPath, getDbPath());
    initDatabase(DATA_DIR); // reopen a fresh connection against the restored file

    req.session.destroy(() => {}); // restored DB may not contain this session's user — force re-login
    res.json({ success: true, requiresRelogin: true });
  } catch (err) {
    res.status(err.isAppError ? 400 : 500).json({ success: false, error: err.isAppError ? err.message : friendlyDbError(err) });
  }
});

// ---------- Static frontend (built via `npm run build:web`) ----------
const distDir = path.join(__dirname, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // The app uses a HashRouter (all client-side routes live after '#'), so
  // every real HTTP path the browser requests is just '/'.
  app.get("/", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res.status(503).send("EduManage frontend is not built yet. Run `npm run build:web` before starting the server.")
  );
}

app.listen(PORT, () => {
  console.log(`EduManage web server listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
