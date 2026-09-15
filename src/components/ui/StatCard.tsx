import React from "react";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "green" | "gold" | "danger";
}

const toneClass = {
  default: "bg-white",
  green: "bg-brand-green-50",
  gold: "bg-brand-wheat-100",
  danger: "bg-red-50",
};

export function StatCard({ label, value, hint, icon, tone = "default" }: StatCardProps) {
  return (
    <div className={clsx("card flex items-start justify-between", toneClass[tone])}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-brand-navy-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
      </div>
      {icon && <div className="text-brand-green-600">{icon}</div>}
    </div>
  );
}
