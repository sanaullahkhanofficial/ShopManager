import { useEffect, useState } from "react";
import { Info, Database as DatabaseIcon, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function SystemInfoPage() {
  const [info, setInfo] = useState<any>(null);
  const { user } = useAuthStore();
  const isSuper = user?.roleName === "Super Admin" || user?.roleName === "School Owner";
  const [loadingDemo, setLoadingDemo] = useState(false);

  function load() { api.appInfo().then(setInfo); }
  useEffect(load, []);

  async function loadDemo() {
    setLoadingDemo(true);
    try { await api.loadDemoData(); toast.success("Sample demo data loaded."); }
    catch (err: any) { toast.error(err.message); } finally { setLoadingDemo(false); }
  }

  if (!info) return null;

  return (
    <div>
      <PageHeader title="System Information" description="Installation details and diagnostics." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><Info className="mr-1 inline h-4 w-4" /> Application</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Version" value={info.version} />
            <Row label="Current User" value={`${user?.displayName} (${user?.roleName})`} />
            <Row label="System Status" value={info.integrity?.ok ? "Healthy" : "Needs Attention"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><DatabaseIcon className="mr-1 inline h-4 w-4" /> Database</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Data Path" value={info.dataPath} mono />
            <Row label="Database Size" value={`${(info.dbSizeBytes / 1024).toFixed(1)} KB`} />
            <Row label="Last Backup" value={info.lastBackup ? new Date(info.lastBackup.created_at).toLocaleString() : "Never"} />
          </CardContent>
        </Card>
      </div>

      {isSuper && (
        <Card className="mt-4">
          <CardHeader><CardTitle><Sparkles className="mr-1 inline h-4 w-4" /> Demo Data</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">Load a clearly-labeled sample dataset ("Bright Future Public School" — 100+ students, 15 teachers) for exploring the system. This does not remove existing data.</p>
            <Button variant="outline" loading={loadingDemo} onClick={loadDemo}>Load Demo Data</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-xs" : "text-right"}>{value}</span>
    </div>
  );
}
