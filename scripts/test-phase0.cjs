// Phase 0 integration test: locations/per-location stock, transfers,
// Purchase Orders, configurable payment methods, permission matrix,
// notifications, bank/petty-cash + cash transfer, recurring expenses,
// aging, and period-over-period report comparison — all driven through the
// real IPC handlers in electron/main.cjs against a temporary SQLite database.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phase0-"));
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
  // --- Locations + per-location stock + transfer ---------------------------
  const mainLoc = call("locations:list")[0];
  assert(mainLoc.name === "Main Store", "default Main Store location seeded");
  const godownId = call("locations:save", { name: "Godown", type: "Warehouse" }).find((l) => l.name === "Godown").id;

  const product = call("products:list")[0];
  call("products:adjust", { product_id: product.id, location_id: mainLoc.id, quantity: 200, unit_cost: product.purchase_price, reason: "Opening stock", actorId: 1 });
  let byLoc = call("stock:byLocation", product.id);
  assert(byLoc.find((l) => l.location_id === mainLoc.id).stock === 200, "stock:byLocation reflects the adjustment at Main Store");

  call("stock:transfer", { product_id: product.id, from_location_id: mainLoc.id, to_location_id: godownId, quantity: 50, reason: "Rebalance", actorId: 1 });
  byLoc = call("stock:byLocation", product.id);
  assert(byLoc.find((l) => l.location_id === mainLoc.id).stock === 150, "transfer reduces source location stock");
  assert(byLoc.find((l) => l.location_id === godownId).stock === 50, "transfer increases destination location stock");
  const totalAfterTransfer = call("products:list").find((p) => p.id === product.id).stock;
  assert(totalAfterTransfer === 200, "company-wide total stock is unchanged by a transfer between locations");
  try {
    call("stock:transfer", { product_id: product.id, from_location_id: mainLoc.id, to_location_id: godownId, quantity: 999999, actorId: 1 });
    console.error("FAIL: over-transfer should have thrown"); failed = true;
  } catch (e) { console.log("PASS: transfer exceeding source stock rejected —", e.message); }

  // --- Purchase Orders: draft -> receive (partial) -> receive (rest) -------
  call("suppliers:save", { name: "Al-Rahim Traders", ntn: "1234567-8", payment_term_days: 30 });
  const supplier = call("suppliers:list")[0];
  const po = call("po:create", { supplier_id: supplier.id, items: [{ product_id: product.id, quantity: 100, rate: product.purchase_price }], actorId: 1 });
  assert(/^PO-\d{8}-0001$/.test(po.po_no), `PO numbered correctly (${po.po_no})`);
  call("po:updateStatus", { id: po.id, status: "SENT", actorId: 1 });
  let poDetail = call("po:get", po.id);
  assert(poDetail.po.status === "SENT", "PO transitions DRAFT -> SENT");

  const partial = call("po:receive", { po_id: po.id, items: [{ po_item_id: poDetail.items[0].id, quantity: 40 }], payment_method: "Credit", paid: 0, actorId: 1 });
  assert(!!partial.invoice_no, "receiving a PO creates a real purchase invoice");
  assert(partial.po_status === "PARTIALLY_RECEIVED", "PO marked PARTIALLY_RECEIVED after partial receipt");
  const stockAfterPartial = call("products:list").find((p) => p.id === product.id).stock;
  assert(stockAfterPartial === 240, "partial PO receipt increases real stock (200 + 40)");

  poDetail = call("po:get", po.id);
  const full = call("po:receive", { po_id: po.id, items: [{ po_item_id: poDetail.items[0].id, quantity: 60 }], payment_method: "Cash", paid: 60 * product.purchase_price, actorId: 1 });
  assert(full.po_status === "RECEIVED", "PO marked RECEIVED after the remaining quantity is received");
  try {
    call("po:receive", { po_id: po.id, items: [{ po_item_id: poDetail.items[0].id, quantity: 1 }], actorId: 1 });
    console.error("FAIL: receiving beyond a RECEIVED PO should have thrown"); failed = true;
  } catch (e) { console.log("PASS: over-receiving a closed PO rejected —", e.message); }

  // --- Configurable payment methods ------------------------------------------
  const methods = call("paymentMethods:list");
  assert(methods.some((m) => m.name === "Cash") && methods.length === 7, "payment methods seeded (Cash, Bank Transfer, JazzCash, Easypaisa, Cheque, Credit, Partial)");
  call("paymentMethods:save", { name: "Money Order" });
  assert(call("paymentMethods:list").some((m) => m.name === "Money Order"), "a new payment method can be added");

  // --- Permission matrix -----------------------------------------------------
  const ownerPerms = call("permissions:forRole", "Owner");
  assert(ownerPerms.every((p) => p.allowed === 1), "Owner role has every permission allowed by default");
  assert(call("permissions:check", "Cashier", "users.manage") === false, "Cashier cannot manage users by default");
  assert(call("permissions:check", "Cashier", "sales.create") === true, "Cashier can create sales by default");
  call("permissions:update", { role: "Cashier", permission: "sales.return", allowed: true, actorId: 1 });
  assert(call("permissions:check", "Cashier", "sales.return") === true, "a permission can be granted to a role and takes effect immediately");

  // --- Notifications -----------------------------------------------------
  call("products:save", { name: "Low Stock Test Item", category_id: product.category_id, min_stock: 999, package_unit: "KG", stock: 1, purchase_price: 100, retail_price: 150, wholesale_price: 140, actorId: 1 });
  const notifs = call("notifications:refresh");
  assert(notifs.some((n) => n.type === "LOW_STOCK" && n.title.includes("Low Stock Test Item")), "a below-minimum product generates a LOW_STOCK notification");
  const unread = call("notifications:unreadCount");
  assert(unread > 0, "unread notification count is positive");
  call("notifications:markAllRead");
  assert(call("notifications:unreadCount") === 0, "markAllRead clears the unread count");

  // --- Bank / petty cash / cash transfer --------------------------------------
  call("cash:open", { opening_cash: 10000, actorId: 1 });
  call("bank:accountSave", { name: "HBL Current Account", opening_balance: 0 });
  const bankAccount = call("bank:accountsList")[0];
  call("cash:transfer", { from: "CASH", to: "BANK", amount: 5000, to_account_id: bankAccount.id, note: "Bank deposit", actorId: 1 });
  const cashAfterTransfer = call("cash:current");
  assert(cashAfterTransfer.expected === 5000, "cash-to-bank transfer reduces cash register expected total");
  const bankBalance = call("bank:accountsList").find((b) => b.id === bankAccount.id).balance;
  assert(bankBalance === 5000, "cash-to-bank transfer increases the bank account balance");
  call("cash:transfer", { from: "CASH", to: "PETTY", amount: 1000, note: "Fund petty cash", actorId: 1 });
  assert(call("petty:balance") === 1000, "cash-to-petty transfer funds petty cash");

  // --- Recurring expenses -----------------------------------------------------
  call("recurringExpenses:save", { title: "Shop Rent", category: "Rent", amount: 25000, payment_method: "Cash", frequency: "MONTHLY", next_run_date: new Date().toISOString().slice(0, 10) });
  const cashBeforeRent = call("cash:current").expected;
  call("recurringExpenses:runDue");
  const expenseRows = call("expenses:list");
  assert(expenseRows.some((e) => e.title === "Shop Rent" && e.note === "Auto-generated recurring expense"), "a due recurring expense posts a real expense entry");
  const cashAfterRent = call("cash:current").expected;
  assert(cashAfterRent === cashBeforeRent - 25000, "the recurring cash expense reduces the cash register");

  // --- Aging (FIFO) -----------------------------------------------------------
  call("customers:save", { name: "Aging Test Customer", customer_type: "Wholesale" });
  const agingCustomer = call("customers:list").find((c) => c.name === "Aging Test Customer");
  const oldSale = call("sales:create", { customer_id: agingCustomer.id, items: [{ product_id: product.id, quantity: 1, rate: 50000 }], paid: 0, payment_method: "Credit", actorId: 1 });
  // Backdate the credit entry to simulate an old debt (95 days) for aging.
  const dbPathTest = require("path").join(tmpDir, "shopmanager.db");
  const DirectDb = require("better-sqlite3");
  const rawDb = new DirectDb(dbPathTest);
  const oldDate = new Date(Date.now() - 95 * 86400000).toISOString();
  rawDb.prepare("UPDATE customer_transactions SET created_at=? WHERE reference=?").run(oldDate, oldSale.invoice_no);
  rawDb.close();
  const aging = call("customers:aging", agingCustomer.id);
  assert(aging.over90 === 50000, `95-day-old credit sale lands in the over-90 aging bucket (got ${JSON.stringify(aging)})`);

  // --- Period comparison reports -----------------------------------------------
  const cmp = call("reports:compare", { from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  assert(typeof cmp.deltaPct.sales === "number", "reports:compare returns a numeric sales delta vs. the prior equivalent period");
  assert(cmp.current.sales >= 0 && cmp.previous.sales === 0, "reports:compare separates current vs previous period totals");

  console.log(failed ? "\nSOME PHASE 0 TESTS FAILED" : "\nALL PHASE 0 TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
