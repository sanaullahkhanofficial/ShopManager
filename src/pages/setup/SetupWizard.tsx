import { useState } from "react";
import { GraduationCap, Check, ChevronRight, ChevronLeft, Building2, BookOpen, Wallet, UserCog, PartyPopper } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STEPS = [
  { key: "school", label: "School Information", icon: Building2 },
  { key: "academic", label: "Academic Configuration", icon: BookOpen },
  { key: "finance", label: "Financial Configuration", icon: Wallet },
  { key: "admin", label: "Administrator Account", icon: UserCog },
  { key: "finish", label: "Finish", icon: PartyPopper },
];

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [school, setSchool] = useState({ name: "", address: "", city: "", province: "", country: "", phone: "", email: "", website: "", principalName: "", motto: "" });
  const [academic, setAcademic] = useState({
    sessionName: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    startDate: `${new Date().getFullYear()}-08-01`,
    endDate: `${new Date().getFullYear() + 1}-06-30`,
    classesText: "Grade 1\nGrade 2\nGrade 3\nGrade 4\nGrade 5",
    subjectsText: "English\nMathematics\nScience\nSocial Studies\nComputer Studies",
  });
  const [finance, setFinance] = useState({ currency: "USD", currencySymbol: "$", admissionFee: "", monthlyFee: "", lateFeeAmount: "", feeCategoriesText: "Tuition Fee\nExamination Fee\nLibrary Fee" });
  const [admin, setAdmin] = useState({ displayName: "", username: "", password: "", confirmPassword: "" });
  const [loadDemo, setLoadDemo] = useState(true);

  function next() { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  async function finish() {
    setSubmitting(true);
    try {
      await api.setupComplete({
        school,
        academic: {
          sessionName: academic.sessionName,
          startDate: academic.startDate,
          endDate: academic.endDate,
          classes: academic.classesText.split("\n").map((s) => s.trim()).filter(Boolean),
          subjects: academic.subjectsText.split("\n").map((s) => s.trim()).filter(Boolean),
        },
        finance: {
          currency: finance.currency,
          currencySymbol: finance.currencySymbol,
          admissionFee: finance.admissionFee ? Number(finance.admissionFee) : 0,
          monthlyFee: finance.monthlyFee ? Number(finance.monthlyFee) : 0,
          lateFeeAmount: finance.lateFeeAmount ? Number(finance.lateFeeAmount) : 0,
          feeCategories: finance.feeCategoriesText.split("\n").map((s) => s.trim()).filter(Boolean),
        },
        admin,
        loadDemo,
      });
      toast.success("Setup complete! Welcome to EduManage.");
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function validateStep(): string | null {
    if (step === 0 && !school.name.trim()) return "School name is required.";
    if (step === 1 && (!academic.sessionName || !academic.startDate || !academic.endDate)) return "Session name and dates are required.";
    if (step === 3) {
      if (!admin.username.trim() || !admin.password) return "Username and password are required.";
      if (admin.password.length < 6) return "Password must be at least 6 characters.";
      if (admin.password !== admin.confirmPassword) return "Passwords do not match.";
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    next();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Welcome to EduManage</h1>
            <p className="text-sm text-muted-foreground">Let's set up your school in a few steps.</p>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-6 py-4">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="p-6">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="School Name" required value={school.name} onChange={(v) => setSchool({ ...school, name: v })} full />
              <Field label="Principal Name" value={school.principalName} onChange={(v) => setSchool({ ...school, principalName: v })} />
              <Field label="Motto" value={school.motto} onChange={(v) => setSchool({ ...school, motto: v })} />
              <Field label="Phone" value={school.phone} onChange={(v) => setSchool({ ...school, phone: v })} />
              <Field label="Email" value={school.email} onChange={(v) => setSchool({ ...school, email: v })} />
              <Field label="Website" value={school.website} onChange={(v) => setSchool({ ...school, website: v })} />
              <Field label="City" value={school.city} onChange={(v) => setSchool({ ...school, city: v })} />
              <Field label="Province/State" value={school.province} onChange={(v) => setSchool({ ...school, province: v })} />
              <Field label="Country" value={school.country} onChange={(v) => setSchool({ ...school, country: v })} />
              <Field label="Address" value={school.address} onChange={(v) => setSchool({ ...school, address: v })} full />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Academic Session/Year" required value={academic.sessionName} onChange={(v) => setAcademic({ ...academic, sessionName: v })} />
                <Field label="Start Date" type="date" value={academic.startDate} onChange={(v) => setAcademic({ ...academic, startDate: v })} />
                <Field label="End Date" type="date" value={academic.endDate} onChange={(v) => setAcademic({ ...academic, endDate: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Classes (one per line)</Label>
                  <Textarea rows={6} value={academic.classesText} onChange={(e) => setAcademic({ ...academic, classesText: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Subjects (one per line)</Label>
                  <Textarea rows={6} value={academic.subjectsText} onChange={(e) => setAcademic({ ...academic, subjectsText: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Currency Code" value={finance.currency} onChange={(v) => setFinance({ ...finance, currency: v })} />
                <Field label="Currency Symbol" value={finance.currencySymbol} onChange={(v) => setFinance({ ...finance, currencySymbol: v })} />
                <Field label="Admission Fee (per student)" type="number" value={finance.admissionFee} onChange={(v) => setFinance({ ...finance, admissionFee: v })} />
                <Field label="Default Monthly Tuition Fee" type="number" value={finance.monthlyFee} onChange={(v) => setFinance({ ...finance, monthlyFee: v })} />
                <Field label="Late Fee Amount" type="number" value={finance.lateFeeAmount} onChange={(v) => setFinance({ ...finance, lateFeeAmount: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fee Categories (one per line)</Label>
                <Textarea rows={4} value={finance.feeCategoriesText} onChange={(e) => setFinance({ ...finance, feeCategoriesText: e.target.value })} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" value={admin.displayName} onChange={(v) => setAdmin({ ...admin, displayName: v })} full />
              <Field label="Username" required value={admin.username} onChange={(v) => setAdmin({ ...admin, username: v })} />
              <div />
              <Field label="Password" required type="password" value={admin.password} onChange={(v) => setAdmin({ ...admin, password: v })} />
              <Field label="Confirm Password" required type="password" value={admin.confirmPassword} onChange={(v) => setAdmin({ ...admin, confirmPassword: v })} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              <PartyPopper className="mx-auto h-10 w-10 text-primary" />
              <p className="font-medium">Ready to finish setup for {school.name || "your school"}</p>
              <p className="text-sm text-muted-foreground">
                We'll create your academic session, fee structure and administrator account.
              </p>
              <label className="mx-auto flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={loadDemo} onChange={(e) => setLoadDemo(e.target.checked)} />
                Load sample demo data (Bright Future Public School — 100+ students, 15 teachers)
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border p-6">
          <Button variant="outline" onClick={back} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} loading={submitting}>
              Complete Setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, full,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; full?: boolean }) {
  return (
    <div className={cn("space-y-1.5", full && "col-span-2")}>
      <Label required={required}>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
