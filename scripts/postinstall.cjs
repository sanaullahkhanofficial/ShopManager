"use strict";

// This repo ships two deployable targets from one codebase: the Electron
// desktop app and a plain Node/Express web server (server.cjs). Only the
// desktop target needs better-sqlite3 rebuilt against Electron's Node ABI
// (via electron-builder, a devDependency). A production/web install
// (`npm install --omit=dev`, which is what most hosting platforms run)
// won't have electron-builder available at all — so this step must no-op
// cleanly there instead of failing the whole deploy.
try {
  require.resolve("electron-builder");
} catch {
  console.log("[postinstall] electron-builder not installed (web/server-only install) — skipping native rebuild for Electron.");
  process.exit(0);
}

const { execSync } = require("node:child_process");
try {
  execSync("electron-builder install-app-deps", { stdio: "inherit" });
} catch (err) {
  console.warn("[postinstall] electron-builder install-app-deps failed — this only matters if you plan to run/build the Electron desktop app.");
  console.warn(String(err && err.message ? err.message : err));
}
