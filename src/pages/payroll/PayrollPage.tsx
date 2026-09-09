import { useEffect, useState } from "react";
import { Printer, Save, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { printDocument, escapeHtml } from "@/lib/printTemplate";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollPage() {
  const school = useSettingsStore((s) => s.school);
  const symbol = school?.currency_symbol || "$";
  const [month, setMonth] = useState(currentMonth());
  const [roster, setRoster] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    api.payroll.getMonthRoster(month).then((rows) => {
      setRoster(rows);
      setEdits(Object.fromEntries(rows.map((r: any) => [
        `${r.person_type}-${r.person_id}`,
        { allowances: r.allowances || 0, bonuses: r.bonuses || 0, deductions: r.deductions || 0, advances: r.advances || 0 },
      ])));
    });
  }
  useEffect(load, [month]);

  function net(r: any) {
    const e = edits[`${r.person_type}-${r.person_id}`] || {};
    return Number(r.basic_salary) + Number(e.allowances || 0) + Number(e.bonuses || 0) - Number(e.deductions || 0) - Number(e.advances || 0);
  }

  async function save(r: any) {
    const key = `${r.person_type}-${r.person_id}`;
    setSaving(key);
    try {
      const e = edits[key];
      await api.payroll.saveEntry({ month, personType: r.person_type, personId: r.person_id, basicSalary: r.basic_salary, ...e });
      toast.success("Payroll entry saved.");
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(null); }
  }

  async function markPaid(r: any) {
    if (!r.run_id) { toast.error("Save this entry before marking it paid."); return; }
    await api.payroll.markPaid(r.run_id);
    toast.success("Marked as paid.");
    load();
  }

  async function printSlip(r: any) {
    if (!r.run_id) { toast.error("Save this entry first."); return; }
    const slip = await api.payroll.getSlip(r.run_id);
    const html = printDocument(`Salary Slip - ${slip.person.employee_id}`, `
      <div class="doc-header"><div><h1>${escapeHtml(school?.name || "School")}</h1></div><div style="text-align:right"><p>${month}</p></div></div>
      <div class="doc-title">Salary Slip</div>
      <div class="grid-2">
        <div><span>Employee</span> ${escapeHtml(slip.person.first_name)} ${escapeHtml(slip.person.last_name || "")}</div>
        <div><span>Employee ID</span> ${slip.person.employee_id}</div>
      </div>
      <table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>
        <tr><td>Basic Salary</td><td>${formatCurrency(slip.run.basic_salary, symbol)}</td></tr>
        <tr><td>Allowances</td><td>${formatCurrency(slip.run.allowances, symbol)}</td></tr>
        <tr><td>Bonuses</td><td>${formatCurrency(slip.run.bonuses, symbol)}</td></tr>
        <tr><td>Deductions</td><td>-${formatCurrency(slip.run.deductions, symbol)}</td></tr>
        <tr><td>Advances</td><td>-${formatCurrency(slip.run.advances, symbol)}</td></tr>
      </tbody></table>
      <div class="totals"><div class="grand"><span>Net Salary</span><span>${formatCurrency(slip.run.net_salary, symbol)}</span></div></div>
      <div class="signature"><div>Employee Signature</div><div>Authorized Signature</div></div>
    `);
    api.print.openWindow(html).catch((e) => toast.error(e.message));
  }

  return (
    <div>
      <PageHeader title="Payroll" description="Monthly salary runs: basic + allowances + bonuses − deductions − advances = net salary." />
      <div className="mb-3"><Input type="month" className="w-48" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Bonuses</TableHead>
            <TableHead>Deductions</TableHead><TableHead>Advances</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((r) => {
            const key = `${r.person_type}-${r.person_id}`;
            const e = edits[key] || {};
            return (
              <TableRow key={key}>
                <TableCell>{r.first_name} {r.last_name} <span className="text-xs text-muted-foreground">({r.employee_id})</span></TableCell>
                <TableCell>{formatCurrency(r.basic_salary, symbol)}</TableCell>
                {(["allowances", "bonuses", "deductions", "advances"] as const).map((field) => (
                  <TableCell key={field}>
                    <Input className="h-8 w-24" type="number" value={e[field] ?? 0} onChange={(ev) => setEdits((s) => ({ ...s, [key]: { ...s[key], [field]: ev.target.value } }))} />
                  </TableCell>
                ))}
                <TableCell className="font-medium">{formatCurrency(net(r), symbol)}</TableCell>
                <TableCell><StatusBadge status={r.status || "unpaid"} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" loading={saving === key} onClick={() => save(r)}><Save className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => markPaid(r)}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => printSlip(r)}><Printer className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
