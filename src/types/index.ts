// Shared types mirroring the SQLite schema in electron/main.cjs.
// Kept intentionally close to the DB row shape since the renderer talks to
// the local database directly over IPC (no serialization boundary to drift).

export interface Settings {
  business_name: string;
  business_title: string;
  business_type: string;
  address: string;
  phone: string;
  currency: string;
  primary_color: string;
  logo_path: string;
  invoice_footer: string;
  invoice_prefix: string;
  language: "en" | "ur" | "en-ur";
  low_stock_default: string;
  print_customer_copy: string;
  print_office_copy: string;
  auto_cut: string;
  setup_complete: string;
  [key: string]: string;
}

export type Role = "Owner" | "Manager" | "Accountant" | "Sales Staff" | "Purchase Staff" | "Inventory Staff" | "Cashier" | "Viewer";

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  status: "active" | "inactive";
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  name_urdu: string;
  image_path: string;
  status: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_name_urdu?: string;
  name: string;
  name_urdu: string;
  brand: string;
  package_size: number;
  package_unit: string;
  sku: string;
  barcode: string | null;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  stock: number;
  min_stock: number;
  avg_cost: number;
  image_path: string;
  status: string;
}

export type CustomerType = "Retail" | "Wholesale" | "Distributor";

export interface Customer {
  id: number;
  shop_name: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  area: string;
  customer_type: CustomerType;
  credit_limit: number;
  opening_balance: number;
  notes: string;
  balance: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  category: string;
  opening_balance: number;
  notes: string;
  balance: number;
}

export type PaymentMethod = "Cash" | "Bank Transfer" | "JazzCash" | "Easypaisa" | "Cheque" | "Credit" | "Partial";
export type SaleMode = "Retail" | "Wholesale";

export interface CartLine {
  product_id: number;
  name: string;
  name_urdu?: string;
  unit: string;
  quantity: number;
  rate: number;
  max?: number;
}

export interface Sale {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer_name?: string;
  mode: SaleMode;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: PaymentMethod;
  status: "COMPLETED" | "VOID";
  sale_date: string;
  created_at: string;
}

export interface Purchase {
  id: number;
  invoice_no: string;
  supplier_id: number | null;
  supplier_name?: string;
  subtotal: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: PaymentMethod;
  notes: string;
  purchase_date: string;
}

export interface Expense {
  id: number;
  expense_no: string;
  title: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  paid_by: string;
  note: string;
  expense_date: string;
}

export interface CashRegisterState {
  id: number;
  business_date: string;
  opening_cash: number;
  status: "OPEN" | "CLOSED";
  cashIn: number;
  cashOut: number;
  expected: number;
  transactions: CashTransaction[];
}

export interface CashTransaction {
  id: number;
  direction: "IN" | "OUT";
  category: string;
  amount: number;
  reference: string;
  note: string;
  created_at: string;
}

export interface DashboardData {
  sales: number;
  salesDeltaPct: number;
  purchases: number;
  expenses: number;
  profit: number;
  low: Array<{ name: string; name_urdu: string; stock: number; min_stock: number; package_unit: string }>;
  receivables: number;
  payables: number;
  stockValue: number;
  cashInHand: number | null;
  registerOpen: boolean;
  salesOnCredit: number;
  salesOnCreditCount: number;
}

export interface ReportSummary {
  sales: number;
  salesReturns: number;
  netSales: number;
  purchases: number;
  purchaseReturns: number;
  expenses: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  cashSales: number;
  creditSales: number;
  retailSales: number;
  wholesaleSales: number;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  entity: string | null;
  entity_id: number | null;
  severity: "info" | "warning" | "critical";
  is_read: number;
  created_at: string;
}

export interface Location {
  id: number;
  name: string;
  type: string;
  status: string;
}

export interface LocationStock {
  location_id: number;
  location_name: string;
  stock: number;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  package_unit: string;
  location_name: string | null;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number;
  reference: string;
  reason: string;
  created_at: string;
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
}
