import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Users2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { TeacherFormDialog } from "./TeacherFormDialog";

export function TeachersPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(params.get("new") === "1");
  const navigate = useNavigate();

  function load() { api.teachers.search({ q }).then(setRows); }
  useEffect(load, [q]);

  return (
    <div>
      <PageHeader title="Teachers" description="Manage teaching staff and their class assignments." action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Teacher</Button>} />
      <div className="relative mb-3 w-72">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, employee ID…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users2} title="No teachers found" actionLabel="Add Teacher" onAction={() => setFormOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/teachers/${t.id}`)}>
                <TableCell className="font-mono text-xs">{t.employee_id}</TableCell>
                <TableCell className="font-medium">{t.first_name} {t.last_name}</TableCell>
                <TableCell>{t.department || "—"}</TableCell>
                <TableCell>{t.phone || "—"}</TableCell>
                <TableCell><StatusBadge status={t.employment_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <TeacherFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
    </div>
  );
}
