import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Paperclip, Play, Plus, Repeat, Tag, Wallet, X } from "lucide-react";
import { api } from "../lib/api";
import { money, todayIso, formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Switch } from "../components/ui/Switch";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { useLang, paymentMethodLabel, frequencyLabel } from "../lib/i18n";
import type { AuthUser, Budget, BudgetSummaryRow, Expense, ExpenseCategory, PaymentMethod, RecurringExpense, RecurringFrequency } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque"];
const FREQUENCIES: RecurringFrequency[] = ["MONTHLY", "WEEKLY", "YEARLY"];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function ExpensesTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const { t } = useLang();
  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState({ title: "", category: "", amount: 0, payment_method: "Cash" as PaymentMethod, paid_by: "", note: "", expense_date: todayIso() });
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  const load = () => { api.expensesList().then((e) => setRows(e as Expense[])); };
  useEffect(load, []);
  useEffect(() => {
    api.expenseCategoriesList().then((c) => {
      const active = (c as ExpenseCategory[]).filter((x) => x.status === "active");
      setCategories(active);
      setForm((f) => (f.category ? f : { ...f, category: active[0]?.name || "" }));
    });
  }, []);

  async function attachReceipt() {
    setAttaching(true);
    try {
      const path = await api.receiptsPick();
      if (path) { setReceiptPath(path); push("success", "Receipt attached"); }
    } finally {
      setAttaching(false);
    }
  }

  async function save() {
    if (!form.title || form.amount <= 0) { push("error", "Title and a positive amount are required"); return; }
    await api.expensesAdd({ ...form, receipt_path: receiptPath || "", actorId: user.id });
    push("success", "Expense recorded");
    setForm({ title: "", category: categories[0]?.name || "", amount: 0, payment_method: "Cash", paid_by: "", note: "", expense_date: todayIso() });
    setReceiptPath(null);
    load();
  }

  const isPdf = (p: string) => p.toLowerCase().endsWith(".pdf");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">{t("addExpenseTitle")}</h3>
        <Field label={t("titleField")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <SelectField label={t("categoryField")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </SelectField>
        <Field label={t("amountCol")} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        <SelectField label={t("paymentMethod")} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m, t)}</option>)}
        </SelectField>
        <Field label={t("paidByField")} value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })} />
        <Field label={t("dateCol")} type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        <Field label={t("noteCol")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />

        <div>
          <span className="label">{t("receiptLabel")}</span>
          {receiptPath ? (
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-2 text-sm">
              <FileText size={15} className="shrink-0 text-brand-green-700" />
              <span className="min-w-0 flex-1 truncate text-stone-600">{receiptPath.split(/[\\/]/).pop()}</span>
              <button className="text-red-400 hover:text-red-600" onClick={() => setReceiptPath(null)}><X size={14} /></button>
            </div>
          ) : (
            <Button className="w-full" onClick={attachReceipt} disabled={attaching}>
              <Paperclip size={14} /> {attaching ? t("choosingEllipsis") : t("attachReceiptBtn")}
            </Button>
          )}
        </div>

        <Button variant="primary" className="w-full" onClick={save}>{t("saveExpenseBtn")}</Button>
      </div>
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">{t("recentExpensesTitle")}</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          pageSize={20}
          columns={[
            { header: t("dateCol"), render: (r) => formatDate(r.expense_date) },
            { header: t("titleField"), render: (r) => r.title },
            { header: t("categoryField"), render: (r) => r.category },
            { header: t("methodCol"), render: (r) => paymentMethodLabel(r.payment_method, t) },
            { header: t("amountCol"), render: (r) => money(r.amount) },
            { header: t("receiptLabel"), render: (r) => r.receipt_path ? (
              <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setViewReceipt(r.receipt_path)}>{t("viewBtn")}</button>
            ) : <span className="text-stone-300">—</span> },
          ]}
        />
      </div>

      {viewReceipt && (
        <Modal title={t("receiptLabel")} onClose={() => setViewReceipt(null)}>
          {isPdf(viewReceipt) ? (
            <p className="text-sm text-stone-600">{viewReceipt.split(/[\\/]/).pop()} {t("pdfReceiptHint")}</p>
          ) : (
            <img src={`file://${viewReceipt}`} className="w-full rounded-md border border-stone-200" />
          )}
        </Modal>
      )}
    </div>
  );
}

function RecurringTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const { t } = useLang();
  const [rows, setRows] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState({ title: "", category: "", amount: 0, payment_method: "Cash" as PaymentMethod, frequency: "MONTHLY" as RecurringFrequency, day_of_month: 1 });
  const [busy, setBusy] = useState(false);

  const load = () => { api.recurringExpensesList().then((r) => setRows(r as RecurringExpense[])); };
  useEffect(load, []);
  useEffect(() => {
    api.expenseCategoriesList().then((c) => {
      const active = (c as ExpenseCategory[]).filter((x) => x.status === "active");
      setCategories(active);
      setForm((f) => (f.category ? f : { ...f, category: active[0]?.name || "" }));
    });
  }, []);

  async function save() {
    if (!form.title || form.amount <= 0) { push("error", "Title and a positive amount are required"); return; }
    await api.recurringExpensesSave(form);
    push("success", "Recurring expense saved");
    setForm({ title: "", category: categories[0]?.name || "", amount: 0, payment_method: "Cash", frequency: "MONTHLY", day_of_month: 1 });
    load();
  }

  async function toggle(row: RecurringExpense) {
    await api.recurringExpensesSave({ ...row, status: row.status === "active" ? "inactive" : "active" });
    load();
  }

  async function runDue() {
    setBusy(true);
    try {
      await api.recurringExpensesRunDue();
      push("success", "Due recurring expenses posted");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">{t("addRecurringExpenseTitle")}</h3>
        <Field label={t("titleField")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("shopRentPlaceholder")} />
        <SelectField label={t("categoryField")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </SelectField>
        <Field label={t("amountCol")} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        <SelectField label={t("paymentMethod")} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m, t)}</option>)}
        </SelectField>
        <SelectField label={t("frequencyField")} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringFrequency })}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{frequencyLabel(f, t)}</option>)}
        </SelectField>
        {form.frequency === "MONTHLY" && (
          <Field label={t("dayOfMonthField")} type="number" min={1} max={28} value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })} />
        )}
        <Button variant="primary" className="w-full" onClick={save}>{t("saveRecurringExpenseBtn")}</Button>
      </div>
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("recurringExpensesTitle")}</h3>
          <Button onClick={runDue} disabled={busy}><Play size={14} /> {t("runDueNowBtn")}</Button>
        </div>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          columns={[
            { header: t("titleField"), render: (r) => r.title },
            { header: t("categoryField"), render: (r) => r.category },
            { header: t("amountCol"), render: (r) => money(r.amount) },
            { header: t("frequencyField"), render: (r) => frequencyLabel(r.frequency, t) },
            { header: t("nextRunCol"), render: (r) => formatDate(r.next_run_date) },
            { header: t("statusCol"), render: (r) => <Switch checked={r.status === "active"} onChange={() => toggle(r)} /> },
          ]}
        />
        <p className="text-xs text-stone-400">{t("recurringAutoPostHint")}</p>
      </div>
    </div>
  );
}

function BudgetsTab() {
  const { push } = useToast();
  const { t } = useLang();
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<BudgetSummaryRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});

  const load = () => { api.budgetsSummary(month).then((s) => setSummary(s as BudgetSummaryRow[])); };
  useEffect(load, [month]);
  useEffect(() => { api.expenseCategoriesList().then((c) => setCategories((c as ExpenseCategory[]).filter((x) => x.status === "active"))); }, []);

  const rows = useMemo(() => {
    const known = new Set(summary.map((s) => s.category));
    const extra = categories.filter((c) => !known.has(c.name)).map((c) => ({ category: c.name, budget: 0, spent: 0 }));
    return [...summary, ...extra].sort((a, b) => a.category.localeCompare(b.category));
  }, [summary, categories]);

  async function saveBudget(category: string) {
    const amount = edits[category];
    if (amount == null) return;
    await api.budgetsSet({ category, period_month: month, amount });
    push("success", `Budget for ${category} saved`);
    setEdits((e) => { const n = { ...e }; delete n[category]; return n; });
    load();
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-navy-900">{t("monthlyBudgetsVsActual")}</h3>
        <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <DataTable
        keyField={(r) => r.category}
        rows={rows}
        columns={[
          { header: t("categoryField"), render: (r) => r.category },
          { header: t("budgetCol"), render: (r) => (
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} className="input w-28 py-1"
                value={edits[r.category] ?? r.budget}
                onChange={(e) => setEdits({ ...edits, [r.category]: Number(e.target.value) })}
              />
              {edits[r.category] != null && edits[r.category] !== r.budget && (
                <Button onClick={() => saveBudget(r.category)}>{t("saveBtn")}</Button>
              )}
            </div>
          ) },
          { header: t("spentCol"), render: (r) => money(r.spent) },
          { header: t("remainingCol"), render: (r) => {
            const remaining = r.budget - r.spent;
            return <span className={remaining < 0 ? "font-medium text-red-600" : "text-stone-600"}>{money(remaining)}</span>;
          } },
          { header: "", render: (r) => (
            r.budget > 0 && r.spent > r.budget ? (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={12} /> {t("overBudget")}</span>
            ) : null
          ) },
        ]}
      />
    </div>
  );
}

function CategoriesTab() {
  const { push } = useToast();
  const { t } = useLang();
  const [rows, setRows] = useState<ExpenseCategory[]>([]);
  const [name, setName] = useState("");

  const load = () => { api.expenseCategoriesList().then((r) => setRows(r as ExpenseCategory[])); };
  useEffect(load, []);

  async function add() {
    if (!name.trim()) return;
    await api.expenseCategoriesSave({ name: name.trim() });
    push("success", "Category added");
    setName("");
    load();
  }
  async function toggle(row: ExpenseCategory) {
    await api.expenseCategoriesSave({ id: row.id, name: row.name, status: row.status === "active" ? "inactive" : "active" });
    load();
  }

  return (
    <div className="card max-w-xl space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><Tag size={15} /> {t("expenseCategoriesTitle")}</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: t("categoryField"), render: (r) => r.name },
          { header: t("statusCol"), render: (r) => <Switch checked={r.status === "active"} onChange={() => toggle(r)} /> },
        ]}
      />
      <div className="flex gap-2">
        <Field label={t("addCategoryField")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("vehicleMaintenancePlaceholder")} />
        <Button className="mt-5" onClick={add} disabled={!name.trim()}><Plus size={14} /> {t("addBtn")}</Button>
      </div>
    </div>
  );
}

export function Expenses({ user }: { user: AuthUser }) {
  const { t } = useLang();
  const [tab, setTab] = useState("expenses");
  const tabs = useMemo(() => ([
    { id: "expenses", label: t("expenses"), icon: Wallet },
    { id: "recurring", label: t("recurringTab"), icon: Repeat },
    { id: "budgets", label: t("budgetsTab"), icon: AlertTriangle },
    { id: "categories", label: t("categories"), icon: Tag },
  ]), [t]);

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "expenses" && <ExpensesTab user={user} />}
      {tab === "recurring" && <RecurringTab user={user} />}
      {tab === "budgets" && <BudgetsTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}
