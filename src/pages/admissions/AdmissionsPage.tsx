import { useEffect, useState } from "react";
import { Plus, UserPlus2, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useClasses, useSections } from "@/hooks/useAcademicLookups";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { printDocument } from "@/lib/printTemplate";
import { useSettingsStore } from "@/store/settingsStore";
import { formatDate, todayIso } from "@/lib/utils";

const STAGES = [
  { key: "application", label: "Application" },
  { key: "review", label: "Review" },
  { key: "approved", label: "Approved" },
  { key: "enrolled", label: "Enrolled" },
  { key: "rejected", label: "Rejected" },
];

export function AdmissionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<any>(null);
  const { confirm, dialog } = useConfirm();

  function load() { api.admissions.list().then(setItems); }
  useEffect(load, []);

  async function moveStage(app: any, stage: string) {
    if (stage === "enrolled") { setEnrollTarget(app); return; }
    if (stage === "rejected") {
      const ok = await confirm({ title: "Reject application?", description: `Reject the application for ${app.first_name}?`, destructive: true, confirmLabel: "Reject" });
      if (!ok) return;
    }
    try {
      await api.admissions.moveStage(app.id, stage);
      toast.success(`Moved to ${stage}.`);
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  function printForm(app: any) {
    const html = printDocument(`Admission Form - ${app.application_no}`, `
      <div class="doc-header"><div><h1>Admission Application</h1><p>${app.application_no}</p></div></div>
      <div class="doc-title">Application Form</div>
      <div class="grid-2">
        <div><span>Name</span> ${app.first_name} ${app.last_name || ""}</div>
        <div><span>Father's Name</span> ${app.father_name || "—"}</div>
        <div><span>Date of Birth</span> ${formatDate(app.dob)}</div>
        <div><span>Gender</span> ${app.gender}</div>
        <div><span>Phone</span> ${app.phone || "—"}</div>
        <div><span>Email</span> ${app.email || "—"}</div>
        <div><span>Applying for Class</span> ${app.applying_for_class_name || "—"}</div>
        <div><span>Previous School</span> ${app.previous_school || "—"}</div>
      </div>
      <div class="signature"><div>Applicant/Guardian Signature</div><div>Admissions Officer Signature</div></div>
    `);
    api.print.openWindow(html).catch((e) => toast.error(e.message));
  }

  return (
    <div>
      <PageHeader title="Admissions" description="Track applicants from application through enrollment." action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New Application</Button>} />

      {items.length === 0 ? (
        <EmptyState icon={UserPlus2} title="No admission applications yet" actionLabel="New Application" onAction={() => setFormOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {STAGES.map((stage) => (
            <div key={stage.key} className="space-y-2">
              <p className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {stage.label}
                <Badge variant="secondary">{items.filter((i) => i.stage === stage.key).length}</Badge>
              </p>
              <div className="space-y-2">
                {items.filter((i) => i.stage === stage.key).map((app) => (
                  <Card key={app.id}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{app.first_name} {app.last_name}</p>
                      <p className="text-xs text-muted-foreground">{app.application_no}</p>
                      <p className="text-xs text-muted-foreground">{app.applying_for_class_name || "No class selected"}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => printForm(app)}><Printer className="h-3 w-3" /></Button>
                        {stage.key !== "enrolled" && stage.key !== "rejected" && (
                          <Select onValueChange={(v) => moveStage(app, v)}>
                            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Move to…" /></SelectTrigger>
                            <SelectContent>
                              {STAGES.filter((s) => s.key !== stage.key).map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewApplicationDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
      <EnrollDialog app={enrollTarget} onClose={() => setEnrollTarget(null)} onSaved={load} />
      {dialog}
    </div>
  );
}

function NewApplicationDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const classes = useClasses();
  const [form, setForm] = useState<any>({ firstName: "", lastName: "", fatherName: "", dob: "", gender: "Male", phone: "", email: "", applyingForClassId: "", previousSchool: "" });
  const [saving, setSaving] = useState(false);
  function f(k: string, v: any) { setForm((s: any) => ({ ...s, [k]: v })); }

  async function submit() {
    setSaving(true);
    try {
      const res = await api.admissions.create({ ...form, applyingForClassId: form.applyingForClassId ? Number(form.applyingForClassId) : null });
      toast.success(`Application ${res.applicationNo} created.`);
      onOpenChange(false);
      onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>New Admission Application</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label required>First Name</Label><Input value={form.firstName} onChange={(e) => f("firstName", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => f("lastName", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Father's Name</Label><Input value={form.fatherName} onChange={(e) => f("fatherName", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={(e) => f("dob", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => f("phone", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => f("email", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Applying for Class</Label>
            <Select value={form.applyingForClassId} onValueChange={(v) => f("applyingForClassId", v)}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Previous School</Label><Input value={form.previousSchool} onChange={(e) => f("previousSchool", e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Create Application</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrollDialog({ app, onClose, onSaved }: { app: any; onClose: () => void; onSaved: () => void }) {
  const classes = useClasses();
  const [classId, setClassId] = useState("");
  const sections = useSections(classId);
  const [sectionId, setSectionId] = useState("");
  const [admissionDate, setAdmissionDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (app) { setClassId(app.applying_for_class_id ? String(app.applying_for_class_id) : ""); setSectionId(""); setAdmissionDate(todayIso()); } }, [app]);

  async function submit() {
    setSaving(true);
    try {
      const res = await api.admissions.enroll(app.id, { classId: classId ? Number(classId) : null, sectionId: sectionId ? Number(sectionId) : null, admissionDate });
      toast.success(`Enrolled as ${res.admissionNo}.`);
      onClose(); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  if (!app) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Enroll {app.first_name} as a Student</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Section</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Admission Date</Label><Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Confirm Enrollment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
