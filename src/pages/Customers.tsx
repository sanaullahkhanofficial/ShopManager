import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Plus, Search, Users, Store, HandCoins, Wallet, UserPlus, Upload, Download, Printer,
  Tags, RotateCcw, BookText, MessageCircle, Trash2, Save, User as UserIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField, TextAreaField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { StatCard } from "../components/ui/StatCard";
import { PrintableList } from "../components/PrintableList";
import { useToast } from "../components/ui/Toast";
import { useLang, ledgerTypeLabel, customerTypeLabel } from "../lib/i18n";
import type { AuthUser, Customer, CustomerGroup, CustomerStats, LedgerEntry, Settings } from "../types";
import type { PageId } from "../components/layout/Sidebar";

const emptyDraft = (): Partial<Customer> => ({ customer_type: "Retail" });

export function Customers({ user, settings, onNavigate, onOpenLedger }: {
  user: AuthUser; settings?: Settings; onNavigate?: (p: PageId) => void; onOpenLedger?: (id: number) => void;
}) {
  const { push } = useToast();
  const { t } = useLang();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [draft, setDraft] = useState<Partial<Customer>>(emptyDraft());
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [recentTx, setRecentTx] = useState<LedgerEntry[]>([]);
  const [manageGroups, setManageGroups] = useState(false);
  const [printList, setPrintList] = useState(false);

  const load = () => {
    api.customersList().then((c) => setCustomers(c as Customer[]));
    api.customerGroupsList().then((g) => setGroups(g as CustomerGroup[]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (printList) { const t = setTimeout(() => window.print(), 150); return () => clearTimeout(t); }
  }, [printList]);

  useEffect(() => {
    if (!draft.id) { setStats(null); setRecentTx([]); return; }
    api.customersStats(draft.id).then((s) => setStats(s as CustomerStats));
    api.customersLedger(draft.id).then((r) => setRecentTx((r as LedgerEntry[]).slice(0, 5)));
  }, [draft.id]);

  const areas = useMemo(() => Array.from(new Set(customers.map((c) => c.area).filter(Boolean))), [customers]);

  const rows = customers.filter((c) =>
    (c.name + " " + c.shop_name + " " + c.phone + " " + c.cnic).toLowerCase().includes(query.toLowerCase()) &&
    (!typeFilter || c.customer_type === typeFilter) &&
    (!areaFilter || c.area === areaFilter)
  );

  const totalCreditLimit = customers.reduce((a, c) => a + (c.credit_limit || 0), 0);
  const totalOutstanding = customers.reduce((a, c) => a + Math.max(0, c.balance), 0);
  const activeShops = customers.filter((c) => c.customer_type !== "Retail").length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = customers.filter((c) => new Date(c.created_at) >= monthStart).length;

  function resetForm() { setDraft(emptyDraft()); }
  function editRow(c: Customer) { setDraft(c); }

  async function save() {
    if (!draft.name) { push("error", "Customer name is required"); return; }
    await api.customersSave({ ...draft, actorId: user.id });
    push("success", draft.id ? "Customer updated" : "Customer created");
    resetForm();
    load();
  }

  async function deactivate(c: Customer) {
    if (!confirm(`Deactivate ${c.shop_name || c.name}? They'll drop off the active list.`)) return;
    await api.customersSave({ id: c.id, status: "inactive", actorId: user.id });
    push("success", "Customer deactivated");
    if (draft.id === c.id) resetForm();
    load();
  }

  function exportCsv() {
    const csv = Papa.unparse(customers.map((c) => ({
      shop_name: c.shop_name, name: c.name, phone: c.phone, whatsapp: c.whatsapp, cnic: c.cnic,
      customer_type: c.customer_type, city: c.city, area: c.area, credit_limit: c.credit_limit, balance: c.balance,
    })));
    api.filesSaveText({ title: "Export Customers", defaultPath: "customers.csv", content: csv }).then((p) => { if (p) push("success", "Customers exported"); });
  }

  async function importCsv() {
    const file = await api.filesPickCsv();
    if (!file) return;
    const parsed = Papa.parse<Record<string, string>>(file.content, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) { push("error", `CSV parse error: ${parsed.errors[0].message}`); return; }
    let created = 0, updated = 0;
    for (const row of parsed.data) {
      if (!row.name) continue;
      const existing = customers.find((c) => c.phone && c.phone === row.phone);
      await api.customersSave({
        id: existing?.id, shop_name: row.shop_name || "", name: row.name, phone: row.phone || "", whatsapp: row.whatsapp || "",
        cnic: row.cnic || "", customer_type: row.customer_type || "Retail", city: row.city || "", area: row.area || "",
        credit_limit: Number(row.credit_limit) || 0, actorId: user.id,
      });
      if (existing) updated++; else created++;
    }
    push("success", `Import complete — ${created} created, ${updated} updated`);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={t("totalCustomers")} value={String(customers.length)} hint={t("activeCustomersHint")} icon={<Users size={18} />} tone="green" />
        <StatCard label={t("activeShops")} value={String(activeShops)} hint={t("regularBuyersHint")} icon={<Store size={18} />} />
        <StatCard label={t("totalCreditLimit")} value={money(totalCreditLimit)} icon={<HandCoins size={18} />} tone="gold" />
        <StatCard label={t("outstandingBalance")} value={money(totalOutstanding)} icon={<Wallet size={18} />} tone="danger" />
        <StatCard label={t("newThisMonth")} value={String(newThisMonth)} icon={<UserPlus size={18} />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder={t("searchByNameShopPhoneCnic")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t("allCustomerTypes")}</option>
          <option value="Retail">{t("customerTypeRetail")}</option>
          <option value="Wholesale">{t("customerTypeWholesale")}</option>
          <option value="Distributor">{t("customerTypeDistributor")}</option>
        </select>
        <select className="input w-auto" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
          <option value="">{t("allAreas")}</option>
          {areas.map((a) => <option key={a}>{a}</option>)}
        </select>
        <Button onClick={() => { setQuery(""); setTypeFilter(""); setAreaFilter(""); }}><RotateCcw size={14} /> {t("resetBtn")}</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => setManageGroups(true)}><Tags size={14} /> {t("customerGroups")}</Button>
          <Button onClick={importCsv}><Upload size={14} /> {t("importCsvBtn")}</Button>
          <Button onClick={exportCsv}><Download size={14} /> {t("exportBtn")}</Button>
          <Button variant="primary" onClick={resetForm}><Plus size={15} /> {t("addCustomerTitle")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card">
          <DataTable
            keyField={(r) => r.id}
            rows={rows}
            pageSize={20}
            columns={[
              { header: t("customerNameCol"), render: (r) => r.name },
              { header: t("shopNameCol"), render: (r) => r.shop_name || "—" },
              { header: t("typeCol"), render: (r) => <span className="rounded-full bg-brand-green-50 px-2 py-0.5 text-xs font-medium text-brand-green-700">{customerTypeLabel(r.customer_type, t)}</span> },
              { header: t("phoneCol"), render: (r) => r.phone || "—" },
              { header: t("areaCol"), render: (r) => r.area || "—" },
              { header: t("creditLimitCol"), render: (r) => money(r.credit_limit) },
              { header: t("balance"), render: (r) => <span className={r.balance > 0 ? "font-medium text-red-600" : ""}>{money(r.balance)}</span> },
              { header: t("actionCol"), render: (r) => (
                <div className="flex gap-2">
                  <button className="text-stone-400 hover:text-brand-green-700" title={t("viewEditTooltip")} onClick={() => editRow(r)}><UserIcon size={14} /></button>
                  <button className="text-stone-400 hover:text-brand-green-700" title={t("ledgerTooltip")} onClick={() => (onOpenLedger?.(r.id), onNavigate?.("customerLedger"))}><BookText size={14} /></button>
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
                <p className="text-sm font-semibold text-brand-navy-900">{draft.shop_name || draft.name}</p>
                <p className="text-xs text-stone-400">{customerTypeLabel(draft.customer_type || "Retail", t)} {t("customerWord")} · {t("joinedPrefix")} {draft.created_at ? formatDate(draft.created_at) : "—"}</p>
              </div>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-brand-navy-900">{t("addCustomerTitle")}</h3>
          )}

          {draft.id && stats && (
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("creditLimitCol")}</p><p className="font-semibold">{money(draft.credit_limit)}</p></div>
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("currentBalance")}</p><p className="font-semibold">{money(draft.balance)}</p></div>
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("totalPurchasesLabel")}</p><p className="font-semibold">{money(stats.totalPurchases)}</p></div>
              <div className="rounded-md bg-stone-50 p-2"><p className="text-stone-400">{t("totalInvoicesLabel")}</p><p className="font-semibold">{stats.totalInvoices}</p></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("shopNameCol")} value={draft.shop_name || ""} onChange={(e) => setDraft({ ...draft, shop_name: e.target.value })} />
            <Field label={t("customerNameRequired")} value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Field label={t("phoneNumberField")} value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <Field label={t("whatsappField")} value={draft.whatsapp || ""} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} />
            <Field label={t("cnicField")} value={draft.cnic || ""} onChange={(e) => setDraft({ ...draft, cnic: e.target.value })} />
            <SelectField label={t("customerTypeField")} value={draft.customer_type || "Retail"} onChange={(e) => setDraft({ ...draft, customer_type: e.target.value as Customer["customer_type"] })}>
              <option value="Retail">{t("customerTypeRetail")}</option>
              <option value="Wholesale">{t("customerTypeWholesale")}</option>
              <option value="Distributor">{t("customerTypeDistributor")}</option>
            </SelectField>
            <Field label={t("cityField")} value={draft.city || ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            <Field label={t("areaLocationField")} value={draft.area || ""} onChange={(e) => setDraft({ ...draft, area: e.target.value })} />
            <SelectField label={t("customerGroupField")} value={draft.group_id || ""} onChange={(e) => setDraft({ ...draft, group_id: Number(e.target.value) || null })}>
              <option value="">{t("noneOption")}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </SelectField>
            <Field label={t("creditLimitCol")} type="number" value={draft.credit_limit ?? 0} onChange={(e) => setDraft({ ...draft, credit_limit: Number(e.target.value) })} />
            {!draft.id && <Field label={t("openingBalance")} type="number" value={draft.opening_balance ?? 0} onChange={(e) => setDraft({ ...draft, opening_balance: Number(e.target.value) })} />}
          </div>
          <TextAreaField label={t("addressField")} value={draft.address || ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />

          <div className="flex gap-2">
            <Button onClick={resetForm}><RotateCcw size={14} /> {t("resetBtn")}</Button>
            <Button variant="primary" className="flex-1" onClick={save}><Save size={14} /> {t("saveCustomer")}</Button>
          </div>

          {draft.id && recentTx.length > 0 && (
            <div className="border-t border-stone-100 pt-2">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("recentTransactions")}</h4>
                <button className="text-xs text-brand-green-700 hover:underline" onClick={() => (onOpenLedger?.(draft.id!), onNavigate?.("customerLedger"))}>{t("viewAllArrow")}</button>
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
              <Button onClick={() => setPrintList(true)}><Printer size={14} /> {t("printStatement")}</Button>
              <Button onClick={() => push("info", "Not connected — SMS sending isn't set up yet (see Settings > Integrations)")}><MessageCircle size={14} /> {t("sendSms")}</Button>
              <Button onClick={() => push("info", "Not connected — WhatsApp sending isn't set up yet (see Settings > Integrations)")}><MessageCircle size={14} /> {t("whatsappField")}</Button>
            </div>
          )}
        </div>
      </div>

      {manageGroups && <GroupsModal groups={groups} onClose={() => setManageGroups(false)} onChanged={load} />}
      {printList && settings && (
        <PrintableList
          title={t("customerListTitle")} settings={settings} rows={rows} keyField={(r) => r.id}
          columns={[
            { header: t("customer"), render: (r) => r.shop_name || r.name },
            { header: t("typeCol"), render: (r) => customerTypeLabel(r.customer_type, t) },
            { header: t("phoneCol"), render: (r) => r.phone },
            { header: t("areaCol"), render: (r) => r.area },
            { header: t("creditLimitCol"), render: (r) => money(r.credit_limit) },
            { header: t("balance"), render: (r) => money(r.balance) },
          ]}
        />
      )}
    </div>
  );
}

function GroupsModal({ groups, onClose, onChanged }: { groups: CustomerGroup[]; onClose: () => void; onChanged: () => void }) {
  const { push } = useToast();
  const { t } = useLang();
  const [name, setName] = useState("");
  async function add() {
    if (!name) return;
    await api.customerGroupsSave({ name });
    push("success", "Group added");
    setName("");
    onChanged();
  }
  return (
    <Modal title={t("customerGroups")} onClose={onClose}>
      <div className="mb-4 space-y-1">
        {groups.map((g) => <div key={g.id} className="rounded-md border border-stone-100 px-3 py-1.5 text-sm">{g.name}</div>)}
        {!groups.length && <p className="text-sm text-stone-400">{t("noGroupsYet")}</p>}
      </div>
      <div className="flex gap-2">
        <Field label={t("groupNameField")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("groupNamePlaceholder")} />
        <Button className="mt-5" onClick={add} disabled={!name}><Plus size={14} /></Button>
      </div>
    </Modal>
  );
}
