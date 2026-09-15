import React, { useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Sale } from "../types";

interface SaleItem { id: number; product_id: number; product_name: string; quantity: number; returned_quantity: number; rate: number }

export function SalesReturns({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [refundCash, setRefundCash] = useState(false);

  async function find() {
    const list = await api.salesList() as Sale[];
    const match = list.find((s) => s.invoice_no.toLowerCase() === invoiceNo.trim().toLowerCase());
    if (!match) { push("error", "Invoice not found"); return; }
    const detail = await api.salesGet(match.id) as { sale: Sale; items: SaleItem[] };
    setSale(detail.sale);
    setItems(detail.items);
    setReturnQty({});
  }

  async function submit() {
    if (!sale) return;
    const lines = items
      .filter((i) => (returnQty[i.id] || 0) > 0)
      .map((i) => ({ sale_item_id: i.id, quantity: returnQty[i.id] }));
    if (!lines.length) { push("error", "Enter a return quantity for at least one item"); return; }
    try {
      const r = await api.salesReturnsCreate({ sale_id: sale.id, items: lines, reason, refundCash, actorId: user.id }) as { return_no: string };
      push("success", `Sales return ${r.return_no} recorded`);
      setSale(null); setItems([]); setInvoiceNo(""); setReason("");
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to record return");
    }
  }

  return (
    <div className="card max-w-2xl space-y-4">
      <h3 className="text-sm font-semibold text-brand-navy-900">Sales Return</h3>
      <div className="flex gap-2">
        <Field label="Invoice Number" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-20260915-0001" />
        <Button className="mt-5" onClick={find}>Find Invoice</Button>
      </div>

      {sale && (
        <>
          <div className="rounded-md bg-stone-50 p-3 text-sm">
            <p><strong>{sale.invoice_no}</strong> — {sale.customer_name || "Walk-in"} — Total {money(sale.total)}</p>
          </div>
          <div className="space-y-2">
            {items.map((i) => {
              const returnable = i.quantity - (i.returned_quantity || 0);
              return (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{i.product_name}</span>
                  <span className="text-stone-400">sold {i.quantity}, returnable {returnable}</span>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={refundCash} onChange={(e) => setRefundCash(e.target.checked)} /> Refund in cash (reduces today's cash register)
          </label>
          <Button variant="primary" onClick={submit}>Save Return</Button>
        </>
      )}
    </div>
  );
}
