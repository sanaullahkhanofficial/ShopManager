import { useEffect, useState } from "react";
import { Plus, Landmark, Trash2, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, todayIso } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { exportToCsv } from "@/lib/export";

export function ExpensesPage() {
  const school = useSettingsStore((s) => s.school);
  const symbol = school?.currency_symbol || "$";
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  function load() {
    api.expenses.list().then(setRows);
    api.expenses.listCategories().then(setCategories);
  }
  useEffect(load, []);

  async function remove(id: number) {
    const ok = await confirm({ title: "Delete expense?", description: "This will permanently remove this expense record.", destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    await api.expenses.delete(id);
    toast.success("Expense deleted.");
    load();
  }

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      <PageHeader title="Expenses" description={`Total recorded: ${formatCurrency(total, symbol)}`}
        action={<>
          <Button variant="outline" onClick={() => exportToCsv("expenses.csv", rows)}><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Expense</Button>
        </>} />

      {rows.length === 0 ? (
        <EmptyState icon={Landmark} title="No expenses recorded yet" actionLabel="Add Expense" onAction={() => setOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Expense #</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead>Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.expense_no}</TableCell>
                <TableCell>{e.expense_date}</TableCell>
                <TableCell>{e.category_name || "—"}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>{e.vendor || "—"}</TableCell>
                <TableCell className="font-medium">{formatCurrency(e.amount, symbol)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ExpenseFormDialog open={open} onOpenChange={setOpen} categories={categories} onSaved={load} />
      {dialog}
    </div>
  );
}

function ExpenseFormDialog({ open, onOpenChange, categories, onSaved }: any) {
  const [form, setForm] = useState<any>({ categoryId: "", description: "", amount: "", paymentMethod: "cash", vendor: "", notes: "", expenseDate: todayIso() });
  const [saving, setSaving] = useState(false);
  function f(k: string, v: any) { setForm((s: any) => ({ ...s, [k]: v })); }

  async function submit() {
    if (!form.description || !form.amount) { toast.error("Description and amount are required."); return; }
    setSaving(true);
    try {
      const res = await api.expenses.create({ ...form, categoryId: form.categoryId ? Number(form.categoryId) : null, amount: Number(form.amount) });
      toast.success(`Expense ${res.expenseNo} recorded.`);
      onOpenChange(false); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label required>Description</Label><Input value={form.description} onChange={(e) => f("description", e.target.value)} /></div>
          <div className="space-y-1.5"><Label required>Amount</Label><Input type="number" value={form.amount} onChange={(e) => f("amount", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={(v) => f("categoryId", v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => f("paymentMethod", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["cash", "bank_transfer", "card", "other"].map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => f("vendor", e.target.value)} /></div>
          <div className="space-y-1.5"><Label required>Date</Label><Input type="date" value={form.expenseDate} onChange={(e) => f("expenseDate", e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Save Expense</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
