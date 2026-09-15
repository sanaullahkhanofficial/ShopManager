import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import type { Settings } from "../types";

export function SettingsPage({ value, onSaved }: { value: Settings; onSaved: (s: Settings) => void }) {
  const { push } = useToast();
  const [x, setX] = useState<Settings>(value);
  useEffect(() => setX(value), [value]);

  async function save() {
    const s = await api.settingsUpdate(x) as Settings;
    onSaved(s);
    push("success", "Settings saved");
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Business Identity</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Business Name" value={x.business_name} onChange={(e) => setX({ ...x, business_name: e.target.value })} />
          <Field label="Display Title" value={x.business_title} onChange={(e) => setX({ ...x, business_title: e.target.value })} />
          <Field label="Phone" value={x.phone} onChange={(e) => setX({ ...x, phone: e.target.value })} />
          <Field label="Currency" value={x.currency} onChange={(e) => setX({ ...x, currency: e.target.value })} />
          <div className="sm:col-span-2"><Field label="Address" value={x.address} onChange={(e) => setX({ ...x, address: e.target.value })} /></div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Invoice &amp; Printer</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Invoice Prefix" value={x.invoice_prefix} onChange={(e) => setX({ ...x, invoice_prefix: e.target.value })} />
          <Field label="Invoice Footer" value={x.invoice_footer} onChange={(e) => setX({ ...x, invoice_footer: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={x.print_customer_copy !== "0"} onChange={(e) => setX({ ...x, print_customer_copy: e.target.checked ? "1" : "0" })} /> Print Customer Copy</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={x.print_office_copy !== "0"} onChange={(e) => setX({ ...x, print_office_copy: e.target.checked ? "1" : "0" })} /> Print Office Copy</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={x.auto_cut !== "0"} onChange={(e) => setX({ ...x, auto_cut: e.target.checked ? "1" : "0" })} /> Auto Cut</label>
        </div>
        <p className="text-xs text-stone-400">58mm receipts print via the browser dialog today. Native ESC/POS USB printing for the Tauri desktop build is tracked in ROADMAP.md.</p>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Inventory</h3>
        <Field label="Default Low Stock Threshold" type="number" value={x.low_stock_default} onChange={(e) => setX({ ...x, low_stock_default: e.target.value })} />
      </div>

      <Button variant="primary" onClick={save}><Save size={15} /> Save Settings</Button>
    </div>
  );
}
