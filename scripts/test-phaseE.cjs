// Phase E integration test: supplier stats/recent purchases, safe partial
// supplier updates, and the full Purchase Order workflow surfaced by the new
// UI (create -> send -> receive) — driven through the real IPC handlers.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseE-"));
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

  // --- Supplier with full Phase E fields, safe partial updates -----------
  call("suppliers:save", { name: "Al-Rahim Traders", ntn: "1234567-8", payment_term_days: 30, category: "Fertilizer", products_supplied: "Wheat, Maida, Bran", actorId: 1 });
  const supplier = call("suppliers:list")[0];
  call("suppliers:save", { id: supplier.id, payment_term_days: 45, actorId: 1 });
  const afterPartial = call("suppliers:list").find((s) => s.id === supplier.id);
  assert(afterPartial.payment_term_days === 45, "payment term updated via partial payload");
  assert(afterPartial.name === "Al-Rahim Traders" && afterPartial.ntn === "1234567-8", "partial update did not null out name/NTN");

  // --- Purchase Order: create (draft) -> send -> receive (partial then full) --
  const po = call("po:create", { supplier_id: supplier.id, expected_date: "2026-10-01", notes: "Monthly restock", items: [{ product_id: product.id, quantity: 100, rate: product.purchase_price }], actorId: 1 });
  assert(/^PO-\d{8}-0001$/.test(po.po_no), `PO numbered correctly (${po.po_no})`);
  assert(call("po:list").find((p) => p.id === po.id).status === "DRAFT", "new PO starts as DRAFT");

  call("po:updateStatus", { id: po.id, status: "SENT", actorId: 1 });
  assert(call("po:list").find((p) => p.id === po.id).status === "SENT", "PO transitions to SENT");

  let detail = call("po:get", po.id);
  const partial = call("po:receive", { po_id: po.id, items: [{ po_item_id: detail.items[0].id, quantity: 60 }], payment_method: "Credit", paid: 0, actorId: 1 });
  assert(partial.po_status === "PARTIALLY_RECEIVED", "PO marked PARTIALLY_RECEIVED");
  const supplierAfterPartialReceipt = call("suppliers:list").find((s) => s.id === supplier.id);
  assert(supplierAfterPartialReceipt.balance === 60 * product.purchase_price, `credit PO receipt increases supplier payable correctly (got ${supplierAfterPartialReceipt.balance})`);

  detail = call("po:get", po.id);
  const full = call("po:receive", { po_id: po.id, items: [{ po_item_id: detail.items[0].id, quantity: 40 }], payment_method: "Cash", paid: 40 * product.purchase_price, actorId: 1 });
  assert(full.po_status === "RECEIVED", "PO marked RECEIVED after remaining quantity received");

  // --- Supplier stats reflect both purchases from the PO -------------------
  const stats = call("suppliers:stats", supplier.id);
  assert(stats.totalInvoices === 2, `suppliers:stats counts both PO-derived purchases (got ${stats.totalInvoices})`);
  assert(stats.totalPurchases === 100 * product.purchase_price, `suppliers:stats sums the full received value (got ${stats.totalPurchases})`);

  const recent = call("suppliers:recentPurchases", supplier.id);
  assert(recent.length === 2, "suppliers:recentPurchases returns both real purchases");

  // --- Make a payment and confirm the ledger nets correctly -----------------
  call("payments:add", { type: "supplier", entity_id: supplier.id, amount: 20000, payment_method: "Cash", actorId: 1 });
  const balanceAfterPayment = call("suppliers:list").find((s) => s.id === supplier.id).balance;
  const expectedPayable = 60 * product.purchase_price - 20000; // the 40-qty leg was paid in full at receipt time
  assert(balanceAfterPayment === expectedPayable, `outstanding payable nets correctly after payment (expected ${expectedPayable}, got ${balanceAfterPayment})`);

  // --- Aging works for suppliers too ----------------------------------------
  const aging = call("suppliers:aging", supplier.id);
  assert(aging.current + aging.d31_60 + aging.d61_90 + aging.over90 === balanceAfterPayment, "supplier aging buckets sum to the outstanding balance");

  console.log(failed ? "\nSOME PHASE E TESTS FAILED" : "\nALL PHASE E TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
