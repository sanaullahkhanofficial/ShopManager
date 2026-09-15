import React, { useEffect, useState } from "react";
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
import { Sidebar, type PageId } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import type { AuthUser, DashboardData, Settings } from "./types";

const TITLES: Record<PageId, string> = {
  dashboard: "Dashboard", pos: "POS — Sales Counter", purchases: "Purchases", products: "Products & Inventory",
  customers: "Customers (Shops)", suppliers: "Suppliers", salesReturns: "Sales Returns", purchaseReturns: "Purchase Returns",
  cash: "Cash Management", payments: "Payments", expenses: "Expenses", reports: "Reports",
  users: "Users & Permissions", settings: "Settings", backup: "Backup & Health",
};

export default function App() {
  const { dir } = useLang();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [page, setPage] = useState<PageId>("dashboard");
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => { api.settingsGet().then((s) => setSettings(s as Settings)); }, []);
  useEffect(() => { document.documentElement.setAttribute("dir", dir); }, [dir]);
  useEffect(() => {
    if (!user) return;
    api.dashboard().then((d) => setRegisterOpen((d as DashboardData).registerOpen));
  }, [user, page]);

  if (!settings) return <div className="flex min-h-screen items-center justify-center text-stone-400">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="flex h-screen overflow-hidden bg-stone-100">
      <Sidebar page={page} setPage={setPage} user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={TITLES[page]} subtitle={settings.business_title} onLogout={() => setUser(null)} registerOpen={registerOpen} />
        <main className="flex-1 overflow-y-auto p-6">
          {page === "dashboard" && <Dashboard />}
          {page === "pos" && <POS user={user} settings={settings} />}
          {page === "purchases" && <Purchases user={user} />}
          {page === "products" && <Products user={user} />}
          {page === "customers" && <Customers user={user} />}
          {page === "suppliers" && <Suppliers />}
          {page === "salesReturns" && <SalesReturns user={user} />}
          {page === "purchaseReturns" && <PurchaseReturns user={user} />}
          {page === "cash" && <CashRegister user={user} />}
          {page === "payments" && <Payments user={user} />}
          {page === "expenses" && <Expenses user={user} />}
          {page === "reports" && <Reports />}
          {page === "users" && <Users user={user} />}
          {page === "settings" && <SettingsPage value={settings} onSaved={setSettings} />}
          {page === "backup" && <Backup />}
        </main>
      </div>
    </div>
  );
}
