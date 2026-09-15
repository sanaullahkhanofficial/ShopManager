import React, { useEffect, useState } from "react";
import {
  Building2, SlidersHorizontal, Printer, CreditCard, Percent, Warehouse,
  Bell, DatabaseBackup, Plug, Settings as SettingsIcon, Save, RotateCcw,
  Plus, Eye, Image as ImageIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField, TextAreaField } from "../components/ui/Field";
import { Switch } from "../components/ui/Switch";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { ReceiptPreview, type ReceiptData } from "../components/ReceiptPreview";
import type { Settings, Location } from "../types";

const TABS = [
  { id: "business", label: "Business Profile", icon: Building2 },
  { id: "system", label: "System Settings", icon: SlidersHorizontal },
  { id: "invoice", label: "Invoice & Print", icon: Printer },
  { id: "payment", label: "Payment Methods", icon: CreditCard },
  { id: "tax", label: "Tax & Discounts", icon: Percent },
  { id: "locations", label: "Locations & Warehouses", icon: Warehouse },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "backup", label: "Backup & Data", icon: DatabaseBackup },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "preferences", label: "System Preferences", icon: SettingsIcon },
];

const on = (v?: string) => v !== "0";
const flag = (b: boolean) => (b ? "1" : "0");

const SAMPLE_RECEIPT: ReceiptData = {
  invoiceNo: "INV-20260915-0001", date: new Date().toISOString(), cashier: "Administrator",
  customerName: "Ali Khan General Store", customerPhone: "0333-1234567", mode: "Wholesale",
  items: [
    { name: "Sona Urea", qty: 5, unit: "KG", rate: 5600, amount: 28000 },
    { name: "Chakki Atta Punjab", qty: 10, unit: "KG", rate: 3700, amount: 37000 },
  ],
  subtotal: 65000, discount: 1000, total: 64000, paymentMethod: "Cash", paid: 64000, remaining: 0,
};

