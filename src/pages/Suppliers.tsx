import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Plus, Search, Truck, ReceiptText, HandCoins, TrendingUp, Upload, Download,
  RotateCcw, BookText, Mail, MessageCircle, Trash2, Save, Building2,
} from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField, TextAreaField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { StatCard } from "../components/ui/StatCard";
import { useToast } from "../components/ui/Toast";
import { useLang, ledgerTypeLabel } from "../lib/i18n";
import type { AuthUser, Supplier, SupplierStats, LedgerEntry, Purchase } from "../types";
import type { PageId } from "../components/layout/Sidebar";

const emptyDraft = (): Partial<Supplier> => ({});

export function Suppliers({ user, onNavigate, onOpenLedger }: {
  user: AuthUser; onNavigate?: (p: PageId) => void; onOpenLedger?: (id: number) => void;
}) {
  const { push } = useToast();
  const { t } = useLang();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [draft, setDraft] = useState<Partial<Supplier>>(emptyDraft());
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [recentTx, setRecentTx] = useState<LedgerEntry[]>([]);

  const load = () => {
    api.suppliersList().then((s) => setSuppliers(s as Supplier[]));
    api.purchasesList().then((p) => setPurchases(p as Purchase[]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!draft.id) { setStats(null); setRecentTx([]); return; }
    api.suppliersStats(draft.id).then((s) => setStats(s as SupplierStats));
    api.suppliersLedger(draft.id).then((r) => setRecentTx((r as LedgerEntry[]).slice(0, 5)));
  }, [draft.id]);

  const categories = Array.from(new Set(suppliers.map((s) => s.category).filter(Boolean)));
  const rows = suppliers.filter((s) =>
    (s.name + " " + s.phone + " " + s.ntn).toLowerCase().includes(query.toLowerCase()) &&
    (!categoryFilter || s.category === categoryFilter)
  );

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const totalPurchasesThisMonth = purchases.filter((p) => new Date(p.purchase_date) >= monthStart).reduce((a, p) => a + p.total, 0);
  const totalOutstanding = suppliers.reduce((a, s) => a + Math.max(0, s.balance), 0);
  const totalAdvance = suppliers.reduce((a, s) => a + Math.max(0, -s.balance), 0);

  function resetForm() { setDraft(emptyDraft()); }
  function editRow(s: Supplier) { setDraft(s); }

  async function save() {
    if (!draft.name) { push("error", "Supplier name is required"); return; }
    await api.suppliersSave({ ...draft, actorId: user.id });
    push("success", draft.id ? "Supplier updated" : "Supplier created");
    resetForm();
    load();
  }

  async function deactivate(s: Supplier) {
    if (!confirm(`Deactivate ${s.name}? They'll drop off the active list.`)) return;
    await api.suppliersSave({ id: s.id, status: "inactive", actorId: user.id });
    push("success", "Supplier deactivated");
    if (draft.id === s.id) resetForm();
    load();
  }

  function exportCsv() {
    const csv = Papa.unparse(suppliers.map((s) => ({
      name: s.name, contact_person: s.contact_person, phone: s.phone, ntn: s.ntn,
      category: s.category, city: s.city, products_supplied: s.products_supplied, balance: s.balance,
    })));
    api.filesSaveText({ title: "Export Suppliers", defaultPath: "suppliers.csv", content: csv }).then((p) => { if (p) push("success", "Suppliers exported"); });
  }

  async function importCsv() {
    const file = await api.filesPickCsv();
    if (!file) return;
    const parsed = Papa.parse<Record<string, string>>(file.content, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) { push("error", `CSV parse error: ${parsed.errors[0].message}`); return; }
    let created = 0, updated = 0;
    for (const row of parsed.data) {
      if (!row.name) continue;
      const existing = suppliers.find((s) => s.phone && s.phone === row.phone);
      await api.suppliersSave({
        id: existing?.id, name: row.name, contact_person: row.contact_person || "", phone: row.phone || "",
        ntn: row.ntn || "", category: row.category || "", city: row.city || "", products_supplied: row.products_supplied || "",
        actorId: user.id,
      });
      if (existing) updated++; else created++;
    }
    push("success", `Import complete — ${created} created, ${updated} updated`);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("totalSuppliers")} value={String(suppliers.length)} hint={t("registeredSuppliersHint")} icon={<Truck size={18} />} tone="green" />
        <StatCard label={t("totalPurchasesLabel")} value={money(totalPurchasesThisMonth)} hint={t("thisMonthHint")} icon={<ReceiptText size={18} />} />
        <StatCard label={t("outstandingPayable")} value={money(totalOutstanding)} icon={<HandCoins size={18} />} tone="danger" />
        <StatCard label={t("advancePayments")} value={money(totalAdvance)} hint={t("paidInAdvanceHint")} icon={<TrendingUp size={18} />} tone="gold" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder={t("searchSupplierByNamePhoneNtn")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button onClick={() => { setQuery(""); setCategoryFilter(""); }}><RotateCcw size={14} /> {t("resetBtn")}</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={importCsv}><Upload size={14} /> {t("importCsvBtn")}</Button>
          <Button onClick={exportCsv}><Download size={14} /> {t("exportBtn")}</Button>
          <Button variant="primary" onClick={resetForm}><Plus size={15} /> {t("addSupplierTitle")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card">
          <DataTable
            keyField={(r) => r.id}
            rows={rows}
            pageSize={20}
            columns={[
              { header: t("supplierNameCol"), render: (r) => r.name },
              { header: t("contactPersonCol"), render: (r) => r.contact_person || "—" },
              { header: t("phoneCol"), render: (r) => r.phone || "—" },
              { header: t("addressLocationCol"), render: (r) => r.city || "—" },
              { header: t("productsSuppliedCol"), render: (r) => r.products_supplied || "—" },
              { header: t("outstandingCol"), render: (r) => <span className={r.balance > 0 ? "font-medium text-red-600" : ""}>{money(r.balance)}</span> },
              { header: t("actionCol"), render: (r) => (
                <div className="flex gap-2">
                  <button className="text-stone-400 hover:text-brand-green-700" title={t("viewEditTooltip")} onClick={() => editRow(r)}><Building2 size={14} /></button>
                  <button className="text-stone-400 hover:text-brand-green-700" title={t("ledgerTooltip")} onClick={() => (onOpenLedger?.(r.id), onNavigate?.("supplierLedger"))}><BookText size={14} /></button>
                  <button className="text-stone-400 hover:text-red-600" title={t("deactivateTooltip")} onClick={() => deactivate(r)}><Trash2 size={14} /></button>
                </div>
              ) },
            ]}
          />
        </div>

        <div className="card space-y-3">
          {draft.id ? (
            <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-green-100 text-sm font-semibold text-brand-green-700">
                {(draft.name || "?").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-brand-navy-900">{draft.name}</p>
                <p className="text-xs text-stone-400">{draft.category || t("supplierWord")} · {draft.payment_term_days ? `${draft.payment_term_days} ${t("dayTermsSuffix")}` : t("noCreditTermSet")}</p>
              </div>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-brand-navy-900">{t("addSupplierTitle")}</h3>
          )}

          {draft.id && stats && (
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("totalPurchasesLabel")}</p><p className="font-semibold">{money(stats.totalPurchases)}</p></div>
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("outstandingCol")}</p><p className="font-semibold">{money(draft.balance)}</p></div>
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("advancePaidLabel")}</p><p className="font-semibold">{money(Math.max(0, -(draft.balance || 0)))}</p></div>
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("totalInvoicesLabel")}</p><p className="font-semibold">{stats.totalInvoices}</p></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("supplierNameRequired")} value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Field label={t("contactPersonField")} value={draft.contact_person || ""} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} />
            <Field label={t("phoneField")} value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <Field label={t("whatsappField")} value={draft.whatsapp || ""} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} />
            <Field label={t("ntnField")} value={draft.ntn || ""} onChange={(e) => setDraft({ ...draft, ntn: e.target.value })} />
            <Field label={t("paymentTermDaysField")} type="number" value={draft.payment_term_days ?? 0} onChange={(e) => setDraft({ ...draft, payment_term_days: Number(e.target.value) })} />
            <Field label={t("cityField")} value={draft.city || ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            <Field label={t("categoryField")} value={draft.category || ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder={t("categoryPlaceholderExample")} />
            <Field label={t("productsSuppliedField")} value={draft.products_supplied || ""} onChange={(e) => setDraft({ ...draft, products_supplied: e.target.value })} placeholder={t("productsSuppliedPlaceholderExample")} />
            {!draft.id && <Field label={t("openingPayableField")} type="number" value={draft.opening_balance ?? 0} onChange={(e) => setDraft({ ...draft, opening_balance: Number(e.target.value) })} />}
          </div>
          <TextAreaField label={t("addressField")} value={draft.address || ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />

          <div className="flex gap-2">
            <Button onClick={resetForm}><RotateCcw size={14} /> {t("resetBtn")}</Button>
            <Button variant="primary" className="flex-1" onClick={save}><Save size={14} /> {t("saveSupplier")}</Button>
          </div>

          {draft.id && recentTx.length > 0 && (
            <div className="border-t border-stone-100 pt-2">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("recentTransactions")}</h4>
                <button className="text-xs text-brand-green-700 hover:underline" onClick={() => (onOpenLedger?.(draft.id!), onNavigate?.("supplierLedger"))}>{t("viewAllArrow")}</button>
              </div>
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex justify-between py-0.5 text-xs">
                  <span className="text-stone-500">{formatDate(tx.created_at)} · {ledgerTypeLabel(tx.type, t)}</span>
                  <span className={tx.direction > 0 ? "text-red-600" : "text-brand-green-700"}>{tx.direction > 0 ? "+" : "-"}{money(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {draft.id && (
            <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
              <Button onClick={() => push("info", "Not connected — WhatsApp sending isn't set up yet (see Settings > Integrations)")}><MessageCircle size={14} /> {t("whatsappField")}</Button>
              <Button onClick={() => push("info", "Not connected — Email sending isn't set up yet (see Settings > Integrations)")}><Mail size={14} /> {t("emailBtn")}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
