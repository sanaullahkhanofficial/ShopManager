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
import { useLang, roleLabel, moduleLabel, actionLabel, auditActionLabel, auditEntityLabel } from "../lib/i18n";
import type { AuditLogEntry, AuthUser, PermissionMatrix, Role, User } from "../types";

const ROLES: Role[] = ["Owner", "Manager", "Accountant", "Sales Staff", "Purchase Staff", "Inventory Staff", "Cashier", "Viewer"];

function UsersTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const { t } = useLang();
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
        <Button variant="primary" onClick={() => setEdit({ username: "", display_name: "", role: "Cashier", password: "" })}><Plus size={15} /> {t("addUserBtn")}</Button>
      </div>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: t("usernameCol"), render: (r) => r.username },
          { header: t("nameCol"), render: (r) => r.display_name },
          { header: t("roleCol"), render: (r) => roleLabel(r.role, t) },
          { header: t("statusCol"), render: (r) => <Switch checked={r.status === "active"} onChange={() => toggleStatus(r)} disabled={r.id === user.id} /> },
          { header: t("createdCol"), render: (r) => formatDateTime(r.created_at) },
          { header: "", render: (r) => (
            <button className="flex items-center gap-1 text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setResetTarget(r)}>
              <KeyRound size={12} /> {t("resetPasswordLink")}
            </button>
          ) },
        ]}
      />

      {edit && (
        <Modal title={t("addUserTitle")} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <Field label={t("usernameField")} value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} />
            <Field label={t("displayNameField")} value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} />
            <SelectField label={t("roleCol")} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, t)}</option>)}
            </SelectField>
            <Field label={t("passwordField")} type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setEdit(null)}>{t("cancelBtn")}</Button>
            <Button variant="primary" onClick={save}>{t("createUserBtn")}</Button>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`${t("resetPasswordPrefix")} ${resetTarget.display_name}`} onClose={() => setResetTarget(null)}>
          <Field label={t("newPasswordField")} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("atLeast4CharsPlaceholder")} />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setResetTarget(null)}>{t("cancelBtn")}</Button>
            <Button variant="primary" onClick={resetPassword}>{t("resetPasswordLink")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PermissionMatrixTab({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const { t } = useLang();
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
      <p className="text-xs text-stone-400">{t("permissionMatrixHint")}</p>
      <div className="overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-stone-50">{t("moduleActionCol")}</th>
              {matrix.roles.map((r) => <th key={r} className="text-center">{roleLabel(r, t)}</th>)}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([mod, perms]) => (
              <React.Fragment key={mod}>
                <tr className="bg-stone-50">
                  <td colSpan={matrix.roles.length + 1} className="text-xs font-semibold uppercase tracking-wide text-stone-500">{moduleLabel(mod, t)}</td>
                </tr>
                {perms.map((p) => {
                  const action = p.split(".")[1];
                  return (
                    <tr key={p}>
                      <td className="sticky left-0 bg-white pl-4 text-stone-600">{actionLabel(action, t)}</td>
                      {matrix.roles.map((role) => {
                        const locked = role === "Owner" && p === "users.manage";
                        return (
                          <td key={role} className="text-center">
                            <input
                              type="checkbox"
                              checked={isAllowed(role, p)}
                              disabled={locked}
                              onChange={() => toggle(role, p)}
                              title={locked ? t("ownerLockedTooltip") : undefined}
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
  const { t } = useLang();
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
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy-900"><History size={15} /> {t("activityLoginLogTitle")}</h3>
      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        pageSize={30}
        columns={[
          { header: t("timeCol"), render: (r) => formatDateTime(r.created_at) },
          { header: t("userCol"), render: (r) => r.user_name || t("systemWord") },
          { header: t("actionCol"), render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionTone(r.action)}`}>{auditActionLabel(r.action, t)}</span> },
          { header: t("entityCol"), render: (r) => r.entity ? `${auditEntityLabel(r.entity, t)}${r.entity_id ? ` #${r.entity_id}` : ""}` : "—" },
          { header: t("detailsCol"), render: (r) => {
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
  const { t } = useLang();
  const [tab, setTab] = useState("users");
  const tabs = useMemo(() => ([
    { id: "users", label: t("usersTab"), icon: UsersIcon },
    { id: "matrix", label: t("permissionMatrixTab"), icon: Grid3x3 },
    { id: "activity", label: t("activityLogTab"), icon: History },
  ]), [t]);

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "users" && <UsersTab user={user} />}
      {tab === "matrix" && <PermissionMatrixTab user={user} />}
      {tab === "activity" && <ActivityLogTab />}
    </div>
  );
}