export function SettingsPage({ value, onSaved }: { value: Settings; onSaved: (s: Settings) => void }) {
  const { push } = useToast();
  const [x, setX] = useState<Settings>(value);
  const [tab, setTab] = useState("business");
  const [preview, setPreview] = useState(false);
  useEffect(() => setX(value), [value]);

  const update = (patch: Record<string, string>) => setX((v) => ({ ...v, ...patch } as Settings));

  async function save() {
    const s = await api.settingsUpdate(x) as Settings;
    onSaved(s);
    push("success", "Settings saved");
  }
  function reset() {
    setX(value);
    push("info", "Changes reverted to last saved settings");
  }

  async function pickLogo() {
    const p = await api.imagesPick();
    if (p) update({ logo_path: p });
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div className="hidden shrink-0 gap-2 sm:flex">
          <Button onClick={reset}><RotateCcw size={14} /> Reset</Button>
          <Button variant="primary" onClick={save}><Save size={14} /> Save Changes</Button>
        </div>
      </div>

      {tab === "business" && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-brand-navy-900">Business Information</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Business Name" value={x.business_name} onChange={(e) => update({ business_name: e.target.value })} />
            <Field label="Business Type" value={x.business_type} onChange={(e) => update({ business_type: e.target.value })} />
            <Field label="Owner Name" value={x.owner_name || ""} onChange={(e) => update({ owner_name: e.target.value })} />
            <Field label="CNIC / NTN" value={x.cnic || ""} onChange={(e) => update({ cnic: e.target.value })} />
            <Field label="Phone Number" value={x.phone} onChange={(e) => update({ phone: e.target.value })} />
            <Field label="Email Address" type="email" value={x.email || ""} onChange={(e) => update({ email: e.target.value })} />
            <Field label="Currency" value={x.currency} onChange={(e) => update({ currency: e.target.value })} />
            <Field label="Time Zone" value={x.timezone || "Asia/Karachi"} onChange={(e) => update({ timezone: e.target.value })} />
            <div className="sm:col-span-2"><TextAreaField label="Address" value={x.address} onChange={(e) => update({ address: e.target.value })} /></div>
            <div className="sm:col-span-2"><TextAreaField label="Business Description" value={x.business_description || ""} onChange={(e) => update({ business_description: e.target.value })} /></div>
          </div>
          <div>
            <span className="label">Business Logo</span>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                {x.logo_path ? <img src={`file://${x.logo_path}`} className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-stone-300" />}
              </div>
              <Button onClick={pickLogo}>Change Logo</Button>
              {x.logo_path && <Button onClick={() => update({ logo_path: "" })}>Remove</Button>}
            </div>
          </div>
        </div>
      )}

      {tab === "system" && (
        <div className="space-y-4">
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label="Default Language" value={x.language} onChange={(e) => update({ language: e.target.value })}>
              <option value="en">English</option><option value="ur">اردو</option><option value="en-ur">English + اردو</option>
            </SelectField>
            <SelectField label="Date Format" value={x.date_format || "DD MMM YYYY"} onChange={(e) => update({ date_format: e.target.value })}>
              <option>DD MMM YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option>
            </SelectField>
            <SelectField label="Time Format" value={x.time_format || "12"} onChange={(e) => update({ time_format: e.target.value })}>
              <option value="12">12 Hour (AM/PM)</option><option value="24">24 Hour</option>
            </SelectField>
            <SelectField label="Fiscal Year Start Month" value={x.fiscal_year_start_month || "January"} onChange={(e) => update({ fiscal_year_start_month: e.target.value })}>
              {["January", "April", "July", "October"].map((m) => <option key={m}>{m}</option>)}
            </SelectField>
          </div>
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-brand-navy-900">Feature Toggles</h3>
            {[
              ["enable_batch_tracking", "Enable Product Batch/Expiry Reference"],
              ["enable_low_stock_alerts", "Enable Low Stock Alerts"],
              ["enable_sales_return", "Enable Sales Return"],
              ["enable_purchase_return", "Enable Purchase Return"],
              ["enable_customer_credit", "Enable Customer Credit"],
              ["enable_supplier_credit", "Enable Supplier Credit"],
              ["show_purchase_price_to_sales", "Show Purchase Price to Sales Staff"],
              ["enable_multi_location", "Enable Multi-Location Stock Selector (POS/Purchases)"],
            ].map(([key, label]) => (
              <Switch key={key} checked={on(x[key])} onChange={(v) => update({ [key]: flag(v) })} label={label} />
            ))}
            <p className="text-xs text-stone-400">
              Multi-location stock tracking already works in the database (Phase 0); this toggle controls whether POS and
              Purchases show a location picker — that UI lands in Phases F/G.
            </p>
          </div>
        </div>
      )}

      {tab === "invoice" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-brand-navy-900">Invoice &amp; Print Settings</h3>
            <SelectField label="Invoice Template" value={x.invoice_template || "Standard"} onChange={(e) => update({ invoice_template: e.target.value })}>
              {["Standard", "Modern", "Minimal", "Compact (Thermal)"].map((t) => <option key={t}>{t}</option>)}
            </SelectField>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice Prefix (Sales)" value={x.invoice_prefix} onChange={(e) => update({ invoice_prefix: e.target.value.toUpperCase() })} />
              <Field label="Invoice Prefix (Purchase)" value={x.invoice_prefix_purchase || "PUR"} onChange={(e) => update({ invoice_prefix_purchase: e.target.value.toUpperCase() })} />
            </div>
            <SelectField label="Invoice Size" value={x.invoice_size || "A4"} onChange={(e) => update({ invoice_size: e.target.value })}>
              <option>A4</option><option>58mm Thermal</option>
            </SelectField>
            <Switch checked={on(x.show_logo_on_invoice)} onChange={(v) => update({ show_logo_on_invoice: flag(v) })} label="Show Business Logo on Invoice" />
            <Switch checked={on(x.show_barcode_on_invoice)} onChange={(v) => update({ show_barcode_on_invoice: flag(v) })} label="Show Barcode on Invoice" />
            <Switch checked={on(x.show_terms_on_invoice)} onChange={(v) => update({ show_terms_on_invoice: flag(v) })} label="Show Terms &amp; Conditions" />
            <Switch checked={on(x.show_thankyou_on_invoice)} onChange={(v) => update({ show_thankyou_on_invoice: flag(v) })} label="Show Thank You Message" />
            <Field label="Footer Text" value={x.invoice_footer} onChange={(e) => update({ invoice_footer: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button onClick={() => setPreview(true)}><Eye size={14} /> Preview Invoice</Button>
              <Button onClick={() => { setPreview(true); setTimeout(() => window.print(), 200); }}><Printer size={14} /> Print Test Invoice</Button>
            </div>
            <p className="text-xs text-stone-400">
              Full ESC/POS printer configuration, live A4-style invoice preview and 58mm dual-token print layout live on the
              dedicated Invoice &amp; Thermal Printer Settings page (Phase N).
            </p>
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold text-brand-navy-900">Customer/Office Copy Printing</h3>
            <div className="space-y-2 text-sm">
              <Switch checked={on(x.print_customer_copy)} onChange={(v) => update({ print_customer_copy: flag(v) })} label="Print Customer Copy" />
              <Switch checked={on(x.print_office_copy)} onChange={(v) => update({ print_office_copy: flag(v) })} label="Print Office Copy" />
              <Switch checked={on(x.auto_cut)} onChange={(v) => update({ auto_cut: flag(v) })} label="Auto Cut (58mm printer, when supported)" />
            </div>
          </div>
        </div>
      )}

      {tab === "payment" && <PaymentMethodsPanel />}

      {tab === "tax" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card space-y-3">
            <Switch checked={on(x.sales_tax_enabled)} onChange={(v) => update({ sales_tax_enabled: flag(v) })} label="Enable Sales Tax" />
            <Field label="Sales Tax Rate (%)" type="number" value={x.sales_tax_rate || "0"} onChange={(e) => update({ sales_tax_rate: e.target.value })} disabled={!on(x.sales_tax_enabled)} />
          </div>
          <div className="card space-y-3">
            <Switch checked={on(x.purchase_tax_enabled)} onChange={(v) => update({ purchase_tax_enabled: flag(v) })} label="Enable Purchase Tax" />
            <Field label="Purchase Tax Rate (%)" type="number" value={x.purchase_tax_rate || "0"} onChange={(e) => update({ purchase_tax_rate: e.target.value })} disabled={!on(x.purchase_tax_enabled)} />
          </div>
          <div className="card space-y-3">
            <Switch checked={on(x.discount_sales_enabled)} onChange={(v) => update({ discount_sales_enabled: flag(v) })} label="Enable Discount on Sales" />
            <Field label="Maximum Discount (%)" type="number" value={x.discount_sales_max_pct || "10"} onChange={(e) => update({ discount_sales_max_pct: e.target.value })} disabled={!on(x.discount_sales_enabled)} />
          </div>
          <div className="card space-y-3">
            <Switch checked={on(x.discount_purchase_enabled)} onChange={(v) => update({ discount_purchase_enabled: flag(v) })} label="Enable Discount on Purchase" />
            <Field label="Maximum Discount (%)" type="number" value={x.discount_purchase_max_pct || "10"} onChange={(e) => update({ discount_purchase_max_pct: e.target.value })} disabled={!on(x.discount_purchase_enabled)} />
          </div>
        </div>
      )}

      {tab === "locations" && <LocationsPanel />}

      {tab === "notifications" && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-brand-navy-900">Automatic Notifications</h3>
          <Switch checked={on(x.notify_low_stock)} onChange={(v) => update({ notify_low_stock: flag(v) })} label="Low Stock Alerts" />
          <Switch checked={on(x.notify_overdue_receivables)} onChange={(v) => update({ notify_overdue_receivables: flag(v) })} label="Overdue Receivable Alerts (90+ days)" />
          <p className="text-xs text-stone-400">These generate the notifications shown in the bell menu at the top of every page.</p>
        </div>
      )}

      {tab === "backup" && <BackupPanel settings={x} update={update} />}

      {tab === "integrations" && (
        <div className="space-y-4">
          <div className="card">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Not connected yet. These fields save your provider details, but SMS/WhatsApp/Email sending is not implemented
              in this build — the "Send SMS/WhatsApp/Email" buttons elsewhere in the app will say so until a provider is wired up.
            </p>
          </div>
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-brand-navy-900 sm:col-span-2">SMS &amp; WhatsApp</h3>
            <Field label="SMS Provider" value={x.sms_provider || ""} onChange={(e) => update({ sms_provider: e.target.value })} placeholder="e.g. Twilio" />
            <Field label="SMS API Key" type="password" value={x.sms_api_key || ""} onChange={(e) => update({ sms_api_key: e.target.value })} />
            <Field label="WhatsApp Provider" value={x.whatsapp_provider || ""} onChange={(e) => update({ whatsapp_provider: e.target.value })} placeholder="e.g. WhatsApp Business API" />
            <Field label="WhatsApp API Key" type="password" value={x.whatsapp_api_key || ""} onChange={(e) => update({ whatsapp_api_key: e.target.value })} />
          </div>
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-brand-navy-900 sm:col-span-2">Email (SMTP)</h3>
            <Field label="SMTP Host" value={x.email_smtp_host || ""} onChange={(e) => update({ email_smtp_host: e.target.value })} />
            <Field label="SMTP Port" value={x.email_smtp_port || ""} onChange={(e) => update({ email_smtp_port: e.target.value })} />
            <Field label="SMTP Username" value={x.email_smtp_user || ""} onChange={(e) => update({ email_smtp_user: e.target.value })} />
            <Field label="SMTP Password" type="password" value={x.email_smtp_pass || ""} onChange={(e) => update({ email_smtp_pass: e.target.value })} />
          </div>
        </div>
      )}

      {tab === "preferences" && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-brand-navy-900">System Preferences</h3>
          <div>
            <Switch checked={on(x.allow_negative_stock)} onChange={(v) => update({ allow_negative_stock: flag(v) })} label="Allow Negative Stock" />
            <p className="mt-1 text-xs text-stone-400">
              Off by default (Section 47): sales, purchases and adjustments that would push stock below zero are rejected.
              Turning this on lets the shop record a sale before stock is physically counted in — use with care.
            </p>
          </div>
          <SelectField label="Default Sale Mode in POS" value={x.default_sale_mode || "Retail"} onChange={(e) => update({ default_sale_mode: e.target.value })}>
            <option>Retail</option><option>Wholesale</option>
          </SelectField>
        </div>
      )}

      <div className="flex gap-2 sm:hidden">
        <Button className="flex-1" onClick={reset}>Reset</Button>
        <Button variant="primary" className="flex-1" onClick={save}>Save Changes</Button>
      </div>

      {preview && (
        <Modal title="Invoice Preview" onClose={() => setPreview(false)} wide>
          <div className="rounded-md bg-stone-100 p-4">
            <ReceiptPreview data={SAMPLE_RECEIPT} settings={x} variant="visible" />
          </div>
          <p className="mt-3 text-center text-xs text-stone-400">Sample data — actual invoices use the real sale.</p>
        </Modal>
      )}
      {/* Hidden print-only copy kept in the DOM so "Print Test Invoice" has something to print. */}
      {preview && <ReceiptPreview data={SAMPLE_RECEIPT} settings={x} />}
    </div>
  );
}

