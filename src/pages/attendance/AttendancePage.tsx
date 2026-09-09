import { useEffect, useState } from "react";
import { CalendarCheck, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { useClasses, useSections } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn, todayIso } from "@/lib/utils";

const STATUSES = ["present", "absent", "late", "leave", "half_day"] as const;
const STATUS_LABEL: Record<string, string> = { present: "P", absent: "A", late: "L", leave: "Lv", half_day: "½" };
const STATUS_COLOR: Record<string, string> = {
  present: "bg-success text-success-foreground", absent: "bg-destructive text-destructive-foreground",
  late: "bg-warning text-warning-foreground", leave: "bg-primary text-primary-foreground", half_day: "bg-muted-foreground text-background",
};

export function AttendancePage() {
  const classes = useClasses();
  const [classId, setClassId] = useState("");
  const sections = useSections(classId);
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [roster, setRoster] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  function load() {
    if (!classId) { setRoster([]); return; }
    api.attendance.getClass({ classId: Number(classId), sectionId: sectionId ? Number(sectionId) : null, date }).then((rows) => {
      setRoster(rows);
      setMarks(Object.fromEntries(rows.map((r: any) => [r.student_id, r.status || "present"])));
    });
  }
  useEffect(load, [classId, sectionId, date]);

  function markAll(status: string) { setMarks(Object.fromEntries(roster.map((r) => [r.student_id, status]))); }

  async function save() {
    setSaving(true);
    try {
      const entries = roster.map((r) => ({ studentId: r.student_id, status: marks[r.student_id] || "present" }));
      const res = await api.attendance.saveClass({ classId: Number(classId), sectionId: sectionId ? Number(sectionId) : null, date, entries });
      toast.success(`Attendance saved for ${res.count} students.`);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Attendance" description="Fast, keyboard-friendly daily attendance entry." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sectionId} onValueChange={setSectionId}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        {roster.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => markAll("present")}><Check className="h-3.5 w-3.5" /> Mark all Present</Button>
            <Button size="sm" loading={saving} onClick={save}>Save Attendance</Button>
          </div>
        )}
      </div>

      {!classId ? (
        <EmptyState icon={CalendarCheck} title="Select a class to begin" description="Choose a class (and optionally a section) and a date to mark attendance." />
      ) : roster.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No active students in this class/section" />
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Roll #</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Quick Set</TableHead></TableRow></TableHeader>
          <TableBody>
            {roster.map((r) => (
              <TableRow key={r.student_id}>
                <TableCell>{r.roll_number || "—"}</TableCell>
                <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                <TableCell>
                  <span className={cn("inline-flex h-6 w-10 items-center justify-center rounded text-xs font-semibold", STATUS_COLOR[marks[r.student_id] || "present"])}>
                    {STATUS_LABEL[marks[r.student_id] || "present"]}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setMarks((m) => ({ ...m, [r.student_id]: s }))}
                        className={cn("h-6 w-8 rounded text-[10px] font-semibold border border-border", marks[r.student_id] === s ? STATUS_COLOR[s] : "bg-background hover:bg-accent")}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
