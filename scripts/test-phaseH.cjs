// Phase H integration test: Sales/Purchase Returns v2 — the real Refund vs
// Exchange distinction, batch_ref persistence, the automatic purchase-return
// credit note, and the new salesReturns:list/purchaseReturns:list history
// endpoints — driven through the real IPC handlers.
const Module = require("module");
const os = require("os"), path = require("path"), fs = require("fs");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shopmanager-phaseH-"));
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
  const products = call("products:list");
  const productA = products[0], productB = products[1];
  call("products:adjust", { product_id: productA.id, quantity: 200, unit_cost: productA.purchase_price, reason: "Opening", actorId: 1 });
  call("products:adjust", { product_id: productB.id, quantity: 200, unit_cost: productB.purchase_price, reason: "Opening", actorId: 1 });
  call("customers:save", { shop_name: "Farooq Store", name: "Farooq", customer_type: "Retail", actorId: 1 });
  const customer = call("customers:list")[0];
  call("suppliers:save", { name: "Zahid Traders", actorId: 1 });
  const supplier = call("suppliers:list")[0];

  // --- Sales Return: Refund path ---------------------------------------------
  const sale = call("sales:create", {
    customer_id: customer.id, mode: "Retail", discount: 0, payment_method: "Cash", paid: 10 * productA.retail_price,
    items: [{ product_id: productA.id, quantity: 10, rate: productA.retail_price }], actorId: 1,
  });
  const stockAfterSale = call("products:list").find((p) => p.id === productA.id).stock;

  const saleDetail = call("sales:get", sale.id);
  const refund = call("salesReturns:create", {
    sale_id: sale.id, returnType: "Refund", reason: "Damaged", refundCash: true,
    items: [{ sale_item_id: saleDetail.items[0].id, quantity: 3, batch_ref: "LOT-A1" }], actorId: 1,
  });
  assert(/^SR-\d{8}-0001$/.test(refund.return_no), `sales return numbered correctly (${refund.return_no})`);
  const stockAfterRefund = call("products:list").find((p) => p.id === productA.id).stock;
  assert(stockAfterRefund === stockAfterSale + 3, "refunded quantity is added back to stock");

  const srList = call("salesReturns:list");
  assert(srList.length === 1 && srList[0].return_no === refund.return_no, "salesReturns:list returns the refund");
  assert(srList[0].return_type === "Refund", "salesReturns:list reports the correct return_type");
  assert(srList[0].original_invoice === sale.invoice_no, "salesReturns:list joins the original invoice number");
  assert(srList[0].customer_name === "Farooq Store", "salesReturns:list joins the customer name");
  assert(srList[0].refund_cash === 3 * productA.retail_price, "refund_cash recorded the real cash amount refunded");

  // --- Sales Return: Exchange path (return credit applied as a discount on a new sale) ---
  const sale2 = call("sales:create", {
    customer_id: customer.id, mode: "Retail", discount: 0, payment_method: "Cash", paid: 5 * productA.retail_price,
    items: [{ product_id: productA.id, quantity: 5, rate: productA.retail_price }], actorId: 1,
  });
  const sale2Detail = call("sales:get", sale2.id);
  const exchangeReturn = call("salesReturns:create", {
    sale_id: sale2.id, returnType: "Exchange", reason: "Wrong item", refundCash: false,
    items: [{ sale_item_id: sale2Detail.items[0].id, quantity: 5 }], actorId: 1,
  });
  assert(exchangeReturn.total === 5 * productA.retail_price, "exchange return computes the correct return credit");
  const exchangeSaleTotal = 4 * productB.retail_price; // fewer units than the credit, on purpose
  const exchangeCredit = Math.min(exchangeReturn.total, exchangeSaleTotal);
  const exchangeSale = call("sales:create", {
    customer_id: customer.id, mode: "Retail", discount: exchangeCredit,
    payment_method: "Cash", paid: 0,
    items: [{ product_id: productB.id, quantity: 4, rate: productB.retail_price }], actorId: 1,
  });
  assert(exchangeSale.total === Math.max(0, exchangeSaleTotal - exchangeCredit), `exchange sale total reflects the applied return credit (got ${exchangeSale.total})`);
  assert(exchangeSale.balance === 0, "an exchange sale fully covered by return credit leaves no balance");

  const srList2 = call("salesReturns:list");
  assert(srList2.find((r) => r.id === exchangeReturn.id).return_type === "Exchange", "the exchange return is correctly listed with type Exchange");

  // --- Over-returning is still rejected (same guard as before) --------------
  let threw = false;
  try {
    call("salesReturns:create", { sale_id: sale.id, returnType: "Refund", items: [{ sale_item_id: saleDetail.items[0].id, quantity: 999 }], actorId: 1 });
  } catch { threw = true; }
  assert(threw, "returning more than what's left returnable is still rejected");

  // --- Purchase Return: batch_ref + automatic credit note ---------------------
  const purchase = call("purchases:create", {
    supplier_id: supplier.id, payment_method: "Credit", paid: 0,
    items: [{ product_id: productA.id, quantity: 20, rate: productA.purchase_price }], actorId: 1,
  });
  const supplierBalanceBefore = call("suppliers:list").find((s) => s.id === supplier.id).balance;
  const purchaseDetail = call("purchases:get", purchase.id);
  const pReturn = call("purchaseReturns:create", {
    purchase_id: purchase.id, reason: "Quality issue",
    items: [{ purchase_item_id: purchaseDetail.items[0].id, quantity: 5, batch_ref: "LOT-B2" }], actorId: 1,
  });
  assert(/^CN-\d{8}-0001$/.test(pReturn.credit_note_no), `a credit note is issued automatically (${pReturn.credit_note_no})`);
  const supplierBalanceAfter = call("suppliers:list").find((s) => s.id === supplier.id).balance;
  assert(supplierBalanceAfter === supplierBalanceBefore - 5 * productA.purchase_price, "the credit note reduces the supplier's payable by the returned amount");

  const prList = call("purchaseReturns:list");
  assert(prList.length === 1 && prList[0].credit_note_no === pReturn.credit_note_no, "purchaseReturns:list shows the credit note number");
  assert(prList[0].original_invoice === purchase.invoice_no, "purchaseReturns:list joins the original purchase invoice");
  assert(prList[0].supplier_name === "Zahid Traders", "purchaseReturns:list joins the supplier name");

  console.log(failed ? "\nSOME PHASE H TESTS FAILED" : "\nALL PHASE H TESTS PASSED");
  if (failed) process.exitCode = 1;
})();
