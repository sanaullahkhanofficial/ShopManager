// Phase B integration test: configurable invoice prefixes, negative-stock
// policy toggle, notification-type toggles, and automatic backup — all
// driven through the real IPC handlers in electron/main.cjs.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseB-"));
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
  const product = call("products:list")[0];

  // --- Configurable invoice prefixes ------------------------------------
  call("settings:update", { invoice_prefix: "SLS", invoice_prefix_purchase: "BUY" });
  call("products:adjust", { product_id: product.id, quantity: 100, unit_cost: product.purchase_price, reason: "Opening", actorId: 1 });
  const sale = call("sales:create", { items: [{ product_id: product.id, quantity: 1, rate: 500 }], paid: 500, payment_method: "Cash", actorId: 1 });
  assert(sale.invoice_no.startsWith("SLS-"), `sale invoice number honors the configured Sales prefix (${sale.invoice_no})`);

  call("suppliers:save", { name: "Test Supplier" });
  const supplier = call("suppliers:list")[0];
  const purchase = call("purchases:create", { supplier_id: supplier.id, items: [{ product_id: product.id, quantity: 5, rate: 400 }], paid: 2000, payment_method: "Cash", actorId: 1 });
  assert(purchase.invoice_no.startsWith("BUY-"), `purchase invoice number honors the configured Purchase prefix (${purchase.invoice_no})`);

  // --- Negative stock policy --------------------------------------------
  try {
    call("products:adjust", { product_id: product.id, quantity: -999999, reason: "test", actorId: 1 });
    console.error("FAIL: negative stock should be denied by default"); failed = true;
  } catch (e) { console.log("PASS: negative stock denied while allow_negative_stock=0 —", e.message); }

  call("settings:update", { allow_negative_stock: "1" });
  call("products:adjust", { product_id: product.id, quantity: -999999, reason: "test", actorId: 1 });
  const afterNegative = call("products:list").find((p) => p.id === product.id).stock;
  assert(afterNegative < 0, `stock can go negative once allow_negative_stock=1 (stock=${afterNegative})`);
  call("settings:update", { allow_negative_stock: "0" });

  // --- Notification toggles -----------------------------------------------
  call("settings:update", { notify_low_stock: "0" });
  call("products:save", { name: "Toggle Test Item", category_id: product.category_id, min_stock: 999999, package_unit: "KG", stock: 1, purchase_price: 10, retail_price: 20, wholesale_price: 18, actorId: 1 });
  const notifsDisabled = call("notifications:refresh");
  assert(!notifsDisabled.some((n) => n.title.includes("Toggle Test Item")), "no LOW_STOCK notification is generated while notify_low_stock=0");
  call("settings:update", { notify_low_stock: "1" });
  const notifsEnabled = call("notifications:refresh");
  assert(notifsEnabled.some((n) => n.title.includes("Toggle Test Item")), "LOW_STOCK notification generates again once notify_low_stock=1");

  // --- Payment methods & locations CRUD (Phase 0 backend, Phase B UI) ------
  call("paymentMethods:save", { name: "Wallet" });
  assert(call("paymentMethods:list").some((m) => m.name === "Wallet"), "a new payment method persists");
  call("locations:save", { name: "Cold Storage", type: "Cold Storage" });
  assert(call("locations:list").some((l) => l.name === "Cold Storage"), "a new location persists");

  // --- Automatic backup -----------------------------------------------------
  const statusBefore = call("backup:autoStatus");
  assert(statusBefore.enabled === true, "auto backup is enabled by default");
  assert(!!statusBefore.lastBackupAt, "an automatic backup already ran once at startup (last_backup_at set)");
  assert(statusBefore.autoBackupCount >= 1, "at least one automatic backup file exists on disk");

  console.log(failed ? "\nSOME PHASE B TESTS FAILED" : "\nALL PHASE B TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
