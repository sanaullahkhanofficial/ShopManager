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
  stockByLocation: (productId: number) => invoke("stock:byLocation", productId),
  stockTransfer: (x: Record<string, unknown>) => invoke("stock:transfer", x),
  stockMovementsList: (filters?: Record<string, unknown>) => invoke("stockMovements:list", filters || {}),
  productsEnsureBarcodes: (actorId: number) => invoke<number>("products:ensureBarcodes", { actorId }),
  productsBulkUpdatePrices: (x: Record<string, unknown>) => invoke("products:bulkUpdatePrices", x),

  filesPickCsv: () => invoke<{ name: string; content: string } | null>("files:pickCsv"),
  filesSaveText: (x: { title?: string; defaultPath?: string; content: string; filters?: Array<{ name: string; extensions: string[] }> }) => invoke<string | null>("files:saveText", x),

  customersList: () => invoke("customers:list"),
  customersSave: (x: Record<string, unknown>) => invoke("customers:save", x),
  customersLedger: (id: number) => invoke("customers:ledger", id),
  customersAging: (id: number) => invoke("customers:aging", id),
  customersStats: (id: number) => invoke("customers:stats", id),
  customersRecentSales: (id: number) => invoke("customers:recentSales", id),
  customerGroupsList: () => invoke("customerGroups:list"),
  customerGroupsSave: (x: Record<string, unknown>) => invoke("customerGroups:save", x),

  suppliersList: () => invoke("suppliers:list"),
  suppliersSave: (x: Record<string, unknown>) => invoke("suppliers:save", x),
  suppliersLedger: (id: number) => invoke("suppliers:ledger", id),
  suppliersAging: (id: number) => invoke("suppliers:aging", id),
  suppliersStats: (id: number) => invoke("suppliers:stats", id),
  suppliersRecentPurchases: (id: number) => invoke("suppliers:recentPurchases", id),

  poList: () => invoke("po:list"),
  poGet: (id: number) => invoke("po:get", id),
  poCreate: (x: Record<string, unknown>) => invoke("po:create", x),
  poUpdateStatus: (x: Record<string, unknown>) => invoke("po:updateStatus", x),
  poReceive: (x: Record<string, unknown>) => invoke("po:receive", x),

  salesList: () => invoke("sales:list"),
  salesGet: (id: number) => invoke("sales:get", id),
  salesCreate: (x: Record<string, unknown>) => invoke("sales:create", x),
  salesVoid: (x: Record<string, unknown>) => invoke("sales:void", x),

  heldSalesList: (type?: "HOLD" | "QUOTATION") => invoke("heldSales:list", type),
  heldSalesCreate: (x: Record<string, unknown>) => invoke("heldSales:create", x),
  heldSalesGet: (id: number) => invoke("heldSales:get", id),
  heldSalesDelete: (id: number) => invoke("heldSales:delete", id),

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

  locationsList: () => invoke("locations:list"),
  locationsSave: (x: Record<string, unknown>) => invoke("locations:save", x),

  paymentMethodsList: () => invoke("paymentMethods:list"),
  paymentMethodsSave: (x: Record<string, unknown>) => invoke("paymentMethods:save", x),

  imagesPick: () => invoke<string | null>("images:pick"),

  notificationsList: (limit = 50) => invoke("notifications:list", limit),
  notificationsUnreadCount: () => invoke("notifications:unreadCount"),
  notificationsMarkRead: (id: number) => invoke("notifications:markRead", id),
  notificationsMarkAllRead: () => invoke("notifications:markAllRead"),
  notificationsRefresh: () => invoke("notifications:refresh"),

  appInfo: () => invoke("app:info"),
  backupCreate: () => invoke("backup:create"),
  backupAutoStatus: () => invoke("backup:autoStatus"),
  dbIntegrity: () => invoke("db:integrity"),
};
