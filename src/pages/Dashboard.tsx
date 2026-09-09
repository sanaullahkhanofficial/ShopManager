import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Users, GraduationCap, UserCheck, Wallet, TrendingUp, TrendingDown, Plus, HandCoins, CalendarCheck, UserPlus2, ScrollText, PenSquare, FileBarChart, Receipt } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const PIE_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

export function Dashboard() {
  const { hasPermission, user } = useAuthStore();
  const school = useSettingsStore((s) => s.school);
  const navigate = useNavigate();
  const isSuper = user?.roleName === "Super Admin" || user?.roleName === "School Owner";
  const [kpis, setKpis] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [incomeExpense, setIncomeExpense] = useState<any[]>([]);
  const [classDist, setClassDist] = useState<any[]>([]);
  const [feeStatus, setFeeStatus] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.dashboard.kpis(),
      api.dashboard.enrollmentTrend(6),
      api.dashboard.collectionTrend(6),
      api.dashboard.attendanceTrend(14),
      api.dashboard.incomeVsExpense(6),
      api.dashboard.classDistribution(),
      api.dashboard.feeCollectionStatus(),
      api.dashboard.recentActivity(10),
    ])
      .then(([k, e, c, a, ie, cd, fs, ra]) => {
        setKpis(k); setEnrollment(e); setCollection(c); setAttendance(a);
        setIncomeExpense(ie); setClassDist(cd); setFeeStatus(fs); setRecent(ra);
      })
      .finally(() => setLoading(false));
  }, []);

  const symbol = school?.currency_symbol || "$";
  const quickActions = [
    { label: "Add Student", icon: Plus, to: "/students?new=1", permission: "students.create" },
    { label: "Collect Fee", icon: HandCoins, to: "/fees/collect", permission: "fees.collect" },
    { label: "Mark Attendance", icon: CalendarCheck, to: "/attendance", permission: "attendance.manage" },
    { label: "Add Teacher", icon: UserPlus2, to: "/teachers?new=1", permission: "teachers.manage" },
    { label: "Create Exam", icon: ScrollText, to: "/exams?new=1", permission: "exams.manage" },
    { label: "Enter Marks", icon: PenSquare, to: "/exams", permission: "marks.enter" },
    { label: "Generate Report", icon: FileBarChart, to: "/reports", permission: "reports.view" },
    { label: "Print Fee Voucher", icon: Receipt, to: "/fees/vouchers", permission: "fees.view" },
  ].filter((a) => isSuper || hasPermission(a.permission));

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Welcome back, ${user?.displayName?.split(" ")[0] || ""}`} description="Here's what's happening at your school today." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Total Students" value={kpis.totalStudents} icon={GraduationCap} />
        <Kpi label="Active Students" value={kpis.activeStudents} icon={UserCheck} />
        <Kpi label="Teachers" value={kpis.teachers} icon={Users} />
        <Kpi label="Today's Attendance" value={kpis.todaysAttendancePct !== null ? `${kpis.todaysAttendancePct}%` : "—"} icon={CalendarCheck} />
        <Kpi label="Today's Collection" value={formatCurrency(kpis.todaysCollection, symbol)} icon={Wallet} />
        <Kpi label="Outstanding Fees" value={formatCurrency(kpis.outstandingFees, symbol)} icon={Wallet} tone="warning" />
        <Kpi label="Monthly Revenue" value={formatCurrency(kpis.monthlyRevenue, symbol)} icon={TrendingUp} tone="success" />
        <Kpi label="Monthly Expenses" value={formatCurrency(kpis.monthlyExpenses, symbol)} icon={TrendingDown} tone="destructive" />
        <Kpi label="Net Balance" value={formatCurrency(kpis.netBalance, symbol)} icon={Wallet} tone={kpis.netBalance >= 0 ? "success" : "destructive"} />
        <Kpi label="Staff" value={kpis.staff} icon={Users} />
      </div>

      {quickActions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <Button key={a.label} variant="outline" size="sm" onClick={() => navigate(a.to)}>
              <a.icon className="h-3.5 w-3.5" /> {a.label}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Student Enrollment Trend">
          {enrollment.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={enrollment}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" name="New admissions" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Monthly Fee Collection">
          {collection.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={collection}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => formatCurrency(v, symbol)} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Attendance Trend (last 14 days)">
          {attendance.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                <YAxis fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="percentage" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Present %" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Income vs Expenses">
          {incomeExpense.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={incomeExpense}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => formatCurrency(v, symbol)} />
                <Legend />
                <Bar dataKey="income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Class-wise Student Distribution">
          {classDist.every((c) => c.count === 0) ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classDist} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="class_name" fontSize={11} width={70} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Fee Collection Status">
          {feeStatus.every((f) => f.value === 0) ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={feeStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {feeStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? <NoData label="No recent activity yet." /> : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium">{r.actor_name || "System"}</span>{" "}
                    <span className="text-muted-foreground">{r.action.replace(/_/g, " ")}</span>{" "}
                    {r.entity && <span className="text-muted-foreground">· {r.entity}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: any; icon: any; tone?: "success" | "warning" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function NoData({ label = "No data yet." }: { label?: string }) {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
