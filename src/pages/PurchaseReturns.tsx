import React, { useEffect, useState } from "react";
import { FileText, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Purchase, PurchaseItem, PurchaseReturn } from "../types";

export function PurchaseReturns({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [history, setHistory] = useState<PurchaseReturn[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [batchRef, setBatchRef] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCreditNote, setLastCreditNote] = useState<{ credit_note_no: string; return_no: string; total: number } | null>(null);

  const load = () => { api.purchaseReturnsList().then((r) => setHistory(r as PurchaseReturn[])); };
  useEffect(load, []);

  async function find() {
    const list = await api.purchasesList() as Purchase[];
    const match = list.find((p) => p.invoice_no.toLowerCase() === invoiceNo.trim().toLowerCase());
    if (!match) { push("error", "Invoice not found"); return; }
    const detail = await api.purchasesGet(match.id) as { purchase: Purchase; items: PurchaseItem[] };
    setPurchase(detail.purchase);
    setItems(detail.items);
    setReturnQty({}); setBatchRef({}); setLastCreditNote(null);
  }

  async function submit() {
    if (!purchase) return;
    const lines = items
      .filter((i) => (returnQty[i.id] || 0) > 0)
      .map((i) => ({ purchase_item_id: i.id, quantity: returnQty[i.id], batch_ref: batchRef[i.id] || undefined }));
    if (!lines.length) { push("error", "Enter a return quantity for at least one item"); return; }
    setBusy(true);
    try {
      const r = await api.purchaseReturnsCreate({ purchase_id: purchase.id, items: lines, reason, actorId: user.id }) as { return_no: string; credit_note_no: string; total: number };
      push("success", `Purchase return ${r.return_no} recorded — supplier payable reduced`);
      setLastCreditNote(r);
      setPurchase(null); setItems([]); setInvoiceNo(""); setReason("");
      load();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to record return");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Purchase Returns History</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={history}
          pageSize={15}
          columns={[
            { header: "Return #", render: (r) => r.return_no },
            { header: "Invoice", render: (r) => r.original_invoice },
            { header: "Supplier", render: (r) => r.supplier_name || "—" },
            { header: "Credit Note", render: (r) => <span className="font-medium text-brand-green-700">{r.credit_note_no}</span> },
            { header: "Amount", render: (r) => money(r.total) },
            { header: "Date", render: (r) => formatDateTime(r.created_at) },
          ]}
        />
      </div>

      <div className="space-y-4">
        {lastCreditNote && (
          <div className="card space-y-1 border-brand-green-200 bg-brand-green-50">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-green-800"><FileText size={15} /> Credit Note Issued</h3>
            <p className="text-sm text-brand-green-900">
              <strong>{lastCreditNote.credit_note_no}</strong> for return {lastCreditNote.return_no} — {money(lastCreditNote.total)}
            </p>
            <p className="text-xs text-brand-green-700">The supplier's outstanding payable has been reduced by this amount.</p>
          </div>
        )}

        <div className="card space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><RotateCcw size={15} /> Purchase Return</h3>
          <div className="flex gap-2">
            <Field label="Invoice Number" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="BUY-20260915-0001" />
            <Button className="mt-5" onClick={find}>Find Invoice</Button>
          </div>

          {purchase && (
            <>
              <div className="rounded-md bg-stone-50 p-3 text-sm">
                <p><strong>{purchase.invoice_no}</strong> — {purchase.supplier_name || "—"} — Total {money(purchase.total)}</p>
              </div>
              <div className="space-y-2">
                {items.map((i) => {
                  const returnable = i.quantity - (i.returned_quantity || 0);
                  return (
                    <div key={i.id} className="space-y-1 rounded-md border border-stone-100 p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{i.product_name}</span>
                        <span className="text-xs text-stone-400">purchased {i.quantity}, returnable {returnable}</span>
                        <input
                          type="number" min={0} max={returnable} className="input w-20"
                          value={returnQty[i.id] || 0}
                          onChange={(e) => setReturnQty({ ...returnQty, [i.id]: Math.min(returnable, Number(e.target.value)) })}
                        />
                      </div>
                      {(returnQty[i.id] || 0) > 0 && (
                        <input
                          className="input py-1 text-xs" placeholder="Batch / lot reference (optional)"
                          value={batchRef[i.id] || ""} onChange={(e) => setBatchRef({ ...batchRef, [i.id]: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <p className="text-xs text-stone-400">A credit note is issued automatically and the supplier's payable is reduced the moment this is saved.</p>
              <Button variant="primary" className="w-full" onClick={submit} disabled={busy}>Save Return</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
