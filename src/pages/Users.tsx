import React, { useEffect, useMemo, useState } from "react";
import { Grid3x3, History, KeyRound, Plus, Users as UsersIcon } from "lucide-react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { Switch } from "../components/ui/Switch";
import { Tabs } from "../components/ui/Tabs";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuditLogEntry, AuthUser, PermissionMatrix, Role, User } from "../types";

const ROLES: Role[] = ["Owner", "Manager", "Accountant", "Sales Staff", "Purchase Staff", "Inventory Staff", "Cashier", "Viewer"];

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", sales: "Sales", purchase: "Purchases", inventory: "Inventory",
  customers: "Customers", suppliers: "Suppliers", cash: "Cash", expenses: "Expenses",
  reports: "Reports", users: "Users", settings: "Settings", printer: "Printer",
};
const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete", return: "Return",
  adjust: "Adjust", payment: "Payment", manage: "Manage", export: "Export",
};

function UsersTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [edit, setEdit] = useState<{ username: string; display_name: string; role: Role; password: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = () => { api.usersList().then((u) => setRows(u as User[])); };
  useEffect(load, []);

  async function save() {
    if (!edit) return;
    await api.usersAdd({ ...edit, actorId: user.id });
    push("success", "User created");
    setEdit(null);
    load();
  }

  async function toggleStatus(row: User) {
    await api.usersSetStatus({ id: row.id, status: row.status === "active" ? "inactive" : "active", actorId: user.id });
    push("success", `${row.display_name} ${row.status === "active" ? "deactivated" : "reactivated"}`);
    load();
  }

  async function resetPassword() {
    if (!resetTarget || newPassword.length < 4) { push("error", "Password must be at least 4 characters"); return; }
    await api.usersResetPassword({ id: resetTarget.id, password: newPassword, actorId: user.id });
    push("success", `Password reset for ${resetTarget.display_name}`);
    setResetTarget(null); setNewPassword("");
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
          { header: "Status", render: (r) => <Switch checked={r.status === "active"} onChange={() => toggleStatus(r)} disabled={r.id === user.id} /> },
          { header: "Created", render: (r) => formatDateTime(r.created_at) },
          { header: "", render: (r) => (
            <button className="flex items-center gap-1 text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setResetTarget(r)}>
              <KeyRound size={12} /> Reset Password
            </button>
          ) },
        ]}
      />

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

      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.display_name}`} onClose={() => setResetTarget(null)}>
          <Field label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 4 characters" />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={resetPassword}>Reset Password</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PermissionMatrixTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);

  const load = () => { api.permissionsMatrix().then((m) => setMatrix(m as PermissionMatrix)); };
  useEffect(load, []);

  const grouped = useMemo(() => {
    if (!matrix) return [];
    const modules = new Map<string, string[]>();
    for (const p of matrix.permissions) {
      const [mod] = p.split(".");
      if (!modules.has(mod)) modules.set(mod, []);
      modules.get(mod)!.push(p);
    }
    return [...modules.entries()];
  }, [matrix]);

  function isAllowed(role: string, permission: string) {
    return !!matrix?.rows.find((r) => r.role === role && r.permission === permission)?.allowed;
  }

  async function toggle(role: Role, permission: string) {
    const current = isAllowed(role, permission);
    if (role === "Owner" && permission === "users.manage" && current) {
      push("error", "The Owner role's user-management permission can't be revoked — it would lock out every administrator.");
      return;
    }
    setMatrix((m) => m ? { ...m, rows: m.rows.some((r) => r.role === role && r.permission === permission)
      ? m.rows.map((r) => r.role === role && r.permission === permission ? { ...r, allowed: current ? 0 : 1 } : r)
      : [...m.rows, { role, permission, allowed: current ? 0 : 1 }] } : m);
    try {
      await api.permissionsUpdate({ role, permission, allowed: !current, actorId: user.id });
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to update permission");
      load();
    }
  }

  if (!matrix) return null;

  return (
    <div className="card space-y-4">
      <p className="text-xs text-stone-400">Toggle which roles can perform each action. Changes take effect immediately and are enforced on every save, not just hidden in the UI.</p>
      <div className="overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-stone-50">Module / Action</th>
              {matrix.roles.map((r) => <th key={r} className="text-center">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([mod, perms]) => (
              <React.Fragment key={mod}>
                <tr className="bg-stone-50">
                  <td colSpan={matrix.roles.length + 1} className="text-xs font-semibold uppercase tracking-wide text-stone-500">{MODULE_LABELS[mod] || mod}</td>
                </tr>
                {perms.map((p) => {
                  const action = p.split(".")[1];
                  return (
                    <tr key={p}>
                      <td className="sticky left-0 bg-white pl-4 text-stone-600">{ACTION_LABELS[action] || action}</td>
                      {matrix.roles.map((role) => {
                        const locked = role === "Owner" && p === "users.manage";
                        return (
                          <td key={role} className="text-center">
                            <input
                              type="checkbox"
                              checked={isAllowed(role, p)}
                              disabled={locked}
                              onChange={() => toggle(role, p)}
                              title={locked ? "Owner must always be able to manage users" : undefined}
                              className="h-4 w-4 accent-brand-green-600 disabled:opacity-40"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityLogTab() {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  useEffect(() => { api.auditList(300).then((r) => setRows(r as AuditLogEntry[])); }, []);

  function actionTone(action: string) {
    if (action === "LOGIN_FAILED") return "bg-red-50 text-red-700";
    if (action === "LOGIN") return "bg-brand-green-50 text-brand-green-700";
    if (action.includes("DELETE") || action === "VOID" || action.includes("DEACTIVATED")) return "bg-amber-50 text-amber-700";
    return "bg-stone-100 text-stone-600";
  }

  return (
    <div className="card space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><History size={15} /> Activity &amp; Login Log</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        pageSize={30}
        columns={[
          { header: "Time", render: (r) => formatDateTime(r.created_at) },
          { header: "User", render: (r) => r.user_name || "System" },
          { header: "Action", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionTone(r.action)}`}>{r.action.replace(/_/g, " ")}</span> },
          { header: "Entity", render: (r) => r.entity ? `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ""}` : "—" },
          { header: "Details", render: (r) => {
            if (!r.details) return "—";
            try {
              const d = JSON.parse(r.details);
              return <span className="text-xs text-stone-500">{Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>;
            } catch { return r.details; }
          } },
        ]}
      />
    </div>
  );
}

export function Users({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState("users");
  const tabs = useMemo(() => ([
    { id: "users", label: "Users", icon: UsersIcon },
    { id: "matrix", label: "Permission Matrix", icon: Grid3x3 },
    { id: "activity", label: "Activity Log", icon: History },
  ]), []);

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "users" && <UsersTab user={user} />}
      {tab === "matrix" && <PermissionMatrixTab user={user} />}
      {tab === "activity" && <ActivityLogTab />}
    </div>
  );
}
