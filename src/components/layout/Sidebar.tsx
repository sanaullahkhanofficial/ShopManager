import React from "react";
import clsx from "clsx";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, WalletCards, ReceiptText,
  BarChart3, Settings, DatabaseBackup, Undo2, ClipboardList, Wheat,
} from "lucide-react";
import { useLang } from "../../lib/i18n";
import type { AuthUser } from "../../types";

export type PageId =
  | "dashboard" | "pos" | "purchases" | "products" | "customers" | "suppliers"
  | "salesReturns" | "purchaseReturns" | "cash" | "payments" | "expenses" | "reports"
  | "users" | "settings" | "backup";

const nav: Array<{ id: PageId; icon: React.ElementType }> = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "pos", icon: ShoppingCart },
  { id: "purchases", icon: ReceiptText },
  { id: "products", icon: Package },
  { id: "customers", icon: Users },
  { id: "suppliers", icon: Truck },
  { id: "salesReturns", icon: Undo2 },
  { id: "purchaseReturns", icon: Undo2 },
  { id: "cash", icon: WalletCards },
  { id: "payments", icon: WalletCards },
  { id: "expenses", icon: ClipboardList },
  { id: "reports", icon: BarChart3 },
  { id: "users", icon: Users },
  { id: "settings", icon: Settings },
  { id: "backup", icon: DatabaseBackup },
];

export function Sidebar({ page, setPage, user }: { page: PageId; setPage: (p: PageId) => void; user: AuthUser }) {
  const { t } = useLang();
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand-navy-800 bg-brand-navy-900 text-stone-200">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-wheat-400 text-brand-navy-900">
          <Wheat size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">Haji Abdul Manan &amp; Abdul Hanan</p>
          <p className="truncate text-[11px] leading-tight text-brand-wheat-300">Atta Dealer Pishin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {nav.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition",
              page === id ? "bg-brand-green-600 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon size={16} />
            <span className="truncate">{t(id)}</span>
          </button>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-sm font-medium text-white">{user.display_name}</p>
        <p className="text-xs text-stone-400">{user.role}</p>
      </div>
    </aside>
  );
}
