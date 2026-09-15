import React, { useEffect, useState } from "react";
import {
  AlertTriangle, Banknote, PackageSearch, ReceiptText, ShoppingCart, TrendingUp, Wallet, Warehouse,
  Zap, Plus, Truck, UserPlus, UsersRound, Wallet2, Sun,
} from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { StatCard } from "../components/ui/StatCard";
import { DataTable } from "../components/ui/DataTable";
import type { DashboardData, Sale } from "../types";
import type { PageId } from "../components/layout/Sidebar";

const QUICK_ACTIONS: Array<{ id: PageId; label: string; icon: React.ElementType; tone: string }> = [
  { id: "pos", label: "New Sale (POS)", icon: ShoppingCart, tone: "bg-brand-green-50 text-brand-green-700" },
  { id: "purchases", label: "New Purchase", icon: Truck, tone: "bg-blue-50 text-blue-700" },
  { id: "products", label: "Add Product", icon: Plus, tone: "bg-orange-50 text-orange-700" },
  { id: "customers", label: "Add Customer", icon: UserPlus, tone: "bg-purple-50 text-purple-700" },
  { id: "suppliers", label: "Add Supplier", icon: UsersRound, tone: "bg-pink-50 text-pink-700" },
  { id: "expenses", label: "Expense", icon: Wallet2, tone: "bg-brand-green-50 text-brand-green-700" },
];

export function Dashboard({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<Sale[]>([]);

  useEffect(() => {
    api.dashboard().then((d) => setData(d as DashboardData));
    api.salesList().then((s) => setRecent((s as Sale[]).slice(0, 8)));
  }, []);

  if (!data) return <p className="text-sm text-stone-400">Loading…</p>;

  const salesHint = data.salesDeltaPct === undefined ? undefined
    : `${data.salesDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(data.salesDeltaPct).toFixed(0)}% from yesterday`;

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
        <div className="card w-full max-w-md sm:w-auto">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <Zap size={13} className="text-brand-gold" /> Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(({ id, label, icon: Icon, tone }) => (
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
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Today's Sales" value={money(data.sales)} hint={salesHint} icon={<ShoppingCart size={20} />} tone="green" />
        <StatCard label="Sales on Credit" value={money(data.salesOnCredit)} hint={`${data.salesOnCreditCount} invoices`} icon={<ReceiptText size={20} />} tone="danger" />
        <StatCard label="Today's Purchases" value={money(data.purchases)} icon={<Truck size={20} />} />
        <StatCard label="Today's Profit" value={money(data.profit)} icon={<TrendingUp size={20} />} tone="gold" />
        <StatCard label="Cash in Hand" value={data.registerOpen ? money(data.cashInHand) : "Register closed"} icon={<Banknote size={20} />} />
        <StatCard label="Receivables" value={money(data.receivables)} icon={<Wallet size={20} />} />
        <StatCard label="Payables" value={money(data.payables)} icon={<Wallet size={20} />} />
        <StatCard label="Stock Value" value={money(data.stockValue)} icon={<Warehouse size={20} />} />
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
