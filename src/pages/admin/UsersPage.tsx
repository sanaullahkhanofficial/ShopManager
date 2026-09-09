import { useEffect, useState } from "react";
import { Plus, Users2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);

  function load() { api.users.list().then(setUsers); api.roles.list().then(setRoles); }
  useEffect(load, []);

  async function toggleStatus(u: any) {
    try { await api.users.setStatus(u.id, u.status === "active" ? "inactive" : "active"); load(); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div>
      <PageHeader title="Users" description="Manage system users and their roles." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add User</Button>} />
      {users.length === 0 ? (
        <EmptyState icon={Users2} title="No users found" actionLabel="Add User" onAction={() => setOpen(true)} />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Last Login</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell>{u.display_name}</TableCell>
                <TableCell>{u.role_name}</TableCell>
                <TableCell>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setResetTarget(u)}><KeyRound className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(u)}>{u.status === "active" ? "Deactivate" : "Activate"}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AddUserDialog open={open} onOpenChange={setOpen} roles={roles} onSaved={load} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}

function AddUserDialog({ open, onOpenChange, roles, onSaved }: any) {
  const [form, setForm] = useState<any>({ username: "", displayName: "", email: "", roleId: "", password: "" });
  const [saving, setSaving] = useState(false);
  function f(k: string, v: any) { setForm((s: any) => ({ ...s, [k]: v })); }
  async function submit() {
    if (!form.username || !form.displayName || !form.roleId || !form.password) { toast.error("All fields except email are required."); return; }
    setSaving(true);
    try { await api.users.create({ ...form, roleId: Number(form.roleId) }); toast.success("User created."); onOpenChange(false); onSaved(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label required>Full Name</Label><Input value={form.displayName} onChange={(e) => f("displayName", e.target.value)} /></div>
          <div className="space-y-1.5"><Label required>Username</Label><Input value={form.username} onChange={(e) => f("username", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => f("email", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label required>Role</Label>
            <Select value={form.roleId} onValueChange={(v) => f("roleId", v)}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5"><Label required>Password</Label><Input type="password" value={form.password} onChange={(e) => f("password", e.target.value)} /></div>
        </div>
        <DialogFooter><Button loading={saving} onClick={submit}>Create User</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setSaving(true);
    try { await api.resetPassword({ userId: user.id, newPassword }); toast.success("Password reset. The user will be asked to change it on next login."); onClose(); setNewPassword(""); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }
  if (!user) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Reset Password for {user.display_name}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label required>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <DialogFooter><Button loading={saving} onClick={submit}>Reset Password</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
