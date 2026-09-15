// Typed wrapper around the IPC bridge exposed by electron/preload.cjs.
// Every call goes straight to the local SQLite database over
// window.api.invoke(channel, ...args) — see electron/main.cjs for handlers.

declare global {
  interface Window {
    api: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> };
  }
}

export function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return window.api.invoke(channel, ...args) as Promise<T>;
}

export const api = {
  settingsGet: () => invoke("settings:get"),
  settingsUpdate: (o: Record<string, unknown>) => invoke("settings:update", o),

  login: (username: string, password: string) => invoke("auth:login", { username, password }),

  usersList: () => invoke("users:list"),
  usersAdd: (x: Record<string, unknown>) => invoke("users:add", x),

  categoriesList: () => invoke("categories:list"),
  categoriesSave: (x: Record<string, unknown>) => invoke("categories:save", x),

  productsList: () => invoke("products:list"),
  productsSave: (x: Record<string, unknown>) => invoke("products:save", x),
  productsAdjust: (x: Record<string, unknown>) => invoke("products:adjust", x),

  customersList: () => invoke("customers:list"),
  customersSave: (x: Record<string, unknown>) => invoke("customers:save", x),
  customersLedger: (id: number) => invoke("customers:ledger", id),

  suppliersList: () => invoke("suppliers:list"),
  suppliersSave: (x: Record<string, unknown>) => invoke("suppliers:save", x),
  suppliersLedger: (id: number) => invoke("suppliers:ledger", id),

  salesList: () => invoke("sales:list"),
  salesGet: (id: number) => invoke("sales:get", id),
  salesCreate: (x: Record<string, unknown>) => invoke("sales:create", x),
  salesVoid: (x: Record<string, unknown>) => invoke("sales:void", x),

  salesReturnsCreate: (x: Record<string, unknown>) => invoke("salesReturns:create", x),
  purchaseReturnsCreate: (x: Record<string, unknown>) => invoke("purchaseReturns:create", x),

  purchasesList: () => invoke("purchases:list"),
  purchasesGet: (id: number) => invoke("purchases:get", id),
  purchasesCreate: (x: Record<string, unknown>) => invoke("purchases:create", x),

  paymentsAdd: (x: Record<string, unknown>) => invoke("payments:add", x),

  expensesList: () => invoke("expenses:list"),
  expensesAdd: (x: Record<string, unknown>) => invoke("expenses:add", x),

  cashCurrent: () => invoke("cash:current"),
  cashOpen: (x: Record<string, unknown>) => invoke("cash:open", x),
  cashTransaction: (x: Record<string, unknown>) => invoke("cash:transaction", x),
  cashClose: (x: Record<string, unknown>) => invoke("cash:close", x),

  dashboard: () => invoke("dashboard"),
  reportsSummary: (range: { from: string; to: string }) => invoke("reports:summary", range),
  auditList: (limit = 200) => invoke("audit:list", limit),

  appInfo: () => invoke("app:info"),
  backupCreate: () => invoke("backup:create"),
  dbIntegrity: () => invoke("db:integrity"),
};
