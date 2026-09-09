import { useEffect, useState } from "react";
import { Plus, School } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [sectionsByClass, setSectionsByClass] = useState<Record<number, any[]>>({});
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [sectionFormClass, setSectionFormClass] = useState<any>(null);

  function load() {
    api.academic.listClasses().then(async (cls) => {
      setClasses(cls);
      const pairs = await Promise.all(cls.map((c: any) => api.academic.listSections(c.id).then((secs) => [c.id, secs] as const)));
      setSectionsByClass(Object.fromEntries(pairs));
    });
  }
  useEffect(load, []);

  return (
    <div>
      <PageHeader title="Classes & Sections" description="Manage your school's grade levels and sections." action={<Button onClick={() => setClassFormOpen(true)}><Plus className="h-4 w-4" /> Add Class</Button>} />

      {classes.length === 0 ? (
        <EmptyState icon={School} title="No classes yet" actionLabel="Add Class" onAction={() => setClassFormOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c: any) => (
            <Card key={c.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{c.name}</CardTitle>
                <Badge variant={c.status === "active" ? "success" : "secondary"}>{c.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(sectionsByClass[c.id] || []).map((s: any) => (
                    <Badge key={s.id} variant="outline">{s.name} · {s.student_count} students</Badge>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSectionFormClass(c)}><Plus className="h-3.5 w-3.5" /> Add Section</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClassFormDialog open={classFormOpen} onOpenChange={setClassFormOpen} onSaved={load} />
      <SectionFormDialog cls={sectionFormClass} onClose={() => setSectionFormClass(null)} onSaved={load} />
    </div>
  );
}

function ClassFormDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!name.trim()) { toast.error("Class name is required."); return; }
    setSaving(true);
    try { await api.academic.createClass({ name }); toast.success("Class added."); setName(""); onOpenChange(false); onSaved(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label required>Class Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 11" /></div>
        <DialogFooter><Button loading={saving} onClick={submit}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionFormDialog({ cls, onClose, onSaved }: { cls: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!name.trim()) { toast.error("Section name is required."); return; }
    setSaving(true);
    try { await api.academic.createSection({ classId: cls.id, name }); toast.success("Section added."); setName(""); onClose(); onSaved(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }
  if (!cls) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Add Section to {cls.name}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label required>Section Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. C" /></div>
        <DialogFooter><Button loading={saving} onClick={submit}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
