import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

const empty = { fatherName: "", motherName: "", guardianName: "", relationship: "Father", phone: "", whatsapp: "", email: "", address: "", occupation: "", cnic: "" };

export function ParentFormDialog({ open, onOpenChange, onSaved, parent }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; parent?: any }) {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(parent ? {
        fatherName: parent.father_name, motherName: parent.mother_name, guardianName: parent.guardian_name,
        relationship: parent.relationship, phone: parent.phone, whatsapp: parent.whatsapp, email: parent.email,
        address: parent.address, occupation: parent.occupation, cnic: parent.cnic,
      } : empty);
    }
  }, [open, parent]);

  function f(key: string, value: string) { setForm((s: any) => ({ ...s, [key]: value })); }

  async function submit() {
    setSaving(true);
    try {
      if (parent) { await api.parents.update(parent.id, form); toast.success("Parent updated."); }
      else { await api.parents.create(form); toast.success("Parent added."); }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{parent ? "Edit Parent/Guardian" : "Add Parent/Guardian"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <F label="Father's Name" value={form.fatherName} onChange={(v) => f("fatherName", v)} />
          <F label="Mother's Name" value={form.motherName} onChange={(v) => f("motherName", v)} />
          <F label="Guardian's Name" value={form.guardianName} onChange={(v) => f("guardianName", v)} />
          <F label="Relationship" value={form.relationship} onChange={(v) => f("relationship", v)} />
          <F label="Phone" required value={form.phone} onChange={(v) => f("phone", v)} />
          <F label="WhatsApp" value={form.whatsapp} onChange={(v) => f("whatsapp", v)} />
          <F label="Email" value={form.email} onChange={(v) => f("email", v)} />
          <F label="Occupation" value={form.occupation} onChange={(v) => f("occupation", v)} />
          <F label="CNIC / National ID" value={form.cnic} onChange={(v) => f("cnic", v)} />
          <div className="col-span-2"><F label="Address" value={form.address} onChange={(v) => f("address", v)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
