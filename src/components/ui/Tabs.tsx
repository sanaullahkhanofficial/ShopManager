import React from "react";
import clsx from "clsx";

interface TabsProps {
  tabs: Array<{ id: string; label: string; icon?: React.ElementType }>;
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1 overflow-x-auto rounded-card border border-stone-200 bg-white p-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={clsx(
            "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition",
            active === id ? "bg-brand-green-600 text-white" : "text-stone-600 hover:bg-stone-100"
          )}
        >
          {Icon && <Icon size={13} />}
          {label}
        </button>
      ))}
    </div>
  );
}
