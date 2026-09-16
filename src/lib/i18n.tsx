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

  // Dashboard (Phase V)
  dashboardGreeting: { en: "Good day!", ur: "خوش آمدید!" },
  dashboardSubtitle: { en: "Here's what's happening in your business today.", ur: "آج آپ کے کاروبار میں یہ ہو رہا ہے۔" },
  quickActions: { en: "Quick Actions", ur: "فوری اقدامات" },
  qaNewSale: { en: "New Sale (POS)", ur: "نئی فروخت" },
  qaNewPurchase: { en: "New Purchase", ur: "نئی خریداری" },
  qaAddProduct: { en: "Add Product", ur: "پروڈکٹ شامل کریں" },
  qaAddCustomer: { en: "Add Customer", ur: "گاہک شامل کریں" },
  qaAddSupplier: { en: "Add Supplier", ur: "سپلائر شامل کریں" },
  qaExpense: { en: "Expense", ur: "خرچہ" },
  todaysPerformance: { en: "Today's Performance", ur: "آج کی کارکردگی" },
  todaysSales: { en: "Today's Sales", ur: "آج کی فروخت" },
  salesOnCredit: { en: "Sales on Credit", ur: "ادھار فروخت" },
  invoicesSuffix: { en: "invoices", ur: "انوائسز" },
  todaysPurchases: { en: "Today's Purchases", ur: "آج کی خریداری" },
  todaysProfit: { en: "Today's Profit", ur: "آج کا منافع" },
  businessPosition: { en: "Business Position", ur: "کاروباری پوزیشن" },
  cashInHand: { en: "Cash in Hand", ur: "دستیاب نقدی" },
  registerClosed: { en: "Register closed", ur: "رجسٹر بند ہے" },
  receivables: { en: "Receivables", ur: "وصولیاں" },
  payables: { en: "Payables", ur: "قابل ادائیگی" },
  stockValue: { en: "Stock Value", ur: "اسٹاک کی مالیت" },
  salesTrend7: { en: "Sales Trend — Last 7 Days", ur: "فروخت کا رجحان — پچھلے 7 دن" },
  paymentMethodsToday: { en: "Payment Methods — Today", ur: "ادائیگی کے طریقے — آج" },
  allViaPrefix: { en: "all via", ur: "سب بذریعہ" },
  todaySuffix: { en: "today", ur: "آج" },
  noSalesToday: { en: "No sales recorded yet today", ur: "آج ابھی تک کوئی فروخت درج نہیں ہوئی" },
  cashSummary: { en: "Cash Summary", ur: "نقدی کا خلاصہ" },
  cashRegister: { en: "Cash Register", ur: "کیش رجسٹر" },
  openStatus: { en: "OPEN", ur: "کھلا" },
  closedStatus: { en: "CLOSED", ur: "بند" },
  bankBalance: { en: "Bank Balance", ur: "بینک بیلنس" },
  pettyCash: { en: "Petty Cash", ur: "پیٹی کیش" },
  todaysMix: { en: "Today's Mix", ur: "آج کا تناسب" },
  lowStock: { en: "Low Stock", ur: "کم اسٹاک" },
  productCol: { en: "Product", ur: "پروڈکٹ" },
  stockCol: { en: "Stock", ur: "اسٹاک" },
  minimumCol: { en: "Minimum", ur: "کم از کم" },
  allAboveMinStock: { en: "All products are above minimum stock", ur: "تمام مصنوعات کم از کم اسٹاک سے زیادہ ہیں" },
  recentBills: { en: "Recent Bills", ur: "حالیہ بلیں" },
  invoiceCol: { en: "Invoice", ur: "انوائس" },
  timeCol: { en: "Time", ur: "وقت" },
  loading: { en: "Loading…", ur: "لوڈ ہو رہا ہے…" },

  // Cash Management (Phase W)
  tabRegister: { en: "Register", ur: "رجسٹر" },
  tabBankAccounts: { en: "Bank Accounts", ur: "بینک اکاؤنٹس" },
  tabTransfer: { en: "Transfer", ur: "منتقلی" },
  openCashRegisterTitle: { en: "Open Cash Register", ur: "کیش رجسٹر کھولیں" },
  openingCash: { en: "Opening Cash", ur: "ابتدائی نقدی" },
  openRegisterBtn: { en: "Open Register", ur: "رجسٹر کھولیں" },
  cashInLabel: { en: "Cash In", ur: "نقدی آمد" },
  cashOutLabel: { en: "Cash Out", ur: "نقدی اخراج" },
  expectedClosing: { en: "Expected Closing", ur: "متوقع اختتامی رقم" },
  todaysCashMovements: { en: "Today's Cash Movements", ur: "آج کی نقدی کی نقل و حرکت" },
  directionCol: { en: "Direction", ur: "سمت" },
  categoryCol: { en: "Category", ur: "زمرہ" },
  referenceCol: { en: "Reference", ur: "حوالہ" },
  noteCol: { en: "Note", ur: "نوٹ" },
  amountCol: { en: "Amount", ur: "رقم" },
  cashWithdrawal: { en: "Cash Withdrawal", ur: "نقدی نکالنا" },
  reasonLabel: { en: "Reason", ur: "وجہ" },
  recordWithdrawal: { en: "Record Withdrawal", ur: "نکالنا درج کریں" },
  denominationCount: { en: "Denomination Count", ur: "نوٹوں کی گنتی" },
  actualCash: { en: "Actual Cash", ur: "اصل نقدی" },
  closeDay: { en: "Close Day", ur: "دن بند کریں" },
  closingNotes: { en: "Closing Notes", ur: "اختتامی نوٹس" },
  closeRegisterBtn: { en: "Close Register", ur: "رجسٹر بند کریں" },
  matchedStatus: { en: "MATCHED", ur: "برابر" },
  cashOverStatus: { en: "CASH OVER", ur: "نقدی زائد" },
  cashShortStatus: { en: "CASH SHORT", ur: "نقدی کم" },
  expectedPrefix: { en: "Expected:", ur: "متوقع:" },
  actualPrefix: { en: "Actual:", ur: "اصل:" },
  differencePrefix: { en: "Difference:", ur: "فرق:" },
  addAccount: { en: "Add Account", ur: "اکاؤنٹ شامل کریں" },
  cancelBtn: { en: "Cancel", ur: "منسوخ کریں" },
  accountName: { en: "Account Name", ur: "اکاؤنٹ کا نام" },
  bankName: { en: "Bank Name", ur: "بینک کا نام" },
  accountNumber: { en: "Account Number", ur: "اکاؤنٹ نمبر" },
  openingBalance: { en: "Opening Balance", ur: "ابتدائی بیلنس" },
  saveAccount: { en: "Save Account", ur: "اکاؤنٹ محفوظ کریں" },
  nameCol: { en: "Name", ur: "نام" },
  bankCol: { en: "Bank", ur: "بینک" },
  accountNumCol: { en: "Account #", ur: "اکاؤنٹ نمبر" },
  selectAnAccount: { en: "Select an account", ur: "ایک اکاؤنٹ منتخب کریں" },
  currentBalance: { en: "Current Balance", ur: "موجودہ بیلنس" },
  noTransactionsYet: { en: "No transactions yet", ur: "ابھی تک کوئی لین دین نہیں" },
  clickBankAccountHint: { en: "Click a bank account to view its transactions", ur: "لین دین دیکھنے کے لیے بینک اکاؤنٹ پر کلک کریں" },
  pettyCashBalance: { en: "Petty Cash Balance", ur: "پیٹی کیش بیلنس" },
  pettyCashHint: { en: "Fund or draw down petty cash from the Transfer tab.", ur: "منتقلی ٹیب سے پیٹی کیش میں رقم شامل یا نکالیں۔" },
  pettyCashHistory: { en: "Petty Cash History", ur: "پیٹی کیش کی تاریخ" },
  dateCol: { en: "Date", ur: "تاریخ" },
  cashTransferTitle: { en: "Cash Transfer", ur: "نقدی کی منتقلی" },
  cashTransferHint: {
    en: "Move money between the cash register, a bank account, and petty cash — each transfer posts two linked, correctly-signed entries.",
    ur: "کیش رجسٹر، بینک اکاؤنٹ اور پیٹی کیش کے درمیان رقم منتقل کریں — ہر منتقلی دو جڑی ہوئی، درست اندراجات درج کرتی ہے۔",
  },
  fromLabel: { en: "From", ur: "سے" },
  toLabel: { en: "To", ur: "تک" },
  bankPrefix: { en: "Bank", ur: "بینک" },
  recordTransfer: { en: "Record Transfer", ur: "منتقلی درج کریں" },
  transferReasonPlaceholder: { en: "Reason for transfer (optional)", ur: "منتقلی کی وجہ (اختیاری)" },
  dirIn: { en: "IN", ur: "آمد" },
  dirOut: { en: "OUT", ur: "اخراج" },
};

// JazzCash/Easypaisa are brand names and stay untranslated everywhere; the
// rest map to real dictionary entries. Shared by every page that displays a
// payment method (POS, Dashboard, …) so there's one real mapping, not a
// separately maintained copy per page.
const PAYMENT_METHOD_KEYS: Record<string, keyof typeof dict> = {
  Cash: "cashMethod", "Bank Transfer": "bankTransferMethod", Cheque: "chequeMethod", Credit: "creditMethod", Partial: "partialMethod",
};
export function paymentMethodLabel(method: string, t: (key: keyof typeof dict) => string): string {
  const key = PAYMENT_METHOD_KEYS[method];
  return key ? t(key) : method;
}

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
