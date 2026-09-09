import { useEffect, useState } from "react";
import { Plus, Save, KeyRound, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  function load() {
    api.roles.list().then(setRoles);
    api.roles.permissions().then(setPermissions);
  }
  useEffect(load, []);

  async function selectRole(role: any) {
    setSelectedRole(role);
    const ids = await api.roles.getPermissions(role.id);
    setChecked(new Set(ids));
  }

  function toggle(id: number) {
    setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    setSaving(true);
    try { await api.roles.updatePermissions(selectedRole.id, Array.from(checked)); toast.success("Permissions updated."); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function removeRole(role: any) {
    const ok = await confirm({ title: `Delete role "${role.name}"?`, description: "This cannot be undone. Roles assigned to users cannot be deleted.", destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try { await api.roles.delete(role.id); toast.success("Role deleted."); if (selectedRole?.id === role.id) setSelectedRole(null); load(); }
    catch (err: any) { toast.error(err.message); }
  }

  const grouped = permissions.reduce((acc: Record<string, any[]>, p) => { (acc[p.module] ||= []).push(p); return acc; }, {});

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Configure granular, enforced permissions for each role." action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Role</Button>} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          {roles.map((r) => (
            <button key={r.id} onClick={() => selectRole(r)} className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm", selectedRole?.id === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              <span>{r.name}</span>
              <div className="flex items-center gap-1">
                {r.is_system ? <Badge variant="outline" className={selectedRole?.id === r.id ? "border-primary-foreground/40 text-primary-foreground" : ""}>system</Badge> : (
                  <Trash2 className="h-3.5 w-3.5 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeRole(r); }} />
                )}
              </div>
            </button>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            {!selectedRole ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground"><KeyRound className="mr-2 h-4 w-4" /> Select a role to edit its permissions</div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">{selectedRole.name} — Permissions</h3>
                  <Button size="sm" loading={saving} onClick={save}><Save className="h-3.5 w-3.5" /> Save</Button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Object.entries(grouped).map(([module, perms]) => (
                    <div key={module}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module}</p>
                      <div className="space-y-1">
                        {perms.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <AddRoleDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      {dialog}
    </div>
  );
}

function AddRoleDialog({ open, onOpenChange, onSaved }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  async function submit() {
    if (!name.trim()) { toast.error("Role name is required."); return; }
    try { await api.roles.create({ name, description }); toast.success("Role created."); setName(""); setDescription(""); onOpenChange(false); onSaved(); }
    catch (err: any) { toast.error(err.message); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Add Role</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label required>Role Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Create Role</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
