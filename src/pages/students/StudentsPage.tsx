import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Upload, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useClasses, useSections } from "@/hooks/useAcademicLookups";
import { StudentFormDialog } from "./StudentFormDialog";
import { ImportStudentsDialog } from "./ImportStudentsDialog";
import { useAuthStore } from "@/store/authStore";

export function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const classes = useClasses();
  const [classId, setClassId] = useState<string>("");
  const sections = useSections(classId);
  const [sectionId, setSectionId] = useState<string>("");
  const [status, setStatus] = useState<string>("active");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: any[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(params.get("new") === "1");
  const [importOpen, setImportOpen] = useState(false);
  const { hasPermission, user } = useAuthStore();
  const isSuper = user?.roleName === "Super Admin" || user?.roleName === "School Owner";
  const canCreate = isSuper || hasPermission("students.create");

  function load() {
    setLoading(true);
    api.students
      .search({ q, classId: classId ? Number(classId) : undefined, sectionId: sectionId ? Number(sectionId) : undefined, status: status || undefined, page, pageSize: 20 })
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(load, [q, classId, sectionId, status, page]);

  return (
    <div>
      <PageHeader
        title="Students"
        description="Manage enrolled students and student records."
        action={canCreate && (
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import</Button>
            <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Student</Button>
          </>
        )}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, admission no, phone…" className="pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select value={classId || "all"} onValueChange={(v) => { setClassId(v === "all" ? "" : v); setSectionId(""); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sectionId || "all"} onValueChange={(v) => { setSectionId(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All sections" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["active", "inactive", "graduated", "transferred", "suspended", "left"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : data.rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students found" description="Try adjusting your filters, or add a new student." actionLabel={canCreate ? "Add Student" : undefined} onAction={() => setFormOpen(true)} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Father</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                <TableCell className="font-mono text-xs">{s.admission_no}</TableCell>
                <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                <TableCell>{s.father_name || "—"}</TableCell>
                <TableCell>{s.class_name || "—"}</TableCell>
                <TableCell>{s.section_name || "—"}</TableCell>
                <TableCell>{s.phone || "—"}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!loading && data.total > 0 && <Pagination page={page} pageSize={20} total={data.total} onPageChange={setPage} />}

      <StudentFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) { params.delete("new"); setParams(params); } }}
        onSaved={() => { load(); }}
      />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />
    </div>
  );
}
