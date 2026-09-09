import { useState } from "react";
import { Plus, Layers, Printer, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useClasses } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, todayIso } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { voucherHtml } from "@/lib/feeDocs";

export function FeeVouchersPage() {
  const classes = useClasses();
  const school = useSettingsStore((s) => s.school);
  const symbol = school?.currency_symbol || "$";
  const [bulkOpen, setBulkOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [classFilter, setClassFilter] = useState("");

  async function loadOutstanding() {
    const res = await api.invoices.outstanding({ classId: classFilter ? Number(classFilter) : undefined });
    setRows(res);
    setSearched(true);
  }

  async function printVoucher(invoiceId: number) {
    const full = await api.invoices.getById(invoiceId);
    const html = voucherHtml(school, full, full.student);
    api.print.openWindow(html).catch((e) => toast.error(e.message));
  }

  return (
    <div>
      <PageHeader title="Fee Vouchers" description="Generate and print monthly fee vouchers for students."
        action={<>
          <Button variant="outline" onClick={() => setBulkOpen(true)}><Layers className="h-4 w-4" /> Bulk Generate</Button>
          <Button onClick={() => setSingleOpen(true)}><Plus className="h-4 w-4" /> Generate for Student</Button>
        </>} />

      <div className="mb-3 flex items-center gap-2">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={loadOutstanding}>Show Vouchers</Button>
      </div>

      {!searched ? (
        <EmptyState icon={Receipt} title="Generate or view vouchers" description="Use the buttons above to generate vouchers, or click Show Vouchers to list existing outstanding ones." />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No outstanding vouchers found" />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Voucher</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Period</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs">{inv.voucher_no}</TableCell>
                <TableCell>{inv.first_name} {inv.last_name} <span className="text-xs text-muted-foreground">({inv.admission_no})</span></TableCell>
                <TableCell>{inv.class_name} {inv.section_name}</TableCell>
                <TableCell>{inv.period_label}</TableCell>
                <TableCell>{formatCurrency(inv.total_amount, symbol)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(inv.balance, symbol)}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => printVoucher(inv.id)}><Printer className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <BulkGenerateDialog open={bulkOpen} onOpenChange={setBulkOpen} classes={classes} onDone={loadOutstanding} />
      <SingleGenerateDialog open={singleOpen} onOpenChange={setSingleOpen} onDone={loadOutstanding} />
    </div>
  );
}

function BulkGenerateDialog({ open, onOpenChange, classes, onDone }: any) {
  const [classId, setClassId] = useState("");
  const [periodLabel, setPeriodLabel] = useState(new Date().toLocaleString("default", { month: "long", year: "numeric" }));
  const [dueDate, setDueDate] = useState(todayIso());
  const [frequency, setFrequency] = useState("monthly");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setRunning(true); setResult(null);
    try {
      const res = await api.invoices.bulkGenerate({ classId: classId ? Number(classId) : undefined, periodLabel, issueDate: todayIso(), dueDate, frequency });
      setResult(res);
      toast.success(`Generated ${res.generated} voucher(s).`);
      onDone();
    } catch (err: any) { toast.error(err.message); } finally { setRunning(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Generate Vouchers</DialogTitle>
          <DialogDescription>Generates a voucher for every active student in the selected class (or all classes), based on that class's fee structure and any active scholarships.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Class (leave blank for all)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label required>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["monthly", "term", "annual", "one_time"].map((f) => <SelectItem key={f} value={f}>{f.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label required>Period Label</Label><Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} /></div>
          <div className="space-y-1.5"><Label required>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        {result && (
          <p className="text-sm text-muted-foreground">
            Generated: {result.generated}, Skipped: {result.skipped}
            {result.errors.length > 0 && ` (e.g. ${result.errors[0].message})`}
          </p>
        )}
        <DialogFooter><Button loading={running} onClick={run}>Generate</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SingleGenerateDialog({ open, onOpenChange, onDone }: any) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [periodLabel, setPeriodLabel] = useState(new Date().toLocaleString("default", { month: "long", year: "numeric" }));
  const [dueDate, setDueDate] = useState(todayIso());
  const [frequency, setFrequency] = useState("monthly");
  const [saving, setSaving] = useState(false);

  async function search() { if (q.trim().length >= 2) setResults(await api.payments.search(q)); }

  async function submit() {
    if (!student) { toast.error("Select a student."); return; }
    setSaving(true);
    try {
      const res = await api.invoices.generate({ studentId: student.id, periodLabel, issueDate: todayIso(), dueDate, frequency });
      toast.success(`Voucher ${res.voucherNo} generated.`);
      onOpenChange(false); onDone();
      setStudent(null); setQ("");
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generate Voucher for Student</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!student ? (
            <div className="relative">
              <Input placeholder="Search student…" value={q} onChange={(e) => { setQ(e.target.value); }} onKeyUp={search} />
              {results.length > 0 && (
                <div className="mt-1 rounded-md border border-border">
                  {results.map((s) => (
                    <button key={s.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setStudent(s); setResults([]); }}>
                      {s.first_name} {s.last_name} ({s.admission_no})
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm">Selected: <strong>{student.first_name} {student.last_name}</strong> ({student.admission_no}) <button className="ml-2 text-xs text-primary underline" onClick={() => setStudent(null)}>change</button></p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label required>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["monthly", "term", "annual", "one_time"].map((f) => <SelectItem key={f} value={f}>{f.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label required>Period Label</Label><Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} /></div>
            <div className="space-y-1.5"><Label required>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Generate Voucher</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
