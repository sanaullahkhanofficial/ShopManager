import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useClasses } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { exportToCsv } from "@/lib/export";

export function OutstandingFeesPage() {
  const classes = useClasses();
  const school = useSettingsStore((s) => s.school);
  const symbol = school?.currency_symbol || "$";
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const navigate = useNavigate();

  function load() { api.invoices.outstanding({ classId: classId ? Number(classId) : undefined }).then(setRows); }
  useEffect(load, [classId]);

  const total = rows.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div>
      <PageHeader title="Outstanding Fees" description={`Total outstanding: ${formatCurrency(total, symbol)}`}
        action={<Button variant="outline" onClick={() => exportToCsv("outstanding-fees.csv", rows)}><Download className="h-4 w-4" /> Export CSV</Button>} />

      <div className="mb-3">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No outstanding fees" description="Every fee voucher has been paid in full." />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Voucher</TableHead><TableHead>Due Date</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/students/${r.student_id}`)}>
                <TableCell>{r.first_name} {r.last_name} <span className="text-xs text-muted-foreground">({r.admission_no})</span></TableCell>
                <TableCell>{r.class_name} {r.section_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.voucher_no}</TableCell>
                <TableCell>{r.due_date}</TableCell>
                <TableCell className="font-medium text-destructive">{formatCurrency(r.balance, symbol)}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
