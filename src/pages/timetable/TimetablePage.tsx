import { useEffect, useState } from "react";
import { Printer, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ClockIcon } from "lucide-react";
import { useClasses, useSections, useSubjects } from "@/hooks/useAcademicLookups";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { printDocument } from "@/lib/printTemplate";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PERIODS = Array.from({ length: 7 }, (_, i) => i + 1);

export function TimetablePage() {
  const classes = useClasses();
  const [classId, setClassId] = useState("");
  const sections = useSections(classId);
  const [sectionId, setSectionId] = useState("");
  const subjects = useSubjects();
  const [slots, setSlots] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cell, setCell] = useState<{ day: number; period: number } | null>(null);

  function load() { if (sectionId) api.timetable.getSection(Number(sectionId)).then(setSlots); }
  useEffect(load, [sectionId]);
  useEffect(() => { api.teachers.search({}).then(setTeachers); }, []);

  function slotAt(day: number, period: number) { return slots.find((s) => s.day_of_week === day && s.period_index === period); }

  function printTimetable() {
    const rows = DAYS.map((day, di) => `<tr><td><strong>${day}</strong></td>${PERIODS.map((p) => {
      const s = slotAt(di, p);
      return `<td>${s ? `${s.subject_name || ""}<br/><small>${s.teacher_name || ""}</small>` : ""}</td>`;
    }).join("")}</tr>`).join("");
    const html = printDocument("Timetable", `
      <div class="doc-header"><div><h1>Class Timetable</h1></div></div>
      <table><thead><tr><th>Day</th>${PERIODS.map((p) => `<th>Period ${p}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    `);
    api.print.openWindow(html).catch((e) => toast.error(e.message));
  }

  return (
    <div>
      <PageHeader title="Timetable" description="Build and view the weekly class schedule."
        action={sectionId && <Button variant="outline" onClick={printTimetable}><Printer className="h-4 w-4" /> Print</Button>} />

      <div className="mb-4 flex gap-2">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sectionId} onValueChange={setSectionId}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!sectionId ? (
        <EmptyState icon={ClockIcon} title="Select a class and section" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr><th className="p-2 text-left">Day</th>{PERIODS.map((p) => <th key={p} className="p-2 text-left">Period {p}</th>)}</tr></thead>
            <tbody>
              {DAYS.map((day, di) => (
                <tr key={day} className="border-t border-border">
                  <td className="p-2 font-medium">{day}</td>
                  {PERIODS.map((p) => {
                    const s = slotAt(di, p);
                    return (
                      <td key={p} className="cursor-pointer border-l border-border p-2 hover:bg-accent" onClick={() => setCell({ day: di, period: p })}>
                        {s ? (
                          <div>
                            <p className="font-medium">{s.subject_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{s.teacher_name || ""}</p>
                          </div>
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cell && (
        <SlotDialog
          cell={cell} classId={Number(classId)} sectionId={Number(sectionId)}
          existing={slotAt(cell.day, cell.period)} subjects={subjects} teachers={teachers}
          onClose={() => setCell(null)} onSaved={load}
        />
      )}
    </div>
  );
}

function SlotDialog({ cell, classId, sectionId, existing, subjects, teachers, onClose, onSaved }: any) {
  const [subjectId, setSubjectId] = useState(existing?.subject_id ? String(existing.subject_id) : "");
  const [teacherId, setTeacherId] = useState(existing?.teacher_id ? String(existing.teacher_id) : "");
  const [room, setRoom] = useState(existing?.room || "");
  const [startTime, setStartTime] = useState(existing?.start_time || "08:00");
  const [endTime, setEndTime] = useState(existing?.end_time || "08:45");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.timetable.saveSlot({
        id: existing?.id, classId, sectionId, dayOfWeek: cell.day, periodIndex: cell.period,
        startTime, endTime, subjectId: subjectId ? Number(subjectId) : null, teacherId: teacherId ? Number(teacherId) : null, room,
      });
      toast.success("Timetable slot saved.");
      onClose(); onSaved();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }
  async function remove() {
    if (!existing) return;
    await api.timetable.deleteSlot(existing.id);
    onClose(); onSaved();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Period {cell.period} — {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][cell.day]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start Time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>End Time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>{teachers.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.first_name} {t.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button loading={saving} onClick={submit}>Save</Button>
          {existing && <Button variant="destructive" onClick={remove}>Remove</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
