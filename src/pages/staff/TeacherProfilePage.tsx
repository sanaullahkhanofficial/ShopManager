import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { TeacherFormDialog } from "./TeacherFormDialog";

export function TeacherProfilePage() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  function load() { api.teachers.getById(Number(id)).then(setTeacher); }
  useEffect(load, [id]);
  if (!teacher) return null;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Teachers", to: "/teachers" }, { label: `${teacher.first_name} ${teacher.last_name || ""}` }]}
        title={`${teacher.first_name} ${teacher.last_name || ""}`}
        description={`${teacher.employee_id} · ${teacher.department || "No department"}`}
        action={<><StatusBadge status={teacher.employment_status} /><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button></>}
      />
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4 mb-4">
        <Info label="Phone" value={teacher.phone} />
        <Info label="Email" value={teacher.email} />
        <Info label="Qualification" value={teacher.qualification} />
        <Info label="Experience" value={teacher.experience_years ? `${teacher.experience_years} years` : "—"} />
        <Info label="Joining Date" value={teacher.joining_date} />
        <Info label="Basic Salary" value={teacher.basic_salary} />
      </div>
      <Card>
        <CardHeader><CardTitle>Class Assignments</CardTitle></CardHeader>
        <CardContent>
          {teacher.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No class assignments yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {teacher.assignments.map((a: any) => (
                <li key={a.id}>{a.class_name} {a.section_name || ""} {a.subject_name ? `— ${a.subject_name}` : ""}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <TeacherFormDialog open={editOpen} onOpenChange={setEditOpen} teacher={teacher} onSaved={load} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (<div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>);
}
