import { useEffect, useState } from "react";
import { Plus, BookOpenCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  function load() { api.academic.listSubjects().then(setSubjects); }
  useEffect(load, []);

  async function submit() {
    if (!name.trim()) { toast.error("Subject name is required."); return; }
    setSaving(true);
    try {
      await api.academic.createSubject({ name, code });
      toast.success("Subject added.");
      setName(""); setCode(""); setOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Subjects" description="Manage the subjects taught across your school." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Subject</Button>} />
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No subjects yet" actionLabel="Add Subject" onAction={() => setOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {subjects.map((s: any) => (
              <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.code || "—"}</TableCell><TableCell>{s.department || "—"}</TableCell><TableCell>{s.status}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label required>Subject Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
          </div>
          <DialogFooter><Button loading={saving} onClick={submit}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
