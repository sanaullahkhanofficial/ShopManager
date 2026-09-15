// Phase D integration test: customer groups, safe partial customer updates
// (credit limit / deactivate), customer stats, and recent-sales listing —
// driven through the real IPC handlers.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseD-"));
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
  call("products:adjust", { product_id: product.id, quantity: 500, unit_cost: product.purchase_price, reason: "Opening", actorId: 1 });

  // --- Customer groups ---------------------------------------------------
  const groups = call("customerGroups:save", { name: "VIP Wholesale" });
  assert(groups.some((g) => g.name === "VIP Wholesale"), "a customer group can be created");
  const group = groups.find((g) => g.name === "VIP Wholesale");

  // --- Create a customer with full Phase D fields -----------------------
  call("customers:save", { name: "Ali Khan", shop_name: "Ali Khan General Store", cnic: "54401-1234567-1", group_id: group.id, customer_type: "Wholesale", credit_limit: 100000, phone: "0301-1234567", actorId: 1 });
  const customer = call("customers:list").find((c) => c.name === "Ali Khan");
  assert(customer.group_name === "VIP Wholesale", "customer lists join in the group name");
  assert(customer.cnic === "54401-1234567-1", "CNIC persisted");

  // --- Safe partial update: Set Credit Limit only -------------------------
  call("customers:save", { id: customer.id, credit_limit: 150000, actorId: 1 });
  const afterCreditChange = call("customers:list").find((c) => c.id === customer.id);
  assert(afterCreditChange.credit_limit === 150000, "credit limit updated via partial payload");
  assert(afterCreditChange.name === "Ali Khan" && afterCreditChange.shop_name === "Ali Khan General Store", "partial credit-limit update did not null out name/shop_name");

  // --- Safe partial update: Deactivate only -------------------------------
  call("customers:save", { id: customer.id, status: "inactive", actorId: 1 });
  assert(!call("customers:list").some((c) => c.id === customer.id), "deactivated customer drops off the active list");
  call("customers:save", { id: customer.id, status: "active", actorId: 1 });
  const reactivated = call("customers:list").find((c) => c.id === customer.id);
  assert(!!reactivated && reactivated.credit_limit === 150000, "reactivated customer keeps its other fields (credit limit survived the round trip)");

  // --- Customer stats + recent sales + ledger + aging ----------------------
  const sale = call("sales:create", { customer_id: customer.id, mode: "Wholesale", items: [{ product_id: product.id, quantity: 2, rate: 6000 }], paid: 4000, payment_method: "Partial", actorId: 1 });
  assert(sale.balance === 8000, "credit sale records the correct outstanding balance");

  const stats = call("customers:stats", customer.id);
  assert(stats.totalInvoices === 1 && stats.totalPurchases === 12000, `customers:stats aggregates real sales (got ${JSON.stringify(stats)})`);

  const recentSales = call("customers:recentSales", customer.id);
  assert(recentSales.length === 1 && recentSales[0].invoice_no === sale.invoice_no, "customers:recentSales returns the real sale");

  call("payments:add", { type: "customer", entity_id: customer.id, amount: 3000, payment_method: "Cash", actorId: 1 });
  const statsAfterPayment = call("customers:stats", customer.id);
  assert(statsAfterPayment.totalPayments === 3000, "customers:stats reflects the payment");

  const balance = call("customers:list").find((c) => c.id === customer.id).balance;
  assert(balance === 5000, `outstanding balance correctly nets credit sale minus payment (8000 - 3000 = 5000, got ${balance})`);

  console.log(failed ? "\nSOME PHASE D TESTS FAILED" : "\nALL PHASE D TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
