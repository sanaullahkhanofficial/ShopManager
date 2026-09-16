import React, { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { api } from "./lib/api";
import { useLang } from "./lib/i18n";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { POS } from "./pages/POS";
import { Purchases } from "./pages/Purchases";
import { Products } from "./pages/Products";
import { Customers } from "./pages/Customers";
import { Suppliers } from "./pages/Suppliers";
import { SalesReturns } from "./pages/SalesReturns";
import { PurchaseReturns } from "./pages/PurchaseReturns";
import { CashRegister } from "./pages/CashRegister";
import { Payments } from "./pages/Payments";
import { Expenses } from "./pages/Expenses";
import { Reports } from "./pages/Reports";
import { Users } from "./pages/Users";
import { SettingsPage } from "./pages/SettingsPage";
import { Backup } from "./pages/Backup";
import { AIAssistant } from "./pages/AIAssistant";
import { StockAdjustment } from "./pages/StockAdjustment";
import { StockTransfer } from "./pages/StockTransfer";
import { CustomerLedger } from "./pages/CustomerLedger";
import { SupplierLedger } from "./pages/SupplierLedger";
import { PurchaseOrders } from "./pages/PurchaseOrders";
import { Sidebar, NAV_ICONS, type PageId } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { Footer } from "./components/layout/Footer";
import { usePermissionSet, canAccessPage } from "./lib/permissions";
import type { AuthUser, Settings } from "./types";

const TITLES: Record<PageId, string> = {
  dashboard: "Dashboard", pos: "POS — Sales Counter", purchases: "Purchases", products: "Products & Inventory",
  customers: "Customers (Shops)", suppliers: "Suppliers", salesReturns: "Sales Returns", purchaseReturns: "Purchase Returns",
  cash: "Cash Management", payments: "Payments", expenses: "Expenses", reports: "Reports",
  users: "Users & Permissions", settings: "Settings", backup: "Backup & Health", aiAssistant: "AI Assistant",
  stockAdjustment: "Stock Adjustment", stockTransfer: "Stock Transfer", customerLedger: "Customer Ledger & Payments",
  supplierLedger: "Supplier Ledger & Payments", purchaseOrders: "Purchase Orders",
};

export default function App() {
  const { dir } = useLang();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [page, setPage] = useState<PageId>("dashboard");
  const [ledgerCustomerId, setLedgerCustomerId] = useState<number | null>(null);
  const [ledgerSupplierId, setLedgerSupplierId] = useState<number | null>(null);

  const perms = usePermissionSet(user?.role);

  useEffect(() => { api.settingsGet().then((s) => setSettings(s as Settings)); }, []);
  useEffect(() => { document.documentElement.setAttribute("dir", dir); }, [dir]);
  // Defensive route guard: if the signed-in role can't reach the current
  // page (e.g. a quick action tried to jump somewhere it shouldn't, or a
  // permission was revoked mid-session), fall back to Dashboard rather than
  // rendering a page whose backend actions would all fail anyway. Sidebar
  // nav already hides these entries — this only catches direct navigation.
  useEffect(() => {
    if (perms && page !== "dashboard" && !canAccessPage(perms, page)) setPage("dashboard");
  }, [perms, page]);

  if (!settings) return <div className="flex min-h-screen items-center justify-center text-stone-400">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  const PageIcon = NAV_ICONS[page];
  const blocked = perms !== null && !canAccessPage(perms, page);

  return (
    <div className="flex h-screen overflow-hidden bg-stone-100">
      <Sidebar page={page} setPage={setPage} user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} settings={settings} onLogout={() => setUser(null)} />
        <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-6 py-2.5">
          <PageIcon size={16} className="text-brand-green-700" />
          <h2 className="text-sm font-semibold text-brand-navy-900">{TITLES[page]}</h2>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {blocked ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-stone-400">
              <ShieldOff size={32} />
              <p className="text-sm font-medium text-stone-500">Access restricted</p>
              <p className="text-xs">Your role ({user.role}) doesn&apos;t have permission to view this page.</p>
            </div>
          ) : (
            <>
              {page === "dashboard" && <Dashboard onNavigate={setPage} user={user} />}
              {page === "pos" && <POS user={user} settings={settings} />}
              {page === "purchases" && <Purchases user={user} settings={settings} />}
              {page === "products" && <Products user={user} settings={settings} onNavigate={setPage} />}
              {page === "stockAdjustment" && <StockAdjustment user={user} settings={settings} />}
              {page === "stockTransfer" && <StockTransfer user={user} settings={settings} />}
              {page === "customers" && <Customers user={user} onNavigate={setPage} onOpenLedger={setLedgerCustomerId} />}
              {page === "customerLedger" && <CustomerLedger user={user} settings={settings} initialCustomerId={ledgerCustomerId} />}
              {page === "suppliers" && <Suppliers user={user} onNavigate={setPage} onOpenLedger={setLedgerSupplierId} />}
              {page === "supplierLedger" && <SupplierLedger user={user} settings={settings} initialSupplierId={ledgerSupplierId} onNavigate={setPage} />}
              {page === "purchaseOrders" && <PurchaseOrders user={user} />}
              {page === "salesReturns" && <SalesReturns user={user} />}
              {page === "purchaseReturns" && <PurchaseReturns user={user} />}
              {page === "cash" && <CashRegister user={user} />}
              {page === "payments" && <Payments user={user} />}
              {page === "expenses" && <Expenses user={user} />}
              {page === "reports" && <Reports user={user} />}
              {page === "users" && <Users user={user} />}
              {page === "settings" && <SettingsPage value={settings} onSaved={setSettings} user={user} />}
              {page === "backup" && <Backup />}
              {page === "aiAssistant" && <AIAssistant />}
            </>
          )}
        </main>
        <Footer settings={settings} />
      </div>
    </div>
  );
}
