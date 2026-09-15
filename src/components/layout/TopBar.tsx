import React from "react";
import { Circle, Languages, LogOut } from "lucide-react";
import { useLang } from "../../lib/i18n";
import { Button } from "../ui/Button";

export function TopBar({ title, subtitle, onLogout, registerOpen }: {
  title: string; subtitle?: string; onLogout: () => void; registerOpen?: boolean;
}) {
  const { lang, setLang, t } = useLang();
  return (
    <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold text-brand-navy-900">{title}</h1>
        {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${registerOpen ? "bg-brand-green-50 text-brand-green-700" : "bg-stone-100 text-stone-500"}`}>
          <Circle size={8} className="fill-current" /> {registerOpen ? "Register Open" : "Register Closed"}
        </span>
        <button
          className="flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          onClick={() => setLang(lang === "en" ? "ur" : "en")}
          title="Toggle English / Urdu"
        >
          <Languages size={14} /> {lang === "en" ? "EN" : "اردو"}
        </button>
        <Button variant="ghost" onClick={onLogout}><LogOut size={15} /> {t("logout")}</Button>
      </div>
    </header>
  );
}
