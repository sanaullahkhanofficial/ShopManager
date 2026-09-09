import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function AuditLogPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: any[]; total: number }>({ rows: [], total: 0 });

  function load() { api.audit.list({ from: from || undefined, to: to || undefined, page, pageSize: 30 }).then(setData); }
  useEffect(load, [from, to, page]);

  return (
    <div>
      <PageHeader title="Audit Logs" description="Read-only record of every important system action — never editable." />
      <div className="mb-3 flex items-center gap-2">
        <Input type="date" className="w-44" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" className="w-44" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      {data.rows.length === 0 ? (
        <EmptyState icon={History} title="No audit entries found" />
      ) : (
        <>
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.actor_name || "System"}</TableCell>
                  <TableCell className="capitalize">{r.action.replace(/_/g, " ")}</TableCell>
                  <TableCell>{r.entity || "—"} {r.entity_id ? `#${r.entity_id}` : ""}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={30} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
