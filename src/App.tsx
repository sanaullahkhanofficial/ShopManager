import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { Login } from "@/pages/Login";
import { SetupWizard } from "@/pages/setup/SetupWizard";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequirePermission } from "@/components/layout/RequirePermission";
import { PlannedPage } from "@/pages/planned/PlannedPage";

import { Dashboard } from "@/pages/Dashboard";
import { StudentsPage } from "@/pages/students/StudentsPage";
import { StudentProfilePage } from "@/pages/students/StudentProfilePage";
import { ParentsPage } from "@/pages/parents/ParentsPage";
import { ParentProfilePage } from "@/pages/parents/ParentProfilePage";
import { AdmissionsPage } from "@/pages/admissions/AdmissionsPage";
import { ClassesPage } from "@/pages/academic/ClassesPage";
import { SubjectsPage } from "@/pages/academic/SubjectsPage";
import { TeachersPage } from "@/pages/staff/TeachersPage";
import { TeacherProfilePage } from "@/pages/staff/TeacherProfilePage";
import { StaffPage } from "@/pages/staff/StaffPage";
import { AttendancePage } from "@/pages/attendance/AttendancePage";
import { TimetablePage } from "@/pages/timetable/TimetablePage";
import { HomeworkPage } from "@/pages/homework/HomeworkPage";
import { NoticesPage } from "@/pages/notices/NoticesPage";
import { FeeStructuresPage } from "@/pages/fees/FeeStructuresPage";
import { FeeCollectionPage } from "@/pages/fees/FeeCollectionPage";
import { FeeVouchersPage } from "@/pages/fees/FeeVouchersPage";
import { ScholarshipsPage } from "@/pages/fees/ScholarshipsPage";
import { OutstandingFeesPage } from "@/pages/fees/OutstandingFeesPage";
import { ExpensesPage } from "@/pages/expenses/ExpensesPage";
import { PayrollPage } from "@/pages/payroll/PayrollPage";
import { ExamsPage } from "@/pages/exams/ExamsPage";
import { ExamDetailPage } from "@/pages/exams/ExamDetailPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { RolesPage } from "@/pages/admin/RolesPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { BackupPage } from "@/pages/admin/BackupPage";
import { SystemInfoPage } from "@/pages/admin/SystemInfoPage";
import { NotificationsPage } from "@/pages/NotificationsPage";

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  const { user, loading, hydrate } = useAuthStore();
  const { load: loadSettings } = useSettingsStore();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await api.setupStatus();
        setSetupComplete(status.setupComplete);
      } catch {
        setSetupComplete(true);
      }
      await Promise.all([hydrate(), loadSettings()]);
    })();
  }, []);

  if (setupComplete === null || loading) return <LoadingScreen />;

  if (!setupComplete) {
    return (
      <HashRouter>
        <SetupWizard onComplete={() => { setSetupComplete(true); loadSettings(); }} />
      </HashRouter>
    );
  }

  if (!user) {
    return (
      <HashRouter>
        <Login />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/students" element={<RequirePermission permission="students.view"><StudentsPage /></RequirePermission>} />
          <Route path="/students/:id" element={<RequirePermission permission="students.view"><StudentProfilePage /></RequirePermission>} />
          <Route path="/parents" element={<RequirePermission permission="parents.view"><ParentsPage /></RequirePermission>} />
          <Route path="/parents/:id" element={<RequirePermission permission="parents.view"><ParentProfilePage /></RequirePermission>} />
          <Route path="/admissions" element={<RequirePermission permission="admissions.view"><AdmissionsPage /></RequirePermission>} />

          <Route path="/academic/classes" element={<RequirePermission permission="academic.manage"><ClassesPage /></RequirePermission>} />
          <Route path="/academic/subjects" element={<RequirePermission permission="academic.manage"><SubjectsPage /></RequirePermission>} />
          <Route path="/teachers" element={<RequirePermission permission="teachers.manage"><TeachersPage /></RequirePermission>} />
          <Route path="/teachers/:id" element={<RequirePermission permission="teachers.manage"><TeacherProfilePage /></RequirePermission>} />
          <Route path="/staff" element={<RequirePermission permission="staff.manage"><StaffPage /></RequirePermission>} />

          <Route path="/attendance" element={<RequirePermission permission="attendance.manage"><AttendancePage /></RequirePermission>} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/homework" element={<HomeworkPage />} />
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route path="/fees/structures" element={<RequirePermission permission="fees.view"><FeeStructuresPage /></RequirePermission>} />
          <Route path="/fees/collect" element={<RequirePermission permission="fees.collect"><FeeCollectionPage /></RequirePermission>} />
          <Route path="/fees/vouchers" element={<RequirePermission permission="fees.view"><FeeVouchersPage /></RequirePermission>} />
          <Route path="/fees/scholarships" element={<RequirePermission permission="scholarships.manage"><ScholarshipsPage /></RequirePermission>} />
          <Route path="/fees/outstanding" element={<RequirePermission permission="fees.view"><OutstandingFeesPage /></RequirePermission>} />
          <Route path="/expenses" element={<RequirePermission permission="expenses.manage"><ExpensesPage /></RequirePermission>} />
          <Route path="/payroll" element={<RequirePermission permission="payroll.view"><PayrollPage /></RequirePermission>} />

          <Route path="/exams" element={<RequirePermission permission="exams.manage"><ExamsPage /></RequirePermission>} />
          <Route path="/exams/:id" element={<RequirePermission permission="exams.manage"><ExamDetailPage /></RequirePermission>} />

          <Route path="/reports" element={<RequirePermission permission="reports.view"><ReportsPage /></RequirePermission>} />

          <Route path="/admin/settings" element={<RequirePermission permission="settings.manage"><SettingsPage /></RequirePermission>} />
          <Route path="/admin/roles" element={<RequirePermission permission="roles.manage"><RolesPage /></RequirePermission>} />
          <Route path="/admin/users" element={<RequirePermission permission="users.manage"><UsersPage /></RequirePermission>} />
          <Route path="/admin/audit" element={<RequirePermission permission="audit.view"><AuditLogPage /></RequirePermission>} />
          <Route path="/admin/backup" element={<RequirePermission permission="backup.create"><BackupPage /></RequirePermission>} />
          <Route path="/admin/system" element={<SystemInfoPage />} />

          <Route path="/library" element={<PlannedPage title="Library Management" />} />
          <Route path="/transport" element={<PlannedPage title="Transport Management" />} />
          <Route path="/inventory" element={<PlannedPage title="Inventory Management" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
