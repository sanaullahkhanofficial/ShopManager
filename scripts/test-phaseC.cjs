// Phase C integration test: stock movement history, barcode auto-generation,
// and bulk price updates — driven through the real IPC handlers.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseC-"));
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
  const products = call("products:list");
  const p1 = products[0], p2 = products[1];

  // --- Stock movement history ------------------------------------------------
  call("products:adjust", { product_id: p1.id, quantity: 50, reason: "Opening", actorId: 1 });
  call("products:adjust", { product_id: p1.id, quantity: -5, reason: "Damage", actorId: 1 });
  const movements = call("stockMovements:list", { productId: p1.id, limit: 10 });
  assert(movements.length === 2, `stockMovements:list returns both adjustments for the product (got ${movements.length})`);
  assert(movements[0].reason === "Damage", "most recent movement listed first");
  assert(movements[0].product_name === p1.name, "movement joins in the product name");

  const filtered = call("stockMovements:list", { types: ["STOCK_ADJUSTMENT_OUT"], limit: 10 });
  assert(filtered.every((m) => m.type === "STOCK_ADJUSTMENT_OUT"), "type filter only returns matching movement types");

  // --- Barcode auto-generation -------------------------------------------------
  assert(!p1.barcode, "seeded product starts with no barcode");
  const generated = call("products:ensureBarcodes", { actorId: 1 });
  assert(generated > 0, `products:ensureBarcodes generated barcodes for missing ones (${generated})`);
  const afterGen = call("products:list").find((p) => p.id === p1.id);
  assert(!!afterGen.barcode, "product now has a barcode value");
  const secondRun = call("products:ensureBarcodes", { actorId: 1 });
  assert(secondRun === 0, "running it again generates nothing (idempotent)");

  // --- Bulk price update -----------------------------------------------------
  call("products:bulkUpdatePrices", {
    actorId: 1,
    updates: [
      { id: p1.id, retail_price: 9999, wholesale_price: 8888 },
      { id: p2.id, retail_price: 7777, wholesale_price: 6666 },
    ],
  });
  const afterBulk = call("products:list");
  const bp1 = afterBulk.find((p) => p.id === p1.id), bp2 = afterBulk.find((p) => p.id === p2.id);
  assert(bp1.retail_price === 9999 && bp1.wholesale_price === 8888, "bulk price update applied to product 1");
  assert(bp2.retail_price === 7777 && bp2.wholesale_price === 6666, "bulk price update applied to product 2");

  // --- Soft deactivate via products:save --------------------------------------
  call("products:save", { id: p2.id, status: "inactive", actorId: 1 });
  assert(!call("products:list").some((p) => p.id === p2.id), "deactivated product no longer appears in the active list");

  console.log(failed ? "\nSOME PHASE C TESTS FAILED" : "\nALL PHASE C TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
