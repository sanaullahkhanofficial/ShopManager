import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Role, User } from "../types";

const ROLES: Role[] = ["Owner", "Manager", "Accountant", "Sales Staff", "Purchase Staff", "Inventory Staff", "Cashier", "Viewer"];

export function Users({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [edit, setEdit] = useState<{ username: string; display_name: string; role: Role; password: string } | null>(null);

  const load = () => api.usersList().then((u) => setRows(u as User[]));
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit) return;
    await api.usersAdd({ ...edit, actorId: user.id });
    push("success", "User created");
    setEdit(null);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setEdit({ username: "", display_name: "", role: "Cashier", password: "" })}><Plus size={15} /> Add User</Button>
      </div>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Username", render: (r) => r.username },
          { header: "Name", render: (r) => r.display_name },
          { header: "Role", render: (r) => r.role },
          { header: "Status", render: (r) => r.status },
          { header: "Created", render: (r) => formatDate(r.created_at) },
        ]}
      />
      <p className="text-xs text-stone-400">Granular per-action permissions (Section 39) are enforced role-by-role today; a full permission matrix editor is tracked in ROADMAP.md.</p>

      {edit && (
        <Modal title="Add User" onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <Field label="Username" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} />
            <Field label="Display Name" value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} />
            <SelectField label="Role" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </SelectField>
            <Field label="Password" type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Create User</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
