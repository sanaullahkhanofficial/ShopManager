import { useEffect, useState } from "react";
import { Plus, Award } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { todayIso } from "@/lib/utils";

export function ScholarshipsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  function load() { api.scholarships.listAll().then(setRows); }
  useEffect(load, []);

  async function revoke(id: number) {
    await api.scholarships.setStatus(id, "revoked");
    load();
  }

  return (
    <div>
      <PageHeader title="Scholarships & Discounts" description="Manage percentage, fixed and full scholarships applied automatically to fee vouchers." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Scholarship</Button>} />
      {rows.length === 0 ? (
        <EmptyState icon={Award} title="No scholarships recorded yet" actionLabel="Add Scholarship" onAction={() => setOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.first_name} {s.last_name} <span className="text-xs text-muted-foreground">({s.admission_no})</span></TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell className="capitalize">{s.type}</TableCell>
                <TableCell>{s.type === "percentage" ? `${s.value}%` : s.type === "full" ? "100%" : s.value}</TableCell>
                <TableCell>{s.start_date}</TableCell>
                <TableCell>{s.end_date || "—"}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell>{s.status === "active" && <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>Revoke</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <ScholarshipFormDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </div>
  );
}

function ScholarshipFormDialog({ open, onOpenChange, onSaved }: any) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [name, setName] = useState("Merit Scholarship");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function search() { if (q.trim().length >= 2) setResults(await api.payments.search(q)); }

  async function submit() {
    if (!student || !name) { toast.error("Student and scholarship name are required."); return; }
    setSaving(true);
    try {
      await api.scholarships.create({ studentId: student.id, name, type, value: Number(value || 0), startDate, endDate: endDate || undefined });
      toast.success("Scholarship added.");
      onOpenChange(false); onSaved();
      setStudent(null); setQ(""); setValue("");
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Scholarship</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!student ? (
            <div className="relative">
              <Input placeholder="Search student…" value={q} onChange={(e) => setQ(e.target.value)} onKeyUp={search} />
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
            <p className="text-sm">Student: <strong>{student.first_name} {student.last_name}</strong> <button className="ml-2 text-xs text-primary underline" onClick={() => setStudent(null)}>change</button></p>
          )}
          <div className="space-y-1.5"><Label required>Scholarship Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label required>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem><SelectItem value="full">Full (100%)</SelectItem></SelectContent>
              </Select>
            </div>
            {type !== "full" && <div className="space-y-1.5"><Label required>Value</Label><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></div>}
            <div className="space-y-1.5"><Label required>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>End Date (optional)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Add Scholarship</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
