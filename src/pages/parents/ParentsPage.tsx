import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ParentFormDialog } from "./ParentFormDialog";

export function ParentsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();
  const { hasPermission, user } = useAuthStore();
  const isSuper = user?.roleName === "Super Admin" || user?.roleName === "School Owner";
  const canManage = isSuper || hasPermission("parents.manage");

  function load() { setLoading(true); api.parents.search({ q }).then(setRows).finally(() => setLoading(false)); }
  useEffect(load, [q]);

  return (
    <div>
      <PageHeader title="Parents / Guardians" description="Manage parent and guardian records linked to students."
        action={canManage && <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Parent</Button>} />

      <div className="relative mb-3 w-72">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name or phone…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <TableSkeleton /> : rows.length === 0 ? (
        <EmptyState icon={UsersRound} title="No parents found" actionLabel={canManage ? "Add Parent" : undefined} onAction={() => setFormOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Occupation</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/parents/${p.id}`)}>
                <TableCell className="font-mono text-xs">{p.parent_code}</TableCell>
                <TableCell className="font-medium">{p.father_name || p.mother_name || p.guardian_name}</TableCell>
                <TableCell>{p.phone}</TableCell>
                <TableCell>{p.email || "—"}</TableCell>
                <TableCell>{p.occupation || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ParentFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
    </div>
  );
}
