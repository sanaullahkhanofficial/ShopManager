// Integration test harness: stubs the `electron` module so electron/main.cjs's
// real IPC handlers (real SQLite schema + real accounting logic) can be
// exercised headlessly, then runs the exact Section 69 test scenario.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-test-"));
const handlers = {};

const fakeElectron = {
  app: {
    getPath: () => tmpDir,
    getVersion: () => "test",
    whenReady: () => ({ then: (cb) => { cb(); return Promise.resolve(); } }),
    on: () => {},
  },
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label} (${actual})`);
  }
}

(async () => {
  // --- Section 69: critical accounting test scenario -----------------------
  call("cash:open", { opening_cash: 50000, actorId: 1 });

  const products = call("products:list");
  const p1 = products[0], p2 = products[1];

  // Give both products opening stock via a manual adjustment before selling.
  call("products:adjust", { product_id: p1.id, quantity: 500, unit_cost: p1.purchase_price, reason: "Opening stock", actorId: 1 });
  call("products:adjust", { product_id: p2.id, quantity: 500, unit_cost: p2.purchase_price, reason: "Opening stock", actorId: 1 });

  // Cash sale Rs. 100,000 (no customer — walk-in)
  call("sales:create", { items: [{ product_id: p1.id, quantity: 1, rate: 100000 }], paid: 100000, payment_method: "Cash", mode: "Retail", actorId: 1 });

  // Credit sale Rs. 80,000 to a customer
  call("customers:save", { name: "Ali Khan General Store", customer_type: "Wholesale", actorId: 1 });
  const customer = call("customers:list")[0];
  call("sales:create", { customer_id: customer.id, items: [{ product_id: p2.id, quantity: 1, rate: 80000 }], paid: 0, payment_method: "Credit", mode: "Wholesale", actorId: 1 });

  // Customer payment Rs. 20,000 (cash)
  call("payments:add", { type: "customer", entity_id: customer.id, amount: 20000, payment_method: "Cash", actorId: 1 });

  // Cash purchase Rs. 40,000
  call("suppliers:save", { name: "Fatima Fertilizer Co.", actorId: 1 });
  const supplier = call("suppliers:list")[0];
  call("purchases:create", { supplier_id: supplier.id, items: [{ product_id: p1.id, quantity: 10, rate: 4000 }], paid: 40000, payment_method: "Cash", actorId: 1 });

  // Supplier payment Rs. 10,000 (cash) — create an opening payable first so payment is meaningful
  call("payments:add", { type: "supplier", entity_id: supplier.id, amount: 10000, payment_method: "Cash", actorId: 1 });

  // Cash expense Rs. 5,000
  call("expenses:add", { title: "Electricity bill", category: "Electricity", amount: 5000, payment_method: "Cash", actorId: 1 });

  // Cash withdrawal Rs. 10,000
  call("cash:transaction", { direction: "OUT", category: "WITHDRAWAL", amount: 10000, note: "Owner withdrawal", actorId: 1 });

  const state = call("cash:current");
  console.log("Cash register state:", JSON.stringify({ opening: state.opening_cash, cashIn: state.cashIn, cashOut: state.cashOut, expected: state.expected }, null, 2));

  assertEqual(state.expected, 105000, "Expected closing cash equals Rs. 105,000 per Section 69");

  const custBalance = call("customers:list").find(c => c.id === customer.id).balance;
  assertEqual(custBalance, 60000, "Customer receivable = 80,000 credit sale - 20,000 payment = 60,000");

  const dash = call("dashboard");
  assertEqual(Math.round(dash.sales), 180000, "Today's sales = 100,000 cash + 80,000 credit = 180,000");

  // --- Returns cannot exceed sold quantity ---------------------------------
  const sale2 = call("sales:list")[0]; // most recent sale (the 80,000 credit sale)
  const items = call("sales:get", sale2.id).items;
  try {
    call("salesReturns:create", { sale_id: sale2.id, items: [{ sale_item_id: items[0].id, quantity: 999 }], reason: "test overreturn", actorId: 1 });
    console.error("FAIL: over-quantity sales return should have thrown");
    process.exitCode = 1;
  } catch (e) {
    console.log("PASS: over-quantity sales return rejected —", e.message);
  }

  // --- Negative stock prevention -------------------------------------------
  try {
    call("sales:create", { items: [{ product_id: p1.id, quantity: 999999, rate: 100 }], paid: 0, payment_method: "Credit", actorId: 1 });
    console.error("FAIL: overselling stock should have thrown");
    process.exitCode = 1;
  } catch (e) {
    console.log("PASS: overselling stock rejected —", e.message);
  }

  // --- Cash close reconciliation --------------------------------------------
  const close = call("cash:close", { actual_cash: 105000, actorId: 1 });
  assertEqual(close.status, "MATCHED", "Denomination-counted actual cash matches expected exactly");

  console.log(process.exitCode ? "\nSOME TESTS FAILED" : "\nALL TESTS PASSED");
})();
