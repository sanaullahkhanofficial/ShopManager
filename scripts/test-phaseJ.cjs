// Phase J integration test: Expenses v2's real expense-category management,
// budgets:summary (real spend-vs-budget), and receipt_path persistence —
// recurring expenses were already covered by test-phase0.cjs's due-posting
// scenario, so this focuses on what's new this phase.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseJ-"));
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
  // --- Expense categories are seeded on first run, matching payment_methods ---
  const categories = call("expenseCategories:list");
  assert(categories.length === 12, `all 12 default expense categories are seeded (got ${categories.length})`);
  assert(categories.every((c) => c.status === "active"), "seeded categories all start active");

  call("expenseCategories:save", { name: "Vehicle Maintenance" });
  assert(call("expenseCategories:list").some((c) => c.name === "Vehicle Maintenance"), "a new category can be added");

  const rentCategory = call("expenseCategories:list").find((c) => c.name === "Rent");
  call("expenseCategories:save", { id: rentCategory.id, name: "Rent", status: "inactive" });
  assert(call("expenseCategories:list").find((c) => c.id === rentCategory.id).status === "inactive", "a category can be deactivated");

  // --- Expenses now persist a real receipt_path -----------------------------
  const expenseId = call("expenses:add", { title: "Electricity Bill", category: "Electricity", amount: 8000, payment_method: "Cash", receipt_path: "/fake/data/receipt-123.jpg", actorId: 1 });
  const expenseRow = call("expenses:list").find((e) => e.id === expenseId);
  assert(expenseRow.receipt_path === "/fake/data/receipt-123.jpg", "the attached receipt path persists on the expense row");

  // --- budgets:summary reflects real spend against a set budget -------------
  const month = expenseRow.expense_date.slice(0, 7);
  call("expenses:add", { title: "Internet Bill", category: "Electricity", amount: 3000, payment_method: "Cash", expense_date: expenseRow.expense_date, actorId: 1 });
  call("budgets:set", { category: "Electricity", period_month: month, amount: 10000 });
  let summary = call("budgets:summary", month);
  const electricityRow = summary.find((s) => s.category === "Electricity");
  assert(electricityRow.spent === 11000, `budgets:summary sums real spend for the category (got ${electricityRow.spent})`);
  assert(electricityRow.budget === 10000, "budgets:summary reports the set budget amount");
  assert(electricityRow.spent > electricityRow.budget, "the category is correctly over budget (11,000 spent vs 10,000 budgeted)");

  // --- A category with spend but no budget still appears (budget=0) ---------
  call("expenses:add", { title: "Fuel for delivery", category: "Fuel", amount: 2500, payment_method: "Cash", expense_date: expenseRow.expense_date, actorId: 1 });
  summary = call("budgets:summary", month);
  const fuelRow = summary.find((s) => s.category === "Fuel");
  assert(fuelRow && fuelRow.budget === 0 && fuelRow.spent === 2500, "a category with spend but no set budget still appears with budget=0");

  // --- A different month has no crossover ------------------------------------
  const otherMonthSummary = call("budgets:summary", "2020-01");
  assert(otherMonthSummary.length === 0, "budgets:summary for an unrelated month returns nothing");

  console.log(failed ? "\nSOME PHASE J TESTS FAILED" : "\nALL PHASE J TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
