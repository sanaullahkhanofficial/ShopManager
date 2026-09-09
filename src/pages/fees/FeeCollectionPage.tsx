import { useState } from "react";
import { Search, Printer, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";
import { receiptHtml } from "@/lib/feeDocs";

export function FeeCollectionPage() {
  const school = useSettingsStore((s) => s.school);
  const symbol = school?.currency_symbol || "$";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState<Record<number, string>>({});
  const [method, setMethod] = useState("cash");
  const [collecting, setCollecting] = useState<number | null>(null);

  async function search() {
    if (q.trim().length < 2) return;
    const res = await api.payments.search(q);
    setResults(res);
  }

  async function selectStudent(s: any) {
    setStudent(s);
    setResults([]);
    setQ("");
    const inv = await api.invoices.listForStudent(s.id);
    setInvoices(inv.filter((i: any) => i.status !== "void"));
  }

  async function collect(invoice: any) {
    const amount = Number(payAmount[invoice.id] || 0);
    if (!amount || amount <= 0) { toast.error("Enter a valid payment amount."); return; }
    setCollecting(invoice.id);
    try {
      const result = await api.payments.collect({ invoiceId: invoice.id, amount, method });
      toast.success(`Payment collected. Receipt ${result.receiptNo}`);
      const receipt = await api.payments.getReceipt(result.paymentId);
      const html = receiptHtml(school, receipt.payment, receipt.invoice, receipt.student);
      api.print.openWindow(html).catch(() => {});
      const inv = await api.invoices.listForStudent(student.id);
      setInvoices(inv.filter((i: any) => i.status !== "void"));
      setPayAmount((p) => ({ ...p, [invoice.id]: "" }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCollecting(null);
    }
  }

  return (
    <div>
      <PageHeader title="Fee Collection" description="Search a student and collect payment against outstanding vouchers." />

      <div className="relative mb-4 w-96">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or admission number…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {results.map((s) => (
              <button key={s.id} onClick={() => selectStudent(s)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent">
                <span>{s.first_name} {s.last_name} <span className="text-muted-foreground">({s.admission_no})</span></span>
                <span className="text-xs text-muted-foreground">{s.class_name} {s.section_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!student ? (
        <EmptyState icon={HandCoins} title="Search for a student to begin" description="Type a name or admission number above." />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{student.first_name} {student.last_name}</CardTitle>
              <p className="text-xs text-muted-foreground">{student.admission_no} · {student.class_name} {student.section_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className="text-lg font-semibold">{formatCurrency(student.outstanding_balance, symbol)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{["cash", "bank_transfer", "card", "other"].map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fee vouchers for this student yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Voucher</TableHead><TableHead>Period</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead>Collect</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.voucher_no}</TableCell>
                      <TableCell>{inv.period_label}</TableCell>
                      <TableCell>{formatCurrency(inv.total_amount, symbol)}</TableCell>
                      <TableCell>{formatCurrency(inv.paid_amount, symbol)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(inv.balance, symbol)}</TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                      <TableCell>
                        {inv.balance > 0 ? (
                          <div className="flex items-center gap-1">
                            <Input className="h-8 w-24" type="number" placeholder="Amount" value={payAmount[inv.id] || ""} onChange={(e) => setPayAmount((p) => ({ ...p, [inv.id]: e.target.value }))} />
                            <Button size="sm" loading={collecting === inv.id} onClick={() => collect(inv)}>Collect</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Fully paid</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
