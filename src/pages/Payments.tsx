import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Customer, PaymentMethod, Supplier } from "../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque"];

export function Payments({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [type, setType] = useState<"customer" | "supplier">("customer");
  const [entityId, setEntityId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [note, setNote] = useState("");

  const load = () => {
    api.customersList().then((c) => setCustomers(c as Customer[]));
    api.suppliersList().then((s) => setSuppliers(s as Supplier[]));
  };
  useEffect(load, []);

  const options = type === "customer" ? customers : suppliers;

  async function save() {
    if (!entityId || amount <= 0) { push("error", "Select an account and enter an amount"); return; }
    const result = await api.paymentsAdd({ type, entity_id: Number(entityId), amount, payment_method: method, note, actorId: user.id }) as { reference: string };
    push("success", `Payment ${result.reference} recorded`);
    setAmount(0); setNote(""); setEntityId("");
    load();
  }

  return (
    <div className="card max-w-md space-y-3">
      <h3 className="text-sm font-semibold text-brand-navy-900">Record Payment</h3>
      <SelectField label="Account Type" value={type} onChange={(e) => { setType(e.target.value as typeof type); setEntityId(""); }}>
        <option value="customer">Customer — payment received</option>
        <option value="supplier">Supplier — payment made</option>
      </SelectField>
      <SelectField label="Account" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
        <option value="">Select</option>
        {options.map((o) => <option key={o.id} value={o.id}>{"shop_name" in o ? (o.shop_name || o.name) : o.name} — {money(o.balance)}</option>)}
      </SelectField>
      <Field label="Amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      <SelectField label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </SelectField>
      <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button variant="primary" className="w-full" onClick={save}>Save Payment</Button>
      {method === "Cash" && <p className="text-xs text-stone-400">Cash payments update today's cash register automatically.</p>}
    </div>
  );
}
