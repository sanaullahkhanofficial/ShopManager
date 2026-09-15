import React, { useEffect, useState } from "react";
import { Plus, Search, Send, PackageCheck, Ban, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import { StatusBadge } from "./SupplierLedger";
import type { AuthUser, PaymentMethod, Product, PurchaseOrder, PurchaseOrderItem, Supplier } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"];

interface DraftLine { product_id: number; name: string; quantity: number; rate: number }

export function PurchaseOrders({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [newPo, setNewPo] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);

  const load = () => {
    api.poList().then((p) => setPos(p as PurchaseOrder[]));
    api.suppliersList().then((s) => setSuppliers(s as Supplier[]));
    api.productsList().then((p) => setProducts(p as Product[]));
  };
  useEffect(load, []);

  const rows = pos.filter((p) =>
    (p.po_no + " " + (p.supplier_name || "")).toLowerCase().includes(query.toLowerCase()) &&
    (!statusFilter || p.status === statusFilter)
  );

  async function send(po: PurchaseOrder) {
    await api.poUpdateStatus({ id: po.id, status: "SENT", actorId: user.id });
    push("success", `${po.po_no} sent to supplier`);
    load();
  }
  async function cancel(po: PurchaseOrder) {
    if (!confirm(`Cancel ${po.po_no}? This can't be undone.`)) return;
    await api.poUpdateStatus({ id: po.id, status: "CANCELLED", actorId: user.id });
    push("success", `${po.po_no} cancelled`);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search PO number or supplier…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {["DRAFT", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <Button variant="primary" className="ml-auto" onClick={() => setNewPo(true)}><Plus size={15} /> New Purchase Order</Button>
      </div>

      <div className="card">
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          pageSize={20}
          columns={[
            { header: "PO No.", render: (r) => r.po_no },
            { header: "Supplier", render: (r) => r.supplier_name || "—" },
            { header: "Created", render: (r) => formatDate(r.created_at) },
            { header: "Expected", render: (r) => r.expected_date ? formatDate(r.expected_date) : "—" },
            { header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { header: "Action", render: (r) => (
              <div className="flex gap-2">
                {r.status === "DRAFT" && <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => send(r)}><Send size={12} className="inline" /> Send</button>}
                {(r.status === "SENT" || r.status === "PARTIALLY_RECEIVED") && <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setReceiveTarget(r)}><PackageCheck size={12} className="inline" /> Receive</button>}
                {(r.status === "DRAFT" || r.status === "SENT") && <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => cancel(r)}><Ban size={12} className="inline" /> Cancel</button>}
              </div>
            ) },
          ]}
        />
      </div>

      {newPo && <NewPoModal suppliers={suppliers} products={products} onClose={() => setNewPo(false)} onSaved={load} actorId={user.id} />}
      {receiveTarget && <ReceivePoModal po={receiveTarget} onClose={() => setReceiveTarget(null)} onSaved={load} actorId={user.id} />}
    </div>
  );
}

function NewPoModal({ suppliers, products, onClose, onSaved, actorId }: {
  suppliers: Supplier[]; products: Product[]; onClose: () => void; onSaved: () => void; actorId: number;
}) {
  const { push } = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productPick, setProductPick] = useState("");

  function addLine() {
    const p = products.find((x) => String(x.id) === productPick);
    if (!p) return;
    setLines((v) => [...v, { product_id: p.id, name: p.name, quantity: 1, rate: p.purchase_price }]);
    setProductPick("");
  }

  const total = lines.reduce((a, l) => a + l.quantity * l.rate, 0);

  async function save() {
    if (!supplierId || !lines.length) { push("error", "Select a supplier and add at least one product"); return; }
    const r = await api.poCreate({
      supplier_id: Number(supplierId), expected_date: expectedDate || null, notes,
      items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, rate: l.rate })),
      actorId,
    }) as { po_no: string };
    push("success", `${r.po_no} created as a draft`);
    onSaved();
    onClose();
  }

  return (
    <Modal title="New Purchase Order" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <Field label="Expected Date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <SelectField label="Add Product" value={productPick} onChange={(e) => setProductPick(e.target.value)}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <Button className="mt-5" onClick={addLine} disabled={!productPick}><Plus size={14} /></Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{l.name}</span>
              <input type="number" className="input w-20" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
              <input type="number" className="input w-24" value={l.rate} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x))} />
              <span className="w-24 text-right font-medium">{money(l.quantity * l.rate)}</span>
              <button className="text-red-400 hover:text-red-600" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-semibold"><span>Total</span><span>{money(total)}</span></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={!lines.length}>Save as Draft</Button>
      </div>
    </Modal>
  );
}

function ReceivePoModal({ po, onClose, onSaved, actorId }: { po: PurchaseOrder; onClose: () => void; onSaved: () => void; actorId: number }) {
  const { push } = useToast();
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [receiveQty, setReceiveQty] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paid, setPaid] = useState(0);

  useEffect(() => {
    api.poGet(po.id).then((d) => {
      const detail = d as { po: PurchaseOrder; items: PurchaseOrderItem[] };
      setItems(detail.items);
      const defaults: Record<number, number> = {};
      detail.items.forEach((i) => { defaults[i.id] = i.quantity - (i.received_quantity || 0); });
      setReceiveQty(defaults);
    });
  }, [po.id]);

  const total = items.reduce((a, i) => a + (receiveQty[i.id] || 0) * i.rate, 0);

  async function save() {
    const lines = items
      .filter((i) => (receiveQty[i.id] || 0) > 0)
      .map((i) => ({ po_item_id: i.id, quantity: receiveQty[i.id] }));
    if (!lines.length) { push("error", "Enter a quantity to receive for at least one item"); return; }
    try {
      const r = await api.poReceive({ po_id: po.id, items: lines, payment_method: paymentMethod, paid, actorId }) as { invoice_no: string; po_status: string };
      push("success", `Received into purchase ${r.invoice_no} — PO is now ${r.po_status.replace(/_/g, " ")}`);
      onSaved();
      onClose();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to receive purchase order");
    }
  }

  return (
    <Modal title={`Receive ${po.po_no}`} onClose={onClose} wide>
      <div className="space-y-3">
        {items.map((i) => {
          const remaining = i.quantity - (i.received_quantity || 0);
          return (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{i.product_name}</span>
              <span className="text-stone-400">ordered {i.quantity}, received {i.received_quantity || 0}</span>
              <input
                type="number" min={0} max={remaining} className="input w-24"
                value={receiveQty[i.id] ?? remaining}
                onChange={(e) => setReceiveQty({ ...receiveQty, [i.id]: Math.min(remaining, Number(e.target.value)) })}
              />
              <span className="w-24 text-right">{money((receiveQty[i.id] || 0) * i.rate)}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-3">
          <SelectField label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </SelectField>
          {paymentMethod !== "Credit" && <Field label="Paid Amount" type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />}
        </div>
        <div className="flex justify-between text-base font-semibold"><span>Receiving Total</span><span>{money(total)}</span></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>Confirm Receipt</Button>
      </div>
    </Modal>
  );
}
