import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Plus, HandCoins, CalendarCheck, UserPlus2, ScrollText, PenSquare, FileBarChart, Settings, DatabaseBackup } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ResultItem {
  key: string;
  label: string;
  sublabel?: string;
  icon: any;
  action: () => void;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ students: any[]; parents: any[]; teachers: any[]; staff: any[] }>({
    students: [], parents: [], teachers: [], staff: [],
  });

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) { setQuery(""); return; }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults({ students: [], parents: [], teachers: [], staff: [] }); return; }
    const t = setTimeout(() => {
      api.search.global(query).then(setResults).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const commands: ResultItem[] = useMemo(
    () => [
      { key: "add-student", label: "Add Student", icon: Plus, action: () => navigate("/students?new=1") },
      { key: "collect-fee", label: "Collect Fee", icon: HandCoins, action: () => navigate("/fees/collect") },
      { key: "mark-attendance", label: "Mark Attendance", icon: CalendarCheck, action: () => navigate("/attendance") },
      { key: "add-teacher", label: "Add Teacher", icon: UserPlus2, action: () => navigate("/teachers?new=1") },
      { key: "create-exam", label: "Create Exam", icon: ScrollText, action: () => navigate("/exams?new=1") },
      { key: "enter-marks", label: "Enter Marks", icon: PenSquare, action: () => navigate("/exams") },
      { key: "generate-report", label: "Generate Report", icon: FileBarChart, action: () => navigate("/reports") },
      { key: "open-settings", label: "Open Settings", icon: Settings, action: () => navigate("/admin/settings") },
      { key: "backup-db", label: "Backup Database", icon: DatabaseBackup, action: () => navigate("/admin/backup") },
    ],
    [navigate]
  );

  const filteredCommands = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  function go(action: () => void) {
    action();
    setCommandPaletteOpen(false);
  }

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent size="lg" className="top-[20%] translate-y-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search or type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length >= 2 && (
            <ResultGroup title="Students" items={results.students.map((s) => ({
              key: `s-${s.id}`, label: `${s.first_name} ${s.last_name || ""}`.trim(), sublabel: s.admission_no,
              icon: Search, action: () => navigate(`/students/${s.id}`),
            }))} onSelect={go} />
          )}
          {query.trim().length >= 2 && (
            <ResultGroup title="Parents" items={results.parents.map((p) => ({
              key: `p-${p.id}`, label: p.father_name || p.mother_name || p.guardian_name, sublabel: p.phone,
              icon: Search, action: () => navigate(`/parents/${p.id}`),
            }))} onSelect={go} />
          )}
          {query.trim().length >= 2 && (
            <ResultGroup title="Teachers" items={results.teachers.map((t) => ({
              key: `t-${t.id}`, label: `${t.first_name} ${t.last_name || ""}`.trim(), sublabel: t.employee_id,
              icon: Search, action: () => navigate(`/teachers/${t.id}`),
            }))} onSelect={go} />
          )}
          <ResultGroup title="Commands" items={filteredCommands} onSelect={go} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultGroup({ title, items, onSelect }: { title: string; items: ResultItem[]; onSelect: (a: () => void) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.action)}
          className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent")}
        >
          <item.icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{item.label}</span>
          {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
        </button>
      ))}
    </div>
  );
}
