import { useEffect, useState } from "react";
import { Plus, Search, IdCard, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

const empty = { firstName: "", lastName: "", designation: "", department: "", phone: "", email: "", address: "", joiningDate: "", basicSalary: "" };

export function StaffPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  function load() { api.staff.search({ q }).then(setRows); }
  useEffect(load, [q]);

  function openNew() { setEditing(null); setForm(empty); setFormOpen(true); }
  function openEdit(s: any) {
    setEditing(s);
    setForm({ firstName: s.first_name, lastName: s.last_name, designation: s.designation, department: s.department, phone: s.phone, email: s.email, address: s.address, joiningDate: s.joining_date || "", basicSalary: s.basic_salary });
    setFormOpen(true);
  }
  function f(k: string, v: string) { setForm((s: any) => ({ ...s, [k]: v })); }

  async function submit() {
    setSaving(true);
    try {
      const payload = { ...form, basicSalary: Number(form.basicSalary || 0) };
      if (editing) { await api.staff.update(editing.id, payload); toast.success("Staff updated."); }
      else { const res = await api.staff.create(payload); toast.success(`Staff added: ${res.employeeId}`); }
      setFormOpen(false); load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Staff" description="Manage non-teaching staff — accountants, receptionists, drivers, librarians and more." action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add Staff</Button>} />
      <div className="relative mb-3 w-72">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, designation…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={IdCard} title="No staff found" actionLabel="Add Staff" onAction={openNew} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.employee_id}</TableCell>
                <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                <TableCell>{s.designation}</TableCell>
                <TableCell>{s.phone || "—"}</TableCell>
                <TableCell><StatusBadge status={s.employment_status} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent size="lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Staff" : "Add Staff"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <F label="First Name" required value={form.firstName} onChange={(v) => f("firstName", v)} />
            <F label="Last Name" value={form.lastName} onChange={(v) => f("lastName", v)} />
            <F label="Designation" required value={form.designation} onChange={(v) => f("designation", v)} />
            <F label="Department" value={form.department} onChange={(v) => f("department", v)} />
            <F label="Phone" value={form.phone} onChange={(v) => f("phone", v)} />
            <F label="Email" value={form.email} onChange={(v) => f("email", v)} />
            <F label="Joining Date" type="date" value={form.joiningDate} onChange={(v) => f("joiningDate", v)} />
            <F label="Basic Salary" type="number" value={form.basicSalary} onChange={(v) => f("basicSalary", v)} />
            <div className="col-span-2"><F label="Address" value={form.address} onChange={(v) => f("address", v)} /></div>
          </div>
          <DialogFooter><Button loading={saving} onClick={submit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, value, onChange, type = "text", required }: { label: string; value: any; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (<div className="space-y-1.5"><Label required={required}>{label}</Label><Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>);
}
