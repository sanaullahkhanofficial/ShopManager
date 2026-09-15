// Phase F integration test: Held Bills / Quotations backend that powers the
// new POS v2 Hold/Resume/Quotation UI — driven through the real IPC handlers.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseF-"));
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
  let product = call("products:list")[0];
  call("products:adjust", { product_id: product.id, quantity: 500, unit_cost: product.purchase_price, reason: "Opening", actorId: 1 });
  product = call("products:list").find((p) => p.id === product.id);
  const stockBefore = product.stock;
  call("customers:save", { shop_name: "Bilal Store", name: "Bilal", customer_type: "Retail", actorId: 1 });
  const customer = call("customers:list")[0];

  // --- Creating a held bill requires a non-empty cart -----------------------
  let threw = false;
  try { call("heldSales:create", { type: "HOLD", items: [], actorId: 1 }); } catch { threw = true; }
  assert(threw, "heldSales:create rejects an empty cart");

  // --- Hold a bill: numbered, listed, does NOT touch stock or ledgers -------
  const cartLines = [{ product_id: product.id, name: product.name, name_urdu: product.name_urdu, unit: product.package_unit, quantity: 5, rate: product.retail_price }];
  const held = call("heldSales:create", { type: "HOLD", customer_id: customer.id, mode: "Retail", discount: 10, items: cartLines, actorId: 1 });
  assert(/^HOLD-\d{8}-0001$/.test(held.hold_no), `held bill numbered correctly (${held.hold_no})`);

  const productAfterHold = call("products:list").find((p) => p.id === product.id);
  assert(productAfterHold.stock === stockBefore, "holding a bill does not change stock");
  const custAfterHold = call("customers:list").find((c) => c.id === customer.id);
  assert(custAfterHold.balance === 0, "holding a bill does not touch the customer ledger");

  const heldList = call("heldSales:list", "HOLD");
  assert(heldList.length === 1 && heldList[0].hold_no === held.hold_no, "heldSales:list returns the held bill");
  assert(heldList[0].customer_name === "Bilal Store", "heldSales:list joins the customer name");

  const quoteList = call("heldSales:list", "QUOTATION");
  assert(quoteList.length === 0, "heldSales:list filters by type — no quotations yet");

  // --- heldSales:get returns parsed items for Resume -------------------------
  const heldRow = call("heldSales:list", "HOLD")[0];
  const full = call("heldSales:get", heldRow.id);
  assert(Array.isArray(full.items) && full.items.length === 1 && full.items[0].product_id === product.id, "heldSales:get parses items_json back into an array");
  assert(full.discount === 10, "heldSales:get preserves discount");

  // --- Resume flow: delete the held row, then complete a real sale from it --
  call("heldSales:delete", heldRow.id);
  assert(call("heldSales:list", "HOLD").length === 0, "heldSales:delete removes the held bill");

  const sale = call("sales:create", {
    customer_id: customer.id, mode: full.mode, discount: full.discount,
    payment_method: "Cash", paid: full.items[0].quantity * full.items[0].rate - full.discount,
    items: full.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, rate: i.rate })),
    actorId: 1,
  });
  assert(sale.total === full.items[0].quantity * full.items[0].rate - full.discount, "resumed held bill completes as a real sale with correct total");
  const productAfterResume = call("products:list").find((p) => p.id === product.id);
  assert(productAfterResume.stock === stockBefore - 5, "completing the resumed sale now really decrements stock");

  // --- Quotation type is numbered independently and never becomes a sale ----
  const quote = call("heldSales:create", { type: "QUOTATION", items: cartLines, actorId: 1 });
  assert(/^QT-\d{8}-0001$/.test(quote.hold_no), `quotation numbered with its own QT prefix (${quote.hold_no})`);
  assert(call("heldSales:list", "QUOTATION").length === 1, "quotation appears under the QUOTATION type filter");
  assert(call("heldSales:list", "HOLD").length === 0, "quotation does not appear under the HOLD type filter");

  console.log(failed ? "\nSOME PHASE F TESTS FAILED" : "\nALL PHASE F TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
