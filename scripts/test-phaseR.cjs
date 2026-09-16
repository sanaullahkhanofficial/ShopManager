// Phase R: real backup encryption (AES-256-GCM, scrypt-derived key) and a
// genuine restore-from-backup path — previously the app could only ever
// make a copy of the database, with no way to bring one back. This script
// drives the real backup:create / backup:restore IPC handlers end to end
// against a real temp SQLite database, including a full encrypt -> modify
// live data -> restore -> confirm the OLDER data came back round trip.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseR-"));
const handlers = {};
let savedDialogPath = null;
const fakeElectron = {
  app: { getPath: () => tmpDir, getVersion: () => "test", whenReady: () => ({ then: (cb) => { cb(); return Promise.resolve(); } }), on: () => {} },
  BrowserWindow: class { loadFile() {} on() {} },
  ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } },
  dialog: {
    showSaveDialog: async () => ({ canceled: false, filePath: savedDialogPath }),
  },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") return fakeElectron;
  return originalLoad.apply(this, arguments);
};
require(path.join(__dirname, "../electron/main.cjs"));
const call = (channel, ...args) => handlers[channel](null, ...args);

let failed = false;
function assert(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); failed = true; }
  else console.log(`PASS: ${label}`);
}

(async () => {
  const owner = call("users:list")[0];

  // --- Seed real, identifiable data: one product at a known price ---
  const catId = call("categories:list")[0].id;
  call("products:save", { category_id: catId, name: "Pre-Backup Product", package_unit: "KG", purchase_price: 100, retail_price: 150, wholesale_price: 130, min_stock: 5, stock: 20, actorId: owner.id });
  assert(call("products:list").some((p) => p.name === "Pre-Backup Product"), "the real product exists before backup");

  // --- Create an ENCRYPTED backup (real AES-256-GCM round trip via the actual IPC handler) ---
  savedDialogPath = path.join(tmpDir, "encrypted-backup.smbak");
  const encPath = await call("backup:create", { passphrase: "correct horse battery staple" });
  assert(encPath === savedDialogPath && fs.existsSync(encPath), "backup:create wrote a real encrypted file to disk");
  const encBytes = fs.readFileSync(encPath);
  assert(encBytes.subarray(0, 7).toString("ascii") === "SMBAKV1", "the encrypted backup carries the real magic header, not a plain SQLite file");
  assert(encBytes.subarray(0, 16).toString("utf8") !== "SQLite format 3\0", "the encrypted backup does not start with the plain SQLite header — it's genuinely encrypted, not just renamed");

  // --- Create a PLAIN (unencrypted) backup too, for the plain-restore path ---
  savedDialogPath = path.join(tmpDir, "plain-backup.db");
  const plainPath = await call("backup:create", {});
  assert(fs.readFileSync(plainPath).subarray(0, 16).toString("utf8") === "SQLite format 3\0", "an unencrypted backup is a real, directly-readable SQLite file");

  // --- Now change live data AFTER the backups were taken ---
  call("products:save", { category_id: catId, name: "Post-Backup Product", package_unit: "KG", purchase_price: 200, retail_price: 250, wholesale_price: 230, min_stock: 5, stock: 5, actorId: owner.id });
  assert(call("products:list").some((p) => p.name === "Post-Backup Product"), "the post-backup product exists in the live database before any restore");

  // --- A Cashier (no settings.manage) cannot restore ---
  call("users:add", { username: "cashier_r", display_name: "Cashier R", role: "Cashier", password: "test1234", actorId: owner.id });
  const cashier = call("users:list").find((u) => u.username === "cashier_r");
  let denied = false;
  try { call("backup:restore", { filePath: plainPath, actorId: cashier.id }); } catch { denied = true; }
  assert(denied, "a Cashier is denied from restoring a backup (settings.manage required)");
  assert(call("products:list").some((p) => p.name === "Post-Backup Product"), "the denied restore attempt left the live database completely untouched");

  // --- Restoring the ENCRYPTED backup with the WRONG passphrase fails cleanly and changes nothing ---
  let wrongPassFailed = false;
  try { call("backup:restore", { filePath: encPath, passphrase: "wrong passphrase entirely", actorId: owner.id }); } catch (e) { wrongPassFailed = /passphrase|corrupted/i.test(e.message); }
  assert(wrongPassFailed, "restoring the encrypted backup with the wrong passphrase throws a clear, real error");
  assert(call("products:list").some((p) => p.name === "Post-Backup Product"), "the wrong-passphrase attempt left the live database untouched");

  // --- Restoring a non-backup file is rejected before touching anything ---
  const junkPath = path.join(tmpDir, "not-a-backup.txt");
  fs.writeFileSync(junkPath, "this is not a database");
  let junkRejected = false;
  try { call("backup:restore", { filePath: junkPath, actorId: owner.id }); } catch { junkRejected = true; }
  assert(junkRejected, "restoring a file that is neither a real SQLite file nor an encrypted backup is rejected");

  // --- The real restore: encrypted backup, correct passphrase, live data reverts to the pre-backup state ---
  const restoreResult = call("backup:restore", { filePath: encPath, passphrase: "correct horse battery staple", actorId: owner.id });
  assert(restoreResult.restored === true, "backup:restore reports success for a valid encrypted backup with the correct passphrase");
  const afterRestore = call("products:list");
  assert(afterRestore.some((p) => p.name === "Pre-Backup Product"), "after restoring, the pre-backup product is back");
  assert(!afterRestore.some((p) => p.name === "Post-Backup Product"), "after restoring, the post-backup product (created after the backup was taken) is genuinely gone");

  // --- A safety-net copy of the pre-restore live data was taken automatically ---
  const preRestoreDir = path.join(tmpDir, "pre-restore-backups");
  assert(fs.existsSync(preRestoreDir) && fs.readdirSync(preRestoreDir).length > 0, "an automatic pre-restore safety backup was created before the restore touched anything");

  // --- The plain (unencrypted) backup can also be restored directly, no passphrase needed ---
  call("products:save", { category_id: catId, name: "Another Post-Backup Product", package_unit: "KG", purchase_price: 50, retail_price: 80, wholesale_price: 70, min_stock: 5, stock: 5, actorId: owner.id });
  call("backup:restore", { filePath: plainPath, actorId: owner.id });
  const afterPlainRestore = call("products:list");
  assert(afterPlainRestore.some((p) => p.name === "Pre-Backup Product") && !afterPlainRestore.some((p) => p.name === "Another Post-Backup Product"),
    "restoring the plain (unencrypted) backup works with no passphrase and correctly reverts live data too");

  console.log(failed ? "\nSOME PHASE R TESTS FAILED" : "\nALL PHASE R TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
