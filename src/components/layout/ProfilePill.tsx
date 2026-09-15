import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import type { AuthUser } from "../../types";

export function ProfilePill({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1.5 pr-2.5 shadow-sm hover:bg-stone-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-green-700 text-white">
          <User size={14} />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-xs font-semibold text-stone-800">{user.display_name}</span>
          <span className="block text-[11px] text-stone-400">{user.role}</span>
        </span>
        <ChevronDown size={14} className="text-stone-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-card border border-stone-200 bg-white shadow-xl">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
