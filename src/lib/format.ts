export function money(n: number | null | undefined): string {
  const v = Number(n || 0);
  return `Rs. ${v.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
