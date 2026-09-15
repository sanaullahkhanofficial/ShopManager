import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Printer, ShoppingBag, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import { PurchaseInvoicePreview, type PurchaseInvoiceData } from "../components/PurchaseInvoicePreview";
import type { AuthUser, PaymentMethod, Product, Purchase, PurchaseItem, PurchaseOrder, PurchaseOrderItem, Settings, Supplier } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"];

interface Line { product_id: number; name: string; name_urdu?: string; unit: string; quantity: number; rate: number; po_item_id?: number; max?: number }

export function Purchases({ user, settings }: { user: AuthUser; settings: Settings }) {
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<Purchase[]>([]);
  const [openPos, setOpenPos] = useState<PurchaseOrder[]>([]);

  const [mode, setMode] = useState<"direct" | "po">("direct");
  const [supplierId, setSupplierId] = useState("");
  const [selectedPoId, setSelectedPoId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productPick, setProductPick] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paid, setPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<PurchaseInvoiceData | null>(null);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.suppliersList().then((s) => setSuppliers(s as Supplier[]));
    api.purchasesList().then((p) => setHistory(p as Purchase[]));
    api.poList().then((p) => setOpenPos((p as PurchaseOrder[]).filter((x) => x.status === "SENT" || x.status === "PARTIALLY_RECEIVED")));
  };
  useEffect(load, []);

  useEffect(() => {
    if (invoice) {
      const t = setTimeout(() => window.print(), 150);
      return () => clearTimeout(t);
    }
  }, [invoice]);

  function resetForm() {
    setLines([]); setDiscount(0); setTax(0); setPaid(0); setNotes("");
    setSupplierId(""); setSelectedPoId(""); setPaymentMethod("Cash");
  }

  function switchMode(m: "direct" | "po") {
    setMode(m);
    resetForm();
  }

  function addLine() {
    const p = products.find((x) => String(x.id) === productPick);
    if (!p) return;
    setLines((v) => {
      if (v.some((l) => l.product_id === p.id)) { push("error", `${p.name} is already on this purchase`); return v; }
      return [...v, { product_id: p.id, name: p.name, name_urdu: p.name_urdu, unit: p.package_unit, quantity: 1, rate: p.purchase_price }];
    });
    setProductPick("");
  }

  async function pickPo(id: string) {
    setSelectedPoId(id);
    if (!id) { setLines([]); return; }
    const detail = (await api.poGet(Number(id))) as { po: PurchaseOrder; items: PurchaseOrderItem[] };
    setSupplierId(String(detail.po.supplier_id));
    const openItems = detail.items.filter((i) => i.quantity - (i.received_quantity || 0) > 0);
    if (!openItems.length) { push("error", "This purchase order has nothing left to receive"); setLines([]); return; }
    setLines(openItems.map((i) => {
      const remaining = i.quantity - (i.received_quantity || 0);
      const product = products.find((p) => p.id === i.product_id);
      return { product_id: i.product_id, name: i.product_name || "", name_urdu: product?.name_urdu, unit: product?.package_unit || "", quantity: remaining, rate: i.rate, po_item_id: i.id, max: remaining };
    }));
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((v) => v.map((l, i) => {
      if (i !== index) return l;
      const next = { ...l, ...patch };
      if (next.max != null) next.quantity = Math.min(next.quantity, next.max);
      return next;
    }));
  }

  const subtotal = lines.reduce((a, l) => a + l.quantity * l.rate, 0);
  const total = Math.max(0, subtotal - discount + tax);
  const selectedSupplier = suppliers.find((s) => String(s.id) === supplierId);
  const selectedPo = openPos.find((p) => String(p.id) === selectedPoId);

  async function save() {
    if (!lines.length) { push("error", "Add at least one product"); return; }
    if (mode === "po" && !selectedPoId) { push("error", "Select a purchase order to receive against"); return; }
    if (mode === "direct" && !supplierId) { push("error", "Select a supplier"); return; }
    setBusy(true);
    try {
      const result = mode === "po"
        ? await api.poReceive({
            po_id: Number(selectedPoId),
            items: lines.map((l) => ({ po_item_id: l.po_item_id, quantity: l.quantity, rate: l.rate })),
            payment_method: paymentMethod, paid: paymentMethod === "Credit" ? 0 : paid, actorId: user.id,
          }) as { id: number; invoice_no: string; po_status: string }
        : await api.purchasesCreate({
            supplier_id: Number(supplierId), discount, tax, notes,
            payment_method: paymentMethod, paid: paymentMethod === "Credit" ? 0 : paid,
            items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, rate: l.rate })),
            actorId: user.id,
          }) as { id: number; invoice_no: string };

      const full = (await api.purchasesGet(result.id)) as { purchase: Purchase; items: PurchaseItem[] };
      setInvoice({
        invoiceNo: full.purchase.invoice_no,
        poNo: full.purchase.po_no,
        date: full.purchase.purchase_date,
        supplierName: full.purchase.supplier_name,
        supplierPhone: full.purchase.supplier_phone,
        items: full.items.map((it) => ({ name: it.product_name || "", nameUrdu: it.name_urdu, qty: it.quantity, unit: it.package_unit || "", rate: it.rate, amount: it.amount })),
        subtotal: full.purchase.subtotal, discount: full.purchase.discount, tax: full.purchase.tax, total: full.purchase.total,
        paymentMethod: full.purchase.payment_method, paid: full.purchase.paid, balance: full.purchase.balance, notes: full.purchase.notes,
      });
      push("success", `Purchase ${full.purchase.invoice_no} saved — stock updated`);
      resetForm();
      load();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to save purchase");
    } finally {
      setBusy(false);
    }
  }

  async function reprint(purchaseId: number) {
    const full = (await api.purchasesGet(purchaseId)) as { purchase: Purchase; items: PurchaseItem[] };
    setInvoice({
      invoiceNo: full.purchase.invoice_no,
      poNo: full.purchase.po_no,
      date: full.purchase.purchase_date,
      supplierName: full.purchase.supplier_name,
      supplierPhone: full.purchase.supplier_phone,
      items: full.items.map((it) => ({ name: it.product_name || "", nameUrdu: it.name_urdu, qty: it.quantity, unit: it.package_unit || "", rate: it.rate, amount: it.amount })),
      subtotal: full.purchase.subtotal, discount: full.purchase.discount, tax: full.purchase.tax, total: full.purchase.total,
      paymentMethod: full.purchase.payment_method, paid: full.purchase.paid, balance: full.purchase.balance, notes: full.purchase.notes,
    });
  }

  const availableProducts = useMemo(() => products.filter((p) => !lines.some((l) => l.product_id === p.id)), [products, lines]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_440px]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Purchase History</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={history}
          pageSize={15}
          columns={[
            { header: "Invoice", render: (r) => (
              <div>
                <div>{r.invoice_no}</div>
                {r.po_no && <div className="text-[11px] text-stone-400">from {r.po_no}</div>}
              </div>
            ) },
            { header: "Supplier", render: (r) => r.supplier_name || "—" },
            { header: "Total", render: (r) => money(r.total) },
            { header: "Paid", render: (r) => money(r.paid) },
            { header: "Balance", render: (r) => money(r.balance) },
            { header: "Date", render: (r) => formatDateTime(r.purchase_date) },
            { header: "", render: (r) => (
              <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => reprint(r.id)}>
                <Printer size={12} className="inline" /> Reprint
              </button>
            ) },
          ]}
        />
      </div>

      <div className="card space-y-3">
        <div className="flex overflow-hidden rounded-md border border-stone-300">
          <button onClick={() => switchMode("direct")} className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium ${mode === "direct" ? "bg-brand-green-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
            <ShoppingBag size={14} /> Direct Purchase
          </button>
          <button onClick={() => switchMode("po")} className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium ${mode === "po" ? "bg-brand-green-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
            <ClipboardList size={14} /> From Purchase Order
          </button>
        </div>

        {mode === "direct" ? (
          <SelectField label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
        ) : (
          <SelectField label="Purchase Order" value={selectedPoId} onChange={(e) => pickPo(e.target.value)}>
            <option value="">Select an open purchase order</option>
            {openPos.map((p) => <option key={p.id} value={p.id}>{p.po_no} — {p.supplier_name} ({p.status.replace(/_/g, " ")})</option>)}
          </SelectField>
        )}

        {mode === "direct" && (
          <div className="flex gap-2">
            <SelectField label="Add Product" value={productPick} onChange={(e) => setProductPick(e.target.value)}>
              <option value="">Select product</option>
              {availableProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectField>
            <Button className="mt-5" onClick={addLine} disabled={!productPick} title="Add product"><Plus size={15} /></Button>
          </div>
        )}

        {/* Live invoice preview — updates as lines/discount/tax change, matching the printed layout's fields */}
        <div className="rounded-card border border-stone-200 bg-stone-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-stone-400">
            <span>Live Invoice Preview</span>
            <span>{mode === "po" && selectedPo ? selectedPo.po_no : "New Purchase"}</span>
          </div>
          <div className="mb-2 text-sm font-medium text-brand-navy-900">
            {mode === "po" ? (selectedPo?.supplier_name || "—") : (selectedSupplier?.name || "No supplier selected")}
          </div>
          <div className="space-y-1.5">
            {lines.length === 0 && <p className="py-3 text-center text-xs text-stone-400">No items yet</p>}
            {lines.map((l, i) => (
              <div key={l.product_id} className="flex items-center gap-2 rounded-md bg-white p-2 text-sm shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-800">{l.name}</p>
                  <p className="text-xs text-stone-400">{l.unit}{l.max != null ? ` · remaining ${l.max}` : ""}</p>
                </div>
                <input
                  type="number" min={0} max={l.max} className="input w-16 py-1 text-right"
                  value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                />
                <input
                  type="number" min={0} className="input w-20 py-1 text-right"
                  value={l.rate} onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                />
                <span className="w-20 text-right font-medium">{money(l.quantity * l.rate)}</span>
                {mode === "direct" && (
                  <button className="text-red-400 hover:text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {mode === "direct" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Discount</span><input type="number" min={0} className="input" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
            <label className="block"><span className="label">Tax</span><input type="number" min={0} className="input" value={tax} onChange={(e) => setTax(Number(e.target.value))} /></label>
          </div>
        )}

        <SelectField label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </SelectField>
        {paymentMethod !== "Credit" && (
          <label className="block"><span className="label">Paid Amount</span><input type="number" min={0} className="input" value={paid} onChange={(e) => setPaid(Number(e.target.value))} /></label>
        )}
        {mode === "direct" && (
          <label className="block"><span className="label">Notes</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        )}

        <div className="space-y-1 border-t border-stone-100 pt-2 text-sm">
          <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {mode === "direct" && discount > 0 && <div className="flex justify-between text-stone-500"><span>Discount</span><span>-{money(discount)}</span></div>}
          {mode === "direct" && tax > 0 && <div className="flex justify-between text-stone-500"><span>Tax</span><span>{money(tax)}</span></div>}
          <div className="flex justify-between text-base font-semibold text-brand-navy-900"><span>Total</span><span>{money(total)}</span></div>
        </div>

        <Button variant="primary" className="w-full" onClick={save} disabled={!lines.length || busy}>
          <Printer size={15} /> Save &amp; Print
        </Button>
      </div>

      {invoice && <PurchaseInvoicePreview data={invoice} settings={settings} />}
    </div>
  );
}
