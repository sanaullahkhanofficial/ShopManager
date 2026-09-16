import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { AlertTriangle, Download, PackageX, TrendingDown, TrendingUp, Users, UsersRound } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate, todayIso } from "../lib/format";
import { Field } from "../components/ui/Field";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { Button } from "../components/ui/Button";
import { TrendBarChart, SplitBar } from "../components/ui/charts";
import { usePermissionSet } from "../lib/permissions";
import type { AuthUser, CustomerReportRow, InventoryReport, ReportCompare, ReportSummary, ReportTrend, SupplierReportRow, TopProductRow } from "../types";

interface Range { from: string; to: string }

function firstOfMonth() {
  return todayIso().slice(0, 8) + "01";
}

function DeltaBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-brand-green-700" : "text-red-600"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(pct).toFixed(0)}% vs last period
    </span>
  );
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="card flex flex-wrap items-end gap-3">
      <Field label="From" type="date" value={range.from} onChange={(e) => onChange({ ...range, from: e.target.value })} />
      <Field label="To" type="date" value={range.to} onChange={(e) => onChange({ ...range, to: e.target.value })} />
    </div>
  );
}

// Section 53 / reports.export permission (real since Phase 0/M, but never
// wired to anything until now): each tab renders this only when the
// signed-in role actually has reports.export, and it exports exactly the
// real data that tab already fetched and is displaying — never a second,
// separately-computed copy of the numbers.
function ExportButton({ canExport, onExport }: { canExport: boolean; onExport: () => void }) {
  if (!canExport) return null;
  return (
    <Button variant="ghost" className="text-xs" onClick={onExport}>
      <Download size={14} /> Export CSV
    </Button>
  );
}

