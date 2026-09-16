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
import { useLang, customerTypeLabel } from "../lib/i18n";
import type { AuthUser, Settings, Location } from "../types";

function useSettingsTabs() {
  const { t } = useLang();
  return [
    { id: "business", label: t("businessProfileTab"), icon: Building2 },
    { id: "system", label: t("systemSettingsTab"), icon: SlidersHorizontal },
    { id: "invoice", label: t("invoicePrintTab"), icon: Printer },
    { id: "payment", label: t("paymentMethodsTab"), icon: CreditCard },
    { id: "tax", label: t("taxDiscountsTab"), icon: Percent },
    { id: "locations", label: t("locationsWarehousesTab"), icon: Warehouse },
    { id: "notifications", label: t("notificationsTab"), icon: Bell },
    { id: "backup", label: t("backupDataTab"), icon: DatabaseBackup },
    { id: "integrations", label: t("integrationsTab"), icon: Plug },
    { id: "preferences", label: t("systemPreferencesTab"), icon: SettingsIcon },
  ];
}

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

export function SettingsPage({ value, onSaved, user }: { value: Settings; onSaved: (s: Settings) => void; user: AuthUser }) {
  const { push } = useToast();
  const { t, setLang } = useLang();
  const TABS = useSettingsTabs();
  const [x, setX] = useState<Settings>(value);
  const [tab, setTab] = useState("business");
  const [preview, setPreview] = useState(false);
  useEffect(() => setX(value), [value]);

  const update = (patch: Record<string, string>) => setX((v) => ({ ...v, ...patch } as Settings));
  // Section 42: this saved preference and the live UI language are the same
  // switch — the TopBar toggle changes this same underlying setLang(), so
  // whichever one a user touches, the other reflects it. "en-ur" (bilingual)
  // is stored as a preference but has no live third mode yet — the UI stays
  // in whichever pure language it was already showing.
  function updateLanguage(v: string) {
    update({ language: v });
    if (v === "en" || v === "ur") setLang(v);
  }

  async function save() {
    const s = await api.settingsUpdate({ ...x, actorId: user.id }) as Settings;
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
          <Button onClick={reset}><RotateCcw size={14} /> {t("resetBtn")}</Button>
          <Button variant="primary" onClick={save}><Save size={14} /> {t("saveChangesBtn")}</Button>
        </div>
      </div>

      {tab === "business" && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("businessInformationTitle")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("businessNameField")} value={x.business_name} onChange={(e) => update({ business_name: e.target.value })} />
            <Field label={t("businessTypeField")} value={x.business_type} onChange={(e) => update({ business_type: e.target.value })} />
            <Field label={t("ownerNameField")} value={x.owner_name || ""} onChange={(e) => update({ owner_name: e.target.value })} />
            <Field label={t("cnicNtnField")} value={x.cnic || ""} onChange={(e) => update({ cnic: e.target.value })} />
            <Field label={t("phoneNumberField")} value={x.phone} onChange={(e) => update({ phone: e.target.value })} />
            <Field label={t("emailAddressField")} type="email" value={x.email || ""} onChange={(e) => update({ email: e.target.value })} />
            <Field label={t("currencyField")} value={x.currency} onChange={(e) => update({ currency: e.target.value })} />
            <Field label={t("timeZoneField")} value={x.timezone || "Asia/Karachi"} onChange={(e) => update({ timezone: e.target.value })} />
            <div className="sm:col-span-2"><TextAreaField label={t("addressField")} value={x.address} onChange={(e) => update({ address: e.target.value })} /></div>
            <div className="sm:col-span-2"><TextAreaField label={t("businessDescriptionField")} value={x.business_description || ""} onChange={(e) => update({ business_description: e.target.value })} /></div>
          </div>
          <div>
            <span className="label">{t("businessLogoLabel")}</span>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                {x.logo_path ? <img src={`file://${x.logo_path}`} className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-stone-300" />}
              </div>
              <Button onClick={pickLogo}>{t("changeLogoBtn")}</Button>
              {x.logo_path && <Button onClick={() => update({ logo_path: "" })}>{t("removeBtn")}</Button>}
            </div>
          </div>
        </div>
      )}

      {tab === "system" && (
        <div className="space-y-4">
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label={t("defaultLanguageField")} value={x.language} onChange={(e) => updateLanguage(e.target.value)}>
              <option value="en">English</option><option value="ur">اردو</option><option value="en-ur">English + اردو</option>
            </SelectField>
            <SelectField label={t("dateFormatField")} value={x.date_format || "DD MMM YYYY"} onChange={(e) => update({ date_format: e.target.value })}>
              <option>DD MMM YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option>
            </SelectField>
            <SelectField label={t("timeFormatField")} value={x.time_format || "12"} onChange={(e) => update({ time_format: e.target.value })}>
              <option value="12">{t("time12Hour")}</option><option value="24">{t("time24Hour")}</option>
            </SelectField>
            <SelectField label={t("fiscalYearStartField")} value={x.fiscal_year_start_month || "January"} onChange={(e) => update({ fiscal_year_start_month: e.target.value })}>
              <option value="January">{t("monthJanuary")}</option>
              <option value="April">{t("monthApril")}</option>
              <option value="July">{t("monthJuly")}</option>
              <option value="October">{t("monthOctober")}</option>
            </SelectField>
          </div>
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-brand-navy-900">{t("featureTogglesTitle")}</h3>
            {([
              ["enable_batch_tracking", "enableBatchTracking"],
              ["enable_low_stock_alerts", "enableLowStockAlerts"],
              ["enable_sales_return", "enableSalesReturn"],
              ["enable_purchase_return", "enablePurchaseReturn"],
              ["enable_customer_credit", "enableCustomerCredit"],
              ["enable_supplier_credit", "enableSupplierCredit"],
              ["show_purchase_price_to_sales", "showPurchasePriceToSales"],
              ["enable_multi_location", "enableMultiLocation"],
            ] as const).map(([key, labelKey]) => (
              <Switch key={key} checked={on(x[key])} onChange={(v) => update({ [key]: flag(v) })} label={t(labelKey)} />
            ))}
            <p className="text-xs text-stone-400">{t("multiLocationHint")}</p>
          </div>
        </div>
      )}

      {tab === "invoice" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-brand-navy-900">{t("invoicePrintSettingsTitle")}</h3>
            <SelectField label={t("invoiceTemplateField")} value={x.invoice_template || "Standard"} onChange={(e) => update({ invoice_template: e.target.value })}>
              {["Standard", "Modern", "Minimal", "Compact (Thermal)"].map((tpl) => <option key={tpl}>{tpl}</option>)}
            </SelectField>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("invoicePrefixSalesField")} value={x.invoice_prefix} onChange={(e) => update({ invoice_prefix: e.target.value.toUpperCase() })} />
              <Field label={t("invoicePrefixPurchaseField")} value={x.invoice_prefix_purchase || "PUR"} onChange={(e) => update({ invoice_prefix_purchase: e.target.value.toUpperCase() })} />
            </div>
            <SelectField label={t("invoiceSizeField")} value={x.invoice_size || "A4"} onChange={(e) => update({ invoice_size: e.target.value })}>
              <option>A4</option><option>58mm Thermal</option>
            </SelectField>
            <Switch checked={on(x.show_logo_on_invoice)} onChange={(v) => update({ show_logo_on_invoice: flag(v) })} label={t("showLogoOnInvoice")} />
            <Switch checked={on(x.show_barcode_on_invoice)} onChange={(v) => update({ show_barcode_on_invoice: flag(v) })} label={t("showBarcodeOnInvoice")} />
            <Switch checked={on(x.show_terms_on_invoice)} onChange={(v) => update({ show_terms_on_invoice: flag(v) })} label={t("showTermsOnInvoice")} />
            {on(x.show_terms_on_invoice) && (
              <TextAreaField label={t("termsConditionsTextField")} value={x.invoice_terms || ""} onChange={(e) => update({ invoice_terms: e.target.value })} />
            )}
            <Switch checked={on(x.show_thankyou_on_invoice)} onChange={(v) => update({ show_thankyou_on_invoice: flag(v) })} label={t("showThankYouMessage")} />
            <Field label={t("footerTextField")} value={x.invoice_footer} onChange={(e) => update({ invoice_footer: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button onClick={() => setPreview(true)}><Eye size={14} /> {t("previewInvoiceBtn")}</Button>
              <Button onClick={() => { setPreview(true); setTimeout(() => window.print(), 200); }}><Printer size={14} /> {t("printTestInvoiceBtn")}</Button>
            </div>
            <p className="text-xs text-stone-400">{t("invoiceLiveHint")}</p>
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold text-brand-navy-900">{t("customerOfficeCopyTitle")}</h3>
            <div className="space-y-2 text-sm">
              <Switch checked={on(x.print_customer_copy)} onChange={(v) => update({ print_customer_copy: flag(v) })} label={t("printCustomerCopy")} />
              <Switch checked={on(x.print_office_copy)} onChange={(v) => update({ print_office_copy: flag(v) })} label={t("printOfficeCopy")} />
              <Switch checked={on(x.auto_cut)} onChange={(v) => update({ auto_cut: flag(v) })} label={t("autoCutLabel")} />
            </div>
            <p className="mt-3 text-xs text-stone-400">{t("dualCopyHint")}</p>
          </div>
        </div>
      )}

      {tab === "payment" && <PaymentMethodsPanel />}

      {tab === "tax" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card space-y-3">
            <Switch checked={on(x.sales_tax_enabled)} onChange={(v) => update({ sales_tax_enabled: flag(v) })} label={t("enableSalesTax")} />
            <Field label={t("salesTaxRateField")} type="number" value={x.sales_tax_rate || "0"} onChange={(e) => update({ sales_tax_rate: e.target.value })} disabled={!on(x.sales_tax_enabled)} />
          </div>
          <div className="card space-y-3">
            <Switch checked={on(x.purchase_tax_enabled)} onChange={(v) => update({ purchase_tax_enabled: flag(v) })} label={t("enablePurchaseTax")} />
            <Field label={t("purchaseTaxRateField")} type="number" value={x.purchase_tax_rate || "0"} onChange={(e) => update({ purchase_tax_rate: e.target.value })} disabled={!on(x.purchase_tax_enabled)} />
          </div>
          <div className="card space-y-3">
            <Switch checked={on(x.discount_sales_enabled)} onChange={(v) => update({ discount_sales_enabled: flag(v) })} label={t("enableDiscountOnSales")} />
            <Field label={t("maximumDiscountField")} type="number" value={x.discount_sales_max_pct || "10"} onChange={(e) => update({ discount_sales_max_pct: e.target.value })} disabled={!on(x.discount_sales_enabled)} />
          </div>
          <div className="card space-y-3">
            <Switch checked={on(x.discount_purchase_enabled)} onChange={(v) => update({ discount_purchase_enabled: flag(v) })} label={t("enableDiscountOnPurchase")} />
            <Field label={t("maximumDiscountField")} type="number" value={x.discount_purchase_max_pct || "10"} onChange={(e) => update({ discount_purchase_max_pct: e.target.value })} disabled={!on(x.discount_purchase_enabled)} />
          </div>
        </div>
      )}

      {tab === "locations" && <LocationsPanel />}

      {tab === "notifications" && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("automaticNotificationsTitle")}</h3>
          <Switch checked={on(x.notify_low_stock)} onChange={(v) => update({ notify_low_stock: flag(v) })} label={t("lowStockAlertsLabel")} />
          <Switch checked={on(x.notify_overdue_receivables)} onChange={(v) => update({ notify_overdue_receivables: flag(v) })} label={t("overdueReceivableAlerts")} />
          <p className="text-xs text-stone-400">{t("notificationsBellHint")}</p>
        </div>
      )}

      {tab === "backup" && <BackupPanel settings={x} update={update} />}

      {tab === "integrations" && (
        <div className="space-y-4">
          <div className="card">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("integrationsNotConnectedHint")}</p>
          </div>
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-brand-navy-900 sm:col-span-2">{t("smsWhatsappTitle")}</h3>
            <Field label={t("smsProviderField")} value={x.sms_provider || ""} onChange={(e) => update({ sms_provider: e.target.value })} placeholder="e.g. Twilio" />
            <Field label={t("smsApiKeyField")} type="password" value={x.sms_api_key || ""} onChange={(e) => update({ sms_api_key: e.target.value })} />
            <Field label={t("whatsappProviderField")} value={x.whatsapp_provider || ""} onChange={(e) => update({ whatsapp_provider: e.target.value })} placeholder="e.g. WhatsApp Business API" />
            <Field label={t("whatsappApiKeyField")} type="password" value={x.whatsapp_api_key || ""} onChange={(e) => update({ whatsapp_api_key: e.target.value })} />
          </div>
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-brand-navy-900 sm:col-span-2">{t("emailSmtpTitle")}</h3>
            <Field label={t("smtpHostField")} value={x.email_smtp_host || ""} onChange={(e) => update({ email_smtp_host: e.target.value })} />
            <Field label={t("smtpPortField")} value={x.email_smtp_port || ""} onChange={(e) => update({ email_smtp_port: e.target.value })} />
            <Field label={t("smtpUsernameField")} value={x.email_smtp_user || ""} onChange={(e) => update({ email_smtp_user: e.target.value })} />
            <Field label={t("smtpPasswordField")} type="password" value={x.email_smtp_pass || ""} onChange={(e) => update({ email_smtp_pass: e.target.value })} />
          </div>
        </div>
      )}

      {tab === "preferences" && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("systemPreferencesTab")}</h3>
          <div>
            <Switch checked={on(x.allow_negative_stock)} onChange={(v) => update({ allow_negative_stock: flag(v) })} label={t("allowNegativeStockLabel")} />
            <p className="mt-1 text-xs text-stone-400">{t("negativeStockHint")}</p>
          </div>
          <SelectField label={t("defaultSaleModeField")} value={x.default_sale_mode || "Retail"} onChange={(e) => update({ default_sale_mode: e.target.value })}>
            <option value="Retail">{customerTypeLabel("Retail", t)}</option>
            <option value="Wholesale">{customerTypeLabel("Wholesale", t)}</option>
          </SelectField>
        </div>
      )}

      <div className="flex gap-2 sm:hidden">
        <Button className="flex-1" onClick={reset}>{t("resetBtn")}</Button>
        <Button variant="primary" className="flex-1" onClick={save}>{t("saveChangesBtn")}</Button>
      </div>

      {preview && (
        <Modal title={`${t("invoicePreviewPrefix")} ${x.invoice_size || "58mm Thermal"} · ${x.invoice_template || "Standard"} · ${t("dualCopySuffix")}`} onClose={() => setPreview(false)} wide>
          <div className="rounded-md bg-stone-100 p-4">
            <ReceiptPreview data={SAMPLE_RECEIPT} settings={x} variant="visible" />
          </div>
          <p className="mt-3 text-center text-xs text-stone-400">{t("invoicePreviewSampleHint")}</p>
        </Modal>
      )}
      {/* Hidden print-only copy kept in the DOM so "Print Test Invoice" has something to print. */}
      {preview && <ReceiptPreview data={SAMPLE_RECEIPT} settings={x} />}
    </div>
  );
}

