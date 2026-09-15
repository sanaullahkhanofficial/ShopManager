// Phase N integration test: the invoice/printer settings backing the
// receipt's template/size/logo/barcode/terms wiring — driven through the
// real IPC handlers. The rendering logic itself (which of these actually
// changes the printed output) is verified visually via Playwright, since
// it's React/CSS behavior a headless IPC test can't observe.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseN-"));
const handlers = {};
const fakeElectron = {
  app: { getPath: () => tmpDir, getVersion: () => "test", whenReady: () => ({ then: (cb) => { cb(); return Promise.resolve(); } }), on: () => {} },
  BrowserWindow: class { loadFile() {} on() {} },
  ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } },
  dialog: {},
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
  const settings = call("settings:get");
  assert(settings.invoice_size === "58mm Thermal", `invoice_size defaults to the business's real hardware, 58mm Thermal (got "${settings.invoice_size}")`);
  assert(typeof settings.invoice_terms === "string" && settings.invoice_terms.length > 0, "invoice_terms seeds with real default text, not empty");
  assert(settings.invoice_template === "Standard", "invoice_template defaults to Standard");
  assert(settings.show_barcode_on_invoice === "1", "show_barcode_on_invoice defaults on");

  const owner = call("users:list")[0];

  // --- Every invoice/printer field persists through the real settings:update path ---
  call("settings:update", {
    invoice_template: "Compact (Thermal)", invoice_size: "A4",
    show_logo_on_invoice: "0", show_barcode_on_invoice: "0",
    show_terms_on_invoice: "1", invoice_terms: "Custom terms for this test.",
    show_thankyou_on_invoice: "0", actorId: owner.id,
  });
  const updated = call("settings:get");
  assert(updated.invoice_template === "Compact (Thermal)", "invoice_template persists a real change");
  assert(updated.invoice_size === "A4", "invoice_size persists a real change");
  assert(updated.show_logo_on_invoice === "0" && updated.show_barcode_on_invoice === "0", "the logo/barcode toggles persist off");
  assert(updated.show_terms_on_invoice === "1" && updated.invoice_terms === "Custom terms for this test.", "the terms toggle and custom terms text persist together");
  assert(updated.show_thankyou_on_invoice === "0", "the thank-you toggle persists off");

  // --- A Cashier (no settings.manage) cannot change printer/invoice settings either ---
  call("users:add", { username: "cashier_n", display_name: "Cashier N", role: "Cashier", password: "test1234", actorId: owner.id });
  const cashier = call("users:list").find((u) => u.username === "cashier_n");
  let denied = false;
  try { call("settings:update", { invoice_template: "Modern", actorId: cashier.id }); } catch { denied = true; }
  assert(denied, "a Cashier is still denied from changing invoice/printer settings (Phase M enforcement covers this real handler too)");
  assert(call("settings:get").invoice_template === "Compact (Thermal)", "the denied attempt left invoice_template unchanged");

  console.log(failed ? "\nSOME PHASE N TESTS FAILED" : "\nALL PHASE N TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
