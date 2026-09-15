import React, { useEffect, useMemo, useState } from "react";
import { Search, Printer, Send, BookText, ArrowLeft, ClipboardCheck } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate, formatDateTime, todayIso } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { PrintableList } from "../components/PrintableList";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Aging, Supplier, SupplierStats, LedgerEntry, Purchase, PaymentMethod, PurchaseOrder, Settings } from "../types";
import type { PageId } from "../components/layout/Sidebar";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque"];

export function SupplierLedger({ user, settings, initialSupplierId, onNavigate }: {
  user: AuthUser; settings: Settings; initialSupplierId: number | null; onNavigate?: (p: PageId) => void;
}) {
  const { push } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialSupplierId);
  const [pickerQuery, setPickerQuery] = useState("");
  const [tab, setTab] = useState("ledger");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [aging, setAging] = useState<Aging | null>(null);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(todayIso());
  const [printStatement, setPrintStatement] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");

  useEffect(() => { api.suppliersList().then((s) => setSuppliers(s as Supplier[])); api.poList().then((p) => setPos(p as PurchaseOrder[])); }, []);
  useEffect(() => setSelectedId(initialSupplierId), [initialSupplierId]);

  const supplier = suppliers.find((s) => s.id === selectedId) || null;

  const loadDetail = () => {
    if (!selectedId) return;
    api.suppliersLedger(selectedId).then((r) => setLedger(r as LedgerEntry[]));
    api.suppliersAging(selectedId).then((a) => setAging(a as Aging));
    api.suppliersStats(selectedId).then((s) => setStats(s as SupplierStats));
    api.suppliersRecentPurchases(selectedId).then((p) => setPurchases(p as Purchase[]));
  };
  useEffect(loadDetail, [selectedId]);

  useEffect(() => {
    if (printStatement) { const t = setTimeout(() => window.print(), 150); return () => clearTimeout(t); }
  }, [printStatement]);

  const supplierPos = useMemo(() => pos.filter((p) => p.supplier_id === selectedId), [pos, selectedId]);

  const ledgerWithBalance = useMemo(() => {
    if (!supplier) return [];
    const asc = [...ledger].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let running = supplier.opening_balance;
    const withBalance = asc.map((r) => { running += r.direction * r.amount; return { ...r, balance: running }; });
    return withBalance.reverse().filter((r) => (!from || r.created_at >= from) && (!to || r.created_at <= `${to}T23:59:59`));
  }, [ledger, supplier, from, to]);

  async function makePayment() {
    if (!selectedId || amount <= 0) { push("error", "Enter a payment amount"); return; }
    const r = await api.paymentsAdd({ type: "supplier", entity_id: selectedId, amount, payment_method: method, note, actorId: user.id }) as { reference: string };
    push("success", `Payment ${r.reference} recorded`);
    setAmount(0); setNote("");
    loadDetail();
    api.suppliersList().then((s) => setSuppliers(s as Supplier[]));
  }

  if (!selectedId || !supplier) {
    const filtered = suppliers.filter((s) => (s.name + " " + s.phone).toLowerCase().includes(pickerQuery.toLowerCase()));
    return (
      <div className="card max-w-2xl">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><BookText size={16} /> Select a Supplier</h3>
        <div className="relative mb-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search suppliers…" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
        </div>
        <DataTable
          keyField={(r) => r.id} rows={filtered} pageSize={10}
          columns={[
            { header: "Supplier", render: (r) => r.name },
            { header: "Category", render: (r) => r.category },
            { header: "Outstanding", render: (r) => money(r.balance) },
            { header: "", render: (r) => <Button onClick={() => setSelectedId(r.id)}>Open Ledger</Button> },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button className="flex items-center gap-1 text-xs text-stone-500 hover:text-brand-navy-900" onClick={() => setSelectedId(null)}>
        <ArrowLeft size={13} /> Choose a different supplier
      </button>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-100 text-base font-semibold text-brand-green-700">
            {(supplier.name || "?").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="text-base font-semibold text-brand-navy-900">{supplier.name}</p>
            <p className="text-xs text-stone-400">{supplier.category || "Supplier"} · NTN {supplier.ntn || "—"} · {supplier.payment_term_days ? `${supplier.payment_term_days} day terms` : "No credit term"}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center text-xs">
          <div><p className="text-stone-400">Total Purchases</p><p className="font-semibold">{money(stats?.totalPurchases)}</p></div>
          <div><p className="text-stone-400">Total Payments</p><p className="font-semibold">{money(stats?.totalPayments)}</p></div>
          <div><p className="text-stone-400">Current Balance</p><p className="font-semibold text-red-600">{money(supplier.balance)}</p></div>
          <div><p className="text-stone-400">Last Purchase</p><p className="font-semibold">{stats?.lastPurchaseDate ? formatDate(stats.lastPurchaseDate) : "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Tabs
            tabs={[
              { id: "ledger", label: "Ledger" }, { id: "po", label: "Purchase Orders" },
              { id: "payments", label: "Payments" }, { id: "purchases", label: "Purchase History" }, { id: "aging", label: "Ageing Report" },
            ]}
            active={tab} onChange={setTab}
          />

          {tab === "ledger" && (
            <div className="card space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="From Date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Field label="To Date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                <Button onClick={() => setPrintStatement(true)}><Printer size={14} /> Print / Export</Button>
              </div>
              <DataTable
                keyField={(r) => r.id} rows={ledgerWithBalance} pageSize={15}
                columns={[
                  { header: "Date", render: (r) => formatDateTime(r.created_at) },
                  { header: "Reference", render: (r) => r.reference },
                  { header: "Type", render: (r) => r.type.replace(/_/g, " ") },
                  { header: "Note", render: (r) => r.note },
                  { header: "Debit (Purchase)", render: (r) => r.direction > 0 ? money(r.amount) : "" },
                  { header: "Credit (Payment)", render: (r) => r.direction < 0 ? money(r.amount) : "" },
                  { header: "Balance", render: (r) => money(r.balance) },
                ]}
              />
            </div>
          )}

          {tab === "po" && (
            <div className="card space-y-3">
              <div className="flex justify-end">
                <Button onClick={() => onNavigate?.("purchaseOrders")}><ClipboardCheck size={14} /> New Purchase Order</Button>
              </div>
              <DataTable
                keyField={(r) => r.id} rows={supplierPos} pageSize={15}
                columns={[
                  { header: "PO No.", render: (r) => r.po_no },
                  { header: "Date", render: (r) => formatDate(r.created_at) },
                  { header: "Expected", render: (r) => r.expected_date ? formatDate(r.expected_date) : "—" },
                  { header: "Status", render: (r) => <StatusBadge status={r.status} /> },
                ]}
              />
            </div>
          )}

          {tab === "payments" && (
            <div className="card">
              <DataTable
                keyField={(r) => r.id} rows={ledger.filter((l) => l.type === "PAYMENT")} pageSize={15}
                columns={[
                  { header: "Date", render: (r) => formatDateTime(r.created_at) },
                  { header: "Reference", render: (r) => r.reference },
                  { header: "Method", render: (r) => r.payment_method || "—" },
                  { header: "Amount", render: (r) => money(r.amount) },
                ]}
              />
            </div>
          )}

          {tab === "purchases" && (
            <div className="card">
              <DataTable
                keyField={(r) => r.id} rows={purchases} pageSize={15}
                columns={[
                  { header: "Invoice", render: (r) => r.invoice_no },
                  { header: "Date", render: (r) => formatDate(r.purchase_date) },
                  { header: "Total", render: (r) => money(r.total) },
                  { header: "Paid", render: (r) => money(r.paid) },
                  { header: "Balance", render: (r) => money(r.balance) },
                ]}
              />
            </div>
          )}

          {tab === "aging" && aging && (
            <div className="card grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-brand-green-50 p-3 text-center"><p className="text-xs text-stone-500">Current (0-30 days)</p><p className="text-lg font-semibold text-brand-green-700">{money(aging.current)}</p></div>
              <div className="rounded-md bg-amber-50 p-3 text-center"><p className="text-xs text-stone-500">31-60 days</p><p className="text-lg font-semibold text-amber-700">{money(aging.d31_60)}</p></div>
              <div className="rounded-md bg-orange-50 p-3 text-center"><p className="text-xs text-stone-500">61-90 days</p><p className="text-lg font-semibold text-orange-700">{money(aging.d61_90)}</p></div>
              <div className="rounded-md bg-red-50 p-3 text-center"><p className="text-xs text-stone-500">Over 90 days</p><p className="text-lg font-semibold text-red-700">{money(aging.over90)}</p></div>
            </div>
          )}
        </div>

        <div className="card h-fit space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><Send size={15} /> Make Payment</h3>
          <Field label="Amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <SelectField label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </SelectField>
          <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="primary" className="w-full" onClick={makePayment} disabled={amount <= 0}>Record Payment</Button>
        </div>
      </div>

      {printStatement && (
        <PrintableList
          title={`Supplier Statement — ${supplier.name}`} settings={settings}
          rows={ledgerWithBalance} keyField={(r) => r.id}
          columns={[
            { header: "Date", render: (r) => formatDateTime(r.created_at) },
            { header: "Reference", render: (r) => r.reference },
            { header: "Type", render: (r) => r.type.replace(/_/g, " ") },
            { header: "Debit", render: (r) => r.direction > 0 ? money(r.amount) : "" },
            { header: "Credit", render: (r) => r.direction < 0 ? money(r.amount) : "" },
            { header: "Balance", render: (r) => money(r.balance) },
          ]}
        />
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    DRAFT: "bg-stone-100 text-stone-600", SENT: "bg-blue-50 text-blue-700",
    PARTIALLY_RECEIVED: "bg-amber-50 text-amber-700", RECEIVED: "bg-brand-green-50 text-brand-green-700",
    CANCELLED: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[status] || "bg-stone-100 text-stone-600"}`}>{status.replace(/_/g, " ")}</span>;
}
