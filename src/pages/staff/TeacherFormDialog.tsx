import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

const empty = { firstName: "", lastName: "", gender: "Male", dob: "", phone: "", email: "", address: "", qualification: "", experienceYears: "", joiningDate: "", department: "", basicSalary: "" };

export function TeacherFormDialog({ open, onOpenChange, onSaved, teacher }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; teacher?: any }) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(teacher ? {
        firstName: teacher.first_name, lastName: teacher.last_name, gender: teacher.gender, dob: teacher.dob || "",
        phone: teacher.phone, email: teacher.email, address: teacher.address, qualification: teacher.qualification,
        experienceYears: teacher.experience_years, joiningDate: teacher.joining_date || "", department: teacher.department,
        basicSalary: teacher.basic_salary,
      } : empty);
    }
  }, [open, teacher]);

  function f(k: string, v: string) { setForm((s: any) => ({ ...s, [k]: v })); }

  async function submit() {
    setSaving(true);
    try {
      const payload = { ...form, experienceYears: Number(form.experienceYears || 0), basicSalary: Number(form.basicSalary || 0) };
      if (teacher) { await api.teachers.update(teacher.id, payload); toast.success("Teacher updated."); }
      else { const res = await api.teachers.create(payload); toast.success(`Teacher added: ${res.employeeId}`); }
      onOpenChange(false); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{teacher ? "Edit Teacher" : "Add Teacher"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <F label="First Name" required value={form.firstName} onChange={(v) => f("firstName", v)} />
          <F label="Last Name" value={form.lastName} onChange={(v) => f("lastName", v)} />
          <F label="Phone" value={form.phone} onChange={(v) => f("phone", v)} />
          <F label="Email" value={form.email} onChange={(v) => f("email", v)} />
          <F label="Qualification" value={form.qualification} onChange={(v) => f("qualification", v)} />
          <F label="Experience (years)" type="number" value={form.experienceYears} onChange={(v) => f("experienceYears", v)} />
          <F label="Joining Date" type="date" value={form.joiningDate} onChange={(v) => f("joiningDate", v)} />
          <F label="Department" value={form.department} onChange={(v) => f("department", v)} />
          <F label="Basic Salary" type="number" value={form.basicSalary} onChange={(v) => f("basicSalary", v)} />
          <div className="col-span-2"><F label="Address" value={form.address} onChange={(v) => f("address", v)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, value, onChange, type = "text", required }: { label: string; value: any; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
