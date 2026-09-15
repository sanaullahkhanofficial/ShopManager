import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, PaymentMethod, Product, Purchase, Supplier } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"];

interface Line { product_id: number; name: string; quantity: number; rate: number }

export function Purchases({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<Purchase[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productPick, setProductPick] = useState("");
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.suppliersList().then((s) => setSuppliers(s as Supplier[]));
    api.purchasesList().then((p) => setHistory(p as Purchase[]));
  };
  useEffect(load, []);

  const total = lines.reduce((a, l) => a + l.quantity * l.rate, 0);

  function addLine() {
    const p = products.find((x) => String(x.id) === productPick);
    if (!p) return;
    setLines((v) => [...v, { product_id: p.id, name: p.name, quantity: 1, rate: p.purchase_price }]);
    setProductPick("");
  }

  async function save() {
    if (!lines.length) { push("error", "Add at least one product"); return; }
    setBusy(true);
    try {
      const r = await api.purchasesCreate({
        supplier_id: supplierId ? Number(supplierId) : null,
        payment_method: paymentMethod,
        notes,
        paid: paymentMethod === "Credit" ? 0 : paid,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, rate: l.rate })),
        actorId: user.id,
      }) as { invoice_no: string };
      push("success", `Purchase ${r.invoice_no} saved — stock updated`);
      setLines([]); setPaid(0); setNotes(""); setSupplierId(""); setPaymentMethod("Cash");
      load();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to save purchase");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Purchase History</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={history}
          columns={[
            { header: "Invoice", render: (r) => r.invoice_no },
            { header: "Supplier", render: (r) => r.supplier_name || "—" },
            { header: "Total", render: (r) => money(r.total) },
            { header: "Paid", render: (r) => money(r.paid) },
            { header: "Balance", render: (r) => money(r.balance) },
            { header: "Date", render: (r) => formatDateTime(r.purchase_date) },
          ]}
        />
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">New Purchase</h3>
        <SelectField label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Select supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <div className="flex gap-2">
          <SelectField label="Add Product" value={productPick} onChange={(e) => setProductPick(e.target.value)}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <Button className="mt-5" onClick={addLine} disabled={!productPick}><Plus size={15} /></Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{l.name}</span>
              <input type="number" className="input w-16" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
              <input type="number" className="input w-24" value={l.rate} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x))} />
              <span className="w-20 text-right font-medium">{money(l.quantity * l.rate)}</span>
              <button className="text-red-400 hover:text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <SelectField label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </SelectField>
        {paymentMethod !== "Credit" && (
          <label className="block"><span className="label">Paid Amount</span><input type="number" className="input" value={paid} onChange={(e) => setPaid(Number(e.target.value))} /></label>
        )}
        <label className="block"><span className="label">Notes</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-semibold"><span>Total</span><span>{money(total)}</span></div>
        <Button variant="primary" className="w-full" onClick={save} disabled={!lines.length || busy}>Save Purchase</Button>
      </div>
    </div>
  );
}
