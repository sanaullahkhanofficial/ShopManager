import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PenSquare, Printer, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { printDocument, escapeHtml } from "@/lib/printTemplate";
import { useSettingsStore } from "@/store/settingsStore";

export function ExamDetailPage() {
  const { id } = useParams();
  const examId = Number(id);
  const school = useSettingsStore((s) => s.school);
  const [exam, setExam] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [marksSubject, setMarksSubject] = useState<any>(null);
  const [status, setStatus] = useState("");

  function load() {
    api.exams.getById(examId).then((e) => { setExam(e); setStatus(e.status); });
    api.exams.computeResults(examId).then(setResults);
  }
  useEffect(load, [examId]);

  async function changeStatus(s: string) {
    setStatus(s);
    await api.exams.updateStatus(examId, s);
    toast.success(`Exam marked as ${s}.`);
    load();
  }

  async function printReportCard(studentId: number) {
    const rc = await api.exams.reportCard(examId, studentId);
    const rows = rc.result.subjectMarks.map((m: any) => `<tr><td>${escapeHtml(m.subjectName)}</td><td>${m.maxMarks}</td><td>${m.obtained ?? "—"}</td></tr>`).join("");
    const html = printDocument(`Report Card - ${rc.result.student.first_name}`, `
      <div class="doc-header"><div><h1>${escapeHtml(school?.name || "School")}</h1></div><div style="text-align:right"><p>${escapeHtml(rc.exam.name)}</p></div></div>
      <div class="doc-title">Report Card</div>
      <div class="grid-2">
        <div><span>Student</span> ${escapeHtml(rc.result.student.first_name)} ${escapeHtml(rc.result.student.last_name || "")}</div>
        <div><span>Roll No</span> ${rc.result.student.roll_number || "—"}</div>
        <div><span>Attendance</span> ${rc.attendance.percentage}%</div>
        <div><span>Position</span> ${rc.result.position || "—"}</div>
      </div>
      <table><thead><tr><th>Subject</th><th>Max Marks</th><th>Obtained</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        <div><span>Total</span><span>${rc.result.total} / ${rc.result.totalMax}</span></div>
        <div><span>Percentage</span><span>${rc.result.percentage}%</span></div>
        <div class="grand"><span>Grade</span><span>${rc.result.grade}</span></div>
      </div>
      <div class="grid-2" style="margin-top:16px">
        <div><span>Teacher Remarks</span> ${escapeHtml(rc.remarks.teacher_remarks || "—")}</div>
        <div><span>Principal Remarks</span> ${escapeHtml(rc.remarks.principal_remarks || "—")}</div>
      </div>
      <div class="signature"><div>Class Teacher</div><div>Principal</div></div>
    `);
    api.print.openWindow(html).catch((e) => toast.error(e.message));
  }

  if (!exam) return null;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Exams", to: "/exams" }, { label: exam.name }]}
        title={exam.name}
        description={`${exam.class_name} · ${exam.type.replace("_", " ")}`}
        action={
          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{["scheduled", "ongoing", "completed", "published"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      <Card className="mb-4">
        <CardHeader><CardTitle>Subjects & Marks Entry</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {exam.subjects.map((s: any) => (
              <Button key={s.id} variant="outline" size="sm" onClick={() => setMarksSubject(s)}>
                <PenSquare className="h-3.5 w-3.5" /> {s.subject_name} (max {s.max_marks})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><Trophy className="mr-1 inline h-4 w-4" /> Results</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Student</TableHead><TableHead>Total</TableHead><TableHead>%</TableHead><TableHead>Grade</TableHead><TableHead>Result</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.student.id}>
                  <TableCell>{r.position || "—"}</TableCell>
                  <TableCell>{r.student.first_name} {r.student.last_name}</TableCell>
                  <TableCell>{r.total}/{r.totalMax}</TableCell>
                  <TableCell>{r.percentage}%</TableCell>
                  <TableCell>{r.allEntered ? r.grade : "—"}</TableCell>
                  <TableCell>{r.allEntered ? <StatusBadge status={r.passed ? "paid" : "unpaid"} /> : <span className="text-xs text-muted-foreground">Pending marks</span>}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => printReportCard(r.student.id)}><Printer className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {marksSubject && <MarksEntryDialog examSubject={marksSubject} onClose={() => setMarksSubject(null)} onSaved={load} />}
    </div>
  );
}

function MarksEntryDialog({ examSubject, onClose, onSaved }: any) {
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.exams.getMarksGrid(examSubject.id).then((data) => {
      setStudents(data.students);
      setMarks(Object.fromEntries(data.students.map((s: any) => [s.student_id, s.obtained_marks ?? ""])));
    });
  }, [examSubject.id]);

  async function submit() {
    setSaving(true);
    try {
      const entries = students.filter((s) => marks[s.student_id] !== "").map((s) => ({ studentId: s.student_id, obtainedMarks: Number(marks[s.student_id]) }));
      await api.exams.saveMarks({ examSubjectId: examSubject.id, entries });
      toast.success("Marks saved.");
      onClose(); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Enter Marks — {examSubject.subject_name} (Max: {examSubject.max_marks})</DialogTitle></DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Roll #</TableHead><TableHead>Student</TableHead><TableHead>Obtained Marks</TableHead></TableRow></TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.student_id}>
                  <TableCell>{s.roll_number || "—"}</TableCell>
                  <TableCell>{s.first_name} {s.last_name}</TableCell>
                  <TableCell>
                    <Input
                      type="number" className="h-8 w-24" max={examSubject.max_marks} min={0}
                      value={marks[s.student_id] ?? ""}
                      onChange={(e) => setMarks((m) => ({ ...m, [s.student_id]: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Save Marks</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
