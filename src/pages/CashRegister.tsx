import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Banknote, CheckCircle2, Landmark, Lock, PiggyBank, Plus, Unlock } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import { useLang } from "../lib/i18n";
import type { AuthUser, BankAccount, BankTransaction, CashRegisterState, PettyCashEntry } from "../types";

// Pakistani currency denominations (Section 27).
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

function RegisterTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const { t } = useLang();
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
        <h3 className="text-sm font-semibold text-brand-navy-900">{t("openCashRegisterTitle")}</h3>
        <Field label={t("openingCash")} type="number" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
        <Button variant="primary" className="w-full" onClick={open}><Unlock size={15} /> {t("openRegisterBtn")}</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card"><p className="label">{t("openingCash")}</p><p className="text-lg font-semibold">{money(state.opening_cash)}</p></div>
          <div className="card"><p className="label">{t("cashInLabel")}</p><p className="text-lg font-semibold text-brand-green-700">{money(state.cashIn)}</p></div>
          <div className="card"><p className="label">{t("cashOutLabel")}</p><p className="text-lg font-semibold text-red-600">{money(state.cashOut)}</p></div>
          <div className="card"><p className="label">{t("expectedClosing")}</p><p className="text-lg font-semibold">{money(state.expected)}</p></div>
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">{t("todaysCashMovements")}</h3>
          <DataTable
            keyField={(r) => r.id}
            rows={state.transactions}
            pageSize={20}
            columns={[
              { header: t("timeCol"), render: (r) => formatDateTime(r.created_at) },
              { header: t("directionCol"), render: (r) => <span className={r.direction === "IN" ? "text-brand-green-700" : "text-red-600"}>{t(r.direction === "IN" ? "dirIn" : "dirOut")}</span> },
              { header: t("categoryCol"), render: (r) => r.category.replace(/_/g, " ") },
              { header: t("referenceCol"), render: (r) => r.reference },
              { header: t("noteCol"), render: (r) => r.note },
              { header: t("amountCol"), render: (r) => money(r.amount) },
            ]}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("cashWithdrawal")}</h3>
          <Field label={t("amountCol")} type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(Number(e.target.value))} />
          <Field label={t("reasonLabel")} value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} />
          <Button className="w-full" onClick={withdraw} disabled={withdrawAmount <= 0}>{t("recordWithdrawal")}</Button>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("denominationCount")}</h3>
          {DENOMINATIONS.map((d) => (
            <div key={d} className="flex items-center justify-between gap-2 text-sm">
              <span className="w-16 text-stone-500">Rs. {d}</span>
              <input type="number" min={0} className="input w-20" value={counts[d] || 0} onChange={(e) => setCounts({ ...counts, [d]: Number(e.target.value) })} />
              <span className="w-24 text-right text-stone-500">{money(d * (counts[d] || 0))}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold"><span>{t("actualCash")}</span><span>{money(actualCash)}</span></div>
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("closeDay")}</h3>
          <Field label={t("closingNotes")} value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} />
          <Button variant="danger" className="w-full" onClick={close}><Lock size={15} /> {t("closeRegisterBtn")}</Button>
          {closeResult && (
            <div className={`mt-2 rounded-md p-3 text-sm ${closeResult.status === "MATCHED" ? "bg-brand-green-50 text-brand-green-800" : "bg-red-50 text-red-800"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {closeResult.status === "MATCHED" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {closeResult.status === "MATCHED" ? t("matchedStatus") : closeResult.status === "OVER" ? t("cashOverStatus") : t("cashShortStatus")}
              </div>
              <p>{t("expectedPrefix")} {money(closeResult.expected)}</p>
              <p>{t("actualPrefix")} {money(closeResult.actual)}</p>
              <p>{t("differencePrefix")} {money(closeResult.difference)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BankAccountsTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const { t } = useLang();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);

  const load = () => { api.bankAccountsList().then((a) => setAccounts(a as BankAccount[])); };
  useEffect(load, []);

  useEffect(() => {
    if (selectedId) api.bankTransactionsList(selectedId).then((t) => setTransactions(t as BankTransaction[]));
    else setTransactions([]);
  }, [selectedId]);

  async function saveAccount() {
    if (!name.trim()) { push("error", "Account name is required"); return; }
    await api.bankAccountSave({ name, bank_name: bankName, account_number: accountNumber, opening_balance: openingBalance, actorId: user.id });
    push("success", "Bank account saved");
    setName(""); setBankName(""); setAccountNumber(""); setOpeningBalance(0); setShowAdd(false);
    load();
  }

  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-navy-900">{t("tabBankAccounts")}</h3>
          <Button onClick={() => setShowAdd((v) => !v)}><Plus size={14} /> {showAdd ? t("cancelBtn") : t("addAccount")}</Button>
        </div>
        {showAdd && (
          <div className="grid grid-cols-2 gap-3 rounded-card border border-stone-200 bg-stone-50 p-3">
            <Field label={t("accountName")} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Business Account" />
            <Field label={t("bankName")} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Field label={t("accountNumber")} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            <Field label={t("openingBalance")} type="number" value={openingBalance} onChange={(e) => setOpeningBalance(Number(e.target.value))} />
            <Button variant="primary" className="col-span-2" onClick={saveAccount}>{t("saveAccount")}</Button>
          </div>
        )}
        <DataTable
          keyField={(r) => r.id}
          rows={accounts}
          onRowClick={(r) => setSelectedId(r.id)}
          columns={[
            { header: t("nameCol"), render: (r) => <span className={r.id === selectedId ? "font-semibold text-brand-green-700" : ""}>{r.name}</span> },
            { header: t("bankCol"), render: (r) => r.bank_name || "—" },
            { header: t("accountNumCol"), render: (r) => r.account_number || "—" },
            { header: t("balance"), render: (r) => money(r.balance) },
          ]}
        />
      </div>

      <div className="card space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><Landmark size={15} /> {selected ? selected.name : t("selectAnAccount")}</h3>
        {selected ? (
          <>
            <div className="rounded-md bg-stone-50 p-3 text-sm">
              <p className="text-xs text-stone-400">{t("currentBalance")}</p>
              <p className="text-lg font-semibold text-brand-navy-900">{money(selected.balance)}</p>
            </div>
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {transactions.length === 0 && <p className="py-4 text-center text-sm text-stone-400">{t("noTransactionsYet")}</p>}
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-2 rounded-md border border-stone-100 p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-stone-700">{tx.note || tx.category.replace(/_/g, " ")}</p>
                    <p className="text-xs text-stone-400">{tx.reference} &middot; {formatDateTime(tx.created_at)}</p>
                  </div>
                  <span className={`whitespace-nowrap font-medium ${tx.direction === "IN" ? "text-brand-green-700" : "text-red-600"}`}>
                    {tx.direction === "IN" ? "+" : "-"}{money(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-stone-400">{t("clickBankAccountHint")}</p>
        )}
      </div>
    </div>
  );
}

function PettyCashTab() {
  const { t } = useLang();
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<PettyCashEntry[]>([]);

  const load = () => {
    api.pettyBalance().then((b) => setBalance(b as number));
    api.pettyList().then((e) => setEntries(e as PettyCashEntry[]));
  };
  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="card max-w-xs space-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><PiggyBank size={15} /> {t("pettyCashBalance")}</h3>
        <p className="text-2xl font-semibold text-brand-navy-900">{money(balance)}</p>
        <p className="text-xs text-stone-400">{t("pettyCashHint")}</p>
      </div>
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-brand-navy-900">{t("pettyCashHistory")}</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={entries}
          pageSize={20}
          columns={[
            { header: t("directionCol"), render: (r) => <span className={r.direction === "IN" ? "text-brand-green-700" : "text-red-600"}>{t(r.direction === "IN" ? "dirIn" : "dirOut")}</span> },
            { header: t("referenceCol"), render: (r) => r.reference },
            { header: t("noteCol"), render: (r) => r.note },
            { header: t("amountCol"), render: (r) => money(r.amount) },
            { header: t("dateCol"), render: (r) => formatDateTime(r.created_at) },
          ]}
        />
      </div>
    </div>
  );
}

type TransferEndpoint = "CASH" | "PETTY" | `BANK:${number}`;

function TransferTab({ user, registerOpen, accounts, onTransferred }: { user: AuthUser; registerOpen: boolean; accounts: BankAccount[]; onTransferred: () => void }) {
  const { push } = useToast();
  const { t } = useLang();
  const [from, setFrom] = useState<TransferEndpoint>("CASH");
  const [to, setTo] = useState<TransferEndpoint>("PETTY");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function decode(v: TransferEndpoint) {
    if (v === "CASH" || v === "PETTY") return { kind: v as "CASH" | "PETTY" };
    return { kind: "BANK" as const, account_id: Number(v.split(":")[1]) };
  }

  async function submit() {
    if (from === to) { push("error", "Choose two different accounts"); return; }
    if (amount <= 0) { push("error", "Enter an amount greater than zero"); return; }
    const f = decode(from), t = decode(to);
    if ((f.kind === "CASH" || t.kind === "CASH") && !registerOpen) { push("error", "Open the cash register before transferring cash"); return; }
    setBusy(true);
    try {
      const result = await api.cashTransfer({
        from: f.kind, to: t.kind, from_account_id: f.account_id, to_account_id: t.account_id,
        amount, note, actorId: user.id,
      }) as { reference: string };
      push("success", `Transfer ${result.reference} recorded`);
      setAmount(0); setNote("");
      onTransferred();
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to record transfer");
    } finally {
      setBusy(false);
    }
  }

  const options: Array<{ value: TransferEndpoint; label: string }> = [
    { value: "CASH", label: t("cashRegister") },
    { value: "PETTY", label: t("pettyCash") },
    ...accounts.map((a) => ({ value: `BANK:${a.id}` as TransferEndpoint, label: `${t("bankPrefix")} — ${a.name}` })),
  ];

  return (
    <div className="card max-w-lg space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><ArrowLeftRight size={15} /> {t("cashTransferTitle")}</h3>
      <p className="text-xs text-stone-400">{t("cashTransferHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t("fromLabel")} value={from} onChange={(e) => setFrom(e.target.value as TransferEndpoint)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
        <SelectField label={t("toLabel")} value={to} onChange={(e) => setTo(e.target.value as TransferEndpoint)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectField>
      </div>
      <Field label={t("amountCol")} type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      <Field label={t("noteCol")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("transferReasonPlaceholder")} />
      <Button variant="primary" className="w-full" onClick={submit} disabled={busy || amount <= 0}>
        <Banknote size={15} /> {t("recordTransfer")}
      </Button>
    </div>
  );
}

export function CashRegister({ user }: { user: AuthUser }) {
  const { t } = useLang();
  const [tab, setTab] = useState("register");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadShared = () => {
    api.bankAccountsList().then((a) => setAccounts(a as BankAccount[]));
    api.cashCurrent().then((s) => setRegisterOpen(!!s));
  };
  useEffect(loadShared, [refreshKey]);

  const tabs = useMemo(() => ([
    { id: "register", label: t("tabRegister"), icon: Lock },
    { id: "bank", label: t("tabBankAccounts"), icon: Landmark },
    { id: "petty", label: t("pettyCash"), icon: PiggyBank },
    { id: "transfer", label: t("tabTransfer"), icon: ArrowLeftRight },
  ]), [t]);

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "register" && <RegisterTab user={user} />}
      {tab === "bank" && <BankAccountsTab user={user} />}
      {tab === "petty" && <PettyCashTab />}
      {tab === "transfer" && <TransferTab user={user} registerOpen={registerOpen} accounts={accounts} onTransferred={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
