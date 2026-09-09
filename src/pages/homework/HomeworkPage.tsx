import { useEffect, useState } from "react";
import { Plus, BookOpenCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useClasses, useSections, useSubjects } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { todayIso } from "@/lib/utils";

export function HomeworkPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const classes = useClasses();
  const subjects = useSubjects();

  function load() { api.homework.list().then(setItems); }
  useEffect(load, []);

  async function remove(id: number) { await api.homework.delete(id); load(); }

  return (
    <div>
      <PageHeader title="Homework" description="Assignments, homework and notes given to classes." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Homework</Button>} />
      {items.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No homework assigned yet" actionLabel="Add Homework" onAction={() => setOpen(true)} />
      ) : (
        <div className="space-y-2">
          {items.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{h.title} <span className="text-xs text-muted-foreground">({h.class_name} {h.section_name || ""} {h.subject_name ? `· ${h.subject_name}` : ""})</span></p>
                  <p className="text-sm text-muted-foreground">{h.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Due {h.due_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={h.status} />
                  <Button variant="ghost" size="icon" onClick={() => remove(h.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <HomeworkFormDialog open={open} onOpenChange={setOpen} classes={classes} subjects={subjects} onSaved={load} />
    </div>
  );
}

function HomeworkFormDialog({ open, onOpenChange, classes, subjects, onSaved }: any) {
  const [form, setForm] = useState<any>({ classId: "", sectionId: "", subjectId: "", title: "", description: "", dueDate: todayIso() });
  const sections = useSections(form.classId);
  const [saving, setSaving] = useState(false);
  function f(k: string, v: any) { setForm((s: any) => ({ ...s, [k]: v })); }

  async function submit() {
    if (!form.classId || !form.title || !form.dueDate) { toast.error("Class, title and due date are required."); return; }
    setSaving(true);
    try {
      await api.homework.create({ ...form, classId: Number(form.classId), sectionId: form.sectionId ? Number(form.sectionId) : null, subjectId: form.subjectId ? Number(form.subjectId) : null });
      toast.success("Homework added.");
      onOpenChange(false); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Homework</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label required>Class</Label>
              <Select value={form.classId} onValueChange={(v) => f("classId", v)}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select value={form.sectionId} onValueChange={(v) => f("sectionId", v)}>
                <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={form.subjectId} onValueChange={(v) => f("subjectId", v)}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label required>Title</Label><Input value={form.title} onChange={(e) => f("title", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => f("description", e.target.value)} /></div>
          <div className="space-y-1.5"><Label required>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => f("dueDate", e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Add Homework</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
