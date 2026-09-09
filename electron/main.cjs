"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { initDatabase, getDb, getDataDir, getDbPath } = require("./db/connection.cjs");
const { registerAllIpc } = require("./ipc/index.cjs");

let win = null;
// In-memory session for the single signed-in user of this desktop app.
// Set by auth:login, cleared by auth:logout. Never persisted to disk.
let session = null;

const ctx = {
  getDb: () => getDb(),
  getSession: () => session,
  setSession: (s) => { session = s; },
  getWin: () => win,
  getDataDir: () => getDataDir(),
  getDbPath: () => getDbPath(),
};

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      // Electron security hardening (spec section 58):
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Prevent the renderer from navigating to, or opening, arbitrary external
  // URLs inside the app window — external links open in the OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !url.startsWith("http://127.0.0.1:5173")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";
  if (!app.isPackaged) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  initDatabase(app.getPath("userData"));
  registerAllIpc(ipcMain, ctx);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
