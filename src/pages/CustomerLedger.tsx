import React, { useEffect, useMemo, useState } from "react";
import { Search, Printer, Send, BookText, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate, formatDateTime, todayIso } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { PrintableList } from "../components/PrintableList";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Aging, Customer, CustomerStats, LedgerEntry, PaymentMethod, Sale, Settings } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque"];

export function CustomerLedger({ user, settings, initialCustomerId }: { user: AuthUser; settings: Settings; initialCustomerId: number | null }) {
  const { push } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialCustomerId);
  const [pickerQuery, setPickerQuery] = useState("");
  const [tab, setTab] = useState("ledger");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [aging, setAging] = useState<Aging | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(todayIso());
  const [printStatement, setPrintStatement] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");

  useEffect(() => { api.customersList().then((c) => setCustomers(c as Customer[])); }, []);
  useEffect(() => setSelectedId(initialCustomerId), [initialCustomerId]);

  const customer = customers.find((c) => c.id === selectedId) || null;

  const loadDetail = () => {
    if (!selectedId) return;
    api.customersLedger(selectedId).then((r) => setLedger(r as LedgerEntry[]));
    api.customersAging(selectedId).then((a) => setAging(a as Aging));
    api.customersStats(selectedId).then((s) => setStats(s as CustomerStats));
    api.customersRecentSales(selectedId).then((s) => setSales(s as Sale[]));
  };
  useEffect(loadDetail, [selectedId]);

  useEffect(() => {
    if (printStatement) { const t = setTimeout(() => window.print(), 150); return () => clearTimeout(t); }
  }, [printStatement]);

  // Chronological running balance: opening_balance + cumulative signed amount.
  const ledgerWithBalance = useMemo(() => {
    if (!customer) return [];
    const asc = [...ledger].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let running = customer.opening_balance;
    const withBalance = asc.map((r) => { running += r.direction * r.amount; return { ...r, balance: running }; });
    return withBalance.reverse().filter((r) => (!from || r.created_at >= from) && (!to || r.created_at <= `${to}T23:59:59`));
  }, [ledger, customer, from, to]);

  async function receivePayment() {
    if (!selectedId || amount <= 0) { push("error", "Enter a payment amount"); return; }
    const r = await api.paymentsAdd({ type: "customer", entity_id: selectedId, amount, payment_method: method, note, actorId: user.id }) as { reference: string };
    push("success", `Payment ${r.reference} recorded`);
    setAmount(0); setNote("");
    loadDetail();
    api.customersList().then((c) => setCustomers(c as Customer[]));
  }

  if (!selectedId || !customer) {
    const filtered = customers.filter((c) => (c.name + " " + c.shop_name + " " + c.phone).toLowerCase().includes(pickerQuery.toLowerCase()));
    return (
      <div className="card max-w-2xl">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><BookText size={16} /> Select a Customer</h3>
        <div className="relative mb-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search customers…" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
        </div>
        <DataTable
          keyField={(r) => r.id} rows={filtered} pageSize={10}
          columns={[
            { header: "Customer", render: (r) => r.shop_name || r.name },
            { header: "Type", render: (r) => r.customer_type },
            { header: "Balance", render: (r) => money(r.balance) },
            { header: "", render: (r) => <Button onClick={() => setSelectedId(r.id)}>Open Ledger</Button> },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button className="flex items-center gap-1 text-xs text-stone-500 hover:text-brand-navy-900" onClick={() => setSelectedId(null)}>
        <ArrowLeft size={13} /> Choose a different customer
      </button>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-100 text-base font-semibold text-brand-green-700">
            {(customer.name || "?").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="text-base font-semibold text-brand-navy-900">{customer.shop_name || customer.name}</p>
            <p className="text-xs text-stone-400">{customer.customer_type} Shop · {customer.phone}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center text-xs">
          <div><p className="text-stone-400">Total Purchases</p><p className="font-semibold">{money(stats?.totalPurchases)}</p></div>
          <div><p className="text-stone-400">Total Payments</p><p className="font-semibold">{money(stats?.totalPayments)}</p></div>
          <div><p className="text-stone-400">Current Balance</p><p className="font-semibold text-red-600">{money(customer.balance)}</p></div>
          <div><p className="text-stone-400">Last Purchase</p><p className="font-semibold">{stats?.lastPurchaseDate ? formatDate(stats.lastPurchaseDate) : "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Tabs
            tabs={[
              { id: "ledger", label: "Transaction Ledger" }, { id: "summary", label: "Account Summary" },
              { id: "payments", label: "Payment History" }, { id: "sales", label: "Sales History" }, { id: "aging", label: "Ageing Report" },
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
                  { header: "Debit", render: (r) => r.direction > 0 ? money(r.amount) : "" },
                  { header: "Credit", render: (r) => r.direction < 0 ? money(r.amount) : "" },
                  { header: "Balance", render: (r) => money(r.balance) },
                ]}
              />
            </div>
          )}

          {tab === "summary" && (
            <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-xs text-stone-400">Total Purchases</p><p className="text-lg font-semibold">{money(stats?.totalPurchases)}</p></div>
              <div><p className="text-xs text-stone-400">Total Payments</p><p className="text-lg font-semibold">{money(stats?.totalPayments)}</p></div>
              <div><p className="text-xs text-stone-400">Current Balance</p><p className="text-lg font-semibold">{money(customer.balance)}</p></div>
              <div><p className="text-xs text-stone-400">Credit Limit</p><p className="text-lg font-semibold">{money(customer.credit_limit)}</p></div>
              <div><p className="text-xs text-stone-400">Available Credit</p><p className="text-lg font-semibold">{money(Math.max(0, customer.credit_limit - customer.balance))}</p></div>
              <div><p className="text-xs text-stone-400">Total Invoices</p><p className="text-lg font-semibold">{stats?.totalInvoices ?? 0}</p></div>
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

          {tab === "sales" && (
            <div className="card">
              <DataTable
                keyField={(r) => r.id} rows={sales} pageSize={15}
                columns={[
                  { header: "Invoice", render: (r) => r.invoice_no },
                  { header: "Date", render: (r) => formatDate(r.sale_date) },
                  { header: "Mode", render: (r) => r.mode },
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
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><Send size={15} /> Receive Payment</h3>
          <Field label="Amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <SelectField label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </SelectField>
          <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="primary" className="w-full" onClick={receivePayment} disabled={amount <= 0}>Record Payment</Button>
        </div>
      </div>

      {printStatement && (
        <PrintableList
          title={`Customer Statement — ${customer.shop_name || customer.name}`} settings={settings}
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
