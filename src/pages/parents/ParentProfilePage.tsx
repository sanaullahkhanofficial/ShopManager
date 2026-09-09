import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { api } from "@/lib/api";
import { ParentFormDialog } from "./ParentFormDialog";

export function ParentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parent, setParent] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  function load() { api.parents.getById(Number(id)).then(setParent); }
  useEffect(load, [id]);
  if (!parent) return null;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Parents", to: "/parents" }, { label: parent.father_name || parent.guardian_name }]}
        title={parent.father_name || parent.mother_name || parent.guardian_name}
        description={`${parent.parent_code} · ${parent.phone}`}
        action={<Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
      />

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4 mb-4">
        <Info label="Mother" value={parent.mother_name} />
        <Info label="WhatsApp" value={parent.whatsapp} />
        <Info label="Email" value={parent.email} />
        <Info label="Occupation" value={parent.occupation} />
        <Info label="Address" value={parent.address} />
        <Info label="CNIC" value={parent.cnic} />
      </div>

      <Card>
        <CardHeader><CardTitle>Children</CardTitle></CardHeader>
        <CardContent>
          {parent.children.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students linked to this parent yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Admission No</TableHead><TableHead>Name</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {parent.children.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/students/${c.id}`)}>
                    <TableCell className="font-mono text-xs">{c.admission_no}</TableCell>
                    <TableCell>{c.first_name} {c.last_name}</TableCell>
                    <TableCell>{c.class_name} {c.section_name}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ParentFormDialog open={editOpen} onOpenChange={setEditOpen} parent={parent} onSaved={load} />
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
