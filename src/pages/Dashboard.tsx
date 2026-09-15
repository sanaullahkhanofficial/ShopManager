import React, { useEffect, useState } from "react";
import { AlertTriangle, Banknote, PackageSearch, ReceiptText, ShoppingCart, TrendingUp, Wallet, Warehouse } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { StatCard } from "../components/ui/StatCard";
import { DataTable } from "../components/ui/DataTable";
import type { DashboardData, Sale } from "../types";

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<Sale[]>([]);

  useEffect(() => {
    api.dashboard().then((d) => setData(d as DashboardData));
    api.salesList().then((s) => setRecent((s as Sale[]).slice(0, 8)));
  }, []);

  if (!data) return <p className="text-sm text-stone-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Today's Sales" value={money(data.sales)} icon={<ShoppingCart size={20} />} tone="green" />
        <StatCard label="Today's Purchases" value={money(data.purchases)} icon={<ReceiptText size={20} />} />
        <StatCard label="Today's Profit" value={money(data.profit)} icon={<TrendingUp size={20} />} tone="gold" />
        <StatCard label="Cash in Hand" value={data.registerOpen ? money(data.cashInHand) : "Register closed"} icon={<Banknote size={20} />} />
        <StatCard label="Receivables" value={money(data.receivables)} icon={<Wallet size={20} />} />
        <StatCard label="Payables" value={money(data.payables)} icon={<Wallet size={20} />} />
        <StatCard label="Stock Value" value={money(data.stockValue)} icon={<Warehouse size={20} />} />
        <StatCard label="Low Stock Items" value={String(data.low.length)} icon={<PackageSearch size={20} />} tone={data.low.length ? "danger" : "default"} />
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
