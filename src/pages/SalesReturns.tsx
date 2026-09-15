import React, { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, PaymentMethod, Product, ReturnType, Sale, SaleItem, SalesReturn } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"];

interface ExchangeLine { product_id: number; name: string; unit: string; quantity: number; rate: number }

function TypeBadge({ type }: { type: ReturnType }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${type === "Exchange" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
      {type}
    </span>
  );
}

export function SalesReturns({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [history, setHistory] = useState<SalesReturn[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [batchRef, setBatchRef] = useState<Record<number, string>>({});
  const [returnType, setReturnType] = useState<ReturnType>("Refund");
  const [reason, setReason] = useState("");
  const [refundCash, setRefundCash] = useState(false);

  const [exchangeLines, setExchangeLines] = useState<ExchangeLine[]>([]);
  const [productPick, setProductPick] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.salesReturnsList().then((r) => setHistory(r as SalesReturn[]));
    api.productsList().then((p) => setProducts(p as Product[]));
  };
  useEffect(load, []);

  async function find() {
    const list = await api.salesList() as Sale[];
    const match = list.find((s) => s.invoice_no.toLowerCase() === invoiceNo.trim().toLowerCase());
    if (!match) { push("error", "Invoice not found"); return; }
    const detail = await api.salesGet(match.id) as { sale: Sale; items: SaleItem[] };
    setSale(detail.sale);
    setItems(detail.items);
    setReturnQty({}); setBatchRef({}); setExchangeLines([]);
  }

  function resetAll() {
    setSale(null); setItems([]); setInvoiceNo(""); setReason(""); setRefundCash(false);
    setReturnType("Refund"); setExchangeLines([]); setPaid(0); setPaymentMethod("Cash");
  }

  const returnTotal = items.reduce((a, i) => a + (returnQty[i.id] || 0) * i.rate, 0);

  function addExchangeLine() {
    const p = products.find((x) => String(x.id) === productPick);
    if (!p) return;
    setExchangeLines((v) => {
      if (v.some((l) => l.product_id === p.id)) return v;
      return [...v, { product_id: p.id, name: p.name, unit: p.package_unit, quantity: 1, rate: sale?.mode === "Wholesale" ? p.wholesale_price : p.retail_price }];
    });
    setProductPick("");
  }

  const exchangeSubtotal = exchangeLines.reduce((a, l) => a + l.quantity * l.rate, 0);
  const netAmount = exchangeSubtotal - returnTotal;
  const amountDue = Math.max(0, netAmount);
  const remainingCredit = Math.max(0, -netAmount);

  async function submit() {
    if (!sale) return;
    const lines = items
      .filter((i) => (returnQty[i.id] || 0) > 0)
      .map((i) => ({ sale_item_id: i.id, quantity: returnQty[i.id], batch_ref: batchRef[i.id] || undefined }));
    if (!lines.length) { push("error", "Enter a return quantity for at least one item"); return; }
    if (returnType === "Exchange" && !exchangeLines.length) { push("error", "Add at least one replacement product for the exchange"); return; }
    setBusy(true);
    try {
      const ret = await api.salesReturnsCreate({
        sale_id: sale.id, items: lines, reason, returnType,
        refundCash: returnType === "Refund" && refundCash,
        actorId: user.id,
      }) as { return_no: string };

      if (returnType === "Exchange" && exchangeLines.length) {
        const exchangeResult = await api.salesCreate({
          customer_id: sale.customer_id, mode: sale.mode,
          discount: Math.min(returnTotal, exchangeSubtotal),
          payment_method: paymentMethod, paid: paymentMethod === "Credit" ? 0 : paid,
          items: exchangeLines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, rate: l.rate })),
          actorId: user.id,
        }) as { invoice_no: string };
        push("success", `Return ${ret.return_no} recorded — exchanged into new invoice ${exchangeResult.invoice_no}${remainingCredit > 0 ? ` (Rs. ${remainingCredit.toLocaleString()} store credit remaining — settle separately)` : ""}`);
      } else {
        push("success", `Sales return ${ret.return_no} recorded`);
      }
      resetAll();
      load();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to record return");
    } finally {
      setBusy(false);
    }
  }

  const availableProducts = useMemo(() => products.filter((p) => !exchangeLines.some((l) => l.product_id === p.id)), [products, exchangeLines]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_440px]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Sales Returns History</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={history}
          pageSize={15}
          columns={[
            { header: "Return #", render: (r) => r.return_no },
            { header: "Invoice", render: (r) => r.original_invoice },
            { header: "Customer", render: (r) => r.customer_name || "Walk-in" },
            { header: "Type", render: (r) => <TypeBadge type={r.return_type} /> },
            { header: "Amount", render: (r) => money(r.total) },
            { header: "Refunded", render: (r) => r.refund_cash > 0 ? money(r.refund_cash) : "—" },
            { header: "Date", render: (r) => formatDateTime(r.created_at) },
          ]}
        />
      </div>

      <div className="card space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><RotateCcw size={15} /> Sales Return</h3>
        <div className="flex gap-2">
          <Field label="Invoice Number" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="SLS-20260915-0001" />
          <Button className="mt-5" onClick={find}>Find Invoice</Button>
        </div>

        {sale && (
          <>
            <div className="rounded-md bg-stone-50 p-3 text-sm">
              <p><strong>{sale.invoice_no}</strong> — {sale.customer_name || "Walk-in"} — Total {money(sale.total)}</p>
            </div>

            <div className="flex overflow-hidden rounded-md border border-stone-300">
              {(["Refund", "Exchange"] as ReturnType[]).map((t) => (
                <button key={t} onClick={() => setReturnType(t)} className={`flex-1 px-3 py-2 text-sm font-medium ${returnType === t ? "bg-brand-green-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {items.map((i) => {
                const returnable = i.quantity - (i.returned_quantity || 0);
                return (
                  <div key={i.id} className="space-y-1 rounded-md border border-stone-100 p-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{i.product_name}</span>
                      <span className="text-xs text-stone-400">sold {i.quantity}, returnable {returnable}</span>
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

            {returnType === "Refund" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={refundCash} onChange={(e) => setRefundCash(e.target.checked)} /> Refund in cash (reduces today's cash register)
              </label>
            ) : (
              <div className="space-y-3 rounded-card border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">Return Credit: {money(returnTotal)} — pick replacement product(s)</p>
                <div className="flex gap-2">
                  <SelectField label="Add Product" value={productPick} onChange={(e) => setProductPick(e.target.value)}>
                    <option value="">Select product</option>
                    {availableProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </SelectField>
                  <Button className="mt-5" onClick={addExchangeLine} disabled={!productPick} title="Add product"><Plus size={15} /></Button>
                </div>
                <div className="space-y-1.5">
                  {exchangeLines.map((l, i) => (
                    <div key={l.product_id} className="flex items-center gap-2 rounded-md bg-white p-2 text-sm shadow-sm">
                      <span className="flex-1 truncate">{l.name}</span>
                      <input type="number" min={1} className="input w-16 py-1 text-right" value={l.quantity} onChange={(e) => setExchangeLines(exchangeLines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                      <input type="number" min={0} className="input w-20 py-1 text-right" value={l.rate} onChange={(e) => setExchangeLines(exchangeLines.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x))} />
                      <span className="w-20 text-right font-medium">{money(l.quantity * l.rate)}</span>
                      <button className="text-red-400 hover:text-red-600" onClick={() => setExchangeLines(exchangeLines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {exchangeLines.length === 0 && <p className="py-2 text-center text-xs text-stone-400">No replacement items yet</p>}
                </div>
                <div className="space-y-1 border-t border-amber-200 pt-2 text-sm">
                  <div className="flex justify-between text-stone-600"><span>Exchange Subtotal</span><span>{money(exchangeSubtotal)}</span></div>
                  <div className="flex justify-between text-stone-600"><span>Return Credit Applied</span><span>-{money(Math.min(returnTotal, exchangeSubtotal))}</span></div>
                  {amountDue > 0 && <div className="flex justify-between text-base font-semibold text-brand-navy-900"><span>Amount Due</span><span>{money(amountDue)}</span></div>}
                  {remainingCredit > 0 && <div className="flex justify-between text-base font-semibold text-brand-green-700"><span>Remaining Store Credit</span><span>{money(remainingCredit)}</span></div>}
                </div>
                {amountDue > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </SelectField>
                    {paymentMethod !== "Credit" && <Field label="Paid Amount" type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />}
                  </div>
                )}
              </div>
            )}

            <Button variant="primary" className="w-full" onClick={submit} disabled={busy}>
              {returnType === "Exchange" ? "Complete Exchange" : "Save Return"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