function PaymentMethodsPanel() {
  const { push } = useToast();
  const [rows, setRows] = useState<Array<{ id: number; name: string; status: string }>>([]);
  const [name, setName] = useState("");
  const load = () => api.paymentMethodsList().then((r) => setRows(r as typeof rows));
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await api.paymentMethodsSave({ name: name.trim() });
    push("success", "Payment method added");
    setName("");
    load();
  }
  async function toggle(row: { id: number; name: string; status: string }) {
    await api.paymentMethodsSave({ id: row.id, name: row.name, status: row.status === "active" ? "inactive" : "active" });
    load();
  }

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold text-brand-navy-900">Payment Methods</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Payment Method", render: (r) => r.name },
          { header: "Status", render: (r) => (
            <Switch checked={r.status === "active"} onChange={() => toggle(r)} />
          ) },
        ]}
      />
      <div className="flex gap-2">
        <Field label="Add Payment Method" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Money Order" />
        <Button className="mt-5" onClick={add} disabled={!name.trim()}><Plus size={14} /> Add</Button>
      </div>
    </div>
  );
}

function LocationsPanel() {
  const { push } = useToast();
  const [rows, setRows] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("Store");
  const load = () => api.locationsList().then((r) => setRows(r as Location[]));
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await api.locationsSave({ name: name.trim(), type });
    push("success", "Location added");
    setName("");
    load();
  }
  async function toggle(row: Location) {
    await api.locationsSave({ id: row.id, name: row.name, type: row.type, status: row.status === "active" ? "inactive" : "active" });
    load();
  }

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold text-brand-navy-900">Locations &amp; Warehouses</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Location / Warehouse", render: (r) => r.name },
          { header: "Type", render: (r) => r.type },
          { header: "Status", render: (r) => <Switch checked={r.status === "active"} onChange={() => toggle(r)} /> },
        ]}
      />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Add Location" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Godown" />
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option>Store</option><option>Warehouse</option><option>Cold Storage</option>
        </SelectField>
        <Button onClick={add} disabled={!name.trim()}><Plus size={14} /> Add Location</Button>
      </div>
    </div>
  );
}

