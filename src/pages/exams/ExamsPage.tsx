import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, ScrollText, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useClasses, useSubjects } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";

const EXAM_TYPES = ["monthly_test", "midterm", "final", "quiz", "assessment", "custom"];

export function ExamsPage() {
  const [params] = useSearchParams();
  const [exams, setExams] = useState<any[]>([]);
  const [open, setOpen] = useState(params.get("new") === "1");
  const navigate = useNavigate();

  function load() { api.exams.list().then(setExams); }
  useEffect(load, []);

  return (
    <div>
      <PageHeader title="Exams" description="Create exams, schedule subjects, and manage marks and results." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Exam</Button>} />
      {exams.length === 0 ? (
        <EmptyState icon={ScrollText} title="No exams created yet" actionLabel="Create Exam" onAction={() => setOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Class</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {exams.map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/exams/${e.id}`)}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell className="capitalize">{e.type.replace("_", " ")}</TableCell>
                <TableCell>{e.class_name}</TableCell>
                <TableCell>{e.start_date || "—"} – {e.end_date || "—"}</TableCell>
                <TableCell><StatusBadge status={e.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <CreateExamDialog open={open} onOpenChange={setOpen} onSaved={(id: number) => navigate(`/exams/${id}`)} />
    </div>
  );
}

function CreateExamDialog({ open, onOpenChange, onSaved }: any) {
  const classes = useClasses();
  const subjects = useSubjects();
  const [name, setName] = useState("");
  const [type, setType] = useState("midterm");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<{ subjectId: string; maxMarks: string; passingMarks: string }[]>([{ subjectId: "", maxMarks: "100", passingMarks: "40" }]);
  const [saving, setSaving] = useState(false);

  function addRow() { setRows((r) => [...r, { subjectId: "", maxMarks: "100", passingMarks: "40" }]); }
  function updateRow(i: number, key: string, value: string) { setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row))); }

  async function submit() {
    if (!name || !classId) { toast.error("Exam name and class are required."); return; }
    setSaving(true);
    try {
      const res = await api.exams.create({
        name, type, classId: Number(classId), startDate: startDate || null, endDate: endDate || null,
        subjects: rows.filter((r) => r.subjectId).map((r) => ({ subjectId: Number(r.subjectId), maxMarks: Number(r.maxMarks), passingMarks: Number(r.passingMarks) })),
      });
      toast.success("Exam created.");
      onOpenChange(false);
      onSaved(res.id);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label required>Exam Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midterm Exam" /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label required>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div />
            <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>

          <div>
            <Label>Subjects</Label>
            <div className="mt-1 space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Select value={row.subjectId} onValueChange={(v) => updateRow(i, "subjectId", v)}>
                    <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder="Max marks" value={row.maxMarks} onChange={(e) => updateRow(i, "maxMarks", e.target.value)} />
                  <Input type="number" placeholder="Passing marks" value={row.passingMarks} onChange={(e) => updateRow(i, "passingMarks", e.target.value)} />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add Subject</Button>
          </div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Create Exam</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
