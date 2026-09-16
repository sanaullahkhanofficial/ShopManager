// Section 39, Phase O: client-side reflection of the same role_permissions
// table electron/main.cjs's requirePermission() already enforces at the IPC
// boundary (Phase M). This hook fetches the signed-in user's real permission
// set once per login and exposes it so the UI can hide what the backend
// would reject, instead of showing a button that always fails. It never
// invents a restriction the backend doesn't also enforce — a page with no
// entry below is intentionally left visible to every role, exactly matching
// its real (ungated) backend behavior.
import { useEffect, useState } from "react";
import { api } from "./api";
import type { PageId } from "../components/layout/Sidebar";
import type { Role } from "../types";

export function usePermissionSet(role: Role | undefined): Set<string> | null {
  const [perms, setPerms] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!role) { setPerms(null); return; }
    let cancelled = false;
    api.permissionsForRole(role).then((rows) => {
      if (cancelled) return;
      setPerms(new Set(rows.filter((r) => r.allowed).map((r) => r.permission)));
    });
    return () => { cancelled = true; };
  }, [role]);
  return perms;
}

// One page can require any-of several permissions (e.g. Payments covers both
// customer and supplier payments); an empty/absent entry means "always
// visible" because no single permission in the Section 39 catalog gates it.
export const PAGE_PERMISSIONS: Partial<Record<PageId, string[]>> = {
  dashboard: ["dashboard.view"],
  pos: ["sales.create"],
  purchases: ["purchase.create"],
  products: ["inventory.view"],
  stockAdjustment: ["inventory.adjust"],
  stockTransfer: ["inventory.adjust"],
  customers: ["customers.view"],
  customerLedger: ["customers.view"],
  suppliers: ["suppliers.view"],
  supplierLedger: ["suppliers.view"],
  purchaseOrders: ["purchase.create"],
  salesReturns: ["sales.return"],
  purchaseReturns: ["purchase.return"],
  cash: ["cash.view"],
  payments: ["customers.payment", "suppliers.payment"],
  expenses: ["expenses.create"],
  reports: ["reports.view"],
  users: ["users.manage"],
  settings: ["settings.manage"],
};

export function canAccessPage(perms: Set<string> | null, page: PageId): boolean {
  const required = PAGE_PERMISSIONS[page];
  if (!required || required.length === 0) return true;
  if (!perms) return false; // permissions not loaded yet — fail closed, not open
  return required.some((p) => perms.has(p));
}
