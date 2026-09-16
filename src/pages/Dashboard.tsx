import React, { useEffect, useState } from "react";
import {
  AlertTriangle, Banknote, Landmark, PiggyBank, ReceiptText, ShoppingCart, TrendingUp, Wallet, Warehouse,
  Zap, Plus, Truck, UserPlus, UsersRound, Wallet2, Sun,
} from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { StatCard } from "../components/ui/StatCard";
import { DataTable } from "../components/ui/DataTable";
import { TrendBarChart, BreakdownDonut, SplitBar } from "../components/ui/charts";
import { usePermissionSet } from "../lib/permissions";
import type { AuthUser, BankAccount, CashRegisterState, DashboardData, Sale } from "../types";
import type { PageId } from "../components/layout/Sidebar";

// Each quick action jumps straight to a specific create flow, so it's gated
// by that flow's real backend permission — not the page's looser "view"
// permission a nav entry uses. "Add Customer" needs customers.create, not
// just customers.view, or a Viewer would see a button that always fails.
const QUICK_ACTIONS: Array<{ id: PageId; label: string; icon: React.ElementType; tone: string; permission: string }> = [
  { id: "pos", label: "New Sale (POS)", icon: ShoppingCart, tone: "bg-brand-green-50 text-brand-green-700", permission: "sales.create" },
  { id: "purchases", label: "New Purchase", icon: Truck, tone: "bg-blue-50 text-blue-700", permission: "purchase.create" },
  { id: "products", label: "Add Product", icon: Plus, tone: "bg-orange-50 text-orange-700", permission: "inventory.view" },
  { id: "customers", label: "Add Customer", icon: UserPlus, tone: "bg-purple-50 text-purple-700", permission: "customers.create" },
  { id: "suppliers", label: "Add Supplier", icon: UsersRound, tone: "bg-pink-50 text-pink-700", permission: "suppliers.create" },
  { id: "expenses", label: "Expense", icon: Wallet2, tone: "bg-brand-green-50 text-brand-green-700", permission: "expenses.create" },
];

// Fixed categorical color per payment method (never reassigned by rank — the
// same method always reads as the same color, whichever subset appears today).
const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#2a78d6", "Bank Transfer": "#eb6834", JazzCash: "#1baf7a", Easypaisa: "#eda100",
  Cheque: "#e87ba4", Credit: "#008300", Partial: "#4a3aa7",
};

function weekdayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" });
}

