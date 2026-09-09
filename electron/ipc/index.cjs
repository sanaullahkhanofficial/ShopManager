"use strict";

const coreIpc = require("./coreIpc.cjs");
const peopleIpc = require("./peopleIpc.cjs");
const academicOpsIpc = require("./academicOpsIpc.cjs");
const financeIpc = require("./financeIpc.cjs");
const systemIpc = require("./systemIpc.cjs");

/**
 * Registers every ipcMain.handle channel used by the renderer, split by
 * domain module. `ctx` exposes the shared db connection, the in-memory
 * session (current signed-in user) and window/paths needed for dialogs.
 */
function registerAllIpc(ipcMain, ctx) {
  coreIpc.register(ipcMain, ctx);
  peopleIpc.register(ipcMain, ctx);
  academicOpsIpc.register(ipcMain, ctx);
  financeIpc.register(ipcMain, ctx);
  systemIpc.register(ipcMain, ctx);
}

module.exports = { registerAllIpc };
