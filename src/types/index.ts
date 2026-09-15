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
  cnic: string;
  group_id: number | null;
  group_name?: string;
  credit_limit: number;
  opening_balance: number;
  notes: string;
  balance: number;
  status: string;
  created_at: string;
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
  ntn: string;
  payment_term_days: number;
  products_supplied: string;
  opening_balance: number;
  notes: string;
  balance: number;
  status: string;
  created_at: string;
}

export type PoStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrder {
  id: number;
  po_no: string;
  supplier_id: number;
  supplier_name?: string;
  location_id: number;
  status: PoStatus;
  expected_date: string | null;
  notes: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: number;
  po_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  rate: number;
  received_quantity: number;
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

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  name_urdu?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  cost: number;
  returned_quantity: number;
}

export interface Purchase {
  id: number;
  invoice_no: string;
  supplier_id: number | null;
  supplier_name?: string;
  supplier_phone?: string;
  po_id: number | null;
  po_no?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: PaymentMethod;
  notes: string;
  purchase_date: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name?: string;
  name_urdu?: string;
  package_unit?: string;
  quantity: number;
  rate: number;
  amount: number;
  returned_quantity: number;
}

export interface Expense {
  id: number;
  expense_no: string;
  title: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  paid_by: string;
  receipt_path: string;
  note: string;
  expense_date: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  status: string;
  sort_order: number;
}

export type RecurringFrequency = "MONTHLY" | "WEEKLY" | "YEARLY";

export interface RecurringExpense {
  id: number;
  title: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  frequency: RecurringFrequency;
  day_of_month: number;
  next_run_date: string;
  status: string;
  created_at: string;
}

export interface Budget {
  category: string;
  period_month: string;
  amount: number;
}

export interface BudgetSummaryRow {
  category: string;
  budget: number;
  spent: number;
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
  trend: Array<{ date: string; total: number }>;
  paymentBreakdown: Array<{ payment_method: string; v: number }>;
  mix: { retailSales: number; wholesaleSales: number; cashSales: number; creditSales: number };
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

export interface ReportCompare {
  current: ReportSummary;
  previous: ReportSummary;
  deltaPct: { sales: number; netProfit: number; expenses: number; grossProfit: number };
}

export interface ReportTrend {
  granularity: "day" | "month";
  points: Array<{ label: string; total: number }>;
}

export interface TopProductRow {
  id: number;
  name: string;
  name_urdu: string;
  package_unit: string;
  qty: number;
  revenue: number;
}

export interface InventoryReport {
  products: Array<{ id: number; name: string; name_urdu: string; category_name: string | null; stock: number; avg_cost: number; min_stock: number; package_unit: string; value: number }>;
  totalValue: number;
  totalProducts: number;
  lowCount: number;
  outCount: number;
  fastMoving: Array<{ id: number; name: string; name_urdu: string; package_unit: string; qty: number }>;
  slowMoving: Array<{ id: number; name: string; name_urdu: string; package_unit: string; stock: number }>;
}

export interface CustomerReportRow {
  id: number;
  name: string;
  customer_type: CustomerType;
  balance: number;
  totalPurchases: number;
  totalPayments: number;
  lastPurchaseDate: string | null;
}

export interface SupplierReportRow {
  id: number;
  name: string;
  category: string;
  balance: number;
  totalPurchases: number;
  totalPayments: number;
  lastPurchaseDate: string | null;
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

export interface Aging {
  current: number;
  d31_60: number;
  d61_90: number;
  over90: number;
}

export interface SupplierStats {
  totalPurchases: number;
  totalInvoices: number;
  lastPurchaseDate: string | null;
  totalPayments: number;
}

export interface CustomerStats {
  totalPurchases: number;
  totalInvoices: number;
  lastPurchaseDate: string | null;
  totalPayments: number;
}

export interface CustomerGroup {
  id: number;
  name: string;
}

export interface LedgerEntry {
  id: number;
  type: string;
  direction: number;
  amount: number;
  reference: string;
  note: string;
  payment_method?: string;
  created_at: string;
}

export interface BankAccount {
  id: number;
  name: string;
  account_number: string;
  bank_name: string;
  opening_balance: number;
  balance: number;
  status: string;
  created_at: string;
}

export interface BankTransaction {
  id: number;
  account_id: number;
  direction: "IN" | "OUT";
  category: string;
  amount: number;
  reference: string;
  note: string;
  created_at: string;
}

export interface PettyCashEntry {
  id: number;
  direction: "IN" | "OUT";
  amount: number;
  reference: string;
  note: string;
  created_at: string;
}

export type ReturnType = "Refund" | "Exchange";

export interface SalesReturn {
  id: number;
  return_no: string;
  sale_id: number;
  original_invoice: string;
  customer_id: number | null;
  customer_name?: string;
  return_type: ReturnType;
  total: number;
  reason: string;
  refund_cash: number;
  created_at: string;
}

export interface PurchaseReturn {
  id: number;
  return_no: string;
  purchase_id: number;
  original_invoice: string;
  supplier_id: number | null;
  supplier_name?: string;
  total: number;
  reason: string;
  credit_note_no: string;
  created_at: string;
}

export interface HeldSale {
  id: number;
  hold_no: string;
  type: "HOLD" | "QUOTATION";
  customer_id: number | null;
  customer_name?: string;
  mode: SaleMode;
  discount: number;
  notes: string;
  items: CartLine[];
  created_at: string;
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
}
