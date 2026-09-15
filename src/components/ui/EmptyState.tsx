import React from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ label = "No records found" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-stone-300 bg-stone-50 py-10 text-stone-400">
      <Inbox size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
