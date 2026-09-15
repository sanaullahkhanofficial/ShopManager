import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, todayIso, formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Expense, PaymentMethod } from "../types";

const CATEGORIES = ["Electricity", "Internet", "Salary", "Transport", "Fuel", "Rent", "Repairs", "Office Supplies", "Maintenance", "Bank Charges", "Miscellaneous", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque"];

export function Expenses({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [form, setForm] = useState({ title: "", category: "Miscellaneous", amount: 0, payment_method: "Cash" as PaymentMethod, paid_by: "", note: "", expense_date: todayIso() });

  const load = () => api.expensesList().then((e) => setRows(e as Expense[]));
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.title || form.amount <= 0) { push("error", "Title and a positive amount are required"); return; }
    await api.expensesAdd({ ...form, actorId: user.id });
    push("success", "Expense recorded");
    setForm({ title: "", category: "Miscellaneous", amount: 0, payment_method: "Cash", paid_by: "", note: "", expense_date: todayIso() });
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Add Expense</h3>
        <Field label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <SelectField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </SelectField>
        <Field label="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        <SelectField label="Payment Method" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}>
          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </SelectField>
        <Field label="Paid By" value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })} />
        <Field label="Date" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        <Field label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <Button variant="primary" className="w-full" onClick={save}>Save Expense</Button>
      </div>
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Recent Expenses</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          columns={[
            { header: "Date", render: (r) => formatDate(r.expense_date) },
            { header: "Title", render: (r) => r.title },
            { header: "Category", render: (r) => r.category },
            { header: "Method", render: (r) => r.payment_method },
            { header: "Amount", render: (r) => money(r.amount) },
          ]}
        />
      </div>
    </div>
  );
}
