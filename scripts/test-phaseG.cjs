// Phase G integration test: Purchases v2's converged direct-purchase /
// PO-linked-receive flow, discount/tax fields, and the new po_no join used
// for the "from PO-XXXX" badge and dual-copy invoice printing.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseG-"));
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
  call("suppliers:save", { name: "Balochistan Grains Co.", phone: "0333-4445555", actorId: 1 });
  const supplier = call("suppliers:list")[0];

  // --- Direct purchase with discount + tax --------------------------------
  const direct = call("purchases:create", {
    supplier_id: supplier.id, discount: 500, tax: 200, payment_method: "Cash", paid: 0, notes: "Opening stock",
    items: [{ product_id: product.id, quantity: 50, rate: product.purchase_price }],
    actorId: 1,
  });
  const expectedTotal = 50 * product.purchase_price - 500 + 200;
  assert(direct.total === expectedTotal, `direct purchase applies discount and tax correctly (expected ${expectedTotal}, got ${direct.total})`);

  const directFull = call("purchases:get", direct.id);
  assert(directFull.purchase.po_no == null, "a direct purchase has no po_no");
  assert(directFull.purchase.supplier_name === "Balochistan Grains Co." && directFull.purchase.supplier_phone === "0333-4445555", "purchases:get joins supplier name and phone");
  assert(directFull.items[0].product_name === product.name, "purchases:get joins product name onto line items");

  const listRow = call("purchases:list").find((p) => p.id === direct.id);
  assert(listRow.supplier_name === "Balochistan Grains Co.", "purchases:list still joins supplier name");
  assert(listRow.po_no == null, "purchases:list shows no po_no for a direct purchase");

  // --- PO-linked purchase: create PO, send it, then receive as a converged purchase ---
  const po = call("po:create", { supplier_id: supplier.id, items: [{ product_id: product.id, quantity: 80, rate: product.purchase_price }], actorId: 1 });
  call("po:updateStatus", { id: po.id, status: "SENT", actorId: 1 });
  const detail = call("po:get", po.id);
  const received = call("po:receive", { po_id: po.id, items: [{ po_item_id: detail.items[0].id, quantity: 80, rate: product.purchase_price }], payment_method: "Credit", paid: 0, actorId: 1 });
  assert(received.po_status === "RECEIVED", "PO marked RECEIVED after receiving the full remaining quantity");

  const poLinkedFull = call("purchases:get", received.id);
  assert(poLinkedFull.purchase.po_no === po.po_no, `the resulting purchase's po_no join matches the source PO (got ${poLinkedFull.purchase.po_no})`);
  assert(poLinkedFull.purchase.notes === `From ${po.po_no}`, "the PO-linked purchase carries the automatic 'From PO-...' note");

  const listRow2 = call("purchases:list").find((p) => p.id === received.id);
  assert(listRow2.po_no === po.po_no, "purchases:list also shows the po_no for a PO-linked purchase");

  // --- A PO with nothing left to receive is correctly reported as empty ---
  const emptyDetail = call("po:get", po.id);
  const stillOpen = emptyDetail.items.filter((i) => i.quantity - (i.received_quantity || 0) > 0);
  assert(stillOpen.length === 0, "a fully-received PO has no open line items left to link into a new purchase");

  console.log(failed ? "\nSOME PHASE G TESTS FAILED" : "\nALL PHASE G TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
