import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, TextAreaField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { Supplier } from "../types";

export function Suppliers() {
  const { push } = useToast();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [edit, setEdit] = useState<Partial<Supplier> | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Supplier | null>(null);

  const load = () => api.suppliersList().then((s) => setRows(s as Supplier[]));
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit?.name) { push("error", "Name is required"); return; }
    await api.suppliersSave(edit);
    push("success", "Supplier saved");
    setEdit(null);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setEdit({})}><Plus size={15} /> Add Supplier</Button>
      </div>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Name", render: (r) => r.name },
          { header: "Contact Person", render: (r) => r.contact_person || "—" },
          { header: "Phone", render: (r) => r.phone || "—" },
          { header: "City", render: (r) => r.city || "—" },
          { header: "Category", render: (r) => r.category || "—" },
          { header: "Payable", render: (r) => <span className={r.balance > 0 ? "font-medium text-red-600" : ""}>{money(r.balance)}</span> },
          { header: "", render: (r) => (
            <div className="flex gap-2">
              <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setEdit(r)}>Edit</button>
              <button className="text-xs font-medium text-stone-500 hover:underline" onClick={() => setLedgerFor(r)}>Ledger</button>
            </div>
          ) },
        ]}
      />
      {edit && (
        <Modal title={edit.id ? "Edit Supplier" : "Add Supplier"} onClose={() => setEdit(null)} wide>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Supplier Name" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Field label="Contact Person" value={edit.contact_person || ""} onChange={(e) => setEdit({ ...edit, contact_person: e.target.value })} />
            <Field label="Phone" value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            <Field label="WhatsApp" value={edit.whatsapp || ""} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} />
            <Field label="City" value={edit.city || ""} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
            <Field label="Category" value={edit.category || ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="Fertilizer, Grains…" />
            {!edit.id && <Field label="Opening Payable" type="number" value={edit.opening_balance ?? 0} onChange={(e) => setEdit({ ...edit, opening_balance: Number(e.target.value) })} />}
            <div className="sm:col-span-2"><TextAreaField label="Address" value={edit.address || ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></div>
            <div className="sm:col-span-2"><TextAreaField label="Notes" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Supplier</Button>
          </div>
        </Modal>
      )}
      {ledgerFor && <SupplierLedgerModal supplier={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function SupplierLedgerModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [rows, setRows] = useState<Array<{ id: number; type: string; direction: number; amount: number; reference: string; note: string; created_at: string }>>([]);
  useEffect(() => { api.suppliersLedger(supplier.id).then((r) => setRows(r as typeof rows)); }, [supplier.id]);
  return (
    <Modal title={`Ledger — ${supplier.name}`} onClose={onClose} wide>
      <div className="mb-3 flex justify-between rounded-md bg-stone-50 px-3 py-2 text-sm">
        <span>Opening Payable</span><span className="font-medium">{money(supplier.opening_balance)}</span>
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
        <span>Outstanding Payable</span><span>{money(supplier.balance)}</span>
      </div>
    </Modal>
  );
}
