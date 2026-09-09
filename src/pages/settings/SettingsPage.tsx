import { useEffect, useState } from "react";
import { Save, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settingsStore";

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Configure your school profile, branding, academic sessions and grading scale." />
      <Tabs defaultValue="school">
        <TabsList>
          <TabsTrigger value="school">School</TabsTrigger>
          <TabsTrigger value="academic">Academic Sessions</TabsTrigger>
          <TabsTrigger value="grading">Grading Scale</TabsTrigger>
          <TabsTrigger value="theme">Theme & Print</TabsTrigger>
        </TabsList>
        <TabsContent value="school"><SchoolTab /></TabsContent>
        <TabsContent value="academic"><AcademicTab /></TabsContent>
        <TabsContent value="grading"><GradingTab /></TabsContent>
        <TabsContent value="theme"><ThemeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SchoolTab() {
  const { school, load } = useSettingsStore();
  const [form, setForm] = useState<any>(school || {});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (school) setForm(school); }, [school]);
  function f(k: string, v: string) { setForm((s: any) => ({ ...s, [k]: v })); }

  async function save() {
    setSaving(true);
    try { await api.settings.updateSchool(form); await load(); toast.success("School settings saved."); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>School Information</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <F label="School Name" value={form.name} onChange={(v) => f("name", v)} />
          <F label="Principal Name" value={form.principal_name} onChange={(v) => f("principal_name", v)} />
          <F label="Motto" value={form.motto} onChange={(v) => f("motto", v)} />
          <F label="Phone" value={form.phone} onChange={(v) => f("phone", v)} />
          <F label="Email" value={form.email} onChange={(v) => f("email", v)} />
          <F label="Website" value={form.website} onChange={(v) => f("website", v)} />
          <F label="City" value={form.city} onChange={(v) => f("city", v)} />
          <F label="Country" value={form.country} onChange={(v) => f("country", v)} />
          <F label="Address" value={form.address} onChange={(v) => f("address", v)} />
          <F label="Currency Code" value={form.currency} onChange={(v) => f("currency", v)} />
          <F label="Currency Symbol" value={form.currency_symbol} onChange={(v) => f("currency_symbol", v)} />
        </div>
        <Button loading={saving} onClick={save}><Save className="h-4 w-4" /> Save</Button>
      </CardContent>
    </Card>
  );
}

function AcademicTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function load() { api.academic.listSessions().then(setSessions); }
  useEffect(load, []);

  async function add() {
    if (!name || !startDate || !endDate) { toast.error("Fill in all fields."); return; }
    try { await api.academic.createSession({ name, startDate, endDate }); toast.success("Session added."); setName(""); load(); }
    catch (err: any) { toast.error(err.message); }
  }
  async function makeCurrent(id: number) { await api.academic.setCurrentSession(id); toast.success("Set as current session."); load(); }

  return (
    <Card>
      <CardHeader><CardTitle>Academic Sessions</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-4 items-end gap-2">
          <div className="space-y-1.5"><Label>Session Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-2027" /></div>
          <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <Button onClick={add}><Plus className="h-4 w-4" /> Add Session</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Current</TableHead></TableRow></TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell><TableCell>{s.start_date}</TableCell><TableCell>{s.end_date}</TableCell>
                <TableCell>{s.is_current ? <span className="text-success">Current</span> : <Button variant="ghost" size="sm" onClick={() => makeCurrent(s.id)}>Set Current</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GradingTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  function load() { api.settings.getGradingScale().then(setRows); }
  useEffect(load, []);

  function update(i: number, key: string, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: key === "grade" || key === "remarks" ? value : Number(value) } : row)));
  }
  function addRow() { setRows((r) => [...r, { min_percent: 0, max_percent: 0, grade: "", remarks: "", gpa: 0 }]); }

  async function save() {
    setSaving(true);
    try { await api.settings.saveGradingScale(rows); toast.success("Grading scale saved."); load(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Grading Scale</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Min %</TableHead><TableHead>Max %</TableHead><TableHead>Grade</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell><Input className="h-8 w-20" type="number" value={r.min_percent} onChange={(e) => update(i, "min_percent", e.target.value)} /></TableCell>
                <TableCell><Input className="h-8 w-20" type="number" value={r.max_percent} onChange={(e) => update(i, "max_percent", e.target.value)} /></TableCell>
                <TableCell><Input className="h-8 w-16" value={r.grade} onChange={(e) => update(i, "grade", e.target.value)} /></TableCell>
                <TableCell><Input className="h-8" value={r.remarks} onChange={(e) => update(i, "remarks", e.target.value)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add Band</Button>
          <Button size="sm" loading={saving} onClick={save}><Save className="h-3.5 w-3.5" /> Save Grading Scale</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeTab() {
  const { school, load } = useSettingsStore();
  const [color, setColor] = useState(school?.theme_primary_color || "#4f46e5");
  const [mode, setMode] = useState<string>(school?.theme_mode || "system");
  const [receiptFooter, setReceiptFooter] = useState(school?.receipt_footer || "");
  const [prefixes, setPrefixes] = useState({ receipt_prefix: school?.receipt_prefix, voucher_prefix: school?.voucher_prefix, student_id_prefix: school?.student_id_prefix, admission_no_prefix: school?.admission_no_prefix });

  useEffect(() => {
    if (school) {
      setColor(school.theme_primary_color); setMode(school.theme_mode); setReceiptFooter(school.receipt_footer);
      setPrefixes({ receipt_prefix: school.receipt_prefix, voucher_prefix: school.voucher_prefix, student_id_prefix: school.student_id_prefix, admission_no_prefix: school.admission_no_prefix });
    }
  }, [school]);

  async function save() {
    await api.settings.updateSchool({ theme_primary_color: color, theme_mode: mode, receipt_footer: receiptFooter, ...prefixes });
    await load();
    toast.success("Theme & print settings saved.");
  }

  return (
    <Card>
      <CardHeader><CardTitle>Theme & Print Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Primary Color</Label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full rounded-md border border-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Theme Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="system">System</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent>
            </Select>
          </div>
          <F label="Receipt Prefix" value={prefixes.receipt_prefix} onChange={(v) => setPrefixes((p) => ({ ...p, receipt_prefix: v }))} />
          <F label="Voucher Prefix" value={prefixes.voucher_prefix} onChange={(v) => setPrefixes((p) => ({ ...p, voucher_prefix: v }))} />
          <F label="Student ID Prefix" value={prefixes.student_id_prefix} onChange={(v) => setPrefixes((p) => ({ ...p, student_id_prefix: v }))} />
          <F label="Admission No Prefix" value={prefixes.admission_no_prefix} onChange={(v) => setPrefixes((p) => ({ ...p, admission_no_prefix: v }))} />
        </div>
        <div className="space-y-1.5"><Label>Receipt Footer</Label><Input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} /></div>
        <Button onClick={save}><Save className="h-4 w-4" /> Save</Button>
      </CardContent>
    </Card>
  );
}

function F({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (<div className="space-y-1.5"><Label>{label}</Label><Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>);
}
