import React from "react";
import type { Settings } from "../../types";

export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-navy-800 bg-brand-navy-900 px-4 py-1.5 text-[11px] text-stone-400">
      <span>{settings.business_title || "Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin"} · POS System</span>
      <span>Version 1.31.0 · Quality Products, Prosperous Balochistan</span>
    </footer>
  );
}
