// Phase O: client-side per-role UI gating. The gating itself (hiding
// Sidebar nav items, the App.tsx route guard) is React/JSX logic verified
// visually via Playwright, since a headless IPC test can't render it. What
// this script verifies is the real data everything downstream depends on:
// permissions:forRole returns the true, current role_permissions rows, and
// applying the same any-of-these-permissions rule the frontend uses
// (src/lib/permissions.ts's PAGE_PERMISSIONS/canAccessPage) against that
// real data produces the exact page-access decisions the UI should show
// for each role — so a passing test here means the UI has correct data to
// gate with, not just a plausible-looking mock.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseO-"));
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

// Mirrors src/lib/permissions.ts exactly — kept as a literal copy (not a
// shared import) since this script runs under plain Node against the .cjs
// backend, not through the Vite/TS toolchain the real frontend uses.
const PAGE_PERMISSIONS = {
  dashboard: ["dashboard.view"], pos: ["sales.create"], purchases: ["purchase.create"],
  products: ["inventory.view"], stockAdjustment: ["inventory.adjust"], stockTransfer: ["inventory.adjust"],
  customers: ["customers.view"], customerLedger: ["customers.view"], suppliers: ["suppliers.view"],
  supplierLedger: ["suppliers.view"], purchaseOrders: ["purchase.create"], salesReturns: ["sales.return"],
  purchaseReturns: ["purchase.return"], cash: ["cash.view"], payments: ["customers.payment", "suppliers.payment"],
  expenses: ["expenses.create"], reports: ["reports.view"], users: ["users.manage"], settings: ["settings.manage"],
  backup: [], aiAssistant: [],
};
function accessiblePages(allowedSet) {
  return Object.keys(PAGE_PERMISSIONS).filter((page) => {
    const required = PAGE_PERMISSIONS[page];
    if (required.length === 0) return true;
    return required.some((p) => allowedSet.has(p));
  });
}

(async () => {
  // Every permission PAGE_PERMISSIONS relies on must be a real permission in
  // the backend's own catalog — if this drifts, the UI would silently gate
  // against a permission the backend never checks.
  const definitions = new Set(call("permissions:definitions"));
  const referenced = new Set(Object.values(PAGE_PERMISSIONS).flat());
  const unknown = [...referenced].filter((p) => !definitions.has(p));
  assert(unknown.length === 0, `every PAGE_PERMISSIONS entry is a real backend permission (unknown: ${unknown.join(", ") || "none"})`);

  const cashierPerms = new Set(call("permissions:forRole", "Cashier").filter((r) => r.allowed).map((r) => r.permission));
  const cashierPages = accessiblePages(cashierPerms);
  assert(cashierPages.includes("dashboard") && cashierPages.includes("pos") && cashierPages.includes("cash") && cashierPages.includes("customers"),
    "a Cashier's real permissions grant access to Dashboard, POS, Cash and Customers");
  assert(!cashierPages.includes("products") && !cashierPages.includes("reports") && !cashierPages.includes("settings") && !cashierPages.includes("users") && !cashierPages.includes("purchases"),
    "a Cashier's real permissions do NOT grant access to Products, Reports, Settings, Users, or Purchases");
  assert(cashierPages.includes("backup") && cashierPages.includes("aiAssistant"),
    "pages with no backend-enforced permission (Backup, AI Assistant) stay accessible to a Cashier, matching real backend behavior");

  const viewerPerms = new Set(call("permissions:forRole", "Viewer").filter((r) => r.allowed).map((r) => r.permission));
  const viewerPages = accessiblePages(viewerPerms);
  assert(viewerPages.includes("products") && viewerPages.includes("reports") && viewerPages.includes("customers") && viewerPages.includes("suppliers") && viewerPages.includes("cash"),
    "a Viewer's real permissions grant read access to Products, Reports, Customers, Suppliers and Cash");
  assert(!viewerPages.includes("pos") && !viewerPages.includes("purchases") && !viewerPages.includes("expenses") && !viewerPages.includes("settings"),
    "a Viewer's real permissions do NOT grant access to POS, Purchases, Expenses, or Settings (Viewer has no create/manage permissions)");

  const ownerPerms = new Set(call("permissions:forRole", "Owner").filter((r) => r.allowed).map((r) => r.permission));
  const ownerPages = accessiblePages(ownerPerms);
  assert(Object.keys(PAGE_PERMISSIONS).every((p) => ownerPages.includes(p)), "an Owner's real permissions grant access to every gated page");

  // A live permission change (the Permission Matrix editor) takes effect
  // immediately in permissions:forRole's data, which is what the UI refetches.
  const owner = call("users:list")[0];
  call("permissions:update", { role: "Cashier", permission: "reports.view", allowed: 1, actorId: owner.id });
  const cashierPermsAfter = new Set(call("permissions:forRole", "Cashier").filter((r) => r.allowed).map((r) => r.permission));
  assert(accessiblePages(cashierPermsAfter).includes("reports"), "granting reports.view to Cashier through the real matrix editor immediately shows up in permissions:forRole");

  console.log(failed ? "\nSOME PHASE O TESTS FAILED" : "\nALL PHASE O TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
