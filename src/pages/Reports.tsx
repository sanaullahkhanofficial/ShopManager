import React, { useState } from "react";
import { api } from "../lib/api";
import { money, todayIso } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { StatCard } from "../components/ui/StatCard";
import type { ReportSummary } from "../types";

export function Reports() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [r, setR] = useState<ReportSummary | null>(null);

  const run = () => api.reportsSummary({ from, to }).then((d) => setR(d as ReportSummary));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="primary" onClick={run}>Run Report</Button>
      </div>

      {r && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Sales" value={money(r.sales)} tone="green" />
            <StatCard label="Purchases" value={money(r.purchases)} />
            <StatCard label="Expenses" value={money(r.expenses)} />
            <StatCard label="Net Profit" value={money(r.netProfit)} tone="gold" />
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Profit &amp; Loss</h3>
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm md:grid-cols-2">
              <Row label="Sales Revenue" value={r.sales} />
              <Row label="Sales Returns" value={-r.salesReturns} />
              <Row label="Net Sales" value={r.netSales} bold />
              <Row label="Cost of Goods Sold" value={-r.cogs} />
              <Row label="Gross Profit" value={r.grossProfit} bold />
              <Row label={`Gross Margin ${r.grossMarginPct.toFixed(1)}%`} value={null} />
              <Row label="Operating Expenses" value={-r.expenses} />
              <Row label="Net Profit" value={r.netProfit} bold />
              <Row label={`Net Margin ${r.netMarginPct.toFixed(1)}%`} value={null} />
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Sales Breakdown</h3>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Stat label="Cash Sales" value={r.cashSales} />
              <Stat label="Credit Sales" value={r.creditSales} />
              <Stat label="Retail Sales" value={r.retailSales} />
              <Stat label="Wholesale Sales" value={r.wholesaleSales} />
            </div>
          </div>
        </>
      )}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-lg font-semibold text-brand-navy-900">{money(value)}</p>
    </div>
  );
}