function PaymentMethodsPanel() {
  const { push } = useToast();
  const { t } = useLang();
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
      <h3 className="text-sm font-semibold text-brand-navy-900">{t("paymentMethodsTab")}</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: t("paymentMethodCol"), render: (r) => r.name },
          { header: t("statusCol"), render: (r) => (
            <Switch checked={r.status === "active"} onChange={() => toggle(r)} />
          ) },
        ]}
      />
      <div className="flex gap-2">
        <Field label={t("addPaymentMethodField")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("moneyOrderPlaceholder")} />
        <Button className="mt-5" onClick={add} disabled={!name.trim()}><Plus size={14} /> {t("addBtn")}</Button>
      </div>
    </div>
  );
}

function LocationsPanel() {
  const { push } = useToast();
  const { t } = useLang();
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
      <h3 className="text-sm font-semibold text-brand-navy-900">{t("locationsWarehousesTab")}</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: t("locationWarehouseCol"), render: (r) => r.name },
          { header: t("typeCol"), render: (r) => r.type },
          { header: t("statusCol"), render: (r) => <Switch checked={r.status === "active"} onChange={() => toggle(r)} /> },
        ]}
      />
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("addLocationField")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("godownPlaceholder")} />
        <SelectField label={t("typeCol")} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="Store">{t("typeStore")}</option>
          <option value="Warehouse">{t("typeWarehouse")}</option>
          <option value="Cold Storage">{t("typeColdStorage")}</option>
        </SelectField>
        <Button onClick={add} disabled={!name.trim()}><Plus size={14} /> {t("addLocationBtn")}</Button>
      </div>
    </div>
  );
}

