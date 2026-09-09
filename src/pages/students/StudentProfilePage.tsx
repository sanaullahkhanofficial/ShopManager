import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, Archive, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { StudentFormDialog } from "./StudentFormDialog";
import { toast } from "sonner";

const STATUSES = ["active", "inactive", "graduated", "transferred", "suspended", "left"];

export function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const school = useSettingsStore((s) => s.school);
  const [student, setStudent] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  function load() { api.students.getById(Number(id)).then(setStudent); }
  useEffect(load, [id]);

  async function changeStatus(status: string) {
    if (status !== "active") {
      const ok = await confirm({ title: `Mark as ${status}?`, description: "This will archive the student's active enrollment. Financial and academic history are preserved.", confirmLabel: "Confirm", destructive: true });
      if (!ok) return;
    }
    await api.students.setStatus(Number(id), status);
    toast.success("Student status updated.");
    load();
  }

  if (!student) return null;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Students", to: "/students" }, { label: `${student.first_name} ${student.last_name || ""}` }]}
        title={`${student.first_name} ${student.last_name || ""}`}
        description={`${student.admission_no} · ${student.class_name || "Unassigned"} ${student.section_name || ""}`}
        action={
          <>
            <Select value={student.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initials(student.first_name, student.last_name)}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
          <Info label="Father" value={student.father_name} />
          <Info label="Gender" value={student.gender} />
          <Info label="DOB" value={formatDate(student.dob, school?.date_format)} />
          <Info label="Status" value={<StatusBadge status={student.status} />} />
          <Info label="Phone" value={student.phone} />
          <Info label="Email" value={student.email} />
          <Info label="Admission Date" value={formatDate(student.admission_date, school?.date_format)} />
          <Info label="Roll No" value={student.roll_number} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="exams">Exams & Results</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>Parents / Guardians</CardTitle></CardHeader>
            <CardContent>
              {student.parents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parent/guardian linked yet.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>Phone</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {student.parents.map((p: any) => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/parents/${p.id}`)}>
                        <TableCell>{p.father_name || p.mother_name || p.guardian_name}</TableCell>
                        <TableCell>{p.relationship}</TableCell>
                        <TableCell>{p.phone}</TableCell>
                        <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance"><AttendanceTab studentId={Number(id)} /></TabsContent>
        <TabsContent value="fees"><FeesTab studentId={Number(id)} /></TabsContent>
        <TabsContent value="exams"><ExamsTab studentId={Number(id)} classId={student.class_id} /></TabsContent>
        <TabsContent value="other">
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Documents, Discipline, Transport and Library history are planned modules for this student profile — not yet available in this release.
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} student={student} onSaved={load} />
      {dialog}
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function AttendanceTab({ studentId }: { studentId: number }) {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => { api.attendance.studentSummary(studentId).then(setSummary); }, [studentId]);
  if (!summary) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Attendance — {summary.percentage}% present ({summary.present}/{summary.total} days)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
          <TableBody>
            {summary.rows.slice(0, 30).map((r: any, i: number) => (
              <TableRow key={i}><TableCell>{r.date}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell><TableCell>{r.remarks || "—"}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FeesTab({ studentId }: { studentId: number }) {
  const school = useSettingsStore((s) => s.school);
  const [ledger, setLedger] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  useEffect(() => {
    api.ledger.getStudent(studentId).then(setLedger);
    api.invoices.listForStudent(studentId).then(setInvoices);
  }, [studentId]);
  const symbol = school?.currency_symbol || "$";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Current Balance: {formatCurrency(ledger?.currentBalance, symbol)}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {(ledger?.entries || []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.entry_date}</TableCell><TableCell>{e.description}</TableCell>
                  <TableCell>{e.debit ? formatCurrency(e.debit, symbol) : "—"}</TableCell>
                  <TableCell>{e.credit ? formatCurrency(e.credit, symbol) : "—"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(e.balance_after, symbol)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Fee Vouchers</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Voucher</TableHead><TableHead>Period</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.voucher_no}</TableCell><TableCell>{inv.period_label}</TableCell>
                  <TableCell>{formatCurrency(inv.total_amount, symbol)}</TableCell><TableCell>{formatCurrency(inv.paid_amount, symbol)}</TableCell>
                  <TableCell>{formatCurrency(inv.balance, symbol)}</TableCell><TableCell><StatusBadge status={inv.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ExamsTab({ studentId, classId }: { studentId: number; classId: number }) {
  const [exams, setExams] = useState<any[]>([]);
  useEffect(() => { if (classId) api.exams.list({ classId }).then(setExams); }, [classId]);
  return (
    <Card>
      <CardHeader><CardTitle>Exams</CardTitle></CardHeader>
      <CardContent>
        {exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exams scheduled for this student's class yet.</p>
        ) : (
          <ul className="space-y-2">
            {exams.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span>{ex.name} <span className="text-muted-foreground">({ex.type})</span></span>
                <StatusBadge status={ex.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
