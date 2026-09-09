import { useEffect, useState } from "react";
import { DatabaseBackup, ShieldCheck, History, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function BackupPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [integrity, setIntegrity] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { confirm, dialog } = useConfirm();

  function load() { api.backup.history().then(setHistory); }
  useEffect(load, []);

  async function createBackup() {
    setCreating(true);
    try {
      const res = await api.backup.create();
      if (res.canceled) return;
      toast.success(`Backup saved to ${res.backup.path}`);
      load();
    } catch (err: any) { toast.error(err.message); } finally { setCreating(false); }
  }

  async function runIntegrityCheck() {
    const res = await api.backup.integrityCheck();
    setIntegrity(res);
    toast[res.ok ? "success" : "error"](res.ok ? "Database integrity check passed." : "Database integrity check found issues.");
  }

  async function restore() {
    const ok = await confirm({
      title: "Restore from backup?",
      description: "This will replace your current database with the selected backup file and restart the application. A safety backup of your current data will be taken first.",
      destructive: true, confirmLabel: "Restore & Restart",
    });
    if (!ok) return;
    setRestoring(true);
    try {
      const res = await api.backup.restore();
      if (res.canceled) { setRestoring(false); return; }
      toast.success("Restoring — the application will restart now.");
    } catch (err: any) { toast.error(err.message); setRestoring(false); }
  }

  return (
    <div>
      <PageHeader title="Backup & Restore" description="Keep a safe copy of your school's database, and verify its integrity." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle><DatabaseBackup className="mr-1 inline h-4 w-4" /> Create Backup</CardTitle><CardDescription>Save a full copy of the database to a location you choose.</CardDescription></CardHeader>
          <CardContent><Button loading={creating} onClick={createBackup}>Create Backup</Button></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><ShieldCheck className="mr-1 inline h-4 w-4" /> Integrity Check</CardTitle><CardDescription>Verify the database has no corruption.</CardDescription></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={runIntegrityCheck}>Run Check</Button>
            {integrity && <p className={`mt-2 text-sm ${integrity.ok ? "text-success" : "text-destructive"}`}>{integrity.ok ? "✓ Database is healthy" : "✗ Issues detected"}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><Upload className="mr-1 inline h-4 w-4" /> Restore</CardTitle><CardDescription>Restore the database from a backup file.</CardDescription></CardHeader>
          <CardContent><Button variant="destructive" loading={restoring} onClick={restore}>Restore from Backup</Button></CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle><History className="mr-1 inline h-4 w-4" /> Backup History</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <EmptyState title="No backups taken yet" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>File</TableHead><TableHead>Size</TableHead></TableRow></TableHeader>
              <TableBody>
                {history.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs">{b.file_path}</TableCell>
                    <TableCell>{(b.size_bytes / 1024).toFixed(1)} KB</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  );
}
