import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { SelectField } from "../components/ui/Field";
import { ReceiptPreview, type ReceiptData } from "../components/ReceiptPreview";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, CartLine, Customer, PaymentMethod, Product, SaleMode, Settings } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"];

export function POS({ user, settings }: { user: AuthUser; settings: Settings }) {
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SaleMode>("Retail");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paid, setPaid] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.customersList().then((c) => setCustomers(c as Customer[]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (receipt) {
      const t = setTimeout(() => window.print(), 150);
      return () => clearTimeout(t);
    }
  }, [receipt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.name_urdu.includes(query.trim()) || (p.sku || "").toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q)
    );
  }, [products, query]);

  function priceFor(p: Product) {
    return mode === "Wholesale" ? p.wholesale_price : p.retail_price;
  }

  function addToCart(p: Product) {
    if (p.stock <= 0) { push("error", `${p.name} is out of stock`); return; }
    setCart((v) => {
      const existing = v.find((l) => l.product_id === p.id);
      if (existing) {
        if (existing.quantity + 1 > p.stock) { push("error", "Not enough stock"); return v; }
        return v.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...v, { product_id: p.id, name: p.name, name_urdu: p.name_urdu, unit: p.package_unit, quantity: 1, rate: priceFor(p), max: p.stock }];
    });
  }

  function updateQty(productId: number, qty: number) {
    setCart((v) => v.map((l) => (l.product_id === productId ? { ...l, quantity: Math.max(0, Math.min(qty, l.max ?? qty)) } : l)).filter((l) => l.quantity > 0));
  }

  const subtotal = cart.reduce((a, l) => a + l.quantity * l.rate, 0);
  const total = Math.max(0, subtotal - discount);
  const remaining = Math.max(0, total - paid);
  const selectedCustomer = customers.find((c) => String(c.id) === customerId);

  function clearCart() {
    setCart([]); setDiscount(0); setPaid(0); setCustomerId(""); setPaymentMethod("Cash");
  }

  async function saveAndPrint() {
    if (!cart.length) return;
    if (paymentMethod === "Credit" && !customerId) { push("error", "Select a customer for a credit sale"); return; }
    setBusy(true);
    try {
      const result = await api.salesCreate({
        customer_id: customerId ? Number(customerId) : null,
        mode, discount,
        payment_method: paymentMethod,
        paid: paymentMethod === "Credit" ? 0 : paid,
        items: cart.map((l) => ({ product_id: l.product_id, quantity: l.quantity, rate: l.rate })),
        actorId: user.id,
      }) as { invoice_no: string; subtotal: number; discount: number; total: number; paid: number; balance: number; sale_date: string };

      setReceipt({
        invoiceNo: result.invoice_no,
        date: new Date().toISOString(),
        cashier: user.display_name,
        customerName: selectedCustomer ? (selectedCustomer.shop_name || selectedCustomer.name) : undefined,
        customerPhone: selectedCustomer?.phone,
        mode,
        items: cart.map((l) => ({ name: l.name, qty: l.quantity, unit: l.unit, rate: l.rate, amount: l.quantity * l.rate })),
        subtotal: result.subtotal, discount: result.discount, total: result.total,
        paymentMethod, paid: result.paid, remaining: result.balance,
      });
      push("success", `Sale ${result.invoice_no} saved`);
      clearCart();
      load();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to save sale");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input className="input pl-9" placeholder="Search product — English, اردو, SKU or barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex overflow-hidden rounded-md border border-stone-300">
            {(["Retail", "Wholesale"] as SaleMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-sm font-medium ${mode === m ? "bg-brand-green-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              disabled={p.stock <= 0}
              onClick={() => addToCart(p)}
              className="flex flex-col items-start gap-0.5 rounded-card border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-green-400 hover:shadow disabled:opacity-40"
            >
              <span className="text-sm font-semibold text-brand-navy-900">{p.name}</span>
              <span className="text-xs text-stone-400" dir="rtl">{p.name_urdu}</span>
              <span className="text-xs text-stone-500">{p.package_size} {p.package_unit}</span>
              <span className="mt-1 text-sm font-medium text-brand-green-700">{money(priceFor(p))}</span>
              <span className="text-[11px] text-stone-400">{p.stock} {p.package_unit} in stock</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Current Bill</h3>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {cart.length === 0 && <p className="text-sm text-stone-400">Cart is empty</p>}
          {cart.map((l) => (
            <div key={l.product_id} className="flex items-center gap-2 rounded-md border border-stone-100 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-800">{l.name}</p>
                <p className="text-xs text-stone-400">{money(l.rate)} / {l.unit}</p>
              </div>
              <button className="rounded border border-stone-300 p-1 hover:bg-stone-50" onClick={() => updateQty(l.product_id, l.quantity - 1)}><Minus size={12} /></button>
              <span className="w-8 text-center">{l.quantity}</span>
              <button className="rounded border border-stone-300 p-1 hover:bg-stone-50" onClick={() => updateQty(l.product_id, l.quantity + 1)}><Plus size={12} /></button>
              <span className="w-20 text-right font-medium">{money(l.quantity * l.rate)}</span>
              <button className="text-red-400 hover:text-red-600" onClick={() => updateQty(l.product_id, 0)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <SelectField label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in Customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.shop_name || c.name} — {money(c.balance)}</option>)}
        </SelectField>

        <SelectField label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </SelectField>

        <label className="block">
          <span className="label">Discount</span>
          <input type="number" min={0} className="input" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </label>

        {paymentMethod !== "Credit" && (
          <label className="block">
            <span className="label">Paid Amount</span>
            <input type="number" min={0} max={total} className="input" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
          </label>
        )}

        <div className="space-y-1 border-t border-stone-100 pt-2 text-sm">
          <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between text-stone-500"><span>Discount</span><span>-{money(discount)}</span></div>
          <div className="flex justify-between text-base font-semibold text-brand-navy-900"><span>Grand Total</span><span>{money(total)}</span></div>
          <div className="flex justify-between text-stone-500"><span>Remaining</span><span>{money(paymentMethod === "Credit" ? total : remaining)}</span></div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={clearCart} disabled={!cart.length}>Clear</Button>
          <Button variant="primary" className="flex-1" onClick={saveAndPrint} disabled={!cart.length || busy}>
            <Printer size={15} /> Save &amp; Print
          </Button>
        </div>
      </div>

      {receipt && <ReceiptPreview data={receipt} settings={settings} />}
    </div>
  );
}
