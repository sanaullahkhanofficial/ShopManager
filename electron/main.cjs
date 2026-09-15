const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const Database = require("better-sqlite3");

// ---------------------------------------------------------------------------
// Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin
// Offline-first SQLite backend: real transaction-based accounting.
// Every financial action (sale, purchase, payment, expense, withdrawal) is a
// single atomic db.transaction() that updates inventory, ledgers and the cash
// register together, or not at all.
//
// Phase 0 additions on top of the v1 foundation: per-location stock, real
// Purchase Orders (draft -> sent -> received -> converts to a Purchase),
// configurable payment methods, tax settings, a notifications table, a
// role/permission matrix (data layer — enforcement UI is a later phase),
// bank accounts + petty cash sub-ledgers with cash transfers between them,
// recurring expenses + budgets, customer groups, CNIC/NTN fields, an
// optional batch/lot reference on returns, FIFO aging for customer/supplier
// ledgers, and period-over-period comparison for reports.
// ---------------------------------------------------------------------------

let db, win, dataDir;
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(pw ?? ""), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  try {
    if (typeof stored !== "string" || !stored.includes(":")) return false;
    const [salt, hash] = stored.split(":");
    const expected = Buffer.from(hash, "hex");
    const actual = crypto.scryptSync(String(pw ?? ""), salt, 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// Section 39 permission list. Data layer only in Phase 0 — IPC-boundary
// enforcement + the matrix editor UI land in Phase M.
const PERMISSIONS = [
  "dashboard.view", "sales.create", "sales.edit", "sales.delete", "sales.return",
  "purchase.create", "purchase.edit", "purchase.delete", "purchase.return",
  "inventory.view", "inventory.adjust", "customers.view", "customers.create", "customers.payment",
  "suppliers.view", "suppliers.create", "suppliers.payment", "cash.view", "cash.manage",
  "expenses.create", "reports.view", "reports.export", "users.manage", "settings.manage", "printer.manage",
];
const DEFAULT_ROLE_PERMISSIONS = {
  Owner: PERMISSIONS,
  Manager: PERMISSIONS.filter((p) => p !== "users.manage" && p !== "settings.manage"),
  Accountant: ["dashboard.view", "cash.view", "cash.manage", "customers.view", "customers.payment", "suppliers.view", "suppliers.payment", "expenses.create", "reports.view", "reports.export", "inventory.view"],
  "Sales Staff": ["dashboard.view", "sales.create", "sales.edit", "sales.return", "customers.view", "customers.create", "inventory.view", "reports.view"],
  "Purchase Staff": ["dashboard.view", "purchase.create", "purchase.edit", "purchase.return", "suppliers.view", "suppliers.create", "inventory.view", "inventory.adjust", "reports.view"],
  "Inventory Staff": ["dashboard.view", "inventory.view", "inventory.adjust", "reports.view"],
  Cashier: ["dashboard.view", "sales.create", "cash.view", "customers.view"],
  Viewer: ["dashboard.view", "inventory.view", "customers.view", "suppliers.view", "cash.view", "reports.view"],
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
function initDb() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "shopmanager.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  dataDir = path.join(dir, "images");
  fs.mkdirSync(dataDir, { recursive: true });

  db.exec(`
  CREATE TABLE IF NOT EXISTS schema_meta(version INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locations(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'Store',
    status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, name_urdu TEXT DEFAULT '',
    image_path TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, name TEXT NOT NULL, name_urdu TEXT DEFAULT '',
    brand TEXT, package_size REAL DEFAULT 0, package_unit TEXT DEFAULT 'KG', sku TEXT UNIQUE, barcode TEXT,
    purchase_price REAL DEFAULT 0, retail_price REAL DEFAULT 0, wholesale_price REAL DEFAULT 0,
    stock REAL DEFAULT 0, min_stock REAL DEFAULT 0, avg_cost REAL DEFAULT 0,
    image_path TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  -- Per-location stock detail. products.stock stays the authoritative cached
  -- TOTAL across all locations so every existing total-stock query keeps
  -- working unchanged; this table only adds the per-location breakdown.
  CREATE TABLE IF NOT EXISTS product_location_stock(
    product_id INTEGER NOT NULL, location_id INTEGER NOT NULL, stock REAL NOT NULL DEFAULT 0,
    PRIMARY KEY(product_id, location_id),
    FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(location_id) REFERENCES locations(id)
  );

  CREATE TABLE IF NOT EXISTS customer_groups(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers(
    id INTEGER PRIMARY KEY AUTOINCREMENT, shop_name TEXT, name TEXT NOT NULL, phone TEXT, whatsapp TEXT,
    address TEXT, city TEXT, area TEXT, customer_type TEXT DEFAULT 'Retail', cnic TEXT, group_id INTEGER,
    credit_limit REAL DEFAULT 0, opening_balance REAL DEFAULT 0, notes TEXT,
    status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact_person TEXT, phone TEXT, whatsapp TEXT,
    address TEXT, city TEXT, category TEXT, ntn TEXT, payment_term_days INTEGER DEFAULT 0, products_supplied TEXT,
    opening_balance REAL DEFAULT 0, notes TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_counters(prefix TEXT NOT NULL, date_key TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY(prefix, date_key));

  CREATE TABLE IF NOT EXISTS po_orders(
    id INTEGER PRIMARY KEY AUTOINCREMENT, po_no TEXT UNIQUE NOT NULL, supplier_id INTEGER, location_id INTEGER,
    status TEXT DEFAULT 'DRAFT', expected_date TEXT, notes TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
  );
  CREATE TABLE IF NOT EXISTS po_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, po_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, rate REAL NOT NULL, received_quantity REAL DEFAULT 0,
    FOREIGN KEY(po_id) REFERENCES po_orders(id), FOREIGN KEY(product_id) REFERENCES products(id)
  );

  -- Held bills and quotations (Section 16/POS design): a cart snapshot that
  -- hasn't touched stock, ledgers or cash yet — only Resume -> Complete Sale
  -- runs the real sale transaction. items_json is a JSON array of
  -- {product_id,name,name_urdu,unit,quantity,rate} snapshots.
  CREATE TABLE IF NOT EXISTS held_sales(
    id INTEGER PRIMARY KEY AUTOINCREMENT, hold_no TEXT UNIQUE NOT NULL, type TEXT DEFAULT 'HOLD',
    customer_id INTEGER, mode TEXT DEFAULT 'Retail', discount REAL DEFAULT 0, notes TEXT,
    items_json TEXT NOT NULL, user_id INTEGER, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales(
    id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no TEXT UNIQUE NOT NULL, customer_id INTEGER, mode TEXT DEFAULT 'Retail',
    subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL, paid REAL DEFAULT 0, balance REAL DEFAULT 0, location_id INTEGER,
    payment_method TEXT DEFAULT 'Cash', cashier_id INTEGER, status TEXT DEFAULT 'COMPLETED', sale_date TEXT NOT NULL, created_at TEXT NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
  CREATE TABLE IF NOT EXISTS sale_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, unit TEXT DEFAULT '', rate REAL NOT NULL, amount REAL NOT NULL, cost REAL DEFAULT 0,
    returned_quantity REAL DEFAULT 0,
    FOREIGN KEY(sale_id) REFERENCES sales(id), FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS sales_returns(
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_no TEXT UNIQUE NOT NULL, sale_id INTEGER NOT NULL, customer_id INTEGER,
    return_type TEXT DEFAULT 'Refund', total REAL NOT NULL, reason TEXT, refund_cash REAL DEFAULT 0, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id)
  );
  CREATE TABLE IF NOT EXISTS sales_return_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, sale_item_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL, batch_ref TEXT,
    FOREIGN KEY(return_id) REFERENCES sales_returns(id)
  );

  CREATE TABLE IF NOT EXISTS purchases(
    id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no TEXT UNIQUE NOT NULL, supplier_id INTEGER, po_id INTEGER, location_id INTEGER,
    subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
    paid REAL DEFAULT 0, balance REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash', notes TEXT, status TEXT DEFAULT 'COMPLETED',
    purchase_date TEXT NOT NULL, created_at TEXT NOT NULL, user_id INTEGER,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
  );
  CREATE TABLE IF NOT EXISTS purchase_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL, returned_quantity REAL DEFAULT 0,
    FOREIGN KEY(purchase_id) REFERENCES purchases(id), FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS purchase_returns(
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_no TEXT UNIQUE NOT NULL, purchase_id INTEGER NOT NULL, supplier_id INTEGER,
    total REAL NOT NULL, reason TEXT, credit_note_no TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(purchase_id) REFERENCES purchases(id)
  );
  CREATE TABLE IF NOT EXISTS purchase_return_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, purchase_item_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL, batch_ref TEXT,
    FOREIGN KEY(return_id) REFERENCES purchase_returns(id)
  );

  -- direction: +1 increases what the party owes/is owed, -1 decreases it
  CREATE TABLE IF NOT EXISTS customer_transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, type TEXT NOT NULL, direction INTEGER NOT NULL,
    amount REAL NOT NULL, reference TEXT, note TEXT, payment_method TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
  CREATE TABLE IF NOT EXISTS supplier_transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, type TEXT NOT NULL, direction INTEGER NOT NULL,
    amount REAL NOT NULL, reference TEXT, note TEXT, payment_method TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS expenses(
    id INTEGER PRIMARY KEY AUTOINCREMENT, expense_no TEXT UNIQUE, title TEXT NOT NULL, category TEXT, amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'Cash', paid_by TEXT, receipt_path TEXT, note TEXT, expense_date TEXT NOT NULL, user_id INTEGER, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS recurring_expenses(
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'Cash', frequency TEXT DEFAULT 'MONTHLY', day_of_month INTEGER DEFAULT 1,
    next_run_date TEXT NOT NULL, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS budgets(
    category TEXT NOT NULL, period_month TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY(category, period_month)
  );

  CREATE TABLE IF NOT EXISTS cash_registers(
    id INTEGER PRIMARY KEY AUTOINCREMENT, business_date TEXT NOT NULL, opening_cash REAL NOT NULL DEFAULT 0,
    opened_by INTEGER, opened_at TEXT NOT NULL, status TEXT DEFAULT 'OPEN',
    expected_cash REAL, actual_cash REAL, difference REAL, closing_notes TEXT, closed_by INTEGER, closed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS cash_transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT, register_id INTEGER NOT NULL, direction TEXT NOT NULL, category TEXT NOT NULL,
    amount REAL NOT NULL, reference TEXT, note TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(register_id) REFERENCES cash_registers(id)
  );

  CREATE TABLE IF NOT EXISTS bank_accounts(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, account_number TEXT, bank_name TEXT,
    opening_balance REAL DEFAULT 0, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bank_transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, direction TEXT NOT NULL, category TEXT NOT NULL,
    amount REAL NOT NULL, reference TEXT, note TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(account_id) REFERENCES bank_accounts(id)
  );
  CREATE TABLE IF NOT EXISTS petty_cash(
    id INTEGER PRIMARY KEY AUTOINCREMENT, direction TEXT NOT NULL, amount REAL NOT NULL,
    reference TEXT, note TEXT, user_id INTEGER, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_methods(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expense_categories(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, status TEXT DEFAULT 'active', sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS role_permissions(
    role TEXT NOT NULL, permission TEXT NOT NULL, allowed INTEGER DEFAULT 1, PRIMARY KEY(role, permission)
  );

  CREATE TABLE IF NOT EXISTS notifications(
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT,
    entity TEXT, entity_id INTEGER, severity TEXT DEFAULT 'info', is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock_movements(
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, location_id INTEGER, type TEXT NOT NULL, quantity REAL NOT NULL,
    previous_stock REAL, new_stock REAL, unit_cost REAL DEFAULT 0, reference TEXT, reason TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, entity TEXT, entity_id INTEGER,
    details TEXT, created_at TEXT NOT NULL
  );
  `);

  migrate();
  seed();
  backfillLocationStock();
  generateNotifications();
  runDueRecurringExpenses();
  maybeAutoBackup();
  db.prepare("INSERT OR IGNORE INTO schema_meta(version) VALUES(4)").run();
}

// Additive column migrations for installs created by earlier versions of this app.
function migrate() {
  const addColumn = (table, def) => { try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${def}`); } catch { /* already exists */ } };
  addColumn("categories", "name_urdu TEXT DEFAULT ''");
  addColumn("categories", "image_path TEXT DEFAULT ''");
  addColumn("products", "name_urdu TEXT DEFAULT ''");
  addColumn("products", "barcode TEXT");
  addColumn("products", "retail_price REAL DEFAULT 0");
  addColumn("products", "wholesale_price REAL DEFAULT 0");
  addColumn("products", "image_path TEXT DEFAULT ''");
  addColumn("sales", "tax REAL NOT NULL DEFAULT 0");
  addColumn("sales", "location_id INTEGER");
  addColumn("purchases", "discount REAL NOT NULL DEFAULT 0");
  addColumn("purchases", "tax REAL NOT NULL DEFAULT 0");
  addColumn("purchases", "location_id INTEGER");
  addColumn("purchases", "po_id INTEGER");
  addColumn("customers", "cnic TEXT");
  addColumn("customers", "group_id INTEGER");
  addColumn("suppliers", "ntn TEXT");
  addColumn("suppliers", "payment_term_days INTEGER DEFAULT 0");
  addColumn("suppliers", "products_supplied TEXT");
  addColumn("sales_returns", "return_type TEXT DEFAULT 'Refund'");
  addColumn("sales_return_items", "batch_ref TEXT");
  addColumn("purchase_returns", "credit_note_no TEXT");
  addColumn("purchase_return_items", "batch_ref TEXT");
  addColumn("stock_movements", "location_id INTEGER");
  // Older builds used a single `sale_price` column — migrate it into retail_price once.
  try {
    const cols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
    if (cols.includes("sale_price")) {
      db.exec("UPDATE products SET retail_price = sale_price WHERE retail_price = 0 OR retail_price IS NULL");
      db.exec("UPDATE products SET wholesale_price = sale_price WHERE wholesale_price = 0 OR wholesale_price IS NULL");
    }
  } catch { /* fresh install, no legacy column */ }
}

function settingsGet() { return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(r => [r.key, r.value])); }
function settingsSet(obj) {
  const q = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const tx = db.transaction(o => Object.entries(o).forEach(([k, v]) => q.run(k, String(v ?? ""))));
  tx(obj);
  return settingsGet();
}
function audit(userId, action, entity, entityId, details) {
  db.prepare("INSERT INTO audit_logs(user_id,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?)")
    .run(userId ?? null, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details) : null, now());
}

// Section 39: real IPC-boundary enforcement for the permission matrix — a
// curated set of money-moving/administrative channels each map 1:1 to one
// of the 24 permissions; read-only list/get channels are intentionally left
// ungated (there's no matching permission for "viewing a list" in the
// catalog, and page-level access is a separate, larger UI-gating project
// tracked in ROADMAP.md). Throws (denying the action) rather than silently
// no-opping, so a blocked user sees a real error, not a false success.
function requirePermission(actorId, permission) {
  if (!actorId) throw new Error(`Permission denied: no signed-in user for "${permission}"`);
  const u = db.prepare("SELECT role FROM users WHERE id=?").get(actorId);
  if (!u) throw new Error(`Permission denied: unknown user for "${permission}"`);
  const row = db.prepare("SELECT allowed FROM role_permissions WHERE role=? AND permission=?").get(u.role, permission);
  if (!row || !row.allowed) throw new Error(`Permission denied: role "${u.role}" cannot "${permission}"`);
}

// Section 32: collision-free sequential invoice numbering, per prefix per day.
function nextNo(prefix) {
  const dateKey = today().replace(/-/g, "");
  const row = db.prepare("SELECT seq FROM invoice_counters WHERE prefix=? AND date_key=?").get(prefix, dateKey);
  const seq = (row?.seq || 0) + 1;
  db.prepare("INSERT INTO invoice_counters(prefix,date_key,seq) VALUES(?,?,?) ON CONFLICT(prefix,date_key) DO UPDATE SET seq=excluded.seq")
    .run(prefix, dateKey, seq);
  return `${prefix}-${dateKey}-${String(seq).padStart(4, "0")}`;
}

function defaultLocationId() {
  const row = db.prepare("SELECT id FROM locations WHERE status='active' ORDER BY id LIMIT 1").get();
  return row ? row.id : null;
}

// Applies a stock movement at a specific location and keeps the per-product
// cached TOTAL (products.stock / avg_cost) in sync. Weighted average cost
// (Section 31) is recalculated from the company-wide total, not the
// per-location quantity, since cost basis is shared across locations.
function applyStock(productId, locationId, quantitySigned, unitCost, type, reference, reason, userId) {
  const p = db.prepare("SELECT * FROM products WHERE id=?").get(productId);
  if (!p) throw new Error("Product not found");
  const loc = locationId || defaultLocationId();

  // Section 47: negative stock is denied unless the owner explicitly allows it in Settings > System Preferences.
  const allowNegative = settingsGet().allow_negative_stock === "1";

  const locRow = db.prepare("SELECT stock FROM product_location_stock WHERE product_id=? AND location_id=?").get(productId, loc);
  const previousAtLocation = locRow ? locRow.stock : 0;
  const nextAtLocation = previousAtLocation + quantitySigned;
  if (nextAtLocation < 0 && !allowNegative) throw new Error(`Insufficient stock for ${p.name} at this location: have ${previousAtLocation}, need ${-quantitySigned}`);

  const previousTotal = p.stock || 0;
  let newAvg = p.avg_cost || 0;
  if (quantitySigned > 0 && unitCost > 0) {
    newAvg = (previousTotal * (p.avg_cost || 0) + quantitySigned * unitCost) / (previousTotal + quantitySigned || 1);
  }
  const newTotal = previousTotal + quantitySigned;
  if (newTotal < -0.0001 && !allowNegative) throw new Error(`Insufficient stock for ${p.name}: have ${previousTotal}, need ${-quantitySigned}`);

  db.prepare(`INSERT INTO product_location_stock(product_id,location_id,stock) VALUES(?,?,?)
    ON CONFLICT(product_id,location_id) DO UPDATE SET stock=excluded.stock`).run(productId, loc, nextAtLocation);
  db.prepare("UPDATE products SET stock=?, avg_cost=? WHERE id=?").run(newTotal, newAvg, productId);
  db.prepare(`INSERT INTO stock_movements(product_id,location_id,type,quantity,previous_stock,new_stock,unit_cost,reference,reason,user_id,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(productId, loc, type, quantitySigned, previousTotal, newTotal, unitCost || 0, reference || "", reason || "", userId ?? null, now());
  return newTotal;
}

function backfillLocationStock() {
  const loc = defaultLocationId();
  if (!loc) return;
  const already = db.prepare("SELECT COUNT(*) c FROM product_location_stock").get().c;
  if (already > 0) return;
  const ins = db.prepare("INSERT OR IGNORE INTO product_location_stock(product_id,location_id,stock) VALUES(?,?,?)");
  db.prepare("SELECT id,stock FROM products").all().forEach((p) => ins.run(p.id, loc, p.stock || 0));
}

// Cash register: only payment_method==='Cash' portions ever touch the physical drawer (Section 9/69).
function currentOpenRegister() {
  return db.prepare("SELECT * FROM cash_registers WHERE status='OPEN' ORDER BY id DESC LIMIT 1").get();
}
function cashTx(direction, category, amount, reference, note, userId) {
  if (!amount || amount <= 0) return;
  const reg = currentOpenRegister();
  if (!reg) return; // No open register yet — the transaction itself is still recorded; cash impact applies once a register is opened.
  db.prepare("INSERT INTO cash_transactions(register_id,direction,category,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(reg.id, direction, category, amount, reference || "", note || "", userId ?? null, now());
}
function registerTotals(registerId) {
  const inSum = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM cash_transactions WHERE register_id=? AND direction='IN'").get(registerId).v;
  const outSum = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM cash_transactions WHERE register_id=? AND direction='OUT'").get(registerId).v;
  return { cashIn: inSum, cashOut: outSum };
}

// FIFO aging: opening balance + each debit entry (credit sale/purchase) is an
// "open" item; each credit entry (payment/return) is applied against the
// oldest open items first. Whatever remains open is bucketed by age.
function computeAging(rows, openingBalance, openingDate) {
  const open = [];
  if (openingBalance > 0) open.push({ remaining: openingBalance, date: openingDate });
  for (const r of rows) {
    if (r.direction > 0) {
      open.push({ remaining: r.amount, date: r.created_at });
    } else {
      let toApply = r.amount;
      for (const e of open) {
        if (toApply <= 0) break;
        const take = Math.min(e.remaining, toApply);
        e.remaining -= take;
        toApply -= take;
      }
    }
  }
  const nowMs = Date.now();
  const buckets = { current: 0, d31_60: 0, d61_90: 0, over90: 0 };
  for (const e of open) {
    if (e.remaining <= 0.009) continue;
    const days = (nowMs - new Date(e.date).getTime()) / 86400000;
    if (days <= 30) buckets.current += e.remaining;
    else if (days <= 60) buckets.d31_60 += e.remaining;
    else if (days <= 90) buckets.d61_90 += e.remaining;
    else buckets.over90 += e.remaining;
  }
  return buckets;
}

function generateNotifications() {
  const settings = settingsGet();
  const push = (type, title, body, entity, entityId, severity) => {
    const exists = db.prepare("SELECT id FROM notifications WHERE type=? AND entity=? AND entity_id=? AND is_read=0").get(type, entity, entityId);
    if (exists) return;
    db.prepare("INSERT INTO notifications(type,title,body,entity,entity_id,severity,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(type, title, body, entity, entityId, severity, now());
  };
  if (settings.notify_low_stock !== "0") {
    db.prepare("SELECT id,name,stock,min_stock,package_unit FROM products WHERE status='active' AND stock<=min_stock").all()
      .forEach((p) => push("LOW_STOCK", `Low stock: ${p.name}`, `${p.stock} ${p.package_unit} remaining (minimum ${p.min_stock})`, "product", p.id, "warning"));
  }
  if (settings.notify_overdue_receivables !== "0") {
    db.prepare("SELECT id,COALESCE(shop_name,name) name FROM customers WHERE status='active'").all().forEach((c) => {
      const agingRows = db.prepare("SELECT direction,amount,created_at FROM customer_transactions WHERE customer_id=? ORDER BY created_at ASC").all(c.id);
      const customer = db.prepare("SELECT opening_balance,created_at FROM customers WHERE id=?").get(c.id);
      const aging = computeAging(agingRows, customer.opening_balance, customer.created_at);
      if (aging.over90 > 0) push("RECEIVABLE_OVERDUE", `Overdue balance: ${c.name}`, `Rs. ${Math.round(aging.over90)} outstanding for over 90 days`, "customer", c.id, "critical");
    });
  }
}

// Section 49: automatic local backup (Daily/Weekly), on top of the existing
// manual "Backup Now" save-as flow. Writes into <userData>/backups and keeps
// the most recent 10 so the folder doesn't grow unbounded.
function maybeAutoBackup() {
  const settings = settingsGet();
  if (settings.auto_backup_enabled === "0") return;
  const frequencyMs = settings.auto_backup_frequency === "Weekly" ? 7 * 86400000 : 86400000;
  const last = settings.last_backup_at ? new Date(settings.last_backup_at).getTime() : 0;
  if (Date.now() - last < frequencyMs) return;

  const backupsDir = path.join(app.getPath("userData"), "backups");
  fs.mkdirSync(backupsDir, { recursive: true });
  db.pragma("wal_checkpoint(TRUNCATE)");
  const dest = path.join(backupsDir, `ShopManager-Auto-${now().replace(/[:.]/g, "-")}.db`);
  fs.copyFileSync(path.join(app.getPath("userData"), "shopmanager.db"), dest);
  settingsSet({ last_backup_at: now() });
  audit(null, "AUTO_BACKUP_CREATED", "system", null, { path: dest });

  const files = fs.readdirSync(backupsDir).filter((f) => f.startsWith("ShopManager-Auto-")).sort();
  while (files.length > 10) fs.unlinkSync(path.join(backupsDir, files.shift()));
}

function runDueRecurringExpenses() {
  const due = db.prepare("SELECT * FROM recurring_expenses WHERE status='active' AND next_run_date<=?").all(today());
  for (const r of due) {
    const no = nextNo("EXP");
    db.prepare("INSERT INTO expenses(expense_no,title,category,amount,payment_method,paid_by,note,expense_date,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(no, r.title, r.category, r.amount, r.payment_method, "Recurring", "Auto-generated recurring expense", today(), now());
    if (r.payment_method === "Cash") cashTx("OUT", "EXPENSE", r.amount, no, r.title, null);
    const next = new Date(r.next_run_date);
    if (r.frequency === "WEEKLY") next.setDate(next.getDate() + 7); else next.setMonth(next.getMonth() + 1);
    db.prepare("UPDATE recurring_expenses SET next_run_date=? WHERE id=?").run(next.toISOString().slice(0, 10), r.id);
  }
}

// ---------------------------------------------------------------------------
// Seed data — exact business identity and product catalog supplied by the owner.
// ---------------------------------------------------------------------------
function seed() {
  // INSERT OR IGNORE per-key (not gated on the table being empty) so every
  // install — fresh or upgraded from an earlier phase — ends up with every
  // known setting key, without ever overwriting a value the owner already set.
  const s = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
  [
    ["business_name", "Haji Abdul Manan & Abdul Hanan"],
    ["business_title", "Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin"],
    ["business_type", "Atta Dealer / Fertilizer / Grains"],
    ["owner_name", "Haji Abdul Manan & Abdul Hanan"],
    ["address", "Pishin, Balochistan, Pakistan"],
    ["phone", ""], ["cnic", ""], ["ntn", ""], ["email", ""],
    ["currency", "PKR"], ["timezone", "Asia/Karachi"],
    ["primary_color", "#1f6b2a"],
    ["logo_path", ""],
    ["business_description", "Quality fertilizers, grains, and atta for a prosperous Balochistan."],
    ["invoice_footer", "Thank you for your purchase!"],
    ["invoice_prefix", "INV"], ["invoice_prefix_purchase", "PUR"],
    ["invoice_template", "Standard"], ["invoice_size", "58mm Thermal"],
    ["invoice_terms", "Goods once sold will only be exchanged or returned within 7 days with the original receipt."],
    ["show_logo_on_invoice", "1"], ["show_barcode_on_invoice", "1"],
    ["show_terms_on_invoice", "0"], ["show_thankyou_on_invoice", "1"],
    ["language", "en"], ["date_format", "DD MMM YYYY"], ["time_format", "12"], ["fiscal_year_start_month", "January"],
    ["low_stock_default", "10"],
    ["print_customer_copy", "1"], ["print_office_copy", "1"], ["auto_cut", "1"],
    ["sales_tax_enabled", "0"], ["sales_tax_rate", "0"],
    ["purchase_tax_enabled", "0"], ["purchase_tax_rate", "0"],
    ["discount_sales_enabled", "1"], ["discount_sales_max_pct", "10"],
    ["discount_purchase_enabled", "1"], ["discount_purchase_max_pct", "10"],
    ["enable_batch_tracking", "0"], ["enable_low_stock_alerts", "1"],
    ["enable_sales_return", "1"], ["enable_purchase_return", "1"],
    ["enable_customer_credit", "1"], ["enable_supplier_credit", "1"],
    ["show_purchase_price_to_sales", "0"], ["enable_multi_location", "0"],
    ["notify_low_stock", "1"], ["notify_overdue_receivables", "1"],
    ["allow_negative_stock", "0"], ["default_sale_mode", "Retail"],
    ["auto_backup_enabled", "1"], ["auto_backup_frequency", "Daily"], ["last_backup_at", ""],
    ["sms_provider", ""], ["sms_api_key", ""], ["whatsapp_provider", ""], ["whatsapp_api_key", ""],
    ["email_smtp_host", ""], ["email_smtp_port", ""], ["email_smtp_user", ""], ["email_smtp_pass", ""],
    ["setup_complete", "0"]
  ].forEach(x => s.run(...x));
  if (db.prepare("SELECT COUNT(*) c FROM locations").get().c === 0) {
    db.prepare("INSERT INTO locations(name,type,created_at) VALUES(?,?,?)").run("Main Store", "Store", now());
  }
  if (db.prepare("SELECT COUNT(*) c FROM payment_methods").get().c === 0) {
    const pm = db.prepare("INSERT INTO payment_methods(name,sort_order) VALUES(?,?)");
    ["Cash", "Bank Transfer", "JazzCash", "Easypaisa", "Cheque", "Credit", "Partial"].forEach((n, i) => pm.run(n, i));
  }
  if (db.prepare("SELECT COUNT(*) c FROM expense_categories").get().c === 0) {
    const ec = db.prepare("INSERT INTO expense_categories(name,sort_order) VALUES(?,?)");
    ["Electricity", "Internet", "Salary", "Transport", "Fuel", "Rent", "Repairs", "Office Supplies", "Maintenance", "Bank Charges", "Miscellaneous", "Other"].forEach((n, i) => ec.run(n, i));
  }
  if (db.prepare("SELECT COUNT(*) c FROM role_permissions").get().c === 0) {
    const ins = db.prepare("INSERT OR IGNORE INTO role_permissions(role,permission,allowed) VALUES(?,?,?)");
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      const allowedSet = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
      for (const perm of PERMISSIONS) ins.run(role, perm, allowedSet.has(perm) ? 1 : 0);
    }
  }
  if (db.prepare("SELECT COUNT(*) c FROM users").get().c === 0) {
    db.prepare("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)")
      .run("admin", "Administrator", "Owner", hashPassword("admin123"), now());
  }
  if (db.prepare("SELECT COUNT(*) c FROM categories").get().c === 0) {
    const cats = [
      ["Atta / Flour", "آٹا"], ["Grains", "اناج"], ["Bran / Chokar", "چوکر"],
      ["Fertilizer", "کھاد"], ["Micronutrients", "مائیکرو نیوٹرینٹس"], ["Other", "دیگر"]
    ];
    const st = db.prepare("INSERT INTO categories(name,name_urdu,created_at) VALUES(?,?,?)");
    cats.forEach(([n, u]) => st.run(n, u, now()));
    const catId = name => db.prepare("SELECT id FROM categories WHERE name=?").get(name).id;

    // Exact product catalog supplied by the business (English + Urdu names, spellings preserved verbatim).
    const products = [
      ["Ardawa", "ارداوا", "Grains", 50, "KG", 3800, 4100, 4300],
      ["Chakki Atta Punjab", "چکی آٹا پنجاب", "Atta / Flour", 40, "KG", 3400, 3700, 3900],
      ["Chokar 17 kg", "چوکر 17 کلو", "Bran / Chokar", 17, "KG", 900, 1100, 1200],
      ["Chokar 40 kg", "چوکر 40 کلو", "Bran / Chokar", 40, "KG", 1900, 2200, 2400],
      ["DAP", "ڈی اے پی", "Fertilizer", 50, "KG", 11000, 11800, 12000],
      ["Fatima Urea", "فاطمہ یوریا", "Fertilizer", 50, "KG", 5200, 5600, 5800],
      ["Gali 44 kg", "کلی 44 کلو", "Grains", 44, "KG", 4500, 4900, 5100],
      ["Gandam", "گندم", "Grains", 50, "KG", 4200, 4600, 4800],
      ["Gandam Kharan", "گندم خاران", "Grains", 50, "KG", 4300, 4700, 4900],
      ["Gandam Khuzdar", "گندم خضدار", "Grains", 50, "KG", 4300, 4700, 4900],
      ["Gandam Mastamand", "گندم مستعمند", "Grains", 50, "KG", 4250, 4650, 4850],
      ["Jau", "جو", "Grains", 50, "KG", 3600, 3900, 4100],
      ["Kharab Atta", "خراب آٹا", "Atta / Flour", 40, "KG", 1500, 1800, 1900],
      ["Potash Granular", "پوٹاش دانے دار", "Fertilizer", 50, "KG", 9500, 10200, 10500],
      ["Potash Powder", "پوٹاش پاؤڈر", "Fertilizer", 50, "KG", 9000, 9700, 10000],
      ["Sikosterin", "سکوسٹرین", "Micronutrients", 1, "L", 1200, 1500, 1700],
      ["Sona Urea", "سونا یوریا", "Fertilizer", 50, "KG", 5200, 5600, 5800],
      ["Super Aata", "سوپر آٹا", "Atta / Flour", 40, "KG", 3500, 3800, 4000],
      ["Super Punjab", "سپر پنجاب", "Atta / Flour", 40, "KG", 3450, 3750, 3950],
      ["Super Seb", "سپر سیب", "Atta / Flour", 40, "KG", 3550, 3850, 4050],
      ["Zinc", "زنک", "Micronutrients", 1, "KG", 900, 1200, 1350]
    ];
    const p = db.prepare(`INSERT INTO products(category_id,name,name_urdu,brand,package_size,package_unit,sku,purchase_price,retail_price,wholesale_price,min_stock,avg_cost,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    products.forEach(([name, nameUrdu, catName, size, unit, cost, retail, wholesale], idx) => {
      p.run(catId(catName), name, nameUrdu, "", size, unit, `SKU-${String(idx + 1).padStart(3, "0")}`, cost, retail, wholesale, 10, cost, now());
    });
    // Zero opening stock by default — the owner sets real opening stock during setup (Section 13 note).
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.handle("settings:get", () => settingsGet());
  ipcMain.handle("settings:update", (_, o) => {
    const { actorId, ...fields } = o;
    requirePermission(actorId, "settings.manage");
    const s = settingsSet(fields);
    audit(actorId, "SETTINGS_CHANGED", "settings", null, fields);
    return s;
  });

  ipcMain.handle("auth:login", (_, credentialsOrUsername, passwordArg) => {
    const credentials = credentialsOrUsername && typeof credentialsOrUsername === "object"
      ? credentialsOrUsername : { username: credentialsOrUsername, password: passwordArg };
    const username = String(credentials.username ?? "").trim();
    const password = String(credentials.password ?? "");
    if (!username || !password) throw new Error("Username and password are required");
    const u = db.prepare("SELECT id,username,display_name,role,password_hash FROM users WHERE username=@username AND status='active'").get({ username });
    if (!u || !verifyPassword(password, u.password_hash)) {
      audit(u ? u.id : null, "LOGIN_FAILED", "user", u ? u.id : null, { username });
      throw new Error("Invalid username or password");
    }
    audit(u.id, "LOGIN", "user", u.id, null);
    return { id: u.id, username: u.username, display_name: u.display_name, role: u.role };
  });

  ipcMain.handle("users:list", () => db.prepare("SELECT id,username,display_name,role,status,created_at FROM users ORDER BY id DESC").all());
  ipcMain.handle("users:add", (_, x) => {
    requirePermission(x.actorId, "users.manage");
    const r = db.prepare("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)")
      .run(x.username, x.display_name, x.role, hashPassword(x.password || "admin123"), now());
    audit(x.actorId, "CREATE", "user", r.lastInsertRowid, { username: x.username, role: x.role });
    return r.lastInsertRowid;
  });
  ipcMain.handle("users:resetPassword", (_, x) => {
    requirePermission(x.actorId, "users.manage");
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(x.password), x.id);
    audit(x.actorId, "PASSWORD_RESET", "user", x.id, null);
    return true;
  });
  ipcMain.handle("users:setStatus", (_, x) => {
    requirePermission(x.actorId, "users.manage");
    db.prepare("UPDATE users SET status=? WHERE id=?").run(x.status, x.id);
    audit(x.actorId, x.status === "active" ? "USER_REACTIVATED" : "USER_DEACTIVATED", "user", x.id, null);
    return true;
  });

  ipcMain.handle("images:pick", async () => {
    const r = await dialog.showOpenDialog(win, { title: "Choose image", properties: ["openFile"], filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }] });
    if (r.canceled) return null;
    const src = r.filePaths[0], ext = path.extname(src).toLowerCase(), dest = path.join(dataDir, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
    fs.copyFileSync(src, dest);
    return dest;
  });
  ipcMain.handle("images:remove", (_, p) => { if (p && p.startsWith(dataDir) && fs.existsSync(p)) fs.unlinkSync(p); return true; });

  // ---- Expense receipt attachment (Section 26: photo/PDF of the paper receipt) --
  ipcMain.handle("receipts:pick", async () => {
    const r = await dialog.showOpenDialog(win, { title: "Attach receipt", properties: ["openFile"], filters: [{ name: "Receipts", extensions: ["jpg", "jpeg", "png", "webp", "pdf"] }] });
    if (r.canceled) return null;
    const src = r.filePaths[0], ext = path.extname(src).toLowerCase(), dest = path.join(dataDir, `receipt-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
    fs.copyFileSync(src, dest);
    return dest;
  });

  // ---- Generic file dialogs for CSV import/export (Section 53/13 catalog tooling) --
  ipcMain.handle("files:pickCsv", async () => {
    const r = await dialog.showOpenDialog(win, { title: "Choose a CSV file", properties: ["openFile"], filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (r.canceled) return null;
    return { name: path.basename(r.filePaths[0]), content: fs.readFileSync(r.filePaths[0], "utf8") };
  });
  ipcMain.handle("files:saveText", async (_, x) => {
    const out = await dialog.showSaveDialog(win, { title: x.title || "Save File", defaultPath: x.defaultPath, filters: x.filters || [{ name: "CSV", extensions: ["csv"] }] });
    if (out.canceled) return null;
    fs.writeFileSync(out.filePath, x.content, "utf8");
    return out.filePath;
  });

  // ---- Locations ----------------------------------------------------------
  ipcMain.handle("locations:list", () => db.prepare("SELECT * FROM locations ORDER BY name").all());
  ipcMain.handle("locations:save", (_, x) => {
    if (x.id) db.prepare("UPDATE locations SET name=?,type=?,status=? WHERE id=?").run(x.name, x.type || "Store", x.status || "active", x.id);
    else db.prepare("INSERT INTO locations(name,type,created_at) VALUES(?,?,?)").run(x.name, x.type || "Store", now());
    return db.prepare("SELECT * FROM locations ORDER BY name").all();
  });
  ipcMain.handle("stock:byLocation", (_, productId) => db.prepare(`
    SELECT l.id location_id, l.name location_name, COALESCE(pls.stock,0) stock
    FROM locations l LEFT JOIN product_location_stock pls ON pls.location_id=l.id AND pls.product_id=?
    WHERE l.status='active' ORDER BY l.name`).all(productId));
  ipcMain.handle("stock:transfer", (_, x) => {
    requirePermission(x.actorId, "inventory.adjust");
    const tx = db.transaction(v => {
      if (v.from_location_id === v.to_location_id) throw new Error("Source and destination must differ");
      const no = nextNo("TRF");
      applyStock(v.product_id, v.from_location_id, -Number(v.quantity), 0, "TRANSFER", no, v.reason || "Stock transfer out", v.actorId);
      applyStock(v.product_id, v.to_location_id, Number(v.quantity), 0, "TRANSFER", no, v.reason || "Stock transfer in", v.actorId);
      audit(v.actorId, "STOCK_TRANSFER", "product", v.product_id, { from: v.from_location_id, to: v.to_location_id, quantity: v.quantity, reference: no });
      return { reference: no };
    });
    return tx(x);
  });

  ipcMain.handle("categories:list", () => db.prepare("SELECT * FROM categories ORDER BY name").all());
  ipcMain.handle("categories:save", (_, x) => {
    if (x.id) db.prepare("UPDATE categories SET name=?,name_urdu=?,image_path=?,status=? WHERE id=?").run(x.name, x.name_urdu || "", x.image_path || "", x.status || "active", x.id);
    else db.prepare("INSERT INTO categories(name,name_urdu,image_path,created_at) VALUES(?,?,?,?)").run(x.name, x.name_urdu || "", x.image_path || "", now());
    return db.prepare("SELECT * FROM categories ORDER BY name").all();
  });

  ipcMain.handle("products:list", () => db.prepare("SELECT p.*,c.name category_name,c.name_urdu category_name_urdu FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.status='active' ORDER BY p.name").all());
  ipcMain.handle("products:save", (_, x) => {
    if (x.id) {
      // Merge onto the existing row so a partial payload (e.g. just {id, status}
      // to deactivate a product) never nulls out the fields it didn't send.
      const existing = db.prepare("SELECT * FROM products WHERE id=?").get(x.id);
      if (!existing) throw new Error("Product not found");
      const merged = { ...existing, ...x };
      db.prepare(`UPDATE products SET category_id=?,name=?,name_urdu=?,brand=?,package_size=?,package_unit=?,sku=?,barcode=?,
        purchase_price=?,retail_price=?,wholesale_price=?,min_stock=?,image_path=?,status=? WHERE id=?`)
        .run(merged.category_id, merged.name, merged.name_urdu || "", merged.brand || "", merged.package_size || 0, merged.package_unit || "",
          merged.sku || null, merged.barcode || null, merged.purchase_price || 0, merged.retail_price || 0, merged.wholesale_price || 0,
          merged.min_stock || 0, merged.image_path || "", merged.status || "active", x.id);
      if (Number(existing.retail_price) !== Number(merged.retail_price) || Number(existing.wholesale_price) !== Number(merged.wholesale_price))
        audit(x.actorId, "PRICE_CHANGED", "product", x.id, { before: { retail_price: existing.retail_price, wholesale_price: existing.wholesale_price }, after: { retail_price: merged.retail_price, wholesale_price: merged.wholesale_price } });
      if (existing.status !== merged.status) audit(x.actorId, merged.status === "active" ? "PRODUCT_REACTIVATED" : "PRODUCT_DEACTIVATED", "product", x.id, { name: merged.name });
    } else {
      const r = db.prepare(`INSERT INTO products(category_id,name,name_urdu,brand,package_size,package_unit,sku,barcode,purchase_price,retail_price,wholesale_price,min_stock,avg_cost,image_path,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(x.category_id, x.name, x.name_urdu || "", x.brand || "", x.package_size || 0, x.package_unit || "", x.sku || null, x.barcode || null,
          x.purchase_price || 0, x.retail_price || 0, x.wholesale_price || 0, x.min_stock || 0, x.purchase_price || 0, x.image_path || "", now());
      if (x.stock) applyStock(r.lastInsertRowid, x.location_id, Number(x.stock), Number(x.purchase_price || 0), "OPENING_STOCK", "OPENING", "Product creation", x.actorId);
      audit(x.actorId, "CREATE", "product", r.lastInsertRowid, { name: x.name });
    }
    return true;
  });
  ipcMain.handle("products:adjust", (_, x) => {
    requirePermission(x.actorId, "inventory.adjust");
    const qty = Number(x.quantity);
    const type = qty >= 0 ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT";
    applyStock(x.product_id, x.location_id, qty, Number(x.unit_cost || 0), type, "MANUAL", x.reason || "Manual adjustment", x.actorId);
    audit(x.actorId, "STOCK_ADJUSTED", "product", x.product_id, { quantity: qty, reason: x.reason });
    return true;
  });
  ipcMain.handle("products:ensureBarcodes", (_, x) => {
    const rows = db.prepare("SELECT id,sku FROM products WHERE status='active' AND (barcode IS NULL OR barcode='')").all();
    const upd = db.prepare("UPDATE products SET barcode=? WHERE id=?");
    rows.forEach((p) => upd.run(p.sku || `PRD${String(p.id).padStart(6, "0")}`, p.id));
    if (rows.length) audit(x?.actorId, "BARCODES_GENERATED", "product", null, { count: rows.length });
    return rows.length;
  });
  ipcMain.handle("products:bulkUpdatePrices", (_, x) => {
    const tx = db.transaction((updates) => {
      const upd = db.prepare("UPDATE products SET retail_price=?, wholesale_price=? WHERE id=?");
      for (const u of updates) upd.run(u.retail_price, u.wholesale_price, u.id);
    });
    tx(x.updates || []);
    audit(x.actorId, "BULK_PRICE_UPDATE", "product", null, { count: (x.updates || []).length });
    return true;
  });
  ipcMain.handle("stockMovements:list", (_, filters) => {
    const f = filters || {};
    const clauses = [];
    const params = {};
    if (f.types?.length) { clauses.push(`sm.type IN (${f.types.map((_, i) => `@t${i}`).join(",")})`); f.types.forEach((t, i) => { params[`t${i}`] = t; }); }
    if (f.productId) { clauses.push("sm.product_id=@productId"); params.productId = f.productId; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return db.prepare(`
      SELECT sm.*, p.name product_name, p.package_unit, l.name location_name
      FROM stock_movements sm JOIN products p ON p.id=sm.product_id LEFT JOIN locations l ON l.id=sm.location_id
      ${where} ORDER BY sm.id DESC LIMIT @limit`).all({ ...params, limit: f.limit || 100 });
  });

  // ---- Customer groups ------------------------------------------------------
  ipcMain.handle("customerGroups:list", () => db.prepare("SELECT * FROM customer_groups ORDER BY name").all());
  ipcMain.handle("customerGroups:save", (_, x) => { db.prepare("INSERT INTO customer_groups(name,created_at) VALUES(?,?)").run(x.name, now()); return db.prepare("SELECT * FROM customer_groups ORDER BY name").all(); });

  ipcMain.handle("customers:list", () => db.prepare(`
    SELECT c.*, g.name group_name, COALESCE(c.opening_balance,0) + COALESCE((SELECT SUM(direction*amount) FROM customer_transactions t WHERE t.customer_id=c.id),0) balance
    FROM customers c LEFT JOIN customer_groups g ON g.id=c.group_id WHERE c.status='active' ORDER BY COALESCE(c.shop_name,c.name)`).all());
  ipcMain.handle("customers:save", (_, x) => {
    requirePermission(x.actorId, "customers.create");
    if (x.id) {
      // Merge onto the existing row so a partial payload (Set Credit Limit,
      // Deactivate Customer, etc.) never nulls out fields it didn't send.
      const existing = db.prepare("SELECT * FROM customers WHERE id=?").get(x.id);
      if (!existing) throw new Error("Customer not found");
      const merged = { ...existing, ...x };
      db.prepare("UPDATE customers SET shop_name=?,name=?,phone=?,whatsapp=?,address=?,city=?,area=?,customer_type=?,cnic=?,group_id=?,credit_limit=?,notes=?,status=? WHERE id=?")
        .run(merged.shop_name || "", merged.name, merged.phone || "", merged.whatsapp || "", merged.address || "", merged.city || "", merged.area || "",
          merged.customer_type || "Retail", merged.cnic || "", merged.group_id || null, merged.credit_limit || 0, merged.notes || "", merged.status || "active", x.id);
      if (Number(existing.credit_limit) !== Number(merged.credit_limit))
        audit(x.actorId, "CREDIT_LIMIT_CHANGED", "customer", x.id, { before: existing.credit_limit, after: merged.credit_limit });
      if (existing.status !== merged.status) audit(x.actorId, merged.status === "active" ? "CUSTOMER_REACTIVATED" : "CUSTOMER_DEACTIVATED", "customer", x.id, { name: merged.name });
    } else {
      db.prepare("INSERT INTO customers(shop_name,name,phone,whatsapp,address,city,area,customer_type,cnic,group_id,credit_limit,opening_balance,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(x.shop_name || "", x.name, x.phone || "", x.whatsapp || "", x.address || "", x.city || "", x.area || "", x.customer_type || "Retail", x.cnic || "", x.group_id || null, x.credit_limit || 0, x.opening_balance || 0, x.notes || "", now());
      audit(x.actorId, "CREATE", "customer", null, { name: x.name });
    }
    return true;
  });
  ipcMain.handle("customers:ledger", (_, customerId) => db.prepare("SELECT * FROM customer_transactions WHERE customer_id=? ORDER BY id DESC").all(customerId));
  ipcMain.handle("customers:aging", (_, customerId) => {
    const c = db.prepare("SELECT opening_balance,created_at FROM customers WHERE id=?").get(customerId);
    const rows = db.prepare("SELECT direction,amount,created_at FROM customer_transactions WHERE customer_id=? ORDER BY created_at ASC").all(customerId);
    return computeAging(rows, c.opening_balance, c.created_at);
  });
  ipcMain.handle("customers:stats", (_, customerId) => {
    const sales = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) total, MAX(sale_date) lastDate FROM sales WHERE customer_id=? AND status='COMPLETED'").get(customerId);
    const payments = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM customer_transactions WHERE customer_id=? AND type='PAYMENT'").get(customerId);
    return { totalPurchases: sales.total, totalInvoices: sales.n, lastPurchaseDate: sales.lastDate, totalPayments: payments.v };
  });
  ipcMain.handle("customers:recentSales", (_, customerId) => db.prepare("SELECT * FROM sales WHERE customer_id=? ORDER BY id DESC LIMIT 10").all(customerId));

  ipcMain.handle("suppliers:list", () => db.prepare(`
    SELECT s.*, COALESCE(s.opening_balance,0) + COALESCE((SELECT SUM(direction*amount) FROM supplier_transactions t WHERE t.supplier_id=s.id),0) balance
    FROM suppliers s WHERE s.status='active' ORDER BY s.name`).all());
  ipcMain.handle("suppliers:save", (_, x) => {
    requirePermission(x.actorId, "suppliers.create");
    if (x.id) {
      const existing = db.prepare("SELECT * FROM suppliers WHERE id=?").get(x.id);
      if (!existing) throw new Error("Supplier not found");
      const merged = { ...existing, ...x };
      db.prepare("UPDATE suppliers SET name=?,contact_person=?,phone=?,whatsapp=?,address=?,city=?,category=?,ntn=?,payment_term_days=?,products_supplied=?,notes=?,status=? WHERE id=?")
        .run(merged.name, merged.contact_person || "", merged.phone || "", merged.whatsapp || "", merged.address || "", merged.city || "",
          merged.category || "", merged.ntn || "", merged.payment_term_days || 0, merged.products_supplied || "", merged.notes || "", merged.status || "active", x.id);
      if (existing.status !== merged.status) audit(x.actorId, merged.status === "active" ? "SUPPLIER_REACTIVATED" : "SUPPLIER_DEACTIVATED", "supplier", x.id, { name: merged.name });
    } else {
      db.prepare("INSERT INTO suppliers(name,contact_person,phone,whatsapp,address,city,category,ntn,payment_term_days,products_supplied,opening_balance,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(x.name, x.contact_person || "", x.phone || "", x.whatsapp || "", x.address || "", x.city || "", x.category || "", x.ntn || "", x.payment_term_days || 0, x.products_supplied || "", x.opening_balance || 0, x.notes || "", now());
      audit(x.actorId, "CREATE", "supplier", null, { name: x.name });
    }
    return true;
  });
  ipcMain.handle("suppliers:ledger", (_, supplierId) => db.prepare("SELECT * FROM supplier_transactions WHERE supplier_id=? ORDER BY id DESC").all(supplierId));
  ipcMain.handle("suppliers:aging", (_, supplierId) => {
    const s = db.prepare("SELECT opening_balance,created_at FROM suppliers WHERE id=?").get(supplierId);
    const rows = db.prepare("SELECT direction,amount,created_at FROM supplier_transactions WHERE supplier_id=? ORDER BY created_at ASC").all(supplierId);
    return computeAging(rows, s.opening_balance, s.created_at);
  });
  ipcMain.handle("suppliers:stats", (_, supplierId) => {
    const purchases = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) total, MAX(purchase_date) lastDate FROM purchases WHERE supplier_id=?").get(supplierId);
    const payments = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM supplier_transactions WHERE supplier_id=? AND type='PAYMENT'").get(supplierId);
    return { totalPurchases: purchases.total, totalInvoices: purchases.n, lastPurchaseDate: purchases.lastDate, totalPayments: payments.v };
  });
  ipcMain.handle("suppliers:recentPurchases", (_, supplierId) => db.prepare("SELECT * FROM purchases WHERE supplier_id=? ORDER BY id DESC LIMIT 10").all(supplierId));

  // ---- Sales (POS) -------------------------------------------------------
  ipcMain.handle("sales:list", () => db.prepare(`SELECT s.*,COALESCE(c.shop_name,c.name) customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 200`).all());
  ipcMain.handle("sales:get", (_, id) => ({
    sale: db.prepare("SELECT s.*,COALESCE(c.shop_name,c.name) customer_name,c.phone customer_phone FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?").get(id),
    items: db.prepare("SELECT si.*,p.name product_name,p.name_urdu FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=?").all(id)
  }));
  const createSaleTx = db.transaction((v) => {
    if (!v.items?.length) throw new Error("Cart is empty");
    let subtotal = 0;
    for (const i of v.items) subtotal += Number(i.quantity) * Number(i.rate);
    const discount = Number(v.discount || 0);
    const tax = Number(v.tax || 0);
    const total = Math.max(0, subtotal - discount + tax);
    const paid = Math.min(Number(v.paid || 0), total);
    if (paid < 0) throw new Error("Paid amount cannot be negative");
    const loc = v.location_id || defaultLocationId();
    const no = nextNo(settingsGet().invoice_prefix || "INV");
    const sale = db.prepare(`INSERT INTO sales(invoice_no,customer_id,mode,subtotal,discount,tax,total,paid,balance,location_id,payment_method,cashier_id,sale_date,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(no, v.customer_id || null, v.mode || "Retail", subtotal, discount, tax, total, paid, total - paid, loc, v.payment_method || "Cash", v.actorId || null, today(), now());
    const item = db.prepare("INSERT INTO sale_items(sale_id,product_id,quantity,unit,rate,amount,cost) VALUES(?,?,?,?,?,?,?)");
    for (const i of v.items) {
      const p = db.prepare("SELECT * FROM products WHERE id=?").get(i.product_id);
      if (!p) throw new Error("Product not found");
      item.run(sale.lastInsertRowid, i.product_id, i.quantity, p.package_unit, i.rate, i.quantity * i.rate, p.avg_cost || p.purchase_price);
      applyStock(i.product_id, loc, -Number(i.quantity), 0, "SALE", no, "POS sale", v.actorId);
    }
    const balance = total - paid;
    if (v.customer_id && balance > 0) {
      db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,payment_method,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .run(v.customer_id, "SALE_CREDIT", 1, balance, no, `${v.mode || "Retail"} sale — credit`, v.payment_method, v.actorId || null, now());
    }
    if (paid > 0 && (v.payment_method === "Cash" || v.payment_method === "Partial")) cashTx("IN", "SALE", paid, no, `${v.mode || "Retail"} sale`, v.actorId);
    audit(v.actorId, "CREATE", "sale", sale.lastInsertRowid, { invoice_no: no, total, paid, balance });
    return { id: sale.lastInsertRowid, invoice_no: no, subtotal, discount, tax, total, paid, balance, sale_date: today() };
  });
  ipcMain.handle("sales:create", (_, x) => { requirePermission(x.actorId, "sales.create"); return createSaleTx(x); });
  ipcMain.handle("sales:void", (_, x) => {
    requirePermission(x.actorId, "sales.delete");
    const tx = db.transaction(v => {
      const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(v.id);
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "VOID") throw new Error("Sale already voided");
      const items = db.prepare("SELECT * FROM sale_items WHERE sale_id=?").all(v.id);
      for (const i of items) applyStock(i.product_id, sale.location_id, Number(i.quantity), 0, "SALES_RETURN", sale.invoice_no, "Sale voided", v.actorId);
      if (sale.customer_id && sale.balance > 0)
        db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(sale.customer_id, "VOID_ADJUSTMENT", -1, sale.balance, sale.invoice_no, "Sale voided", v.actorId || null, now());
      db.prepare("UPDATE sales SET status='VOID' WHERE id=?").run(v.id);
      audit(v.actorId, "VOID", "sale", v.id, { invoice_no: sale.invoice_no, reason: v.reason });
      return true;
    });
    return tx(x);
  });

  // ---- Held bills & Quotations (F3/F5) -------------------------------------
  ipcMain.handle("heldSales:list", (_, type) => db.prepare(`
    SELECT h.*, COALESCE(c.shop_name,c.name) customer_name FROM held_sales h LEFT JOIN customers c ON c.id=h.customer_id
    ${type ? "WHERE h.type=@type" : ""} ORDER BY h.id DESC`).all(type ? { type } : {}));
  ipcMain.handle("heldSales:create", (_, x) => {
    if (!x.items?.length) throw new Error("Cart is empty");
    const type = x.type === "QUOTATION" ? "QUOTATION" : "HOLD";
    const no = nextNo(type === "QUOTATION" ? "QT" : "HOLD");
    db.prepare("INSERT INTO held_sales(hold_no,type,customer_id,mode,discount,notes,items_json,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(no, type, x.customer_id || null, x.mode || "Retail", x.discount || 0, x.notes || "", JSON.stringify(x.items), x.actorId || null, now());
    audit(x.actorId, type === "QUOTATION" ? "QUOTATION_CREATED" : "SALE_HELD", "held_sale", null, { hold_no: no });
    return { hold_no: no };
  });
  ipcMain.handle("heldSales:get", (_, id) => {
    const row = db.prepare("SELECT h.*, COALESCE(c.shop_name,c.name) customer_name FROM held_sales h LEFT JOIN customers c ON c.id=h.customer_id WHERE h.id=?").get(id);
    if (!row) return null;
    return { ...row, items: JSON.parse(row.items_json) };
  });
  ipcMain.handle("heldSales:delete", (_, id) => { db.prepare("DELETE FROM held_sales WHERE id=?").run(id); return true; });

  // ---- Sales Returns (Refund or Exchange; Section 22 — instant post) --------
  ipcMain.handle("salesReturns:list", () => db.prepare(`
    SELECT sr.*, s.invoice_no original_invoice, COALESCE(c.shop_name,c.name) customer_name
    FROM sales_returns sr JOIN sales s ON s.id=sr.sale_id LEFT JOIN customers c ON c.id=sr.customer_id
    ORDER BY sr.id DESC LIMIT 200`).all());
  ipcMain.handle("salesReturns:create", (_, x) => {
    requirePermission(x.actorId, "sales.return");
    const tx = db.transaction(v => {
      const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(v.sale_id);
      if (!sale) throw new Error("Original sale not found");
      let total = 0;
      const rItem = db.prepare("INSERT INTO sales_return_items(return_id,sale_item_id,product_id,quantity,rate,amount,batch_ref) VALUES(?,?,?,?,?,?,?)");
      const no = nextNo("SR");
      const ret = db.prepare("INSERT INTO sales_returns(return_no,sale_id,customer_id,return_type,total,reason,refund_cash,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .run(no, v.sale_id, sale.customer_id, v.returnType || "Refund", 0, v.reason || "", 0, v.actorId || null, now());
      for (const i of v.items) {
        const si = db.prepare("SELECT * FROM sale_items WHERE id=?").get(i.sale_item_id);
        if (!si) throw new Error("Original sale item not found");
        const already = si.returned_quantity || 0;
        if (already + Number(i.quantity) > si.quantity) throw new Error(`Return quantity exceeds sold quantity for item #${si.id}`);
        db.prepare("UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id=?").run(i.quantity, si.id);
        const amount = Number(i.quantity) * si.rate;
        total += amount;
        rItem.run(ret.lastInsertRowid, si.id, si.product_id, i.quantity, si.rate, amount, i.batch_ref || null);
        applyStock(si.product_id, sale.location_id, Number(i.quantity), 0, "SALES_RETURN", no, v.reason || "Sales return", v.actorId);
      }
      db.prepare("UPDATE sales_returns SET total=? WHERE id=?").run(total, ret.lastInsertRowid);
      if (sale.customer_id) {
        const outstanding = db.prepare("SELECT COALESCE(opening_balance,0)+COALESCE((SELECT SUM(direction*amount) FROM customer_transactions t WHERE t.customer_id=?),0) v FROM customers WHERE id=?").get(sale.customer_id, sale.customer_id).v;
        const reduceReceivable = Math.max(0, Math.min(total, outstanding));
        if (reduceReceivable > 0)
          db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
            .run(sale.customer_id, "SALES_RETURN", -1, reduceReceivable, no, v.reason || "Sales return", v.actorId || null, now());
      }
      if (v.refundCash) { cashTx("OUT", "REFUND", total, no, "Sales return refund", v.actorId); db.prepare("UPDATE sales_returns SET refund_cash=? WHERE id=?").run(total, ret.lastInsertRowid); }
      audit(v.actorId, "CREATE", "sales_return", ret.lastInsertRowid, { return_no: no, total, returnType: v.returnType });
      return { id: ret.lastInsertRowid, return_no: no, total };
    });
    return tx(x);
  });

  // ---- Purchases -----------------------------------------------------------
  ipcMain.handle("purchases:list", () => db.prepare(`SELECT p.*,s.name supplier_name,po.po_no FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN po_orders po ON po.id=p.po_id ORDER BY p.id DESC LIMIT 200`).all());
  ipcMain.handle("purchases:get", (_, id) => ({
    purchase: db.prepare("SELECT p.*,s.name supplier_name,s.phone supplier_phone,po.po_no FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN po_orders po ON po.id=p.po_id WHERE p.id=?").get(id),
    items: db.prepare("SELECT pi.*,p.name product_name,p.name_urdu,p.package_unit FROM purchase_items pi JOIN products p ON p.id=pi.product_id WHERE pi.purchase_id=?").all(id)
  }));
  const createPurchaseTx = db.transaction((v) => {
    if (!v.items?.length) throw new Error("No items in purchase");
    let subtotal = 0;
    for (const i of v.items) subtotal += Number(i.quantity) * Number(i.rate);
    const discount = Number(v.discount || 0);
    const tax = Number(v.tax || 0);
    const grandTotal = Math.max(0, subtotal - discount + tax);
    const paid = Math.min(Number(v.paid || 0), grandTotal);
    const loc = v.location_id || defaultLocationId();
    const no = nextNo(settingsGet().invoice_prefix_purchase || "PUR");
    const purchase = db.prepare(`INSERT INTO purchases(invoice_no,supplier_id,po_id,location_id,subtotal,discount,tax,total,paid,balance,payment_method,notes,purchase_date,created_at,user_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(no, v.supplier_id || null, v.po_id || null, loc, subtotal, discount, tax, grandTotal, paid, grandTotal - paid, v.payment_method || "Cash", v.notes || "", today(), now(), v.actorId || null);
    const item = db.prepare("INSERT INTO purchase_items(purchase_id,product_id,quantity,rate,amount) VALUES(?,?,?,?,?)");
    for (const i of v.items) {
      const qty = Number(i.quantity), rate = Number(i.rate);
      item.run(purchase.lastInsertRowid, i.product_id, qty, rate, qty * rate);
      applyStock(i.product_id, loc, qty, rate, "PURCHASE", no, "Purchase", v.actorId);
      db.prepare("UPDATE products SET purchase_price=? WHERE id=?").run(rate, i.product_id); // latest cost shown on product card
    }
    const balance = grandTotal - paid;
    if (v.supplier_id && balance > 0)
      db.prepare("INSERT INTO supplier_transactions(supplier_id,type,direction,amount,reference,note,payment_method,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .run(v.supplier_id, "PURCHASE_CREDIT", 1, balance, no, "Credit purchase", v.payment_method, v.actorId || null, now());
    if (paid > 0 && (v.payment_method === "Cash" || v.payment_method === "Partial")) cashTx("OUT", "PURCHASE", paid, no, "Purchase", v.actorId);
    audit(v.actorId, "CREATE", "purchase", purchase.lastInsertRowid, { invoice_no: no, total: grandTotal, paid, balance });
    return { id: purchase.lastInsertRowid, invoice_no: no, total: grandTotal, paid, balance };
  });
  ipcMain.handle("purchases:create", (_, x) => { requirePermission(x.actorId, "purchase.create"); return createPurchaseTx(x); });

  // ---- Purchase Orders (draft -> sent -> received -> converts to a Purchase) --
  ipcMain.handle("po:list", () => db.prepare(`SELECT po.*,s.name supplier_name FROM po_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id ORDER BY po.id DESC LIMIT 200`).all());
  ipcMain.handle("po:get", (_, id) => ({
    po: db.prepare("SELECT po.*,s.name supplier_name FROM po_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?").get(id),
    items: db.prepare("SELECT poi.*,p.name product_name FROM po_items poi JOIN products p ON p.id=poi.product_id WHERE poi.po_id=?").all(id)
  }));
  ipcMain.handle("po:create", (_, x) => {
    requirePermission(x.actorId, "purchase.create");
    const tx = db.transaction(v => {
      const no = nextNo("PO");
      const po = db.prepare("INSERT INTO po_orders(po_no,supplier_id,location_id,status,expected_date,notes,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(no, v.supplier_id || null, v.location_id || defaultLocationId(), "DRAFT", v.expected_date || null, v.notes || "", v.actorId || null, now());
      const item = db.prepare("INSERT INTO po_items(po_id,product_id,quantity,rate) VALUES(?,?,?,?)");
      for (const i of v.items) item.run(po.lastInsertRowid, i.product_id, i.quantity, i.rate);
      audit(v.actorId, "CREATE", "po_order", po.lastInsertRowid, { po_no: no });
      return { id: po.lastInsertRowid, po_no: no };
    });
    return tx(x);
  });
  ipcMain.handle("po:updateStatus", (_, x) => {
    requirePermission(x.actorId, "purchase.edit");
    const po = db.prepare("SELECT * FROM po_orders WHERE id=?").get(x.id);
    if (!po) throw new Error("Purchase order not found");
    if (!["DRAFT", "SENT", "CANCELLED"].includes(x.status)) throw new Error("Invalid status transition");
    db.prepare("UPDATE po_orders SET status=? WHERE id=?").run(x.status, x.id);
    audit(x.actorId, "PO_STATUS_CHANGED", "po_order", x.id, { status: x.status });
    return true;
  });
  ipcMain.handle("po:receive", (_, x) => {
    requirePermission(x.actorId, "purchase.create");
    const tx = db.transaction(v => {
      const po = db.prepare("SELECT * FROM po_orders WHERE id=?").get(v.po_id);
      if (!po) throw new Error("Purchase order not found");
      if (po.status === "RECEIVED" || po.status === "CANCELLED") throw new Error(`Purchase order is ${po.status.toLowerCase()}`);
      const purchaseItems = [];
      for (const line of v.items) {
        const poItem = db.prepare("SELECT * FROM po_items WHERE id=?").get(line.po_item_id);
        if (!poItem) throw new Error("Purchase order item not found");
        const remaining = poItem.quantity - (poItem.received_quantity || 0);
        if (Number(line.quantity) > remaining) throw new Error(`Received quantity exceeds ordered quantity for item #${poItem.id}`);
        db.prepare("UPDATE po_items SET received_quantity = received_quantity + ? WHERE id=?").run(line.quantity, poItem.id);
        purchaseItems.push({ product_id: poItem.product_id, quantity: line.quantity, rate: line.rate ?? poItem.rate });
      }
      const purchase = createPurchaseTx({
        supplier_id: po.supplier_id, po_id: po.id, location_id: po.location_id,
        payment_method: v.payment_method || "Cash", paid: v.paid || 0, notes: `From ${po.po_no}`,
        items: purchaseItems, actorId: v.actorId,
      });
      const items = db.prepare("SELECT * FROM po_items WHERE po_id=?").all(po.id);
      const fullyReceived = items.every((i) => (i.received_quantity || 0) >= i.quantity - 0.0001);
      const newStatus = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
      db.prepare("UPDATE po_orders SET status=? WHERE id=?").run(newStatus, po.id);
      db.prepare("INSERT INTO notifications(type,title,body,entity,entity_id,severity,created_at) VALUES(?,?,?,?,?,?,?)")
        .run("PO_STATUS", `${po.po_no} ${newStatus === "RECEIVED" ? "fully received" : "partially received"}`, `Converted into purchase ${purchase.invoice_no}`, "po_order", po.id, "info", now());
      return { ...purchase, po_status: newStatus };
    });
    return tx(x);
  });

  // ---- Purchase Returns (with credit note; Section 23 — instant post) -------
  ipcMain.handle("purchaseReturns:list", () => db.prepare(`
    SELECT pr.*, p.invoice_no original_invoice, s.name supplier_name
    FROM purchase_returns pr JOIN purchases p ON p.id=pr.purchase_id LEFT JOIN suppliers s ON s.id=pr.supplier_id
    ORDER BY pr.id DESC LIMIT 200`).all());
  ipcMain.handle("purchaseReturns:create", (_, x) => {
    requirePermission(x.actorId, "purchase.return");
    const tx = db.transaction(v => {
      const purchase = db.prepare("SELECT * FROM purchases WHERE id=?").get(v.purchase_id);
      if (!purchase) throw new Error("Original purchase not found");
      let total = 0;
      const no = nextNo("PR");
      const creditNoteNo = nextNo("CN");
      const rItem = db.prepare("INSERT INTO purchase_return_items(return_id,purchase_item_id,product_id,quantity,rate,amount,batch_ref) VALUES(?,?,?,?,?,?,?)");
      const ret = db.prepare("INSERT INTO purchase_returns(return_no,purchase_id,supplier_id,total,reason,credit_note_no,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(no, v.purchase_id, purchase.supplier_id, 0, v.reason || "", creditNoteNo, v.actorId || null, now());
      for (const i of v.items) {
        const pi = db.prepare("SELECT * FROM purchase_items WHERE id=?").get(i.purchase_item_id);
        if (!pi) throw new Error("Original purchase item not found");
        const already = pi.returned_quantity || 0;
        if (already + Number(i.quantity) > pi.quantity) throw new Error(`Return quantity exceeds purchased quantity for item #${pi.id}`);
        db.prepare("UPDATE purchase_items SET returned_quantity = returned_quantity + ? WHERE id=?").run(i.quantity, pi.id);
        const amount = Number(i.quantity) * pi.rate;
        total += amount;
        rItem.run(ret.lastInsertRowid, pi.id, pi.product_id, i.quantity, pi.rate, amount, i.batch_ref || null);
        applyStock(pi.product_id, purchase.location_id, -Number(i.quantity), 0, "PURCHASE_RETURN", no, v.reason || "Purchase return", v.actorId);
      }
      db.prepare("UPDATE purchase_returns SET total=? WHERE id=?").run(total, ret.lastInsertRowid);
      if (purchase.supplier_id)
        db.prepare("INSERT INTO supplier_transactions(supplier_id,type,direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(purchase.supplier_id, "PURCHASE_RETURN", -1, total, no, v.reason || "Purchase return", v.actorId || null, now());
      audit(v.actorId, "CREATE", "purchase_return", ret.lastInsertRowid, { return_no: no, total, credit_note_no: creditNoteNo });
      return { id: ret.lastInsertRowid, return_no: no, total, credit_note_no: creditNoteNo };
    });
    return tx(x);
  });

  // ---- Payments (customer receipts / supplier payments) ---------------------
  ipcMain.handle("payments:add", (_, x) => {
    requirePermission(x.actorId, x.type === "customer" ? "customers.payment" : "suppliers.payment");
    const tx = db.transaction(v => {
      const amt = Number(v.amount || 0);
      if (amt <= 0) throw new Error("Amount must be greater than zero");
      const no = nextNo("PAY");
      if (v.type === "customer") {
        db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,payment_method,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .run(v.entity_id, "PAYMENT", -1, amt, no, v.note || "Payment received", v.payment_method || "Cash", v.actorId || null, now());
        if (v.payment_method === "Cash") cashTx("IN", "CUSTOMER_PAYMENT", amt, no, v.note || "Customer payment", v.actorId);
      } else {
        db.prepare("INSERT INTO supplier_transactions(supplier_id,type,direction,amount,reference,note,payment_method,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .run(v.entity_id, "PAYMENT", -1, amt, no, v.note || "Payment made", v.payment_method || "Cash", v.actorId || null, now());
        if (v.payment_method === "Cash") cashTx("OUT", "SUPPLIER_PAYMENT", amt, no, v.note || "Supplier payment", v.actorId);
      }
      audit(v.actorId, "CREATE", v.type === "customer" ? "customer_payment" : "supplier_payment", v.entity_id, { amount: amt, reference: no });
      return { reference: no };
    });
    return tx(x);
  });

  // ---- Expenses / Recurring / Budgets ---------------------------------------
  ipcMain.handle("expenses:list", () => db.prepare("SELECT * FROM expenses ORDER BY id DESC LIMIT 300").all());
  ipcMain.handle("expenses:add", (_, x) => {
    requirePermission(x.actorId, "expenses.create");
    const tx = db.transaction(v => {
      const no = nextNo("EXP");
      const r = db.prepare("INSERT INTO expenses(expense_no,title,category,amount,payment_method,paid_by,receipt_path,note,expense_date,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
        .run(no, v.title, v.category || "Miscellaneous", v.amount || 0, v.payment_method || "Cash", v.paid_by || "", v.receipt_path || "", v.note || "", v.expense_date || today(), v.actorId || null, now());
      if ((v.payment_method || "Cash") === "Cash" && v.amount > 0) cashTx("OUT", "EXPENSE", Number(v.amount), no, v.title, v.actorId);
      audit(v.actorId, "CREATE", "expense", r.lastInsertRowid, { title: v.title, amount: v.amount });
      return r.lastInsertRowid;
    });
    return tx(x);
  });
  ipcMain.handle("recurringExpenses:list", () => db.prepare("SELECT * FROM recurring_expenses ORDER BY next_run_date").all());
  ipcMain.handle("recurringExpenses:save", (_, x) => {
    if (x.id) db.prepare("UPDATE recurring_expenses SET title=?,category=?,amount=?,payment_method=?,frequency=?,day_of_month=?,status=? WHERE id=?")
      .run(x.title, x.category, x.amount, x.payment_method || "Cash", x.frequency || "MONTHLY", x.day_of_month || 1, x.status || "active", x.id);
    else db.prepare("INSERT INTO recurring_expenses(title,category,amount,payment_method,frequency,day_of_month,next_run_date,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(x.title, x.category, x.amount, x.payment_method || "Cash", x.frequency || "MONTHLY", x.day_of_month || 1, x.next_run_date || today(), now());
    return db.prepare("SELECT * FROM recurring_expenses ORDER BY next_run_date").all();
  });
  ipcMain.handle("recurringExpenses:runDue", () => { runDueRecurringExpenses(); return true; });
  ipcMain.handle("budgets:list", (_, periodMonth) => db.prepare("SELECT * FROM budgets WHERE period_month=?").all(periodMonth));
  ipcMain.handle("budgets:set", (_, x) => { db.prepare("INSERT INTO budgets(category,period_month,amount) VALUES(?,?,?) ON CONFLICT(category,period_month) DO UPDATE SET amount=excluded.amount").run(x.category, x.period_month, x.amount); return true; });
  ipcMain.handle("budgets:summary", (_, periodMonth) => {
    const budgets = db.prepare("SELECT * FROM budgets WHERE period_month=?").all(periodMonth);
    const spent = db.prepare("SELECT category, COALESCE(SUM(amount),0) v FROM expenses WHERE strftime('%Y-%m',expense_date)=? GROUP BY category").all(periodMonth);
    const spentMap = Object.fromEntries(spent.map(s => [s.category, s.v]));
    const categories = new Set([...budgets.map(b => b.category), ...spent.map(s => s.category)]);
    return [...categories].map(category => ({
      category,
      budget: budgets.find(b => b.category === category)?.amount || 0,
      spent: spentMap[category] || 0,
    })).sort((a, b) => a.category.localeCompare(b.category));
  });

  ipcMain.handle("expenseCategories:list", () => db.prepare("SELECT * FROM expense_categories ORDER BY sort_order,name").all());
  ipcMain.handle("expenseCategories:save", (_, x) => {
    if (x.id) db.prepare("UPDATE expense_categories SET name=?,status=? WHERE id=?").run(x.name, x.status || "active", x.id);
    else db.prepare("INSERT INTO expense_categories(name,status,sort_order) VALUES(?,?,?)").run(x.name, "active", 99);
    return db.prepare("SELECT * FROM expense_categories ORDER BY sort_order,name").all();
  });

  // ---- Cash register (Section 7/26/27/69) --------------------------------
  ipcMain.handle("cash:current", () => {
    const reg = currentOpenRegister();
    if (!reg) return null;
    const { cashIn, cashOut } = registerTotals(reg.id);
    const txs = db.prepare("SELECT * FROM cash_transactions WHERE register_id=? ORDER BY id DESC").all(reg.id);
    return { ...reg, cashIn, cashOut, expected: reg.opening_cash + cashIn - cashOut, transactions: txs };
  });
  ipcMain.handle("cash:open", (_, x) => {
    requirePermission(x.actorId, "cash.manage");
    if (currentOpenRegister()) throw new Error("A cash register is already open. Close it before opening a new one.");
    const r = db.prepare("INSERT INTO cash_registers(business_date,opening_cash,opened_by,opened_at,status) VALUES(?,?,?,?,?)")
      .run(today(), Number(x.opening_cash || 0), x.actorId || null, now(), "OPEN");
    audit(x.actorId, "CASH_REGISTER_OPENED", "cash_register", r.lastInsertRowid, { opening_cash: x.opening_cash });
    return r.lastInsertRowid;
  });
  ipcMain.handle("cash:transaction", (_, x) => {
    requirePermission(x.actorId, "cash.manage");
    const reg = currentOpenRegister();
    if (!reg) throw new Error("No cash register is open");
    const category = x.category || (x.direction === "IN" ? "OTHER_IN" : "OTHER_OUT");
    db.prepare("INSERT INTO cash_transactions(register_id,direction,category,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(reg.id, x.direction, category, Number(x.amount), "MANUAL", x.note || "", x.actorId || null, now());
    audit(x.actorId, x.direction === "OUT" && category === "WITHDRAWAL" ? "CASH_WITHDRAWAL" : "CASH_ADJUSTMENT", "cash_register", reg.id, { direction: x.direction, category, amount: x.amount, note: x.note });
    return true;
  });
  ipcMain.handle("cash:close", (_, x) => {
    requirePermission(x.actorId, "cash.manage");
    const tx = db.transaction(v => {
      const reg = currentOpenRegister();
      if (!reg) throw new Error("No cash register is open");
      const { cashIn, cashOut } = registerTotals(reg.id);
      const expected = reg.opening_cash + cashIn - cashOut;
      const actual = Number(v.actual_cash || 0);
      const difference = Math.round((actual - expected) * 100) / 100;
      db.prepare("UPDATE cash_registers SET status='CLOSED',expected_cash=?,actual_cash=?,difference=?,closing_notes=?,closed_by=?,closed_at=? WHERE id=?")
        .run(expected, actual, difference, v.notes || "", v.actorId || null, now(), reg.id);
      audit(v.actorId, "CASH_REGISTER_CLOSED", "cash_register", reg.id, { expected, actual, difference });
      return { expected, actual, difference, status: difference === 0 ? "MATCHED" : difference > 0 ? "OVER" : "SHORT" };
    });
    return tx(x);
  });

  // ---- Bank accounts / Petty cash / Cash transfer ---------------------------
  ipcMain.handle("bank:accountsList", () => db.prepare(`
    SELECT b.*, COALESCE(b.opening_balance,0)+COALESCE((SELECT SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END) FROM bank_transactions t WHERE t.account_id=b.id),0) balance
    FROM bank_accounts b WHERE b.status='active' ORDER BY b.name`).all());
  ipcMain.handle("bank:accountSave", (_, x) => {
    if (x.id) {
      const existing = db.prepare("SELECT * FROM bank_accounts WHERE id=?").get(x.id);
      const merged = { ...existing, ...x };
      db.prepare("UPDATE bank_accounts SET name=?,account_number=?,bank_name=?,status=? WHERE id=?")
        .run(merged.name, merged.account_number || "", merged.bank_name || "", merged.status || "active", x.id);
    } else {
      db.prepare("INSERT INTO bank_accounts(name,account_number,bank_name,opening_balance,created_at) VALUES(?,?,?,?,?)")
        .run(x.name, x.account_number || "", x.bank_name || "", x.opening_balance || 0, now());
    }
    return true;
  });
  ipcMain.handle("bank:transactionsList", (_, accountId) => db.prepare("SELECT * FROM bank_transactions WHERE account_id=? ORDER BY id DESC").all(accountId));
  ipcMain.handle("petty:list", () => db.prepare("SELECT * FROM petty_cash ORDER BY id DESC LIMIT 300").all());
  ipcMain.handle("petty:balance", () => db.prepare("SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN amount ELSE -amount END),0) v FROM petty_cash").get().v);

  ipcMain.handle("cash:transfer", (_, x) => {
    requirePermission(x.actorId, "cash.manage");
    const tx = db.transaction(v => {
      const no = nextNo("CT");
      const amt = Number(v.amount);
      if (amt <= 0) throw new Error("Amount must be greater than zero");
      const legOut = (kind) => {
        if (kind === "CASH") cashTx("OUT", "CASH_TRANSFER", amt, no, v.note || "Cash transfer", v.actorId);
        else if (kind === "BANK") db.prepare("INSERT INTO bank_transactions(account_id,direction,category,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(v.from_account_id, "OUT", "TRANSFER_OUT", amt, no, v.note || "", v.actorId || null, now());
        else if (kind === "PETTY") db.prepare("INSERT INTO petty_cash(direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?)").run("OUT", amt, no, v.note || "", v.actorId || null, now());
      };
      const legIn = (kind) => {
        if (kind === "CASH") cashTx("IN", "CASH_TRANSFER", amt, no, v.note || "Cash transfer", v.actorId);
        else if (kind === "BANK") db.prepare("INSERT INTO bank_transactions(account_id,direction,category,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(v.to_account_id, "IN", "TRANSFER_IN", amt, no, v.note || "", v.actorId || null, now());
        else if (kind === "PETTY") db.prepare("INSERT INTO petty_cash(direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?)").run("IN", amt, no, v.note || "", v.actorId || null, now());
      };
      if ((v.from === "CASH" || v.to === "CASH") && !currentOpenRegister()) throw new Error("No cash register is open");
      legOut(v.from);
      legIn(v.to);
      audit(v.actorId, "CASH_TRANSFER", "transfer", null, { from: v.from, to: v.to, amount: amt, reference: no });
      return { reference: no };
    });
    return tx(x);
  });

  // ---- Payment methods / Permissions -----------------------------------------
  ipcMain.handle("paymentMethods:list", () => db.prepare("SELECT * FROM payment_methods ORDER BY sort_order,name").all());
  ipcMain.handle("paymentMethods:save", (_, x) => {
    if (x.id) db.prepare("UPDATE payment_methods SET name=?,status=? WHERE id=?").run(x.name, x.status || "active", x.id);
    else db.prepare("INSERT INTO payment_methods(name,status,sort_order) VALUES(?,?,?)").run(x.name, "active", 99);
    return db.prepare("SELECT * FROM payment_methods ORDER BY sort_order,name").all();
  });

  ipcMain.handle("permissions:definitions", () => PERMISSIONS);
  ipcMain.handle("permissions:forRole", (_, role) => db.prepare("SELECT permission,allowed FROM role_permissions WHERE role=?").all(role));
  ipcMain.handle("permissions:matrix", () => ({
    permissions: PERMISSIONS,
    roles: Object.keys(DEFAULT_ROLE_PERMISSIONS),
    rows: db.prepare("SELECT role,permission,allowed FROM role_permissions").all(),
  }));
  ipcMain.handle("permissions:update", (_, x) => {
    requirePermission(x.actorId, "users.manage");
    if (x.role === "Owner" && x.permission === "users.manage" && !x.allowed)
      throw new Error("Cannot revoke the Owner role's user-management permission — this would lock every administrator out of the permission matrix.");
    db.prepare("INSERT INTO role_permissions(role,permission,allowed) VALUES(?,?,?) ON CONFLICT(role,permission) DO UPDATE SET allowed=excluded.allowed")
      .run(x.role, x.permission, x.allowed ? 1 : 0);
    audit(x.actorId, "PERMISSION_CHANGED", "role", null, { role: x.role, permission: x.permission, allowed: x.allowed });
    return true;
  });
  ipcMain.handle("permissions:check", (_, role, permission) => {
    const row = db.prepare("SELECT allowed FROM role_permissions WHERE role=? AND permission=?").get(role, permission);
    return !!row?.allowed;
  });

  // ---- Notifications ----------------------------------------------------
  ipcMain.handle("notifications:list", (_, limit) => db.prepare("SELECT * FROM notifications ORDER BY is_read ASC, id DESC LIMIT ?").all(limit || 50));
  ipcMain.handle("notifications:unreadCount", () => db.prepare("SELECT COUNT(*) c FROM notifications WHERE is_read=0").get().c);
  ipcMain.handle("notifications:markRead", (_, id) => { db.prepare("UPDATE notifications SET is_read=1 WHERE id=?").run(id); return true; });
  ipcMain.handle("notifications:markAllRead", () => { db.prepare("UPDATE notifications SET is_read=1 WHERE is_read=0").run(); return true; });
  ipcMain.handle("notifications:refresh", () => { generateNotifications(); return db.prepare("SELECT * FROM notifications ORDER BY is_read ASC, id DESC LIMIT 50").all(); });

  // ---- Dashboard & Reports (Section 44 / 30) ------------------------------
  function computeSummary(from, to) {
    const sales = db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE sale_date BETWEEN ? AND ? AND status='COMPLETED'").get(from, to).v;
    const salesReturns = db.prepare("SELECT COALESCE(SUM(sr.total),0) v FROM sales_returns sr JOIN sales s ON s.id=sr.sale_id WHERE s.sale_date BETWEEN ? AND ?").get(from, to).v;
    const purchases = db.prepare("SELECT COALESCE(SUM(total),0) v FROM purchases WHERE purchase_date BETWEEN ? AND ?").get(from, to).v;
    const purchaseReturns = db.prepare("SELECT COALESCE(SUM(pr.total),0) v FROM purchase_returns pr JOIN purchases p ON p.id=pr.purchase_id WHERE p.purchase_date BETWEEN ? AND ?").get(from, to).v;
    const expenses = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date BETWEEN ? AND ?").get(from, to).v;
    const cogs = db.prepare("SELECT COALESCE(SUM(cost*quantity),0) v FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.sale_date BETWEEN ? AND ? AND s.status='COMPLETED'").get(from, to).v;
    const netSales = sales - salesReturns;
    const grossProfit = netSales - cogs;
    const netProfit = grossProfit - expenses;
    const cashSales = db.prepare("SELECT COALESCE(SUM(paid),0) v FROM sales WHERE sale_date BETWEEN ? AND ? AND payment_method='Cash' AND status='COMPLETED'").get(from, to).v;
    const creditSales = db.prepare("SELECT COALESCE(SUM(balance),0) v FROM sales WHERE sale_date BETWEEN ? AND ? AND status='COMPLETED'").get(from, to).v;
    const retailSales = db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE sale_date BETWEEN ? AND ? AND mode='Retail' AND status='COMPLETED'").get(from, to).v;
    const wholesaleSales = db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE sale_date BETWEEN ? AND ? AND mode='Wholesale' AND status='COMPLETED'").get(from, to).v;
    return {
      sales, salesReturns, netSales, purchases, purchaseReturns, expenses, cogs,
      grossProfit, netProfit, grossMarginPct: netSales ? (grossProfit / netSales) * 100 : 0, netMarginPct: netSales ? (netProfit / netSales) * 100 : 0,
      cashSales, creditSales, retailSales, wholesaleSales
    };
  }
  function previousPeriod(from, to) {
    const fromD = new Date(from), toD = new Date(to);
    const lengthDays = Math.round((toD - fromD) / 86400000) + 1;
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (lengthDays - 1));
    return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
  }
  function pctDelta(curr, prev) { return prev ? ((curr - prev) / Math.abs(prev)) * 100 : (curr ? 100 : 0); }

  ipcMain.handle("dashboard", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const sales = db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE sale_date=? AND status='COMPLETED'").get(today()).v;
    const salesYesterday = db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE sale_date=? AND status='COMPLETED'").get(yesterday).v;
    const purchases = db.prepare("SELECT COALESCE(SUM(total),0) v FROM purchases WHERE purchase_date=?").get(today()).v;
    const expensesToday = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE expense_date=?").get(today()).v;
    const cogs = db.prepare("SELECT COALESCE(SUM(cost*quantity),0) v FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.sale_date=? AND s.status='COMPLETED'").get(today()).v;
    const profit = sales - cogs;
    const low = db.prepare("SELECT name,name_urdu,stock,min_stock,package_unit FROM products WHERE status='active' AND stock<=min_stock ORDER BY stock").all();
    const receivables = db.prepare("SELECT COALESCE(SUM(balance),0) v FROM (SELECT COALESCE(opening_balance,0)+COALESCE((SELECT SUM(direction*amount) FROM customer_transactions t WHERE t.customer_id=c.id),0) balance FROM customers c)").get().v;
    const payables = db.prepare("SELECT COALESCE(SUM(balance),0) v FROM (SELECT COALESCE(opening_balance,0)+COALESCE((SELECT SUM(direction*amount) FROM supplier_transactions t WHERE t.supplier_id=s.id),0) balance FROM suppliers s)").get().v;
    const stockValue = db.prepare("SELECT COALESCE(SUM(stock*avg_cost),0) v FROM products WHERE status='active'").get().v;
    const reg = currentOpenRegister();
    const cashInHand = reg ? reg.opening_cash + registerTotals(reg.id).cashIn - registerTotals(reg.id).cashOut : null;
    const creditSalesToday = db.prepare("SELECT COALESCE(SUM(balance),0) v,COUNT(*) n FROM sales WHERE sale_date=? AND status='COMPLETED' AND balance>0").get(today());

    const trendDays = [];
    for (let i = 6; i >= 0; i--) trendDays.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const trendRows = db.prepare(`SELECT sale_date, COALESCE(SUM(total),0) v FROM sales WHERE status='COMPLETED' AND sale_date IN (${trendDays.map(() => "?").join(",")}) GROUP BY sale_date`).all(...trendDays);
    const trendMap = Object.fromEntries(trendRows.map((r) => [r.sale_date, r.v]));
    const trend = trendDays.map((d) => ({ date: d, total: trendMap[d] || 0 }));

    const paymentBreakdown = db.prepare("SELECT payment_method, COALESCE(SUM(total),0) v FROM sales WHERE sale_date=? AND status='COMPLETED' GROUP BY payment_method ORDER BY v DESC").all(today());

    const todaySummary = computeSummary(today(), today());
    const mix = { retailSales: todaySummary.retailSales, wholesaleSales: todaySummary.wholesaleSales, cashSales: todaySummary.cashSales, creditSales: todaySummary.creditSales };

    return {
      sales, salesDeltaPct: pctDelta(sales, salesYesterday), purchases, expenses: expensesToday, profit, low,
      receivables, payables, stockValue, cashInHand, registerOpen: !!reg,
      salesOnCredit: creditSalesToday.v, salesOnCreditCount: creditSalesToday.n,
      trend, paymentBreakdown, mix,
    };
  });

  ipcMain.handle("reports:summary", (_, range) => {
    const r = range || {};
    return computeSummary(r.from || "1900-01-01", r.to || "2999-12-31");
  });
  ipcMain.handle("reports:compare", (_, range) => {
    const from = range.from, to = range.to;
    const prev = previousPeriod(from, to);
    const current = computeSummary(from, to);
    const previous = computeSummary(prev.from, prev.to);
    return {
      current, previous,
      deltaPct: {
        sales: pctDelta(current.sales, previous.sales),
        netProfit: pctDelta(current.netProfit, previous.netProfit),
        expenses: pctDelta(current.expenses, previous.expenses),
        grossProfit: pctDelta(current.grossProfit, previous.grossProfit),
      },
    };
  });

  ipcMain.handle("reports:trend", (_, range) => {
    const from = range.from, to = range.to;
    const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    if (days > 0 && days <= 31) {
      const buckets = [];
      for (let i = 0; i < days; i++) buckets.push(new Date(new Date(from).getTime() + i * 86400000).toISOString().slice(0, 10));
      const rows = db.prepare("SELECT sale_date, COALESCE(SUM(total),0) v FROM sales WHERE status='COMPLETED' AND sale_date BETWEEN ? AND ? GROUP BY sale_date").all(from, to);
      const map = Object.fromEntries(rows.map((r) => [r.sale_date, r.v]));
      return { granularity: "day", points: buckets.map((d) => ({ label: d, total: map[d] || 0 })) };
    }
    const rows = db.prepare("SELECT strftime('%Y-%m',sale_date) ym, COALESCE(SUM(total),0) v FROM sales WHERE status='COMPLETED' AND sale_date BETWEEN ? AND ? GROUP BY ym ORDER BY ym").all(from, to);
    return { granularity: "month", points: rows.map((r) => ({ label: r.ym, total: r.v })) };
  });

  ipcMain.handle("reports:topProducts", (_, range) => {
    const from = range.from, to = range.to, limit = range.limit || 10;
    return db.prepare(`
      SELECT p.id, p.name, p.name_urdu, p.package_unit, SUM(si.quantity) qty, SUM(si.amount) revenue
      FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id
      WHERE s.status='COMPLETED' AND s.sale_date BETWEEN ? AND ?
      GROUP BY p.id ORDER BY revenue DESC LIMIT ?`).all(from, to, limit);
  });

  ipcMain.handle("reports:inventory", (_, range) => {
    const from = (range && range.from) || "1900-01-01", to = (range && range.to) || "2999-12-31";
    const products = db.prepare(`
      SELECT p.id, p.name, p.name_urdu, c.name category_name, p.stock, p.avg_cost, p.min_stock, p.package_unit, (p.stock*p.avg_cost) value
      FROM products p LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.status='active' ORDER BY value DESC`).all();
    const totalValue = products.reduce((a, p) => a + p.value, 0);
    const lowCount = products.filter((p) => p.stock > 0 && p.stock <= p.min_stock).length;
    const outCount = products.filter((p) => p.stock <= 0).length;
    const soldRows = db.prepare(`
      SELECT si.product_id, SUM(si.quantity) qty FROM sale_items si JOIN sales s ON s.id=si.sale_id
      WHERE s.status='COMPLETED' AND s.sale_date BETWEEN ? AND ? GROUP BY si.product_id`).all(from, to);
    const soldMap = Object.fromEntries(soldRows.map((r) => [r.product_id, r.qty]));
    const fastMoving = [...soldRows].sort((a, b) => b.qty - a.qty).slice(0, 10)
      .map((r) => { const p = products.find((x) => x.id === r.product_id); return p ? { id: p.id, name: p.name, name_urdu: p.name_urdu, package_unit: p.package_unit, qty: r.qty } : null; })
      .filter(Boolean);
    const slowMoving = products.filter((p) => p.stock > 0 && !soldMap[p.id]).slice(0, 10)
      .map((p) => ({ id: p.id, name: p.name, name_urdu: p.name_urdu, package_unit: p.package_unit, stock: p.stock }));
    return { products, totalValue, totalProducts: products.length, lowCount, outCount, fastMoving, slowMoving };
  });

  ipcMain.handle("reports:customers", (_, range) => {
    const from = range.from, to = range.to;
    return db.prepare(`
      SELECT c.id, COALESCE(c.shop_name,c.name) name, c.customer_type,
        COALESCE(c.opening_balance,0)+COALESCE((SELECT SUM(direction*amount) FROM customer_transactions t WHERE t.customer_id=c.id),0) balance,
        COALESCE((SELECT SUM(total) FROM sales s WHERE s.customer_id=c.id AND s.status='COMPLETED' AND s.sale_date BETWEEN ? AND ?),0) totalPurchases,
        COALESCE((SELECT SUM(amount) FROM customer_transactions t WHERE t.customer_id=c.id AND t.type='PAYMENT' AND date(t.created_at) BETWEEN ? AND ?),0) totalPayments,
        (SELECT MAX(sale_date) FROM sales s WHERE s.customer_id=c.id AND s.status='COMPLETED') lastPurchaseDate
      FROM customers c WHERE c.status='active'
      ORDER BY totalPurchases DESC`).all(from, to, from, to);
  });

  ipcMain.handle("reports:suppliers", (_, range) => {
    const from = range.from, to = range.to;
    return db.prepare(`
      SELECT s.id, s.name, s.category,
        COALESCE(s.opening_balance,0)+COALESCE((SELECT SUM(direction*amount) FROM supplier_transactions t WHERE t.supplier_id=s.id),0) balance,
        COALESCE((SELECT SUM(total) FROM purchases p WHERE p.supplier_id=s.id AND p.purchase_date BETWEEN ? AND ?),0) totalPurchases,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions t WHERE t.supplier_id=s.id AND t.type='PAYMENT' AND date(t.created_at) BETWEEN ? AND ?),0) totalPayments,
        (SELECT MAX(purchase_date) FROM purchases p WHERE p.supplier_id=s.id) lastPurchaseDate
      FROM suppliers s WHERE s.status='active'
      ORDER BY totalPurchases DESC`).all(from, to, from, to);
  });

  ipcMain.handle("audit:list", (_, limit) => db.prepare("SELECT a.*,u.display_name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT ?").all(limit || 200));

  ipcMain.handle("app:info", () => ({ version: app.getVersion(), dataPath: app.getPath("userData") }));
  ipcMain.handle("backup:create", async () => {
    const out = await dialog.showSaveDialog(win, { title: "Backup ShopManager Database", defaultPath: `ShopManager-Backup-${today()}.db`, filters: [{ name: "SQLite Database", extensions: ["db"] }] });
    if (out.canceled) return null;
    db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(path.join(app.getPath("userData"), "shopmanager.db"), out.filePath);
    audit(null, "BACKUP_CREATED", "system", null, { path: out.filePath });
    return out.filePath;
  });
  ipcMain.handle("db:integrity", () => db.prepare("PRAGMA integrity_check").get());
  ipcMain.handle("backup:autoStatus", () => {
    const s = settingsGet();
    const backupsDir = path.join(app.getPath("userData"), "backups");
    const count = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter((f) => f.startsWith("ShopManager-Auto-")).length : 0;
    return { enabled: s.auto_backup_enabled !== "0", frequency: s.auto_backup_frequency || "Daily", lastBackupAt: s.last_backup_at || null, autoBackupCount: count };
  });
}

app.whenReady().then(() => {
  initDb();
  registerIpc();
  win = new BrowserWindow({
    width: 1500, height: 900, minWidth: 1100, minHeight: 700,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, "../dist/index.html"));
  win.on("closed", () => { win = null; });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
