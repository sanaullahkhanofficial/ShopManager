// Phase I integration test: Cash Management v2's bank accounts, petty cash,
// and cash transfer backend — most of it existed since Phase 0 but had no
// UI or coverage of the partial-update safety fix; this exercises the real
// IPC handlers the new tabbed Cash Management page now drives.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseI-"));
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
  // --- Bank account CRUD + the partial-update safety fix ---------------------
  call("bank:accountSave", { name: "Main Business Account", bank_name: "HBL", account_number: "1234-5678-9012", opening_balance: 100000, actorId: 1 });
  let accounts = call("bank:accountsList");
  assert(accounts.length === 1 && accounts[0].balance === 100000, "a new bank account starts at its opening balance");
  const account = accounts[0];

  call("bank:accountSave", { id: account.id, status: "inactive", actorId: 1 });
  accounts = call("bank:accountsList");
  assert(accounts.length === 0, "deactivating a bank account drops it from the active list");

  call("bank:accountSave", { id: account.id, status: "active", actorId: 1 });
  accounts = call("bank:accountsList");
  assert(accounts.length === 1 && accounts[0].name === "Main Business Account" && accounts[0].bank_name === "HBL", "reactivating keeps the other fields intact (partial-update safety)");

  // --- Cash <-> Bank transfer --------------------------------------------
  call("cash:open", { opening_cash: 50000, actorId: 1 });
  const beforeCash = call("cash:current");
  const t1 = call("cash:transfer", { from: "CASH", to: "BANK", to_account_id: account.id, amount: 20000, note: "Deposit to bank", actorId: 1 });
  assert(/^CT-\d{8}-0001$/.test(t1.reference), `transfer numbered correctly (${t1.reference})`);
  const afterCash1 = call("cash:current");
  assert(afterCash1.expected === beforeCash.expected - 20000, "cash-to-bank transfer reduces the register's expected total");
  const bankBalanceAfterDeposit = call("bank:accountsList").find((a) => a.id === account.id).balance;
  assert(bankBalanceAfterDeposit === 120000, "cash-to-bank transfer increases the bank account balance");

  const bankTx = call("bank:transactionsList", account.id);
  assert(bankTx.length === 1 && bankTx[0].direction === "IN" && bankTx[0].amount === 20000, "bank:transactionsList shows the real deposit leg");

  // --- Bank -> Petty Cash transfer -------------------------------------------
  const beforePetty = call("petty:balance");
  const t2 = call("cash:transfer", { from: "BANK", from_account_id: account.id, to: "PETTY", amount: 5000, note: "Fund petty cash", actorId: 1 });
  const afterPetty = call("petty:balance");
  assert(afterPetty === beforePetty + 5000, "bank-to-petty transfer increases petty cash balance");
  const bankBalanceAfterWithdraw = call("bank:accountsList").find((a) => a.id === account.id).balance;
  assert(bankBalanceAfterWithdraw === 115000, "bank-to-petty transfer decreases the bank account balance");

  const pettyEntries = call("petty:list");
  assert(pettyEntries.length === 1 && pettyEntries[0].reference === t2.reference, "petty:list shows the real funding entry");

  // --- Petty -> Cash transfer (drawing petty cash back into the register) ---
  const beforeCash2 = call("cash:current");
  call("cash:transfer", { from: "PETTY", to: "CASH", amount: 1000, note: "Return unused petty cash", actorId: 1 });
  const afterCash2 = call("cash:current");
  assert(afterCash2.expected === beforeCash2.expected + 1000, "petty-to-cash transfer increases the register's expected total");
  assert(call("petty:balance") === afterPetty - 1000, "petty-to-cash transfer decreases petty cash balance");

  // --- Transferring cash while the register is closed is rejected -----------
  call("cash:close", { actual_cash: call("cash:current").expected, actorId: 1 });
  let threw = false;
  try { call("cash:transfer", { from: "CASH", to: "PETTY", amount: 500, actorId: 1 }); } catch { threw = true; }
  assert(threw, "a cash-involving transfer is rejected while no register is open");

  // --- Transferring between a bank account and petty cash still works closed ---
  const bankToPetty = call("cash:transfer", { from: "BANK", from_account_id: account.id, to: "PETTY", amount: 2000, actorId: 1 });
  assert(/^CT-/.test(bankToPetty.reference), "a bank<->petty transfer (no cash leg) still works while the register is closed");

  console.log(failed ? "\nSOME PHASE I TESTS FAILED" : "\nALL PHASE I TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
