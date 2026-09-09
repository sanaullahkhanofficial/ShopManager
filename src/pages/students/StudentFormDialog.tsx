import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useClasses, useSections, useSessions } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { todayIso } from "@/lib/utils";

const emptyForm = {
  firstName: "", lastName: "", fatherName: "", motherName: "", dob: "", gender: "Male",
  bloodGroup: "", religion: "", nationality: "", phone: "", email: "", address: "", city: "", province: "",
  admissionDate: todayIso(), sessionId: "", classId: "", sectionId: "", rollNumber: "", previousSchool: "",
};

export function StudentFormDialog({
  open, onOpenChange, onSaved, student,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; student?: any }) {
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const classes = useClasses();
  const sections = useSections(form.classId);
  const sessions = useSessions();

  useEffect(() => {
    if (open) {
      setForm(student ? {
        firstName: student.first_name, lastName: student.last_name, fatherName: student.father_name,
        motherName: student.mother_name, dob: student.dob || "", gender: student.gender, bloodGroup: student.blood_group,
        religion: student.religion, nationality: student.nationality, phone: student.phone, email: student.email,
        address: student.address, city: student.city, province: student.province, admissionDate: student.admission_date,
        sessionId: student.session_id || "", classId: student.class_id || "", sectionId: student.section_id || "",
        rollNumber: student.roll_number, previousSchool: student.previous_school,
      } : emptyForm);
    }
  }, [open, student]);

  function f(key: string, value: any) { setForm((s: any) => ({ ...s, [key]: value })); }

  async function submit() {
    setSaving(true);
    try {
      const payload = { ...form, classId: form.classId ? Number(form.classId) : null, sectionId: form.sectionId ? Number(form.sectionId) : null, sessionId: form.sessionId ? Number(form.sessionId) : null };
      if (student) {
        await api.students.update(student.id, payload);
        toast.success("Student updated.");
      } else {
        const res = await api.students.create(payload);
        toast.success(`Student admitted. Admission No: ${res.admissionNo}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{student ? "Edit Student" : "Add Student"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Personal Information">
            <F label="First Name" required value={form.firstName} onChange={(v) => f("firstName", v)} />
            <F label="Last Name" value={form.lastName} onChange={(v) => f("lastName", v)} />
            <F label="Date of Birth" type="date" value={form.dob} onChange={(v) => f("dob", v)} />
            <SelectField label="Gender" value={form.gender} onChange={(v) => f("gender", v)} options={["Male", "Female", "Other"]} />
            <F label="Blood Group" value={form.bloodGroup} onChange={(v) => f("bloodGroup", v)} />
            <F label="Religion" value={form.religion} onChange={(v) => f("religion", v)} />
            <F label="Nationality" value={form.nationality} onChange={(v) => f("nationality", v)} />
          </Section>

          <Section title="Parent Information">
            <F label="Father's Name" value={form.fatherName} onChange={(v) => f("fatherName", v)} />
            <F label="Mother's Name" value={form.motherName} onChange={(v) => f("motherName", v)} />
          </Section>

          <Section title="Academic Information">
            <F label="Admission Date" required type="date" value={form.admissionDate} onChange={(v) => f("admissionDate", v)} />
            <SelectObjField label="Session" value={form.sessionId} onChange={(v) => f("sessionId", v)} options={sessions.map((s: any) => ({ value: s.id, label: s.name }))} />
            <SelectObjField label="Class" value={form.classId} onChange={(v) => { f("classId", v); f("sectionId", ""); }} options={classes.map((c: any) => ({ value: c.id, label: c.name }))} />
            <SelectObjField label="Section" value={form.sectionId} onChange={(v) => f("sectionId", v)} options={sections.map((s: any) => ({ value: s.id, label: s.name }))} />
            <F label="Roll Number" value={form.rollNumber} onChange={(v) => f("rollNumber", v)} />
            <F label="Previous School" value={form.previousSchool} onChange={(v) => f("previousSchool", v)} />
          </Section>

          <Section title="Contact Information">
            <F label="Phone" value={form.phone} onChange={(v) => f("phone", v)} />
            <F label="Email" value={form.email} onChange={(v) => f("email", v)} />
            <F label="City" value={form.city} onChange={(v) => f("city", v)} />
            <F label="Province" value={form.province} onChange={(v) => f("province", v)} />
            <div className="col-span-2"><F label="Address" value={form.address} onChange={(v) => f("address", v)} /></div>
          </Section>
        </div>

        <DialogFooter>
          <Button loading={saving} onClick={submit}>{student ? "Save Changes" : "Admit Student"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function F({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function SelectObjField({ label, value, onChange, options }: { label: string; value: any; onChange: (v: string) => void; options: { value: any; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ? String(value) : undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