export function Dashboard({ onNavigate, user }: { onNavigate: (page: PageId) => void; user: AuthUser }) {
  const perms = usePermissionSet(user.role);
  const visibleActions = QUICK_ACTIONS.filter((a) => perms?.has(a.permission));
  const [data, setData] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<Sale[]>([]);
  const [register, setRegister] = useState<CashRegisterState | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [pettyBalance, setPettyBalance] = useState(0);

  useEffect(() => {
    api.dashboard().then((d) => setData(d as DashboardData));
    api.salesList().then((s) => setRecent((s as Sale[]).slice(0, 8)));
    api.cashCurrent().then((s) => setRegister(s as CashRegisterState | null));
    api.bankAccountsList().then((a) => setBankAccounts(a as BankAccount[]));
    api.pettyBalance().then((b) => setPettyBalance(b as number));
  }, []);

  if (!data) return <p className="text-sm text-stone-400">Loading…</p>;

  const salesHint = data.salesDeltaPct === undefined ? undefined
    : `${data.salesDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(data.salesDeltaPct).toFixed(0)}% from yesterday`;

  const totalBankBalance = bankAccounts.reduce((a, b) => a + b.balance, 0);
  const trendData = data.trend.map((t) => ({ label: weekdayLabel(t.date), value: t.total }));
  const paymentSlices = data.paymentBreakdown
    .filter((p) => p.v > 0)
    .map((p) => ({ label: p.payment_method, value: p.v, color: PAYMENT_COLORS[p.payment_method] || "#78716c" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sun size={20} className="text-brand-gold" />
          <div>
            <h2 className="text-lg font-semibold text-brand-navy-900">Good day!</h2>
            <p className="text-sm text-stone-500">Here's what's happening in your business today.</p>
          </div>
        </div>
        {visibleActions.length > 0 && (
          <div className="card w-full max-w-md sm:w-auto">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <Zap size={13} className="text-brand-gold" /> Quick Actions
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {visibleActions.map(({ id, label, icon: Icon, tone }) => (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  className={`flex flex-col items-center gap-1 rounded-md px-2 py-2.5 text-center text-[11px] font-medium transition hover:brightness-95 ${tone}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Today's Performance</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Today's Sales" value={money(data.sales)} hint={salesHint} icon={<ShoppingCart size={20} />} tone="green" />
          <StatCard label="Sales on Credit" value={money(data.salesOnCredit)} hint={`${data.salesOnCreditCount} invoices`} icon={<ReceiptText size={20} />} tone="danger" />
          <StatCard label="Today's Purchases" value={money(data.purchases)} icon={<Truck size={20} />} />
          <StatCard label="Today's Profit" value={money(data.profit)} icon={<TrendingUp size={20} />} tone="gold" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Business Position</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Cash in Hand" value={data.registerOpen ? money(data.cashInHand) : "Register closed"} icon={<Banknote size={20} />} />
          <StatCard label="Receivables" value={money(data.receivables)} icon={<Wallet size={20} />} />
          <StatCard label="Payables" value={money(data.payables)} icon={<Wallet size={20} />} />
          <StatCard label="Stock Value" value={money(data.stockValue)} icon={<Warehouse size={20} />} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Sales Trend — Last 7 Days</h3>
          <TrendBarChart data={trendData} />
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Payment Methods — Today</h3>
          {paymentSlices.length >= 2 ? (
            <BreakdownDonut data={paymentSlices} centerLabel="Today's Sales" />
          ) : paymentSlices.length === 1 ? (
            <div className="flex h-[140px] flex-col items-center justify-center text-center">
              <p className="text-2xl font-semibold text-brand-navy-900">{money(paymentSlices[0].value)}</p>
              <p className="text-xs text-stone-400">all via {paymentSlices[0].label} today</p>
            </div>
          ) : (
            <div className="flex h-[140px] items-center justify-center text-sm text-stone-400">No sales recorded yet today</div>
          )}
        </div>

        <div className="card space-y-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><Wallet size={15} /> Cash Summary</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-stone-500"><Banknote size={14} /> Cash Register</span>
              <span className={`text-xs font-medium ${register ? "text-brand-green-700" : "text-stone-400"}`}>{register ? "OPEN" : "CLOSED"}</span>
            </div>
            <p className="text-lg font-semibold text-brand-navy-900">{register ? money(register.expected) : "—"}</p>
          </div>
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-sm text-stone-500"><Landmark size={14} /> Bank Balance ({bankAccounts.length})</span>
            <p className="text-lg font-semibold text-brand-navy-900">{money(totalBankBalance)}</p>
          </div>
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-sm text-stone-500"><PiggyBank size={14} /> Petty Cash</span>
            <p className="text-lg font-semibold text-brand-navy-900">{money(pettyBalance)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Today's Mix</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SplitBar segments={[
            { label: "Retail", value: data.mix.retailSales, color: "#1f6b2a" },
            { label: "Wholesale", value: data.mix.wholesaleSales, color: "#d98e2c" },
          ]} />
          <SplitBar segments={[
            { label: "Cash", value: data.mix.cashSales, color: "#2a78d6" },
            { label: "Credit", value: data.mix.creditSales, color: "#eb6834" },
          ]} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy-900">
            <AlertTriangle size={16} className="text-amber-500" /> Low Stock
          </h3>
          <DataTable
            keyField={(r) => r.name}
            columns={[
              { header: "Product", render: (r) => <span>{r.name}<span className="ml-1 text-stone-400">{r.name_urdu}</span></span> },
              { header: "Stock", render: (r) => `${r.stock} ${r.package_unit}` },
              { header: "Minimum", render: (r) => `${r.min_stock} ${r.package_unit}` },
            ]}
            rows={data.low}
            emptyLabel="All products are above minimum stock"
          />
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Recent Bills</h3>
          <DataTable
            keyField={(r) => r.id}
            columns={[
              { header: "Invoice", render: (r) => r.invoice_no },
              { header: "Customer", render: (r) => r.customer_name || "Walk-in" },
              { header: "Total", render: (r) => money(r.total) },
              { header: "Paid", render: (r) => money(r.paid) },
              { header: "Time", render: (r) => formatDateTime(r.created_at) },
            ]}
            rows={recent}
          />
        </div>
      </div>
    </div>
  );
}
