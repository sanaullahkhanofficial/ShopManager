import React from "react";
import { Languages } from "lucide-react";
import { useLang } from "../../lib/i18n";

// The only real, reachable way to switch the app's live language: every
// earlier phase built the LanguageProvider/useLang machinery (RTL flip,
// dictionary), but nothing anywhere ever called setLang() — the whole
// system was unreachable from the UI until this button existed.
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const next = lang === "en" ? "ur" : "en";
  return (
    <button
      onClick={() => setLang(next)}
      title={lang === "en" ? "اردو میں دیکھیں" : "Switch to English"}
      className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm hover:bg-stone-50"
    >
      <Languages size={14} />
      {lang === "en" ? "اردو" : "English"}
    </button>
  );
}
