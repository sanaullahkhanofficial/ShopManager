import React, { createContext, useContext, useMemo, useState } from "react";

// Bilingual dictionary for navigation, high-frequency UI labels, and (since
// Phase T) the full POS screen (Section 42). Full app-wide string
// translation beyond POS and the primary chrome, and voice input, are
// tracked as pending work in ROADMAP.md.
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
  suppliers: { en: "All Suppliers", ur: "تمام سپلائرز" },
  supplierLedger: { en: "Supplier Ledger", ur: "سپلائر کھاتہ" },
  purchaseOrders: { en: "Purchase Orders", ur: "خریداری آرڈرز" },
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

  // POS screen (Phase T)
  posSearchPlaceholder: { en: "Search or scan — English, اردو, SKU or barcode (Enter to scan-add)", ur: "تلاش کریں یا اسکین کریں — انگریزی، اردو، SKU یا بارکوڈ (انٹر دبائیں)" },
  gridView: { en: "Grid view", ur: "گرڈ ویو" },
  listView: { en: "List view", ur: "لسٹ ویو" },
  noProductsMatch: { en: "No products match", ur: "کوئی مصنوعات نہیں ملیں" },
  inStock: { en: "in stock", ur: "اسٹاک میں" },
  currentBill: { en: "Current Bill", ur: "موجودہ بل" },
  heldBillsTooltip: { en: "Held Bills (F3 to hold current)", ur: "رکی ہوئی بلیں (موجودہ روکنے کے لیے F3)" },
  recentBillsTooltip: { en: "Recent Bills (F4)", ur: "حالیہ بلیں (F4)" },
  cartEmpty: { en: "Cart is empty", ur: "ٹوکری خالی ہے" },
  walkInCustomer: { en: "Walk-in Customer", ur: "عام گاہک" },
  walkIn: { en: "Walk-in", ur: "عام گاہک" },
  paymentMethod: { en: "Payment Method", ur: "ادائیگی کا طریقہ" },
  discount: { en: "Discount", ur: "رعایت" },
  paidAmount: { en: "Paid Amount", ur: "ادا شدہ رقم" },
  exact: { en: "Exact", ur: "مکمل رقم" },
  subtotal: { en: "Subtotal", ur: "ذیلی مجموعہ" },
  grandTotal: { en: "Grand Total", ur: "کل رقم" },
  change: { en: "Change", ur: "واپسی" },
  remaining: { en: "Remaining", ur: "باقی" },
  hold: { en: "Hold", ur: "ہولڈ" },
  quote: { en: "Quote", ur: "کوٹیشن" },
  clear: { en: "Clear", ur: "صاف کریں" },
  saveAndPrint: { en: "Save & Print", ur: "محفوظ کریں اور پرنٹ کریں" },
  quotationsTitle: { en: "Quotations", ur: "کوٹیشنز" },
  heldBillsTitle: { en: "Held Bills", ur: "رکی ہوئی بلیں" },
  recentBillsTitle: { en: "Recent Bills", ur: "حالیہ بلیں" },
  nothingHereYet: { en: "Nothing here yet", ur: "ابھی کچھ نہیں" },
  noSalesYet: { en: "No sales yet", ur: "ابھی کوئی فروخت نہیں" },
  resume: { en: "Resume", ur: "دوبارہ شروع کریں" },
  reprint: { en: "Reprint", ur: "دوبارہ پرنٹ" },
  cashMethod: { en: "Cash", ur: "نقد" },
  bankTransferMethod: { en: "Bank Transfer", ur: "بینک ٹرانسفر" },
  chequeMethod: { en: "Cheque", ur: "چیک" },
  creditMethod: { en: "Credit", ur: "ادھار" },
  partialMethod: { en: "Partial", ur: "جزوی" },
  shortcutNew: { en: "New", ur: "نیا" },
  shortcutRecent: { en: "Recent", ur: "حالیہ" },
  shortcutSearch: { en: "Search", ur: "تلاش" },
  shortcutPrint: { en: "Print", ur: "پرنٹ" },
  shortcutComplete: { en: "Complete", ur: "مکمل کریں" },
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
