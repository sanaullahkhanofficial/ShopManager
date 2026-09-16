// Phase P: AI Business Assistant. This is a deterministic, keyword-matched
// Q&A layer over the real database — not an LLM — so every assertion here
// checks that a real, recognizable question produces the exact real number
// the underlying tables hold, and that an unrecognized question is met with
// an honest "I don't have an answer" rather than a guess.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseP-"));
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

  // --- An unrecognized question gets an honest "no answer", not a guess ---
  const gibberish = call("assistant:ask", { question: "what color is the sky" });
  assert(gibberish.matched === false && gibberish.intent === null, "an unrecognized question is honestly reported as unmatched, not guessed at");
  assert(Array.isArray(gibberish.capabilities) && gibberish.capabilities.length > 0, "an unmatched question still returns the real capability list");

  // --- Before any data exists, every real intent still returns a genuine (zero) answer ---
  const salesToday0 = call("assistant:ask", { question: "What were today's sales?" });
  assert(salesToday0.matched && salesToday0.intent === "sales_today" && salesToday0.data.total === 0 && salesToday0.data.count === 0,
    "with no sales yet, \"today's sales\" honestly reports Rs. 0 across 0 invoices, not an error");

  const lowStock0 = call("assistant:ask", { question: "Which products are low in stock?" });
  assert(lowStock0.matched && lowStock0.intent === "low_stock" && Array.isArray(lowStock0.data.items),
    "\"low stock\" returns a real (possibly empty) list of products at or below their reorder level");

  const cash0 = call("assistant:ask", { question: "How much cash do we have?" });
  assert(cash0.matched && cash0.intent === "cash_in_hand" && cash0.data.open === false && cash0.data.cashInHand === null,
    "with the register closed, \"cash in hand\" honestly reports the register as closed rather than a fake balance");

  // --- Seed real data: a product, a customer with a balance, a supplier with a balance, a sale ---
  const catId = call("categories:list")[0].id;
  call("products:save", { category_id: catId, name: "Test Wheat", package_unit: "KG", purchase_price: 100, retail_price: 150, wholesale_price: 130, min_stock: 50, stock: 10, actorId: owner.id });
  const product = call("products:list").find((p) => p.name === "Test Wheat");
  assert(product && product.stock === 10 && product.avg_cost === 100, `the seeded Test Wheat product has real opening stock of 10 at avg_cost 100 (got ${JSON.stringify(product && { stock: product.stock, avg_cost: product.avg_cost })})`);

  call("customers:save", { name: "Test Customer", customer_type: "Retail", opening_balance: 5000, actorId: owner.id });
  const customer = call("customers:list").find((c) => c.name === "Test Customer");

  call("suppliers:save", { name: "Test Supplier", opening_balance: 8000, actorId: owner.id });
  const supplier = call("suppliers:list").find((s) => s.name === "Test Supplier");
  assert(customer && customer.id && supplier && supplier.id, "the real customer and supplier were created and are findable by name");

  call("sales:create", {
    mode: "Retail", customer_id: null, payment_method: "Cash", discount: 0, actorId: owner.id,
    items: [{ product_id: product.id, quantity: 2, rate: 150 }],
    paid: 300,
  });

  // --- With real data present, every intent now reflects it exactly ---
  const salesToday1 = call("assistant:ask", { question: "What were today's sales?" });
  assert(salesToday1.data.total === 300 && salesToday1.data.count === 1, `"today's sales" reflects the real Rs. 300 sale just recorded (got ${JSON.stringify(salesToday1.data)})`);

  const lowStock1 = call("assistant:ask", { question: "low stock" });
  assert(lowStock1.data.items.some((i) => i.name === "Test Wheat"), "\"low stock\" now lists the real Test Wheat product (10 stock, sold down further, under its 50 reorder level)");

  const debtor = call("assistant:ask", { question: "Which customer owes the most?" });
  assert(debtor.matched && debtor.data && debtor.data.name === "Test Customer" && debtor.data.balance === 5000,
    `"which customer owes the most" correctly identifies the real Rs. 5000 balance (got ${JSON.stringify(debtor.data)})`);

  const payable = call("assistant:ask", { question: "Which supplier do we owe the most?" });
  assert(payable.matched && payable.data && payable.data.name === "Test Supplier" && payable.data.balance === 8000,
    `"which supplier do we owe" correctly identifies the real Rs. 8000 balance (got ${JSON.stringify(payable.data)})`);

  const topProduct = call("assistant:ask", { question: "What's our best selling product this month?" });
  assert(topProduct.matched && topProduct.data && topProduct.data.name === "Test Wheat" && topProduct.data.qty === 2 && topProduct.data.revenue === 300,
    `"best selling product" correctly identifies the real sale (got ${JSON.stringify(topProduct.data)})`);

  const profit = call("assistant:ask", { question: "What's today's profit?" });
  assert(profit.matched && profit.data.sales === 300 && profit.data.cogs === 200 && profit.data.profit === 100,
    `"today's profit" correctly computes Rs. 300 sales minus Rs. 200 real cost of goods = Rs. 100 (got ${JSON.stringify(profit.data)})`);

  const stockValue = call("assistant:ask", { question: "What is our stock value?" });
  assert(stockValue.matched && stockValue.data.value === 800, `"stock value" reflects the real remaining 8 KG at Rs. 100 avg cost = Rs. 800 (got ${JSON.stringify(stockValue.data)})`);

  // --- It is genuinely read-only: no write handler is reachable through it ---
  const beforeCount = call("sales:list", {}).length;
  call("assistant:ask", { question: "delete all sales" });
  const afterCount = call("sales:list", {}).length;
  assert(beforeCount === afterCount, "even an adversarial-looking question performs no write — sales count is unchanged");

  console.log(failed ? "\nSOME PHASE P TESTS FAILED" : "\nALL PHASE P TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
