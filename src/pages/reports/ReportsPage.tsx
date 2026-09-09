import { useState } from "react";
import { Download, FileBarChart, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useClasses } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { exportToCsv, exportToExcel } from "@/lib/export";
import { formatCurrency, todayIso } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";

export function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reporting Center" description="Filterable reports across students, attendance, finance and academics — export to CSV/Excel or print." />
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
        </TabsList>
        <TabsContent value="students"><StudentReports /></TabsContent>
        <TabsContent value="attendance"><AttendanceReports /></TabsContent>
        <TabsContent value="finance"><FinanceReports /></TabsContent>
      </Tabs>
    </div>
  );
}

function ReportToolbar({ rows, filename }: { rows: any[]; filename: string }) {
  return (
    <div className="mb-2 flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => exportToCsv(`${filename}.csv`, rows)}><Download className="h-3.5 w-3.5" /> CSV</Button>
      <Button variant="outline" size="sm" onClick={() => exportToExcel(`${filename}.xlsx`, rows)}><Download className="h-3.5 w-3.5" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</Button>
    </div>
  );
}

function StudentReports() {
  const classes = useClasses();
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [ran, setRan] = useState(false);

  async function run() {
    const res = await api.reports.studentList({ classId: classId ? Number(classId) : undefined, status: status || undefined });
    setRows(res); setRan(true);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Student List</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>{["active", "inactive", "graduated", "transferred", "suspended", "left"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={run}>Run Report</Button>
        </div>
        {!ran ? <EmptyState icon={FileBarChart} title="Run the report to see results" /> : rows.length === 0 ? <EmptyState title="No matching students" /> : (
          <>
            <ReportToolbar rows={rows} filename="student-list" />
            <Table>
              <TableHeader><TableRow><TableHead>Admission No</TableHead><TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead>Gender</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((r, i) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{r.admission_no}</TableCell><TableCell>{r.first_name} {r.last_name}</TableCell><TableCell>{r.class_name} {r.section_name}</TableCell><TableCell>{r.gender}</TableCell><TableCell>{r.status}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceReports() {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<any[]>([]);
  const [ran, setRan] = useState(false);
  async function run() { setRows(await api.reports.dailyAttendance(date)); setRan(true); }
  return (
    <Card>
      <CardHeader><CardTitle>Daily Attendance</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button onClick={run}>Run Report</Button>
        </div>
        {!ran ? <EmptyState icon={FileBarChart} title="Run the report to see results" /> : rows.length === 0 ? <EmptyState title="No attendance recorded for this date" /> : (
          <>
            <ReportToolbar rows={rows} filename="daily-attendance" />
            <Table>
              <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Section</TableHead><TableHead>Present</TableHead><TableHead>Absent</TableHead><TableHead>Late</TableHead><TableHead>Leave</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((r, i) => (
                <TableRow key={i}><TableCell>{r.class_name}</TableCell><TableCell>{r.section_name || "—"}</TableCell><TableCell>{r.present}</TableCell><TableCell>{r.absent}</TableCell><TableCell>{r.late}</TableCell><TableCell>{r.leave_}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceReports() {
  const school = useSettingsStore((s) => s.school);
  const symbol = school?.currency_symbol || "$";
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [collectionRows, setCollectionRows] = useState<any[]>([]);
  const [income, setIncome] = useState<any>(null);
  const [ran, setRan] = useState(false);

  async function run() {
    const res = await api.payments.report({ from, to });
    setCollectionRows(res.rows);
    setIncome(await api.reports.incomeStatement({ from, to }));
    setRan(true);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Fee Collection & Income Statement</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <Input type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={run}>Run Report</Button>
        </div>
        {!ran ? <EmptyState icon={FileBarChart} title="Run the report to see results" /> : (
          <>
            {income && (
              <div className="mb-4 grid grid-cols-4 gap-3">
                <Stat label="Income" value={formatCurrency(income.income, symbol)} />
                <Stat label="Expenses" value={formatCurrency(income.expenses, symbol)} />
                <Stat label="Payroll" value={formatCurrency(income.payroll, symbol)} />
                <Stat label="Net" value={formatCurrency(income.net, symbol)} />
              </div>
            )}
            <ReportToolbar rows={collectionRows} filename="fee-collection" />
            {collectionRows.length === 0 ? <EmptyState title="No payments in this range" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Student</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>{collectionRows.map((r, i) => (
                  <TableRow key={i}><TableCell className="font-mono text-xs">{r.receipt_no}</TableCell><TableCell>{r.first_name} {r.last_name}</TableCell><TableCell className="capitalize">{r.method.replace("_", " ")}</TableCell><TableCell>{r.paid_date}</TableCell><TableCell>{formatCurrency(r.amount, symbol)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