function trendLabel(label: string, granularity: "day" | "month") {
  if (granularity === "month") {
    const [y, m] = label.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }
  return new Date(label + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function SalesRevenueTab({ range, canExport }: { range: Range; canExport: boolean }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [compare, setCompare] = useState<ReportCompare | null>(null);
  const [trend, setTrend] = useState<ReportTrend | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);

  useEffect(() => {
    api.reportsSummary(range).then((r) => setSummary(r as ReportSummary));
    api.reportsCompare(range).then((r) => setCompare(r as ReportCompare));
    api.reportsTrend(range).then((r) => setTrend(r as ReportTrend));
    api.reportsTopProducts({ ...range, limit: 10 }).then((r) => setTopProducts(r as TopProductRow[]));
  }, [range.from, range.to]);

  function exportCsv() {
    if (!summary) return;
    const summaryRows = [
      { Metric: "Sales", Value: summary.sales }, { Metric: "Net Sales", Value: summary.netSales },
      { Metric: "Cash Sales", Value: summary.cashSales }, { Metric: "Credit Sales", Value: summary.creditSales },
      { Metric: "Retail Sales", Value: summary.retailSales }, { Metric: "Wholesale Sales", Value: summary.wholesaleSales },
      { Metric: "Sales Returns", Value: summary.salesReturns }, { Metric: "Gross Margin %", Value: summary.grossMarginPct.toFixed(1) },
    ];
    const productRows = topProducts.map((p) => ({ Product: p.name, "Product (Urdu)": p.name_urdu, "Qty Sold": p.qty, Unit: p.package_unit, Revenue: p.revenue }));
    const csv = [`Sales & Revenue Report,${range.from} to ${range.to}`, "", "Summary", Papa.unparse(summaryRows), "", "Top Selling Products", Papa.unparse(productRows)].join("\n");
    api.filesSaveText({ title: "Export Sales & Revenue Report", defaultPath: `sales-report-${range.from}-to-${range.to}.csv`, content: csv });
  }

  if (!summary) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportButton canExport={canExport} onExport={exportCsv} /></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Sales" value={money(summary.sales)} hint={compare && <DeltaBadge pct={compare.deltaPct.sales} />} tone="green" />
        <StatCard label="Net Sales" value={money(summary.netSales)} />
        <StatCard label="Cash Sales" value={money(summary.cashSales)} />
        <StatCard label="Credit Sales" value={money(summary.creditSales)} tone="danger" />
        <StatCard label="Retail Sales" value={money(summary.retailSales)} />
        <StatCard label="Wholesale Sales" value={money(summary.wholesaleSales)} />
        <StatCard label="Sales Returns" value={money(summary.salesReturns)} />
        <StatCard label="Gross Margin" value={`${summary.grossMarginPct.toFixed(1)}%`} tone="gold" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Sales Trend</h3>
          {trend && trend.points.length > 0 ? (
            <TrendBarChart data={trend.points.map((p) => ({ label: trendLabel(p.label, trend.granularity), value: p.total }))} />
          ) : <p className="py-8 text-center text-sm text-stone-400">No sales in this range</p>}
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Top Selling Products</h3>
          <DataTable
            keyField={(r) => r.id}
            rows={topProducts}
            emptyLabel="No sales in this range"
            columns={[
              { header: "Product", render: (r) => <span>{r.name} <span className="text-stone-400">{r.name_urdu}</span></span> },
              { header: "Qty Sold", render: (r) => `${r.qty} ${r.package_unit}` },
              { header: "Revenue", render: (r) => money(r.revenue) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ProfitLossTab({ range, canExport }: { range: Range; canExport: boolean }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [compare, setCompare] = useState<ReportCompare | null>(null);

  useEffect(() => {
    api.reportsSummary(range).then((r) => setSummary(r as ReportSummary));
    api.reportsCompare(range).then((r) => setCompare(r as ReportCompare));
  }, [range.from, range.to]);

  function exportCsv() {
    if (!summary) return;
    const rows = [
      { Line: "Sales Revenue", Amount: summary.sales }, { Line: "Sales Returns", Amount: -summary.salesReturns },
      { Line: "Net Sales", Amount: summary.netSales }, { Line: "Cost of Goods Sold", Amount: -summary.cogs },
      { Line: "Gross Profit", Amount: summary.grossProfit }, { Line: "Gross Margin %", Amount: summary.grossMarginPct.toFixed(1) },
      { Line: "Operating Expenses", Amount: -summary.expenses }, { Line: "Net Profit", Amount: summary.netProfit },
      { Line: "Net Margin %", Amount: summary.netMarginPct.toFixed(1) },
    ];
    const csv = `Profit & Loss Statement,${range.from} to ${range.to}\n\n${Papa.unparse(rows)}`;
    api.filesSaveText({ title: "Export Profit & Loss Statement", defaultPath: `profit-loss-${range.from}-to-${range.to}.csv`, content: csv });
  }

  if (!summary) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportButton canExport={canExport} onExport={exportCsv} /></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Sales" value={money(summary.sales)} tone="green" hint={compare && <DeltaBadge pct={compare.deltaPct.sales} />} />
        <StatCard label="Gross Profit" value={money(summary.grossProfit)} hint={compare && <DeltaBadge pct={compare.deltaPct.grossProfit} />} />
        <StatCard label="Expenses" value={money(summary.expenses)} hint={compare && <DeltaBadge pct={compare.deltaPct.expenses} />} />
        <StatCard label="Net Profit" value={money(summary.netProfit)} tone="gold" hint={compare && <DeltaBadge pct={compare.deltaPct.netProfit} />} />
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Profit &amp; Loss Statement</h3>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm md:grid-cols-2">
          <Row label="Sales Revenue" value={summary.sales} />
          <Row label="Sales Returns" value={-summary.salesReturns} />
          <Row label="Net Sales" value={summary.netSales} bold />
          <Row label="Cost of Goods Sold" value={-summary.cogs} />
          <Row label="Gross Profit" value={summary.grossProfit} bold />
          <Row label={`Gross Margin ${summary.grossMarginPct.toFixed(1)}%`} value={null} />
          <Row label="Operating Expenses" value={-summary.expenses} />
          <Row label="Net Profit" value={summary.netProfit} bold />
          <Row label={`Net Margin ${summary.netMarginPct.toFixed(1)}%`} value={null} />
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-brand-navy-900">Where the Money Went</h3>
        <div>
          <p className="mb-1.5 text-xs text-stone-400">Net Sales split into Cost of Goods vs Gross Profit</p>
          <SplitBar segments={[
            { label: "Cost of Goods Sold", value: Math.max(0, summary.cogs), color: "#e34948" },
            { label: "Gross Profit", value: Math.max(0, summary.grossProfit), color: "#008300" },
          ]} />
        </div>
        <div>
          <p className="mb-1.5 text-xs text-stone-400">Gross Profit split into Expenses vs Net Profit</p>
          <SplitBar segments={[
            { label: "Expenses", value: Math.max(0, summary.expenses), color: "#e34948" },
            { label: "Net Profit", value: Math.max(0, summary.netProfit), color: "#008300" },
          ]} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number | null; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-stone-50 py-1 ${bold ? "font-semibold text-brand-navy-900" : "text-stone-600"}`}>
      <span>{label}</span>
      {value !== null && <span>{money(value)}</span>}
    </div>
  );
}

function InventoryTab({ range, canExport }: { range: Range; canExport: boolean }) {
  const [data, setData] = useState<InventoryReport | null>(null);

  useEffect(() => { api.reportsInventory(range).then((r) => setData(r as InventoryReport)); }, [range.from, range.to]);

  function exportCsv() {
    if (!data) return;
    const rows = data.products.map((p) => ({
      Product: p.name, "Product (Urdu)": p.name_urdu, Category: p.category_name || "", Stock: p.stock, Unit: p.package_unit,
      "Avg Cost": p.avg_cost, Value: p.value, Status: p.stock <= 0 ? "Out of Stock" : p.stock <= p.min_stock ? "Low" : "OK",
    }));
    api.filesSaveText({ title: "Export Inventory Report", defaultPath: `inventory-report-${range.from}-to-${range.to}.csv`, content: Papa.unparse(rows) });
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportButton canExport={canExport} onExport={exportCsv} /></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Stock Value" value={money(data.totalValue)} tone="green" />
        <StatCard label="Active Products" value={String(data.totalProducts)} />
        <StatCard label="Low Stock" value={String(data.lowCount)} tone="danger" />
        <StatCard label="Out of Stock" value={String(data.outCount)} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><TrendingUp size={15} className="text-brand-green-600" /> Fast Moving (this range)</h3>
          <DataTable
            keyField={(r) => r.id}
            rows={data.fastMoving}
            emptyLabel="No sales recorded in this range"
            columns={[
              { header: "Product", render: (r) => <span>{r.name} <span className="text-stone-400">{r.name_urdu}</span></span> },
              { header: "Qty Sold", render: (r) => `${r.qty} ${r.package_unit}` },
            ]}
          />
        </div>
        <div className="card">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><PackageX size={15} className="text-amber-500" /> Slow Moving (no sales this range)</h3>
          <DataTable
            keyField={(r) => r.id}
            rows={data.slowMoving}
            emptyLabel="Every in-stock product sold at least once in this range"
            columns={[
              { header: "Product", render: (r) => <span>{r.name} <span className="text-stone-400">{r.name_urdu}</span></span> },
              { header: "Current Stock", render: (r) => `${r.stock} ${r.package_unit}` },
            ]}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Stock Valuation</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={data.products}
          pageSize={20}
          columns={[
            { header: "Product", render: (r) => <span>{r.name} <span className="text-stone-400">{r.name_urdu}</span></span> },
            { header: "Category", render: (r) => r.category_name || "—" },
            { header: "Stock", render: (r) => `${r.stock} ${r.package_unit}` },
            { header: "Avg Cost", render: (r) => money(r.avg_cost) },
            { header: "Value", render: (r) => money(r.value) },
            { header: "Status", render: (r) => r.stock <= 0
              ? <span className="text-xs font-medium text-red-600">Out of Stock</span>
              : r.stock <= r.min_stock ? <span className="text-xs font-medium text-amber-600">Low</span>
              : <span className="text-xs text-stone-400">OK</span> },
          ]}
        />
      </div>
    </div>
  );
}

function CustomerReportTab({ range, canExport }: { range: Range; canExport: boolean }) {
  const [rows, setRows] = useState<CustomerReportRow[]>([]);
  useEffect(() => { api.reportsCustomers(range).then((r) => setRows(r as CustomerReportRow[])); }, [range.from, range.to]);

  const totalReceivables = rows.reduce((a, r) => a + Math.max(0, r.balance), 0);
  const overdueCount = rows.filter((r) => r.balance > 0).length;

  function exportCsv() {
    const csvRows = rows.map((r) => ({
      Customer: r.name, Type: r.customer_type, "Purchases (range)": r.totalPurchases, "Payments (range)": r.totalPayments,
      "Outstanding Balance": r.balance, "Last Purchase": r.lastPurchaseDate || "",
    }));
    api.filesSaveText({ title: "Export Customer Report", defaultPath: `customer-report-${range.from}-to-${range.to}.csv`, content: Papa.unparse(csvRows) });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportButton canExport={canExport} onExport={exportCsv} /></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Receivables" value={money(totalReceivables)} tone="danger" />
        <StatCard label="Customers Owing" value={String(overdueCount)} />
        <StatCard label="Top Customer" value={rows[0]?.name || "—"} />
        <StatCard label="Customers Reported" value={String(rows.length)} icon={<Users size={20} />} />
      </div>
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Customers — by Purchases in Range</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          pageSize={20}
          emptyLabel="No customers yet"
          columns={[
            { header: "Customer", render: (r) => r.name },
            { header: "Type", render: (r) => r.customer_type },
            { header: "Purchases (range)", render: (r) => money(r.totalPurchases) },
            { header: "Payments (range)", render: (r) => money(r.totalPayments) },
            { header: "Outstanding Balance", render: (r) => <span className={r.balance > 0 ? "font-medium text-red-600" : ""}>{money(r.balance)}</span> },
            { header: "Last Purchase", render: (r) => r.lastPurchaseDate ? formatDate(r.lastPurchaseDate) : "—" },
          ]}
        />
      </div>
    </div>
  );
}

function SupplierReportTab({ range, canExport }: { range: Range; canExport: boolean }) {
  const [rows, setRows] = useState<SupplierReportRow[]>([]);
  useEffect(() => { api.reportsSuppliers(range).then((r) => setRows(r as SupplierReportRow[])); }, [range.from, range.to]);

  const totalPayables = rows.reduce((a, r) => a + Math.max(0, r.balance), 0);
  const owingCount = rows.filter((r) => r.balance > 0).length;

  function exportCsv() {
    const csvRows = rows.map((r) => ({
      Supplier: r.name, Category: r.category || "", "Purchases (range)": r.totalPurchases, "Payments (range)": r.totalPayments,
      "Outstanding Payable": r.balance, "Last Purchase": r.lastPurchaseDate || "",
    }));
    api.filesSaveText({ title: "Export Supplier Report", defaultPath: `supplier-report-${range.from}-to-${range.to}.csv`, content: Papa.unparse(csvRows) });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportButton canExport={canExport} onExport={exportCsv} /></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Payables" value={money(totalPayables)} tone="danger" />
        <StatCard label="Suppliers Owed" value={String(owingCount)} />
        <StatCard label="Top Supplier" value={rows[0]?.name || "—"} />
        <StatCard label="Suppliers Reported" value={String(rows.length)} icon={<UsersRound size={20} />} />
      </div>
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Suppliers — by Purchases in Range</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          pageSize={20}
          emptyLabel="No suppliers yet"
          columns={[
            { header: "Supplier", render: (r) => r.name },
            { header: "Category", render: (r) => r.category || "—" },
            { header: "Purchases (range)", render: (r) => money(r.totalPurchases) },
            { header: "Payments (range)", render: (r) => money(r.totalPayments) },
            { header: "Outstanding Payable", render: (r) => <span className={r.balance > 0 ? "font-medium text-red-600" : ""}>{money(r.balance)}</span> },
            { header: "Last Purchase", render: (r) => r.lastPurchaseDate ? formatDate(r.lastPurchaseDate) : "—" },
          ]}
        />
      </div>
    </div>
  );
}

export function Reports({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState("sales");
  const [range, setRange] = useState<Range>({ from: firstOfMonth(), to: todayIso() });
  const perms = usePermissionSet(user.role);
  const canExport = !!perms?.has("reports.export");

  const tabs = useMemo(() => ([
    { id: "sales", label: "Sales & Revenue", icon: TrendingUp },
    { id: "pnl", label: "Profit & Loss", icon: AlertTriangle },
    { id: "inventory", label: "Inventory", icon: PackageX },
    { id: "customers", label: "Customers", icon: Users },
    { id: "suppliers", label: "Suppliers", icon: UsersRound },
  ]), []);

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <RangePicker range={range} onChange={setRange} />
      {tab === "sales" && <SalesRevenueTab range={range} canExport={canExport} />}
      {tab === "pnl" && <ProfitLossTab range={range} canExport={canExport} />}
      {tab === "inventory" && <InventoryTab range={range} canExport={canExport} />}
      {tab === "customers" && <CustomerReportTab range={range} canExport={canExport} />}
      {tab === "suppliers" && <SupplierReportTab range={range} canExport={canExport} />}
    </div>
  );
}
