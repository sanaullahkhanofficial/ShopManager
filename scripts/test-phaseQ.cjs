// Phase Q: wiring up the reports.export permission (real in the catalog
// since Phase 0/M, but never checked or acted on by anything until now)
// to real CSV export buttons on the Reports suite. The actual CSV
// generation and the Export button's visibility are React/UI concerns
// verified visually via Playwright; this script verifies the two things a
// headless IPC test actually can: the permission is granted to the real
// roles the export feature is meant for, and the report handlers each
// export function reads from return the exact real fields and real numbers
// the CSV rows are built from.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseQ-"));
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
  const owner = call("users:list")[0];
  const today = new Date().toISOString().slice(0, 10);
  const range = { from: today.slice(0, 8) + "01", to: today };

  // --- reports.export is a real permission granted to the roles that need it ---
  assert(call("permissions:definitions").includes("reports.export"), "reports.export is a real permission in the backend catalog");
  const ownerPerms = new Set(call("permissions:forRole", "Owner").filter((r) => r.allowed).map((r) => r.permission));
  const accountantPerms = new Set(call("permissions:forRole", "Accountant").filter((r) => r.allowed).map((r) => r.permission));
  const cashierPerms = new Set(call("permissions:forRole", "Cashier").filter((r) => r.allowed).map((r) => r.permission));
  assert(ownerPerms.has("reports.export") && accountantPerms.has("reports.export"), "Owner and Accountant are genuinely granted reports.export");
  assert(!cashierPerms.has("reports.export"), "a Cashier is NOT granted reports.export, so the real Export CSV button would stay hidden for them");

  // --- Seed real data the CSV export functions read from ---
  const catId = call("categories:list")[0].id;
  call("products:save", { category_id: catId, name: "Test Wheat", package_unit: "KG", purchase_price: 100, retail_price: 150, wholesale_price: 130, min_stock: 50, stock: 10, actorId: owner.id });
  const product = call("products:list").find((p) => p.name === "Test Wheat");
  call("customers:save", { name: "Test Customer", customer_type: "Retail", opening_balance: 5000, actorId: owner.id });
  const customer = call("customers:list").find((c) => c.name === "Test Customer");
  call("suppliers:save", { name: "Test Supplier", opening_balance: 8000, actorId: owner.id });
  call("sales:create", { mode: "Retail", customer_id: customer.id, payment_method: "Credit", discount: 0, actorId: owner.id, items: [{ product_id: product.id, quantity: 2, rate: 150 }], paid: 0 });

  // --- reports:topProducts (Sales & Revenue tab export source) has every field exportCsv() reads ---
  const topProducts = call("reports:topProducts", { ...range, limit: 10 });
  const topProduct = topProducts.find((p) => p.name === "Test Wheat");
  assert(topProduct && "name_urdu" in topProduct && "qty" in topProduct && "package_unit" in topProduct && "revenue" in topProduct,
    "reports:topProducts returns every field the Sales & Revenue CSV export reads");
  assert(topProduct.qty === 2 && topProduct.revenue === 300, `reports:topProducts reflects the real 2 KG / Rs. 300 sale (got qty=${topProduct.qty}, revenue=${topProduct.revenue})`);

  // --- reports:summary (Sales & Revenue + P&L exports) has every field both exportCsv() functions read ---
  const summary = call("reports:summary", range);
  for (const f of ["sales", "netSales", "cashSales", "creditSales", "retailSales", "wholesaleSales", "salesReturns", "grossMarginPct", "cogs", "grossProfit", "expenses", "netProfit", "netMarginPct"]) {
    assert(f in summary, `reports:summary includes "${f}", which the Sales & Revenue and P&L CSV exports both read`);
  }
  assert(summary.sales === 300 && summary.creditSales === 300, `reports:summary reflects the real Rs. 300 credit sale (got sales=${summary.sales}, creditSales=${summary.creditSales})`);

  // --- reports:inventory (Inventory tab export source) has every field exportCsv() reads ---
  const inventory = call("reports:inventory", range);
  const invRow = inventory.products.find((p) => p.name === "Test Wheat");
  assert(invRow && "category_name" in invRow && "stock" in invRow && "avg_cost" in invRow && "value" in invRow && "min_stock" in invRow,
    "reports:inventory's products list includes every field the Inventory CSV export reads");
  assert(invRow.stock === 8 && invRow.avg_cost === 100 && invRow.value === 800, `reports:inventory reflects the real remaining 8 KG at avg_cost 100 = Rs. 800 (got ${JSON.stringify({ stock: invRow.stock, avg_cost: invRow.avg_cost, value: invRow.value })})`);

  // --- reports:customers / reports:suppliers (Customer/Supplier tab exports) have every field read ---
  const customerRows = call("reports:customers", range);
  const custRow = customerRows.find((c) => c.name === "Test Customer");
  assert(custRow && "customer_type" in custRow && "totalPurchases" in custRow && "totalPayments" in custRow && "balance" in custRow && "lastPurchaseDate" in custRow,
    "reports:customers includes every field the Customer CSV export reads");
  assert(custRow.balance === 5300, `reports:customers reflects the real balance: Rs. 5000 opening + Rs. 300 credit sale = Rs. 5300 (got ${custRow.balance})`);

  const supplierRows = call("reports:suppliers", range);
  const supRow = supplierRows.find((s) => s.name === "Test Supplier");
  assert(supRow && "category" in supRow && "totalPurchases" in supRow && "totalPayments" in supRow && "balance" in supRow && "lastPurchaseDate" in supRow,
    "reports:suppliers includes every field the Supplier CSV export reads");
  assert(supRow.balance === 8000, `reports:suppliers reflects the real Rs. 8000 opening balance (got ${supRow.balance})`);

  console.log(failed ? "\nSOME PHASE Q TESTS FAILED" : "\nALL PHASE Q TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
