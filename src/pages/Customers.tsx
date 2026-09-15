import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField, TextAreaField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Customer } from "../types";

export function Customers({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [rows, setRows] = useState<Customer[]>([]);
  const [edit, setEdit] = useState<Partial<Customer> | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null);

  const load = () => api.customersList().then((c) => setRows(c as Customer[]));
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit?.name) { push("error", "Name is required"); return; }
    await api.customersSave(edit);
    push("success", "Customer saved");
    setEdit(null);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setEdit({ customer_type: "Retail" })}><Plus size={15} /> Add Customer</Button>
      </div>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Shop / Name", render: (r) => <div><p className="font-medium text-stone-800">{r.shop_name || r.name}</p><p className="text-xs text-stone-400">{r.name}</p></div> },
          { header: "Type", render: (r) => r.customer_type },
          { header: "Phone", render: (r) => r.phone || "—" },
          { header: "City / Area", render: (r) => [r.city, r.area].filter(Boolean).join(" / ") || "—" },
          { header: "Credit Limit", render: (r) => money(r.credit_limit) },
          { header: "Balance", render: (r) => <span className={r.balance > 0 ? "font-medium text-red-600" : ""}>{money(r.balance)}</span> },
          { header: "", render: (r) => (
            <div className="flex gap-2">
              <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setEdit(r)}>Edit</button>
              <button className="text-xs font-medium text-stone-500 hover:underline" onClick={() => setLedgerFor(r)}>Ledger</button>
            </div>
          ) },
        ]}
      />

      {edit && (
        <Modal title={edit.id ? "Edit Customer" : "Add Customer"} onClose={() => setEdit(null)} wide>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Shop Name" value={edit.shop_name || ""} onChange={(e) => setEdit({ ...edit, shop_name: e.target.value })} />
            <Field label="Customer Name" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Field label="Phone" value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            <Field label="WhatsApp" value={edit.whatsapp || ""} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} />
            <Field label="City" value={edit.city || ""} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
            <Field label="Area" value={edit.area || ""} onChange={(e) => setEdit({ ...edit, area: e.target.value })} />
            <SelectField label="Customer Type" value={edit.customer_type || "Retail"} onChange={(e) => setEdit({ ...edit, customer_type: e.target.value as Customer["customer_type"] })}>
              <option>Retail</option><option>Wholesale</option><option>Distributor</option>
            </SelectField>
            <Field label="Credit Limit" type="number" value={edit.credit_limit ?? 0} onChange={(e) => setEdit({ ...edit, credit_limit: Number(e.target.value) })} />
            {!edit.id && <Field label="Opening Balance" type="number" value={edit.opening_balance ?? 0} onChange={(e) => setEdit({ ...edit, opening_balance: Number(e.target.value) })} />}
            <div className="sm:col-span-2"><TextAreaField label="Address" value={edit.address || ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></div>
            <div className="sm:col-span-2"><TextAreaField label="Notes" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Customer</Button>
          </div>
        </Modal>
      )}

      {ledgerFor && <LedgerModal customer={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function LedgerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [rows, setRows] = useState<Array<{ id: number; type: string; direction: number; amount: number; reference: string; note: string; created_at: string }>>([]);
  useEffect(() => { api.customersLedger(customer.id).then((r) => setRows(r as typeof rows)); }, [customer.id]);
  return (
    <Modal title={`Ledger — ${customer.shop_name || customer.name}`} onClose={onClose} wide>
      <div className="mb-3 flex justify-between rounded-md bg-stone-50 px-3 py-2 text-sm">
        <span>Opening Balance</span><span className="font-medium">{money(customer.opening_balance)}</span>
      </div>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Date", render: (r) => formatDateTime(r.created_at) },
          { header: "Type", render: (r) => r.type.replace(/_/g, " ") },
          { header: "Reference", render: (r) => r.reference },
          { header: "Note", render: (r) => r.note },
          { header: "Amount", render: (r) => <span className={r.direction > 0 ? "text-red-600" : "text-brand-green-700"}>{r.direction > 0 ? "+" : "-"}{money(r.amount)}</span> },
        ]}
      />
      <div className="mt-3 flex justify-between rounded-md bg-brand-green-50 px-3 py-2 text-sm font-semibold">
        <span>Outstanding</span><span>{money(customer.balance)}</span>
      </div>
    </Modal>
  );
}
