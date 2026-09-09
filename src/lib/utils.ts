import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, symbol = "$") {
  const n = Number(amount || 0);
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | null | undefined, fmt = "DD/MM/YYYY") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  if (fmt === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
  if (fmt === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function initials(first?: string, last?: string) {
  return `${(first || "?")[0] ?? ""}${(last || "")[0] ?? ""}`.toUpperCase();
}

export function classNamesForStatus(status: string) {
  const map: Record<string, string> = {
    active: "bg-success/10 text-success",
    inactive: "bg-muted text-muted-foreground",
    graduated: "bg-primary/10 text-primary",
    transferred: "bg-warning/10 text-warning",
    suspended: "bg-destructive/10 text-destructive",
    left: "bg-muted text-muted-foreground",
    paid: "bg-success/10 text-success",
    partial: "bg-warning/10 text-warning",
    unpaid: "bg-destructive/10 text-destructive",
    void: "bg-muted text-muted-foreground line-through",
    open: "bg-primary/10 text-primary",
    closed: "bg-muted text-muted-foreground",
    scheduled: "bg-primary/10 text-primary",
    ongoing: "bg-warning/10 text-warning",
    completed: "bg-success/10 text-success",
    published: "bg-success/10 text-success",
  };
  return map[status] || "bg-muted text-muted-foreground";
}