function BackupPanel({ settings, update }: { settings: Settings; update: (p: Record<string, string>) => void }) {
  const { push } = useToast();
  const [status, setStatus] = useState<{ enabled: boolean; frequency: string; lastBackupAt: string | null; autoBackupCount: number } | null>(null);
  useEffect(() => { api.backupAutoStatus().then((s) => setStatus(s as typeof status)); }, []);

  async function backupNow() {
    const p = await api.backupCreate();
    if (p) push("success", "Backup saved");
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-brand-navy-900">Backup &amp; Data Management</h3>
      <Switch checked={on(settings.auto_backup_enabled)} onChange={(v) => update({ auto_backup_enabled: flag(v) })} label="Auto Backup (runs once per day the app is opened)" />
      <SelectField label="Backup Frequency" value={settings.auto_backup_frequency || "Daily"} onChange={(e) => update({ auto_backup_frequency: e.target.value })}>
        <option>Daily</option><option>Weekly</option>
      </SelectField>
      {status && (
        <p className="text-xs text-stone-400">
          Last automatic backup: {status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : "never"} ·
          {" "}{status.autoBackupCount} automatic backup{status.autoBackupCount === 1 ? "" : "s"} kept on disk (most recent 10).
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={backupNow}><DatabaseBackup size={14} /> Backup Now</Button>
        <Button onClick={backupNow}>Download Full Backup</Button>
      </div>
      <p className="text-xs text-stone-400">
        This downloads the complete local database as a single file — the most complete and accurate export available.
        Per-table CSV export (Products in Phase C, Reports in Phase L) is more convenient for spreadsheets and lands in
        those later phases.
      </p>
    </div>
  );
}
