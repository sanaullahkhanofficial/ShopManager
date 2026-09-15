// Phase K integration test: the dashboard handler's new real fields backing
// Dashboard v2's trend chart, payment-method breakdown, and Retail/Wholesale
// + Cash/Credit mix — driven through the real IPC handler.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseK-"));
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
  const productA = products[0], productB = products[1];
  call("products:adjust", { product_id: productA.id, quantity: 500, unit_cost: productA.purchase_price, reason: "Opening", actorId: 1 });
  call("products:adjust", { product_id: productB.id, quantity: 500, unit_cost: productB.purchase_price, reason: "Opening", actorId: 1 });
  call("customers:save", { shop_name: "Wholesale Buyer Co.", name: "Zafar", customer_type: "Wholesale", actorId: 1 });
  const customer = call("customers:list")[0];

  const dashboardBefore = call("dashboard");
  assert(Array.isArray(dashboardBefore.trend) && dashboardBefore.trend.length === 7, `dashboard returns a 7-day trend array (got ${dashboardBefore.trend.length})`);
  assert(dashboardBefore.trend[6].date === new Date().toISOString().slice(0, 10), "the last trend entry is today");
  assert(dashboardBefore.trend.every((t) => typeof t.total === "number"), "every trend day has a numeric total, including zero-sale days");
  assert(Array.isArray(dashboardBefore.paymentBreakdown), "dashboard returns a paymentBreakdown array");
  assert(dashboardBefore.mix.retailSales === 0 && dashboardBefore.mix.wholesaleSales === 0, "mix starts at zero before any sale today");

  // --- A retail cash sale and a wholesale credit sale today -----------------
  call("sales:create", { customer_id: null, mode: "Retail", discount: 0, payment_method: "Cash", paid: 5 * productA.retail_price, items: [{ product_id: productA.id, quantity: 5, rate: productA.retail_price }], actorId: 1 });
  call("sales:create", { customer_id: customer.id, mode: "Wholesale", discount: 0, payment_method: "Credit", paid: 0, items: [{ product_id: productB.id, quantity: 10, rate: productB.wholesale_price }], actorId: 1 });

  const dashboardAfter = call("dashboard");
  assert(dashboardAfter.trend[6].total === dashboardAfter.sales, "today's trend entry matches today's total sales");

  const cashRow = dashboardAfter.paymentBreakdown.find((p) => p.payment_method === "Cash");
  const creditRow = dashboardAfter.paymentBreakdown.find((p) => p.payment_method === "Credit");
  assert(cashRow && cashRow.v === 5 * productA.retail_price, `paymentBreakdown reports the real Cash total (got ${cashRow && cashRow.v})`);
  assert(creditRow && creditRow.v === 10 * productB.wholesale_price, `paymentBreakdown reports the real Credit total (got ${creditRow && creditRow.v})`);

  assert(dashboardAfter.mix.retailSales === 5 * productA.retail_price, "mix.retailSales reflects the real retail sale");
  assert(dashboardAfter.mix.wholesaleSales === 10 * productB.wholesale_price, "mix.wholesaleSales reflects the real wholesale sale");
  assert(dashboardAfter.mix.cashSales === 5 * productA.retail_price, "mix.cashSales matches the paid cash amount");
  assert(dashboardAfter.mix.creditSales === 10 * productB.wholesale_price, "mix.creditSales matches the outstanding credit balance");

  console.log(failed ? "\nSOME PHASE K TESTS FAILED" : "\nALL PHASE K TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