function BackupPanel({ settings, update }: { settings: Settings; update: (p: Record<string, string>) => void }) {
  const { push } = useToast();
  const { t } = useLang();
  const [status, setStatus] = useState<{ enabled: boolean; frequency: string; lastBackupAt: string | null; autoBackupCount: number } | null>(null);
  useEffect(() => { api.backupAutoStatus().then((s) => setStatus(s as typeof status)); }, []);

  async function backupNow() {
    const p = await api.backupCreate();
    if (p) push("success", "Backup saved");
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-semibold text-brand-navy-900">{t("backupDataManagementTitle")}</h3>
      <Switch checked={on(settings.auto_backup_enabled)} onChange={(v) => update({ auto_backup_enabled: flag(v) })} label={t("autoBackupLabel")} />
      <SelectField label={t("backupFrequencyField")} value={settings.auto_backup_frequency || "Daily"} onChange={(e) => update({ auto_backup_frequency: e.target.value })}>
        <option value="Daily">{t("backupFreqDaily")}</option>
        <option value="Weekly">{t("backupFreqWeekly")}</option>
      </SelectField>
      {status && (
        <p className="text-xs text-stone-400">
          {t("lastAutoBackupPrefix")} {status.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : t("neverWord")} ·
          {" "}{status.autoBackupCount} {t("autoBackupsKeptSuffix")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={backupNow}><DatabaseBackup size={14} /> {t("backupNowBtn")}</Button>
        <Button onClick={backupNow}>{t("downloadFullBackupBtn")}</Button>
      </div>
      <p className="text-xs text-stone-400">{t("fullBackupHint")}</p>
    </div>
  );
}
