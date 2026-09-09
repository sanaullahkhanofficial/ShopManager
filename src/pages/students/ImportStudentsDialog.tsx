import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TEMPLATE_HEADERS = ["firstName", "lastName", "fatherName", "gender", "dob", "phone", "email", "address", "admissionDate", "className", "sectionName"];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] || "").trim()));
    return row;
  });
}

export function ImportStudentsDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null);
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_HEADERS.join(",") + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsv(String(reader.result || "")));
    reader.readAsText(file);
  }

  async function doImport() {
    setImporting(true);
    try {
      const res = await api.students.importBulk(rows);
      setResult(res);
      if (res.created > 0) onImported();
      if (res.errors.length === 0) toast.success(`Imported ${res.created} students successfully.`);
      else toast.warning(`Imported ${res.created}, ${res.errors.length} row(s) had errors.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  function reset() { setRows([]); setFileName(""); setResult(null); if (fileRef.current) fileRef.current.value = ""; }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import Students from CSV</DialogTitle>
          <DialogDescription>Download the template, fill it in, then upload it below for a validation preview before importing.</DialogDescription>
        </DialogHeader>

        <Button variant="outline" size="sm" className="w-fit" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Download CSV Template
        </Button>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center hover:bg-accent">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm">{fileName || "Click to choose a CSV file"}</span>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>

        {rows.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-md border border-border text-xs">
            <table className="w-full">
              <thead className="bg-muted/50"><tr>{Object.keys(rows[0]).map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-border">{Object.values(r).map((v: any, j) => <td key={j} className="px-2 py-1">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="p-2 text-muted-foreground">{rows.length} row(s) ready to import{rows.length > 8 ? " (preview of first 8 shown)" : ""}.</p>
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> {result.created} student(s) created.</p>
            {result.errors.map((e, i) => (
              <p key={i} className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /> Row {e.row}: {e.message}</p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button disabled={rows.length === 0} loading={importing} onClick={doImport}>Confirm Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
