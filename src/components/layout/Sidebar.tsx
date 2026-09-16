import React, { useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, WalletCards, ReceiptText,
  BarChart3, Settings, DatabaseBackup, Undo2, ClipboardList, Sparkles, MapPin,
  ChevronDown, SlidersHorizontal, ArrowLeftRight, BookText, ClipboardCheck,
} from "lucide-react";
import { useLang } from "../../lib/i18n";
import { usePermissionSet, canAccessPage } from "../../lib/permissions";
import { Logo } from "./Logo";
import { WheatFieldBackdrop } from "./WheatFieldBackdrop";
import type { AuthUser } from "../../types";

export type PageId =
  | "dashboard" | "pos" | "purchases" | "products" | "customers" | "suppliers"
  | "salesReturns" | "purchaseReturns" | "cash" | "payments" | "expenses" | "reports"
  | "users" | "settings" | "backup" | "aiAssistant"
  | "stockAdjustment" | "stockTransfer" | "customerLedger" | "supplierLedger" | "purchaseOrders";

interface NavItem { id: PageId; icon: React.ElementType; badge?: string }
interface NavGroup { group: true; id: string; label: string; icon: React.ElementType; children: NavItem[] }

// Flat items render as before; a "group" expands to reveal real sub-pages —
// a top-level entry only becomes a group once its sub-pages actually exist,
// so there's never a submenu item that leads nowhere.
const nav: Array<NavItem | NavGroup> = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "pos", icon: ShoppingCart },
  { id: "purchases", icon: ReceiptText },
  {
    group: true, id: "productsGroup", label: "Products / Inventory", icon: Package,
    children: [
      { id: "products", icon: Package },
      { id: "stockAdjustment", icon: SlidersHorizontal },
      { id: "stockTransfer", icon: ArrowLeftRight },
    ],
  },
  {
    group: true, id: "customersGroup", label: "Customers (Shops)", icon: Users,
    children: [
      { id: "customers", icon: Users },
      { id: "customerLedger", icon: BookText },
    ],
  },
  {
    group: true, id: "suppliersGroup", label: "Suppliers", icon: Truck,
    children: [
      { id: "suppliers", icon: Truck },
      { id: "supplierLedger", icon: BookText },
      { id: "purchaseOrders", icon: ClipboardCheck },
    ],
  },
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

function flatten(items: Array<NavItem | NavGroup>): NavItem[] {
  return items.flatMap((i) => ("group" in i ? i.children : [i]));
}
export const NAV_ICONS = Object.fromEntries(flatten(nav).map((n) => [n.id, n.icon])) as Record<PageId, React.ElementType>;

export function Sidebar({ page, setPage, user }: { page: PageId; setPage: (p: PageId) => void; user: AuthUser }) {
  const { t } = useLang();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const perms = usePermissionSet(user.role);

  // A page with no entry in PAGE_PERMISSIONS (backup, aiAssistant, …) stays
  // visible to every role — it mirrors real backend behavior, it doesn't
  // invent a client-only restriction the IPC layer wouldn't also enforce.
  const visibleNav = nav
    .map((entry) => {
      if (!("group" in entry)) return entry;
      const children = entry.children.filter((c) => canAccessPage(perms, c.id));
      return children.length ? { ...entry, children } : null;
    })
    .filter((entry): entry is NavItem | NavGroup => entry !== null && ("group" in entry || canAccessPage(perms, entry.id)));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand-navy-800 bg-brand-navy-900 text-stone-200">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <Logo size={38} />
        <div className="min-w-0">
          {/* dir="ltr": this is a fixed Roman-script business name, not translated
              content — without it, text-overflow: ellipsis truncates from the
              wrong end (the start of the name) when the page direction is RTL. */}
          <p dir="ltr" className="truncate text-left text-sm font-semibold leading-tight text-white">Haji Abdul Manan &amp; Abdul Hanan</p>
          <p dir="ltr" className="truncate text-left text-[11px] leading-tight text-brand-wheat-300">Atta Dealer Pishin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {visibleNav.map((entry) => {
          if ("group" in entry) {
            const childActive = entry.children.some((c) => c.id === page);
            const expanded = openGroups[entry.id] ?? childActive;
            const GroupIcon = entry.icon;
            return (
              <div key={entry.id}>
                <button
                  onClick={() => { setPage(entry.children[0].id); setOpenGroups((g) => ({ ...g, [entry.id]: true })); }}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition",
                    childActive ? "bg-brand-green-600 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <GroupIcon size={16} />
                  <span className="truncate">{entry.label}</span>
                  <ChevronDown
                    size={14}
                    className={clsx("ml-auto shrink-0 transition-transform", expanded && "rotate-180")}
                    onClick={(e) => { e.stopPropagation(); setOpenGroups((g) => ({ ...g, [entry.id]: !expanded })); }}
                  />
                </button>
                {expanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {entry.children.map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setPage(id)}
                        className={clsx(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-medium transition",
                          page === id ? "bg-brand-green-600/80 text-white" : "text-stone-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon size={14} />
                        <span className="truncate">{t(id)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          const { id, icon: Icon, badge } = entry;
          return (
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
          );
        })}
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
