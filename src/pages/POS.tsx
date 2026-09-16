import React, { useEffect, useMemo, useRef, useState } from "react";
import { Grid2x2, List, Minus, Pause, Plus, Printer, Receipt, Search, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { SelectField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { ReceiptPreview, type ReceiptData } from "../components/ReceiptPreview";
import { useToast } from "../components/ui/Toast";
import { useLang } from "../lib/i18n";
import type { AuthUser, CartLine, Category, Customer, HeldSale, PaymentMethod, Product, Sale, SaleMode, Settings } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"];
const QUICK_TENDER = [100, 500, 1000, 5000, 10000];
// JazzCash/Easypaisa are brand names and stay untranslated; the rest map to
// real dictionary entries so the Urdu POS screen shows real Urdu labels for
// its payment method dropdown, not just the layout mirrored around English text.
const PAYMENT_METHOD_KEYS: Partial<Record<PaymentMethod, "cashMethod" | "bankTransferMethod" | "chequeMethod" | "creditMethod" | "partialMethod">> = {
  Cash: "cashMethod", "Bank Transfer": "bankTransferMethod", Cheque: "chequeMethod", Credit: "creditMethod", Partial: "partialMethod",
};

export function POS({ user, settings }: { user: AuthUser; settings: Settings }) {
  const { push } = useToast();
  const { t, lang } = useLang();
  const paymentMethodLabel = (m: PaymentMethod) => { const k = PAYMENT_METHOD_KEYS[m]; return k ? t(k) : m; };
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SaleMode>("Retail");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paid, setPaid] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [busy, setBusy] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldType, setHeldType] = useState<"HOLD" | "QUOTATION">("HOLD");
  const [held, setHeld] = useState<HeldSale[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.customersList().then((c) => setCustomers(c as Customer[]));
    api.categoriesList().then((c) => setCategories((c as Category[]).filter((x) => x.status === "active")));
  };
  useEffect(load, []);

  useEffect(() => {
    if (receipt) {
      const t = setTimeout(() => window.print(), 150);
      return () => clearTimeout(t);
    }
  }, [receipt]);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryId !== "all") list = list.filter((p) => p.category_id === categoryId);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      p.name.toLowerCase().includes(q) || p.name_urdu.includes(query.trim()) || (p.sku || "").toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q)
    );
  }, [products, query, categoryId]);

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
  const changeAmount = Math.max(0, paid - total);
  const selectedCustomer = customers.find((c) => String(c.id) === customerId);

  function clearCart() {
    setCart([]); setDiscount(0); setPaid(0); setCustomerId(""); setPaymentMethod("Cash");
  }

  function focusSearch() {
    searchRef.current?.focus();
    searchRef.current?.select();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((p) => (p.barcode || "").toLowerCase() === q || (p.sku || "").toLowerCase() === q);
    if (exact) {
      addToCart(exact);
      setQuery("");
    }
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

  async function holdBill(type: "HOLD" | "QUOTATION") {
    if (!cart.length) { push("error", "Cart is empty"); return; }
    try {
      const result = await api.heldSalesCreate({
        type, customer_id: customerId ? Number(customerId) : null, mode, discount,
        items: cart, actorId: user.id,
      }) as { hold_no: string };
      push("success", `${type === "QUOTATION" ? "Quotation" : "Bill"} ${result.hold_no} saved`);
      clearCart();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to hold bill");
    }
  }

  async function openHeldList(type: "HOLD" | "QUOTATION") {
    setHeldType(type);
    const rows = (await api.heldSalesList(type)) as HeldSale[];
    setHeld(rows);
    setHeldOpen(true);
  }

  async function resumeHeld(h: HeldSale) {
    if (cart.length && !window.confirm("Current cart is not empty. Replace it with this held bill?")) return;
    const full = (await api.heldSalesGet(h.id)) as HeldSale | null;
    if (!full) { push("error", "Held bill not found"); return; }
    setCart(full.items);
    setCustomerId(full.customer_id ? String(full.customer_id) : "");
    setMode(full.mode);
    setDiscount(full.discount);
    await api.heldSalesDelete(h.id);
    setHeldOpen(false);
    push("success", `${full.hold_no} resumed`);
  }

  async function deleteHeld(h: HeldSale) {
    if (!window.confirm(`Delete ${h.hold_no}?`)) return;
    await api.heldSalesDelete(h.id);
    setHeld((v) => v.filter((x) => x.id !== h.id));
  }

  async function openRecent() {
    const rows = (await api.salesList()) as Sale[];
    setRecentSales(rows.slice(0, 10));
    setRecentOpen(true);
  }

  async function reprint(saleId: number) {
    const data = (await api.salesGet(saleId)) as { sale: Sale & { customer_name?: string; customer_phone?: string; cashier_id?: number }; items: Array<{ product_name: string; quantity: number; unit: string; rate: number; amount: number }> };
    setReceipt({
      invoiceNo: data.sale.invoice_no,
      date: data.sale.sale_date,
      cashier: user.display_name,
      customerName: data.sale.customer_name,
      customerPhone: data.sale.customer_phone,
      mode: data.sale.mode,
      items: data.items.map((it) => ({ name: it.product_name, qty: it.quantity, unit: it.unit, rate: it.rate, amount: it.amount })),
      subtotal: data.sale.subtotal, discount: data.sale.discount, total: data.sale.total,
      paymentMethod: data.sale.payment_method, paid: data.sale.paid, remaining: data.sale.balance,
    });
    setRecentOpen(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (["F2", "F3", "F4", "F5", "F6", "F8", "F9"].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case "F2": clearCart(); focusSearch(); break;
        case "F3": holdBill("HOLD"); break;
        case "F4": openRecent(); break;
        case "F5": holdBill("QUOTATION"); break;
        case "F6": focusSearch(); break;
        case "F8": if (receipt) window.print(); break;
        case "F9": if (!busy) saveAndPrint(); break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, customerId, discount, mode, paymentMethod, paid, receipt, busy]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[160px_1fr_380px]">
      <div className="card flex flex-row gap-1 overflow-x-auto p-2 xl:flex-col xl:overflow-visible">
        <button
          onClick={() => setCategoryId("all")}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium ${categoryId === "all" ? "bg-brand-green-600 text-white" : "text-stone-600 hover:bg-stone-50"}`}
        >
          {t("products")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium ${categoryId === c.id ? "bg-brand-green-600 text-white" : "text-stone-600 hover:bg-stone-50"}`}
          >
            {lang === "ur" ? (c.name_urdu || c.name) : c.name}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              ref={searchRef}
              className="input pl-9"
              placeholder={t("posSearchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div className="flex overflow-hidden rounded-md border border-stone-300">
            {(["Retail", "Wholesale"] as SaleMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-sm font-medium ${mode === m ? "bg-brand-green-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
                {t(m === "Retail" ? "retail" : "wholesale")}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-stone-300">
            <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-brand-green-600 text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`} title={t("gridView")}><Grid2x2 size={15} /></button>
            <button onClick={() => setView("list")} className={`p-2 ${view === "list" ? "bg-brand-green-600 text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`} title={t("listView")}><List size={15} /></button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 text-[11px] text-stone-400">
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F2 {t("shortcutNew")}</span>
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F3 {t("hold")}</span>
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F4 {t("shortcutRecent")}</span>
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F5 {t("quote")}</span>
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F6 {t("shortcutSearch")}</span>
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F8 {t("shortcutPrint")}</span>
          <span className="rounded border border-stone-200 px-1.5 py-0.5">F9 {t("shortcutComplete")}</span>
        </div>

        {view === "grid" ? (
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
                <span className="text-[11px] text-stone-400">{p.stock} {p.package_unit} {t("inStock")}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-stone-400">{t("noProductsMatch")}</p>}
          </div>
        ) : (
          <div className="card divide-y divide-stone-100 p-0">
            {filtered.map((p) => (
              <button
                key={p.id}
                disabled={p.stock <= 0}
                onClick={() => addToCart(p)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-stone-50 disabled:opacity-40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-navy-900">{p.name} <span className="text-xs text-stone-400" dir="rtl">{p.name_urdu}</span></p>
                  <p className="text-xs text-stone-500">{p.package_size} {p.package_unit} &middot; {p.stock} {t("inStock")}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-medium text-brand-green-700">{money(priceFor(p))}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-stone-400">{t("noProductsMatch")}</p>}
          </div>
        )}
      </div>

      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("currentBill")}</h3>
          <div className="flex gap-1">
            <button onClick={() => openHeldList("HOLD")} className="rounded border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50" title={t("heldBillsTooltip")}><Pause size={14} /></button>
            <button onClick={openRecent} className="rounded border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50" title={t("recentBillsTooltip")}><Receipt size={14} /></button>
          </div>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {cart.length === 0 && <p className="text-sm text-stone-400">{t("cartEmpty")}</p>}
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

        <SelectField label={t("customer")} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">{t("walkInCustomer")}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.shop_name || c.name} — {money(c.balance)}</option>)}
        </SelectField>

        <SelectField label={t("paymentMethod")} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
        </SelectField>

        <label className="block">
          <span className="label">{t("discount")}</span>
          <input type="number" min={0} className="input" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </label>

        {paymentMethod !== "Credit" && (
          <>
            <label className="block">
              <span className="label">{t("paidAmount")}</span>
              <input type="number" min={0} className="input" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TENDER.map((d) => (
                <button key={d} type="button" onClick={() => setPaid((v) => v + d)} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
                  +{d}
                </button>
              ))}
              <button type="button" onClick={() => setPaid(total)} className="rounded-md border border-brand-green-300 bg-brand-green-50 px-2.5 py-1 text-xs font-medium text-brand-green-700 hover:bg-brand-green-100">
                {t("exact")}
              </button>
            </div>
          </>
        )}

        <div className="space-y-1 border-t border-stone-100 pt-2 text-sm">
          <div className="flex justify-between text-stone-500"><span>{t("subtotal")}</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between text-stone-500"><span>{t("discount")}</span><span>-{money(discount)}</span></div>
          <div className="flex justify-between text-base font-semibold text-brand-navy-900"><span>{t("grandTotal")}</span><span>{money(total)}</span></div>
          {paymentMethod !== "Credit" && paid > total ? (
            <div className="flex justify-between text-brand-green-700"><span>{t("change")}</span><span>{money(changeAmount)}</span></div>
          ) : (
            <div className="flex justify-between text-stone-500"><span>{t("remaining")}</span><span>{money(paymentMethod === "Credit" ? total : remaining)}</span></div>
          )}
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => holdBill("HOLD")} disabled={!cart.length} title="Hold Bill (F3)">
            <Pause size={15} /> {t("hold")}
          </Button>
          <Button className="flex-1" onClick={() => holdBill("QUOTATION")} disabled={!cart.length} title="Quotation (F5)">
            <Receipt size={15} /> {t("quote")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={clearCart} disabled={!cart.length}>{t("clear")}</Button>
          <Button variant="primary" className="flex-1" onClick={saveAndPrint} disabled={!cart.length || busy} title="Complete Sale (F9)">
            <Printer size={15} /> {t("saveAndPrint")}
          </Button>
        </div>
      </div>

      {receipt && <ReceiptPreview data={receipt} settings={settings} />}

      {heldOpen && (
        <Modal title={heldType === "QUOTATION" ? t("quotationsTitle") : t("heldBillsTitle")} onClose={() => setHeldOpen(false)} wide>
          <div className="mb-3 flex gap-2">
            <button onClick={() => openHeldList("HOLD")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${heldType === "HOLD" ? "bg-brand-green-600 text-white" : "border border-stone-300 text-stone-600"}`}>{t("heldBillsTitle")}</button>
            <button onClick={() => openHeldList("QUOTATION")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${heldType === "QUOTATION" ? "bg-brand-green-600 text-white" : "border border-stone-300 text-stone-600"}`}>{t("quotationsTitle")}</button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {held.length === 0 && <p className="py-6 text-center text-sm text-stone-400">{t("nothingHereYet")}</p>}
            {held.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy-900">{h.hold_no} <span className="font-normal text-stone-400">&middot; {h.customer_name || t("walkIn")}</span></p>
                  <p className="text-xs text-stone-500">{h.items.length} item(s) &middot; {t(h.mode === "Retail" ? "retail" : "wholesale")} &middot; {new Date(h.created_at).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="primary" onClick={() => resumeHeld(h)}>{t("resume")}</Button>
                  <Button variant="danger" onClick={() => deleteHeld(h)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {recentOpen && (
        <Modal title={t("recentBillsTitle")} onClose={() => setRecentOpen(false)} wide>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {recentSales.length === 0 && <p className="py-6 text-center text-sm text-stone-400">{t("noSalesYet")}</p>}
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy-900">{s.invoice_no} <span className="font-normal text-stone-400">&middot; {s.customer_name || t("walkIn")}</span></p>
                  <p className="text-xs text-stone-500">{money(s.total)} &middot; {paymentMethodLabel(s.payment_method)} &middot; {new Date(s.sale_date).toLocaleString()}</p>
                </div>
                <Button onClick={() => reprint(s.id)}><Printer size={14} /> {t("reprint")}</Button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
