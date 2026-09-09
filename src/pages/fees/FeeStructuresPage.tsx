import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useClasses } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

export function FeeStructuresPage() {
  const classes = useClasses();
  const school = useSettingsStore((s) => s.school);
  const [categories, setCategories] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [structOpen, setStructOpen] = useState(false);

  function load() {
    api.fees.listCategories().then(setCategories);
    api.fees.listStructures().then(setStructures);
  }
  useEffect(load, []);

  async function addCategory() {
    if (!newCat.trim()) return;
    try { await api.fees.createCategory({ name: newCat, isRecurring: true }); setNewCat(""); setCatOpen(false); load(); toast.success("Category added."); }
    catch (err: any) { toast.error(err.message); }
  }

  const symbol = school?.currency_symbol || "$";

  return (
    <div>
      <PageHeader title="Fee Structures" description="Define fee categories and per-class amounts."
        action={<>
          <Button variant="outline" onClick={() => setCatOpen(true)}><Plus className="h-4 w-4" /> Category</Button>
          <Button onClick={() => setStructOpen(true)}><Plus className="h-4 w-4" /> Fee Structure</Button>
        </>} />

      {structures.length === 0 ? (
        <EmptyState icon={Wallet} title="No fee structures defined yet" actionLabel="Add Fee Structure" onAction={() => setStructOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Category</TableHead><TableHead>Frequency</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {structures.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.class_name}</TableCell><TableCell>{s.category_name}</TableCell>
                <TableCell className="capitalize">{s.frequency.replace("_", " ")}</TableCell>
                <TableCell className="font-medium">{formatCurrency(s.amount, symbol)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Add Fee Category</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label required>Category Name</Label><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} /></div>
          <DialogFooter><Button onClick={addCategory}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <StructureFormDialog open={structOpen} onOpenChange={setStructOpen} classes={classes} categories={categories} onSaved={load} />
    </div>
  );
}

function StructureFormDialog({ open, onOpenChange, classes, categories, onSaved }: any) {
  const [classId, setClassId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!classId || !categoryId || !amount) { toast.error("Class, category and amount are required."); return; }
    setSaving(true);
    try {
      await api.fees.saveStructure({ classId: Number(classId), categoryId: Number(categoryId), frequency, amount: Number(amount) });
      toast.success("Fee structure saved.");
      onOpenChange(false); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Add Fee Structure</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label required>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label required>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label required>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["monthly", "term", "annual", "one_time"].map((f) => <SelectItem key={f} value={f}>{f.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label required>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
