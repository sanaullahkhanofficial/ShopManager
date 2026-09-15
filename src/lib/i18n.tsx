import React, { createContext, useContext, useMemo, useState } from "react";

// Bilingual dictionary for navigation and high-frequency UI labels (Section 42).
// This covers the primary chrome — full-app string translation and voice
// input are tracked as pending work in ROADMAP.md.
export type Lang = "en" | "ur";

const dict: Record<string, { en: string; ur: string }> = {
  dashboard: { en: "Dashboard", ur: "ڈیش بورڈ" },
  pos: { en: "POS (Sales)", ur: "فروخت" },
  purchases: { en: "Purchase", ur: "خریداری" },
  products: { en: "All Products", ur: "تمام مصنوعات" },
  stockAdjustment: { en: "Stock Adjustment", ur: "اسٹاک ایڈجسٹمنٹ" },
  stockTransfer: { en: "Stock Transfer", ur: "اسٹاک منتقلی" },
  categories: { en: "Categories", ur: "زمرہ جات" },
  customers: { en: "All Customers", ur: "تمام گاہک" },
  customerLedger: { en: "Customer Ledger", ur: "گاہک کھاتہ" },
  suppliers: { en: "Suppliers", ur: "سپلائر" },
  salesReturns: { en: "Sales Returns", ur: "فروخت کی واپسی" },
  purchaseReturns: { en: "Purchase Returns", ur: "خریداری کی واپسی" },
  cash: { en: "Cash Management", ur: "نقدی انتظام" },
  payments: { en: "Payments", ur: "ادائیگیاں" },
  expenses: { en: "Expenses", ur: "اخراجات" },
  reports: { en: "Reports", ur: "رپورٹس" },
  users: { en: "Users & Permissions", ur: "صارفین" },
  settings: { en: "Settings", ur: "ترتیبات" },
  backup: { en: "Backup & Health", ur: "بیک اپ" },
  aiAssistant: { en: "AI Assistant", ur: "AI اسسٹنٹ" },
  logout: { en: "Logout", ur: "لاگ آؤٹ" },
  customer: { en: "Customer", ur: "گاہک" },
  supplier: { en: "Supplier", ur: "سپلائر" },
  total: { en: "Total", ur: "کل" },
  paid: { en: "Paid", ur: "ادا شدہ" },
  balance: { en: "Balance", ur: "بقایا" },
  retail: { en: "Retail", ur: "خوردہ" },
  wholesale: { en: "Wholesale", ur: "تھوک" },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict) => string;
  dir: "ltr" | "rtl";
}

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("sm_lang") as Lang) || "en");
  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: (l) => { setLang(l); localStorage.setItem("sm_lang", l); },
    t: (key) => dict[key as string]?.[lang] ?? String(key),
    dir: lang === "ur" ? "rtl" : "ltr",
  }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
