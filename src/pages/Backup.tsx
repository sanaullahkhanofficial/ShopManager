import React, { useEffect, useState } from "react";
import { DatabaseBackup, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

export function Backup() {
  const { push } = useToast();
  const [info, setInfo] = useState<{ version: string; dataPath: string } | null>(null);
  const [result, setResult] = useState("");

  useEffect(() => { api.appInfo().then((i) => setInfo(i as typeof info)); }, []);

  async function backup() {
    const path = await api.backupCreate() as string | null;
    if (path) { setResult(`Backup saved to ${path}`); push("success", "Backup created"); }
  }
  async function integrity() {
    const r = await api.dbIntegrity() as Record<string, string>;
    setResult(JSON.stringify(r));
    push(Object.values(r)[0] === "ok" ? "success" : "error", "Integrity check complete");
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><DatabaseBackup size={16} /> Local Backup</h3>
        <p className="text-sm text-stone-500">Create a safe copy of the local SQLite database. Automatic cloud backup is tracked in ROADMAP.md pending online sync.</p>
        <Button variant="primary" onClick={backup}>Backup Now</Button>
      </div>
      <div className="card space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><ShieldCheck size={16} /> Health Check</h3>
        <Button onClick={integrity}>Run Integrity Check</Button>
        {info && <p className="text-xs text-stone-400">Version {info.version}<br />Data: {info.dataPath}</p>}
        {result && <p className="rounded-md bg-stone-50 p-2 text-xs text-stone-600">{result}</p>}
      </div>
    </div>
  );
}
