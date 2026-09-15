import React, { useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Purchase } from "../types";

interface PurchaseItem { id: number; product_id: number; product_name: string; quantity: number; returned_quantity: number; rate: number }

export function PurchaseReturns({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");

  async function find() {
    const list = await api.purchasesList() as Purchase[];
    const match = list.find((p) => p.invoice_no.toLowerCase() === invoiceNo.trim().toLowerCase());
    if (!match) { push("error", "Invoice not found"); return; }
    const detail = await api.purchasesGet(match.id) as { purchase: Purchase; items: PurchaseItem[] };
    setPurchase(detail.purchase);
    setItems(detail.items);
    setReturnQty({});
  }

  async function submit() {
    if (!purchase) return;
    const lines = items
      .filter((i) => (returnQty[i.id] || 0) > 0)
      .map((i) => ({ purchase_item_id: i.id, quantity: returnQty[i.id] }));
    if (!lines.length) { push("error", "Enter a return quantity for at least one item"); return; }
    try {
      const r = await api.purchaseReturnsCreate({ purchase_id: purchase.id, items: lines, reason, actorId: user.id }) as { return_no: string };
      push("success", `Purchase return ${r.return_no} recorded — supplier payable reduced`);
      setPurchase(null); setItems([]); setInvoiceNo(""); setReason("");
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to record return");
    }
  }

  return (
    <div className="card max-w-2xl space-y-4">
      <h3 className="text-sm font-semibold text-brand-navy-900">Purchase Return</h3>
      <div className="flex gap-2">
        <Field label="Invoice Number" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="PUR-20260915-0001" />
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
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{i.product_name}</span>
                  <span className="text-stone-400">purchased {i.quantity}, returnable {returnable}</span>
                  <input
                    type="number" min={0} max={returnable} className="input w-20"
                    value={returnQty[i.id] || 0}
                    onChange={(e) => setReturnQty({ ...returnQty, [i.id]: Math.min(returnable, Number(e.target.value)) })}
                  />
                </div>
              );
            })}
          </div>
          <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="primary" onClick={submit}>Save Return</Button>
        </>
      )}
    </div>
  );
}
