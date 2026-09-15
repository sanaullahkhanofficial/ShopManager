import React from "react";
import clsx from "clsx";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, WalletCards, ReceiptText,
  BarChart3, Settings, DatabaseBackup, Undo2, ClipboardList, Sparkles, MapPin,
} from "lucide-react";
import { useLang } from "../../lib/i18n";
import { Logo } from "./Logo";
import { WheatFieldBackdrop } from "./WheatFieldBackdrop";
import type { AuthUser } from "../../types";

export type PageId =
  | "dashboard" | "pos" | "purchases" | "products" | "customers" | "suppliers"
  | "salesReturns" | "purchaseReturns" | "cash" | "payments" | "expenses" | "reports"
  | "users" | "settings" | "backup" | "aiAssistant";

const nav: Array<{ id: PageId; icon: React.ElementType; badge?: string }> = [
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
  { id: "aiAssistant", icon: Sparkles, badge: "New" },
];

export const NAV_ICONS = Object.fromEntries(nav.map((n) => [n.id, n.icon])) as Record<PageId, React.ElementType>;

export function Sidebar({ page, setPage, user }: { page: PageId; setPage: (p: PageId) => void; user: AuthUser }) {
  const { t } = useLang();
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand-navy-800 bg-brand-navy-900 text-stone-200">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <Logo size={38} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">Haji Abdul Manan &amp; Abdul Hanan</p>
          <p className="truncate text-[11px] leading-tight text-brand-wheat-300">Atta Dealer Pishin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {nav.map(({ id, icon: Icon, badge }) => (
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
            {badge && (
              <span className="ml-auto rounded-full bg-brand-wheat-400 px-1.5 py-0.5 text-[10px] font-semibold text-brand-navy-900">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="relative mx-3 mb-2 h-16 overflow-hidden rounded-md">
        <WheatFieldBackdrop />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-brand-navy-900/80 via-transparent to-transparent p-2">
          <p className="font-script text-sm text-white drop-shadow">Good Farming, Brighter Tomorrow</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-white/10 px-4 py-2 text-[11px] text-stone-400">
        <MapPin size={12} /> Pishin, Balochistan, Pakistan
      </div>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-sm font-medium text-white">{user.display_name}</p>
        <p className="text-xs text-stone-400">{user.role}</p>
      </div>
    </aside>
  );
}
