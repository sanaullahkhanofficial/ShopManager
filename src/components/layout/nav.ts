import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, GraduationCap, UserPlus2, School, Users2, CalendarCheck, ClockIcon,
  BookOpenCheck, ScrollText, Wallet, Receipt, FileSpreadsheet, HandCoins, Landmark,
  BarChart3, UsersRound, IdCard, Library, Bus, Boxes, FolderOpen, Award, ShieldAlert,
  Megaphone, Bell, MessageSquare, FileBarChart, Settings, KeyRound, History, DatabaseBackup, Info,
} from "lucide-react";

export interface NavItem {
  label: string;
  to?: string;
  icon: LucideIcon;
  permission?: string;
  planned?: boolean;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    label: "Academic",
    items: [
      { label: "Students", to: "/students", icon: GraduationCap, permission: "students.view" },
      { label: "Admissions", to: "/admissions", icon: UserPlus2, permission: "admissions.view" },
      { label: "Classes & Sections", to: "/academic/classes", icon: School, permission: "academic.manage" },
      { label: "Subjects", to: "/academic/subjects", icon: BookOpenCheck, permission: "academic.manage" },
      { label: "Teachers", to: "/teachers", icon: Users2, permission: "teachers.manage" },
      { label: "Timetable", to: "/timetable", icon: ClockIcon },
      { label: "Attendance", to: "/attendance", icon: CalendarCheck, permission: "attendance.manage" },
      { label: "Exams", to: "/exams", icon: ScrollText, permission: "exams.manage" },
      { label: "Homework", to: "/homework", icon: BookOpenCheck },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Fee Structures", to: "/fees/structures", icon: Wallet, permission: "fees.view" },
      { label: "Fee Collection", to: "/fees/collect", icon: HandCoins, permission: "fees.collect" },
      { label: "Fee Vouchers", to: "/fees/vouchers", icon: Receipt, permission: "fees.view" },
      { label: "Scholarships", to: "/fees/scholarships", icon: Award, permission: "scholarships.manage" },
      { label: "Outstanding Fees", to: "/fees/outstanding", icon: FileSpreadsheet, permission: "fees.view" },
      { label: "Expenses", to: "/expenses", icon: Landmark, permission: "expenses.manage" },
      { label: "Payroll", to: "/payroll", icon: Wallet, permission: "payroll.view" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Parents", to: "/parents", icon: UsersRound, permission: "parents.view" },
      { label: "Staff", to: "/staff", icon: IdCard, permission: "staff.manage" },
      { label: "Users", to: "/admin/users", icon: Users2, permission: "users.manage" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Library", icon: Library, planned: true },
      { label: "Transport", icon: Bus, planned: true },
      { label: "Inventory", icon: Boxes, planned: true },
      { label: "Documents", icon: FolderOpen, planned: true },
      { label: "Certificates", icon: Award, planned: true },
      { label: "Discipline", icon: ShieldAlert, planned: true },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notices", to: "/notices", icon: Megaphone },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Messages (SMS/Email)", icon: MessageSquare, planned: true },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Reporting Center", to: "/reports", icon: FileBarChart, permission: "reports.view" }],
  },
  {
    label: "Administration",
    items: [
      { label: "Settings", to: "/admin/settings", icon: Settings, permission: "settings.manage" },
      { label: "Roles & Permissions", to: "/admin/roles", icon: KeyRound, permission: "roles.manage" },
      { label: "Audit Logs", to: "/admin/audit", icon: History, permission: "audit.view" },
      { label: "Backup & Restore", to: "/admin/backup", icon: DatabaseBackup, permission: "backup.create" },
      { label: "System Information", to: "/admin/system", icon: Info },
    ],
  },
];
