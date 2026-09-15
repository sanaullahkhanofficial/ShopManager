import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, Unlock } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, CashRegisterState } from "../types";

// Pakistani currency denominations (Section 27).
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

export function CashRegister({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [state, setState] = useState<CashRegisterState | null>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawNote, setWithdrawNote] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closeResult, setCloseResult] = useState<{ expected: number; actual: number; difference: number; status: string } | null>(null);

  const load = () => api.cashCurrent().then((s) => setState(s as CashRegisterState | null));
  useEffect(() => { load(); }, []);

  const actualCash = DENOMINATIONS.reduce((a, d) => a + d * (counts[d] || 0), 0);

  async function open() {
    await api.cashOpen({ opening_cash: openingCash, actorId: user.id });
    push("success", "Cash register opened");
    load();
  }

  async function withdraw() {
    if (withdrawAmount <= 0) return;
    await api.cashTransaction({ direction: "OUT", category: "WITHDRAWAL", amount: withdrawAmount, note: withdrawNote, actorId: user.id });
    push("success", "Withdrawal recorded");
    setWithdrawAmount(0); setWithdrawNote("");
    load();
  }

  async function close() {
    const result = await api.cashClose({ actual_cash: actualCash, notes: closingNotes, actorId: user.id }) as { expected: number; actual: number; difference: number; status: string };
    setCloseResult(result);
    load();
  }

  if (!state) {
    return (
      <div className="card max-w-sm space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">Open Cash Register</h3>
        <Field label="Opening Cash" type="number" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
        <Button variant="primary" className="w-full" onClick={open}><Unlock size={15} /> Open Register</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card"><p className="label">Opening Cash</p><p className="text-lg font-semibold">{money(state.opening_cash)}</p></div>
          <div className="card"><p className="label">Cash In</p><p className="text-lg font-semibold text-brand-green-700">{money(state.cashIn)}</p></div>
          <div className="card"><p className="label">Cash Out</p><p className="text-lg font-semibold text-red-600">{money(state.cashOut)}</p></div>
          <div className="card"><p className="label">Expected Closing</p><p className="text-lg font-semibold">{money(state.expected)}</p></div>
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Today's Cash Movements</h3>
          <DataTable
            keyField={(r) => r.id}
            rows={state.transactions}
            columns={[
              { header: "Time", render: (r) => formatDateTime(r.created_at) },
              { header: "Direction", render: (r) => <span className={r.direction === "IN" ? "text-brand-green-700" : "text-red-600"}>{r.direction}</span> },
              { header: "Category", render: (r) => r.category.replace(/_/g, " ") },
              { header: "Reference", render: (r) => r.reference },
              { header: "Note", render: (r) => r.note },
              { header: "Amount", render: (r) => money(r.amount) },
            ]}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-navy-900">Cash Withdrawal</h3>
          <Field label="Amount" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(Number(e.target.value))} />
          <Field label="Reason" value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} />
          <Button className="w-full" onClick={withdraw} disabled={withdrawAmount <= 0}>Record Withdrawal</Button>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-navy-900">Denomination Count</h3>
          {DENOMINATIONS.map((d) => (
            <div key={d} className="flex items-center justify-between gap-2 text-sm">
              <span className="w-16 text-stone-500">Rs. {d}</span>
              <input type="number" min={0} className="input w-20" value={counts[d] || 0} onChange={(e) => setCounts({ ...counts, [d]: Number(e.target.value) })} />
              <span className="w-24 text-right text-stone-500">{money(d * (counts[d] || 0))}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold"><span>Actual Cash</span><span>{money(actualCash)}</span></div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-navy-900">Close Day</h3>
          <Field label="Closing Notes" value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} />
          <Button variant="danger" className="w-full" onClick={close}><Lock size={15} /> Close Register</Button>
          {closeResult && (
            <div className={`mt-2 rounded-md p-3 text-sm ${closeResult.status === "MATCHED" ? "bg-brand-green-50 text-brand-green-800" : "bg-red-50 text-red-800"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {closeResult.status === "MATCHED" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {closeResult.status === "MATCHED" ? "MATCHED" : closeResult.status === "OVER" ? "CASH OVER" : "CASH SHORT"}
              </div>
              <p>Expected: {money(closeResult.expected)}</p>
              <p>Actual: {money(closeResult.actual)}</p>
              <p>Difference: {money(closeResult.difference)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
