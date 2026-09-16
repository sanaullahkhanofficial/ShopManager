import React, { useEffect, useState } from "react";
import { DatabaseBackup, ShieldCheck, Upload, Lock } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Switch } from "../components/ui/Switch";
import { useToast } from "../components/ui/Toast";
import { usePermissionSet } from "../lib/permissions";
import type { AuthUser } from "../types";

export function Backup({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const perms = usePermissionSet(user.role);
  const canRestore = !!perms?.has("settings.manage");

  const [info, setInfo] = useState<{ version: string; dataPath: string } | null>(null);
  const [result, setResult] = useState("");
  const [encrypt, setEncrypt] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [busy, setBusy] = useState(false);

  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState("");

  useEffect(() => { api.appInfo().then((i) => setInfo(i as typeof info)); }, []);

  async function backup() {
    if (encrypt && !backupPassphrase.trim()) { push("error", "Enter a passphrase, or turn off encryption"); return; }
    setBusy(true);
    try {
      const path = await api.backupCreate(encrypt ? backupPassphrase : undefined);
      if (path) {
        setResult(`Backup saved to ${path}`);
        push("success", encrypt ? "Encrypted backup created" : "Backup created");
        setBackupPassphrase("");
      }
    } finally {
      setBusy(false);
    }
  }
  async function integrity() {
    const r = await api.dbIntegrity() as Record<string, string>;
    setResult(JSON.stringify(r));
    push(Object.values(r)[0] === "ok" ? "success" : "error", "Integrity check complete");
  }

  async function pickRestoreFile() {
    const path = await api.backupPickFile();
    if (path) { setRestoreFile(path); setRestoreError(""); }
  }
  async function restore() {
    if (!restoreFile) return;
    if (!confirm(
      "This will permanently REPLACE all current sales, purchases, customers, stock and cash data with the contents of this backup. " +
      "A safety copy of today's data is kept automatically, but this cannot be undone from inside the app. Continue?"
    )) return;
    setRestoreBusy(true);
    setRestoreError("");
    try {
      await api.backupRestore({ filePath: restoreFile, passphrase: restorePassphrase || undefined, actorId: user.id });
      push("success", "Restored — reloading with the restored data");
      window.location.reload();
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><DatabaseBackup size={16} /> Local Backup</h3>
        <p className="text-sm text-stone-500">Create a safe copy of the local SQLite database. Automatic cloud backup is tracked in ROADMAP.md pending online sync.</p>
        <Switch checked={encrypt} onChange={setEncrypt} label="Encrypt this backup with a passphrase" />
        {encrypt && (
          <>
            <Field label="Passphrase" type="password" value={backupPassphrase} onChange={(e) => setBackupPassphrase(e.target.value)} />
            <p className="text-xs text-stone-400">You'll need this exact passphrase to restore from this file later. There's no way to recover a lost passphrase.</p>
          </>
        )}
        <Button variant="primary" onClick={backup} disabled={busy}>{busy ? "Saving…" : "Backup Now"}</Button>
      </div>

      <div className="card space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><ShieldCheck size={16} /> Health Check</h3>
        <Button onClick={integrity}>Run Integrity Check</Button>
        {info && <p className="text-xs text-stone-400">Version {info.version}<br />Data: {info.dataPath}</p>}
        {result && <p className="rounded-md bg-stone-50 p-2 text-xs text-stone-600">{result}</p>}
      </div>

      {canRestore && (
        <div className="card space-y-3 md:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><Upload size={16} /> Restore from Backup</h3>
          <p className="text-sm text-stone-500">
            Replaces all current data with a backup file's contents. The file is validated with a real database
            integrity check before anything is touched, and today's data is copied aside automatically first.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Button onClick={pickRestoreFile}>Choose Backup File</Button>
            {restoreFile && <span className="text-xs text-stone-500">{restoreFile}</span>}
          </div>
          {restoreFile && (
            <>
              <Field
                label="Passphrase (only if this backup was encrypted)"
                type="password" value={restorePassphrase} onChange={(e) => setRestorePassphrase(e.target.value)}
              />
              <Button variant="danger" onClick={restore} disabled={restoreBusy}>
                <Lock size={14} /> {restoreBusy ? "Restoring…" : "Restore This Backup"}
              </Button>
            </>
          )}
          {restoreError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{restoreError}</p>}
        </div>
      )}
    </div>
  );
}
