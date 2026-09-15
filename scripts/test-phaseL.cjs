// Phase L integration test: the Reports suite's five new handlers
// (reports:trend, reports:topProducts, reports:inventory, reports:customers,
// reports:suppliers) — driven through the real IPC handlers against a real
// scenario of sales, purchases and payments.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseL-"));
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

const todayStr = new Date().toISOString().slice(0, 10);
const monthStart = todayStr.slice(0, 8) + "01";

(async () => {
  const products = call("products:list");
  const productA = products[0], productB = products[1], productC = products[2];
  call("products:adjust", { product_id: productA.id, quantity: 500, unit_cost: productA.purchase_price, reason: "Opening", actorId: 1 });
  call("products:adjust", { product_id: productB.id, quantity: 500, unit_cost: productB.purchase_price, reason: "Opening", actorId: 1 });
  call("products:adjust", { product_id: productC.id, quantity: 3, unit_cost: productC.purchase_price, reason: "Opening", actorId: 1 }); // will stay below min_stock (10) -> low stock
  call("customers:save", { shop_name: "Report Test Store", name: "Nadia", customer_type: "Retail", actorId: 1 });
  const customer = call("customers:list")[0];
  call("suppliers:save", { name: "Report Test Supplier", category: "Grains", actorId: 1 });
  const supplier = call("suppliers:list")[0];

  // --- reports:trend ----------------------------------------------------
  call("sales:create", { customer_id: customer.id, mode: "Retail", discount: 0, payment_method: "Cash", paid: 10 * productA.retail_price, items: [{ product_id: productA.id, quantity: 10, rate: productA.retail_price }], actorId: 1 });
  const trend = call("reports:trend", { from: monthStart, to: todayStr });
  assert(trend.granularity === "day", "reports:trend uses day granularity for a within-month range");
  const todayPoint = trend.points.find((p) => p.label === todayStr);
  assert(todayPoint && todayPoint.total === 10 * productA.retail_price, `reports:trend's today bucket matches the real sale total (got ${todayPoint && todayPoint.total})`);
  const wideTrend = call("reports:trend", { from: "2026-01-01", to: "2026-12-31" });
  assert(wideTrend.granularity === "month", "reports:trend switches to month granularity for a range over 31 days");

  // --- reports:topProducts ------------------------------------------------
  call("sales:create", { customer_id: customer.id, mode: "Retail", discount: 0, payment_method: "Cash", paid: 20 * productB.retail_price, items: [{ product_id: productB.id, quantity: 20, rate: productB.retail_price }], actorId: 1 });
  const top = call("reports:topProducts", { from: monthStart, to: todayStr, limit: 10 });
  assert(top.length === 2, `reports:topProducts returns both sold products (got ${top.length})`);
  assert(top[0].id === productB.id, "reports:topProducts orders by revenue descending (productB sold for more)");
  assert(top[0].qty === 20, "reports:topProducts sums the real quantity sold");

  // --- reports:inventory ---------------------------------------------------
  const inv = call("reports:inventory", { from: monthStart, to: todayStr });
  assert(inv.lowCount >= 1, "reports:inventory correctly counts the low-stock product");
  assert(inv.totalValue > 0, "reports:inventory computes a positive total stock value");
  assert(inv.fastMoving.some((f) => f.id === productB.id), "reports:inventory's fastMoving list includes the top-selling product");
  assert(!inv.slowMoving.some((s) => s.id === productA.id) && !inv.slowMoving.some((s) => s.id === productB.id), "reports:inventory excludes products that sold from slowMoving");
  assert(inv.slowMoving.some((s) => s.id === productC.id), "reports:inventory lists an in-stock, unsold product as slow moving");

  // --- reports:customers ---------------------------------------------------
  call("payments:add", { type: "customer", entity_id: customer.id, amount: 5000, payment_method: "Cash", actorId: 1 });
  const custReport = call("reports:customers", { from: monthStart, to: todayStr });
  const custRow = custReport.find((c) => c.id === customer.id);
  assert(custRow.totalPurchases === 10 * productA.retail_price + 20 * productB.retail_price, `reports:customers sums real purchases in range (got ${custRow.totalPurchases})`);
  assert(custRow.totalPayments === 5000, "reports:customers sums real payments in range");
  assert(custRow.lastPurchaseDate === todayStr, "reports:customers reports the real last purchase date");

  // --- reports:suppliers ---------------------------------------------------
  call("purchases:create", { supplier_id: supplier.id, payment_method: "Credit", paid: 0, items: [{ product_id: productA.id, quantity: 15, rate: productA.purchase_price }], actorId: 1 });
  call("payments:add", { type: "supplier", entity_id: supplier.id, amount: 3000, payment_method: "Cash", actorId: 1 });
  const supReport = call("reports:suppliers", { from: monthStart, to: todayStr });
  const supRow = supReport.find((s) => s.id === supplier.id);
  assert(supRow.totalPurchases === 15 * productA.purchase_price, `reports:suppliers sums real purchases in range (got ${supRow.totalPurchases})`);
  assert(supRow.totalPayments === 3000, "reports:suppliers sums real payments in range");
  assert(supRow.balance === 15 * productA.purchase_price - 3000, "reports:suppliers reports the correct outstanding balance");

  console.log(failed ? "\nSOME PHASE L TESTS FAILED" : "\nALL PHASE L TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
