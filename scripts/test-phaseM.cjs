// Phase M integration test: real IPC-boundary permission enforcement, the
// Owner users.manage safeguard, the permissions:matrix shape, user
// activate/deactivate + password reset, and login/login-failure audit
// logging — driven through the real IPC handlers.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseM-"));
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
function throws(fn) { try { fn(); return null; } catch (e) { return e.message; } }

(async () => {
  const owner = call("users:list").find((u) => u.role === "Owner");
  assert(owner.id === 1, "the seeded admin is the Owner (id 1)");

  // --- Owner (all permissions) can do everything the gated handlers need ---
  call("customers:save", { shop_name: "Owner Test Store", name: "Owner Buyer", customer_type: "Retail", actorId: owner.id });
  const customer = call("customers:list")[0];
  const product = call("products:list")[0];
  call("products:adjust", { product_id: product.id, quantity: 100, unit_cost: product.purchase_price, reason: "Opening", actorId: owner.id });
  const sale = call("sales:create", { customer_id: customer.id, mode: "Retail", discount: 0, payment_method: "Cash", paid: product.retail_price, items: [{ product_id: product.id, quantity: 1, rate: product.retail_price }], actorId: owner.id });
  assert(sale.invoice_no, "Owner can create a sale");

  // --- A Cashier (limited permissions) is genuinely blocked, not just hidden in UI ---
  call("users:add", { username: "cashier1", display_name: "Cashier One", role: "Cashier", password: "cash1234", actorId: owner.id });
  const cashier = call("users:list").find((u) => u.username === "cashier1");

  const cashierSaleErr = throws(() => call("sales:create", { customer_id: customer.id, mode: "Retail", discount: 0, payment_method: "Cash", paid: 100, items: [{ product_id: product.id, quantity: 1, rate: product.retail_price }], actorId: cashier.id }));
  assert(cashierSaleErr === null, "a Cashier (has sales.create by default) can still create a sale");

  const cashierExpenseErr = throws(() => call("expenses:add", { title: "Unauthorized expense", category: "Miscellaneous", amount: 500, payment_method: "Cash", actorId: cashier.id }));
  assert(cashierExpenseErr && /Permission denied/.test(cashierExpenseErr), `a Cashier is denied expenses.create (got: ${cashierExpenseErr})`);

  const cashierSettingsErr = throws(() => call("settings:update", { business_name: "Hacked Name", actorId: cashier.id }));
  assert(cashierSettingsErr && /Permission denied/.test(cashierSettingsErr), `a Cashier is denied settings.manage (got: ${cashierSettingsErr})`);
  assert(call("settings:get").business_name !== "Hacked Name", "the denied settings update did not actually change the setting");

  const cashierUserAddErr = throws(() => call("users:add", { username: "sneaky", display_name: "Sneaky", role: "Owner", password: "x", actorId: cashier.id }));
  assert(cashierUserAddErr && /Permission denied/.test(cashierUserAddErr), "a Cashier is denied users.manage (cannot create new users)");

  // --- No actorId at all is denied, not silently allowed --------------------
  const noActorErr = throws(() => call("expenses:add", { title: "No actor", category: "Miscellaneous", amount: 100, payment_method: "Cash" }));
  assert(noActorErr && /Permission denied/.test(noActorErr), "a call with no actorId is denied, not silently allowed");

  // --- Granting a permission takes effect immediately -----------------------
  call("permissions:update", { role: "Cashier", permission: "expenses.create", allowed: true, actorId: owner.id });
  const afterGrant = throws(() => call("expenses:add", { title: "Now allowed", category: "Miscellaneous", amount: 200, payment_method: "Cash", actorId: cashier.id }));
  assert(afterGrant === null, "granting expenses.create to Cashier immediately allows the expense");

  // --- The Owner users.manage safeguard cannot be revoked -------------------
  const revokeOwnerErr = throws(() => call("permissions:update", { role: "Owner", permission: "users.manage", allowed: false, actorId: owner.id }));
  assert(revokeOwnerErr && /Cannot revoke/.test(revokeOwnerErr), "revoking Owner's users.manage permission is rejected");
  const matrixCheck = call("permissions:matrix");
  const ownerUsersManage = matrixCheck.rows.find((r) => r.role === "Owner" && r.permission === "users.manage");
  assert(ownerUsersManage.allowed === 1, "Owner's users.manage permission is still intact after the rejected attempt");

  // --- permissions:matrix returns the full real shape ------------------------
  const permCount = matrixCheck.permissions.length;
  assert(permCount > 0, `permissions:matrix lists a non-empty permission catalog (got ${permCount})`);
  assert(matrixCheck.roles.length === 8, `permissions:matrix lists all 8 roles (got ${matrixCheck.roles.length})`);
  assert(matrixCheck.rows.length === permCount * 8, `permissions:matrix returns a full role x permission grid (${permCount} permissions x 8 roles = ${permCount * 8}, got ${matrixCheck.rows.length})`);

  // --- Users v2: activate/deactivate and password reset ---------------------
  call("users:setStatus", { id: cashier.id, status: "inactive", actorId: owner.id });
  let loginErr = throws(() => call("auth:login", { username: "cashier1", password: "cash1234" }));
  assert(loginErr && /Invalid username or password/.test(loginErr), "a deactivated user can no longer log in");
  call("users:setStatus", { id: cashier.id, status: "active", actorId: owner.id });

  call("users:resetPassword", { id: cashier.id, password: "newpass99", actorId: owner.id });
  const loginResult = call("auth:login", { username: "cashier1", password: "newpass99" });
  assert(loginResult.username === "cashier1", "the reset password logs in successfully");
  const oldPasswordErr = throws(() => call("auth:login", { username: "cashier1", password: "cash1234" }));
  assert(oldPasswordErr && /Invalid username or password/.test(oldPasswordErr), "the old password no longer works after reset");

  // --- Failed logins are audited, not just successful ones ------------------
  throws(() => call("auth:login", { username: "cashier1", password: "wrong-password" }));
  const auditRows = call("audit:list", 300);
  assert(auditRows.some((r) => r.action === "LOGIN_FAILED"), "a failed login attempt is recorded in the audit log");
  assert(auditRows.some((r) => r.action === "LOGIN" && r.user_name === "Cashier One"), "a successful login is recorded with the real user's name joined in");

  console.log(failed ? "\nSOME PHASE M TESTS FAILED" : "\nALL PHASE M TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
