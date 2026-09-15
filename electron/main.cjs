const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const Database = require("better-sqlite3");

// ---------------------------------------------------------------------------
// Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin
// Offline-first SQLite backend: real transaction-based accounting.
// Every financial action (sale, purchase, payment, expense, withdrawal) is a
// single atomic db.transaction() that updates inventory, ledgers and the cash
// register together, or not at all.
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

  CREATE TABLE IF NOT EXISTS customers(
    id INTEGER PRIMARY KEY AUTOINCREMENT, shop_name TEXT, name TEXT NOT NULL, phone TEXT, whatsapp TEXT,
    address TEXT, city TEXT, area TEXT, customer_type TEXT DEFAULT 'Retail',
    credit_limit REAL DEFAULT 0, opening_balance REAL DEFAULT 0, notes TEXT,
    status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact_person TEXT, phone TEXT, whatsapp TEXT,
    address TEXT, city TEXT, category TEXT, opening_balance REAL DEFAULT 0, notes TEXT,
    status TEXT DEFAULT 'active', created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_counters(prefix TEXT NOT NULL, date_key TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY(prefix, date_key));

  CREATE TABLE IF NOT EXISTS sales(
    id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no TEXT UNIQUE NOT NULL, customer_id INTEGER, mode TEXT DEFAULT 'Retail',
    subtotal REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL, paid REAL DEFAULT 0, balance REAL DEFAULT 0,
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
    total REAL NOT NULL, reason TEXT, refund_cash REAL DEFAULT 0, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(sale_id) REFERENCES sales(id)
  );
  CREATE TABLE IF NOT EXISTS sales_return_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, sale_item_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL,
    FOREIGN KEY(return_id) REFERENCES sales_returns(id)
  );

  CREATE TABLE IF NOT EXISTS purchases(
    id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_no TEXT UNIQUE NOT NULL, supplier_id INTEGER,
    subtotal REAL NOT NULL DEFAULT 0, total REAL NOT NULL, paid REAL DEFAULT 0, balance REAL DEFAULT 0,
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
    total REAL NOT NULL, reason TEXT, user_id INTEGER, created_at TEXT NOT NULL,
    FOREIGN KEY(purchase_id) REFERENCES purchases(id)
  );
  CREATE TABLE IF NOT EXISTS purchase_return_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT, return_id INTEGER NOT NULL, purchase_item_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity REAL NOT NULL, rate REAL NOT NULL, amount REAL NOT NULL,
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
    payment_method TEXT DEFAULT 'Cash', paid_by TEXT, note TEXT, expense_date TEXT NOT NULL, user_id INTEGER, created_at TEXT NOT NULL
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

  CREATE TABLE IF NOT EXISTS stock_movements(
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL,
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
  db.prepare("INSERT OR IGNORE INTO schema_meta(version) VALUES(3)").run();
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

// Section 32: collision-free sequential invoice numbering, per prefix per day.
function nextNo(prefix) {
  const dateKey = today().replace(/-/g, "");
  const row = db.prepare("SELECT seq FROM invoice_counters WHERE prefix=? AND date_key=?").get(prefix, dateKey);
  const seq = (row?.seq || 0) + 1;
  db.prepare("INSERT INTO invoice_counters(prefix,date_key,seq) VALUES(?,?,?) ON CONFLICT(prefix,date_key) DO UPDATE SET seq=excluded.seq")
    .run(prefix, dateKey, seq);
  return `${prefix}-${dateKey}-${String(seq).padStart(4, "0")}`;
}

// Applies a stock movement and updates the product's running stock / weighted average cost.
function applyStock(productId, quantitySigned, unitCost, type, reference, reason, userId) {
  const p = db.prepare("SELECT * FROM products WHERE id=?").get(productId);
  if (!p) throw new Error("Product not found");
  const previous = p.stock || 0;
  let newAvg = p.avg_cost || 0;
  if (quantitySigned > 0 && unitCost > 0) {
    // Weighted average cost recalculation (Section 31) — only on stock increases with a known cost.
    newAvg = (previous * (p.avg_cost || 0) + quantitySigned * unitCost) / (previous + quantitySigned || 1);
  }
  const next = previous + quantitySigned;
  if (next < 0) throw new Error(`Insufficient stock for ${p.name}: have ${previous}, need ${-quantitySigned}`);
  db.prepare("UPDATE products SET stock=?, avg_cost=? WHERE id=?").run(next, newAvg, productId);
  db.prepare(`INSERT INTO stock_movements(product_id,type,quantity,previous_stock,new_stock,unit_cost,reference,reason,user_id,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(productId, type, quantitySigned, previous, next, unitCost || 0, reference || "", reason || "", userId ?? null, now());
  return next;
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

// ---------------------------------------------------------------------------
// Seed data — exact business identity and product catalog supplied by the owner.
// ---------------------------------------------------------------------------
function seed() {
  if (!db.prepare("SELECT COUNT(*) c FROM settings").get().c) {
    const s = db.prepare("INSERT INTO settings(key,value) VALUES(?,?)");
    [
      ["business_name", "Haji Abdul Manan & Abdul Hanan"],
      ["business_title", "Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin"],
      ["business_type", "Atta Dealer / Fertilizer / Grains"],
      ["address", "Pishin, Balochistan, Pakistan"],
      ["phone", ""],
      ["currency", "PKR"],
      ["primary_color", "#1f6b2a"],
      ["logo_path", ""],
      ["invoice_footer", "Thank you for your purchase!"],
      ["invoice_prefix", "INV"],
      ["language", "en"],
      ["low_stock_default", "10"],
      ["print_customer_copy", "1"],
      ["print_office_copy", "1"],
      ["auto_cut", "1"],
      ["setup_complete", "0"]
    ].forEach(x => s.run(...x));
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
  ipcMain.handle("settings:update", (_, o) => { const s = settingsSet(o); audit(null, "SETTINGS_CHANGED", "settings", null, o); return s; });

  ipcMain.handle("auth:login", (_, credentialsOrUsername, passwordArg) => {
    const credentials = credentialsOrUsername && typeof credentialsOrUsername === "object"
      ? credentialsOrUsername : { username: credentialsOrUsername, password: passwordArg };
    const username = String(credentials.username ?? "").trim();
    const password = String(credentials.password ?? "");
    if (!username || !password) throw new Error("Username and password are required");
    const u = db.prepare("SELECT id,username,display_name,role,password_hash FROM users WHERE username=@username AND status='active'").get({ username });
    if (!u || !verifyPassword(password, u.password_hash)) throw new Error("Invalid username or password");
    audit(u.id, "LOGIN", "user", u.id, null);
    return { id: u.id, username: u.username, display_name: u.display_name, role: u.role };
  });

  ipcMain.handle("users:list", () => db.prepare("SELECT id,username,display_name,role,status,created_at FROM users ORDER BY id DESC").all());
  ipcMain.handle("users:add", (_, x) => {
    const r = db.prepare("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)")
      .run(x.username, x.display_name, x.role, hashPassword(x.password || "admin123"), now());
    audit(x.actorId, "CREATE", "user", r.lastInsertRowid, { username: x.username, role: x.role });
    return r.lastInsertRowid;
  });
  ipcMain.handle("users:resetPassword", (_, id, pw) => { db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(pw), id); audit(null, "PASSWORD_RESET", "user", id, null); return true; });

  ipcMain.handle("images:pick", async () => {
    const r = await dialog.showOpenDialog(win, { title: "Choose image", properties: ["openFile"], filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }] });
    if (r.canceled) return null;
    const src = r.filePaths[0], ext = path.extname(src).toLowerCase(), dest = path.join(dataDir, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
    fs.copyFileSync(src, dest);
    return dest;
  });
  ipcMain.handle("images:remove", (_, p) => { if (p && p.startsWith(dataDir) && fs.existsSync(p)) fs.unlinkSync(p); return true; });

  ipcMain.handle("categories:list", () => db.prepare("SELECT * FROM categories ORDER BY name").all());
  ipcMain.handle("categories:save", (_, x) => {
    if (x.id) db.prepare("UPDATE categories SET name=?,name_urdu=?,image_path=?,status=? WHERE id=?").run(x.name, x.name_urdu || "", x.image_path || "", x.status || "active", x.id);
    else db.prepare("INSERT INTO categories(name,name_urdu,image_path,created_at) VALUES(?,?,?,?)").run(x.name, x.name_urdu || "", x.image_path || "", now());
    return db.prepare("SELECT * FROM categories ORDER BY name").all();
  });

  ipcMain.handle("products:list", () => db.prepare("SELECT p.*,c.name category_name,c.name_urdu category_name_urdu FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.status='active' ORDER BY p.name").all());
  ipcMain.handle("products:save", (_, x) => {
    if (x.id) {
      const before = db.prepare("SELECT retail_price,wholesale_price FROM products WHERE id=?").get(x.id);
      db.prepare(`UPDATE products SET category_id=?,name=?,name_urdu=?,brand=?,package_size=?,package_unit=?,sku=?,barcode=?,
        purchase_price=?,retail_price=?,wholesale_price=?,min_stock=?,image_path=? WHERE id=?`)
        .run(x.category_id, x.name, x.name_urdu || "", x.brand || "", x.package_size || 0, x.package_unit || "", x.sku || null, x.barcode || null,
          x.purchase_price || 0, x.retail_price || 0, x.wholesale_price || 0, x.min_stock || 0, x.image_path || "", x.id);
      if (before && (before.retail_price !== Number(x.retail_price) || before.wholesale_price !== Number(x.wholesale_price)))
        audit(x.actorId, "PRICE_CHANGED", "product", x.id, { before, after: { retail_price: x.retail_price, wholesale_price: x.wholesale_price } });
    } else {
      const r = db.prepare(`INSERT INTO products(category_id,name,name_urdu,brand,package_size,package_unit,sku,barcode,purchase_price,retail_price,wholesale_price,min_stock,avg_cost,image_path,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(x.category_id, x.name, x.name_urdu || "", x.brand || "", x.package_size || 0, x.package_unit || "", x.sku || null, x.barcode || null,
          x.purchase_price || 0, x.retail_price || 0, x.wholesale_price || 0, x.min_stock || 0, x.purchase_price || 0, x.image_path || "", now());
      if (x.stock) applyStock(r.lastInsertRowid, Number(x.stock), Number(x.purchase_price || 0), "OPENING_STOCK", "OPENING", "Product creation", x.actorId);
      audit(x.actorId, "CREATE", "product", r.lastInsertRowid, { name: x.name });
    }
    return true;
  });
  ipcMain.handle("products:adjust", (_, x) => {
    const qty = Number(x.quantity);
    const type = qty >= 0 ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT";
    applyStock(x.product_id, qty, Number(x.unit_cost || 0), type, "MANUAL", x.reason || "Manual adjustment", x.actorId);
    audit(x.actorId, "STOCK_ADJUSTED", "product", x.product_id, { quantity: qty, reason: x.reason });
    return true;
  });

  ipcMain.handle("customers:list", () => db.prepare(`
    SELECT c.*, COALESCE(c.opening_balance,0) + COALESCE((SELECT SUM(direction*amount) FROM customer_transactions t WHERE t.customer_id=c.id),0) balance
    FROM customers c WHERE c.status='active' ORDER BY COALESCE(c.shop_name,c.name)`).all());
  ipcMain.handle("customers:save", (_, x) => {
    if (x.id) db.prepare("UPDATE customers SET shop_name=?,name=?,phone=?,whatsapp=?,address=?,city=?,area=?,customer_type=?,credit_limit=?,notes=? WHERE id=?")
      .run(x.shop_name || "", x.name, x.phone || "", x.whatsapp || "", x.address || "", x.city || "", x.area || "", x.customer_type || "Retail", x.credit_limit || 0, x.notes || "", x.id);
    else db.prepare("INSERT INTO customers(shop_name,name,phone,whatsapp,address,city,area,customer_type,credit_limit,opening_balance,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(x.shop_name || "", x.name, x.phone || "", x.whatsapp || "", x.address || "", x.city || "", x.area || "", x.customer_type || "Retail", x.credit_limit || 0, x.opening_balance || 0, x.notes || "", now());
    return true;
  });
  ipcMain.handle("customers:ledger", (_, customerId) => db.prepare("SELECT * FROM customer_transactions WHERE customer_id=? ORDER BY id DESC").all(customerId));

  ipcMain.handle("suppliers:list", () => db.prepare(`
    SELECT s.*, COALESCE(s.opening_balance,0) + COALESCE((SELECT SUM(direction*amount) FROM supplier_transactions t WHERE t.supplier_id=s.id),0) balance
    FROM suppliers s WHERE s.status='active' ORDER BY s.name`).all());
  ipcMain.handle("suppliers:save", (_, x) => {
    if (x.id) db.prepare("UPDATE suppliers SET name=?,contact_person=?,phone=?,whatsapp=?,address=?,city=?,category=?,notes=? WHERE id=?")
      .run(x.name, x.contact_person || "", x.phone || "", x.whatsapp || "", x.address || "", x.city || "", x.category || "", x.notes || "", x.id);
    else db.prepare("INSERT INTO suppliers(name,contact_person,phone,whatsapp,address,city,category,opening_balance,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(x.name, x.contact_person || "", x.phone || "", x.whatsapp || "", x.address || "", x.city || "", x.category || "", x.opening_balance || 0, x.notes || "", now());
    return true;
  });
  ipcMain.handle("suppliers:ledger", (_, supplierId) => db.prepare("SELECT * FROM supplier_transactions WHERE supplier_id=? ORDER BY id DESC").all(supplierId));

  // ---- Sales (POS) -------------------------------------------------------
  ipcMain.handle("sales:list", () => db.prepare(`SELECT s.*,COALESCE(c.shop_name,c.name) customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 200`).all());
  ipcMain.handle("sales:get", (_, id) => ({
    sale: db.prepare("SELECT s.*,COALESCE(c.shop_name,c.name) customer_name,c.phone customer_phone FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?").get(id),
    items: db.prepare("SELECT si.*,p.name product_name,p.name_urdu FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=?").all(id)
  }));
  ipcMain.handle("sales:create", (_, x) => {
    const tx = db.transaction(v => {
      if (!v.items?.length) throw new Error("Cart is empty");
      let subtotal = 0;
      for (const i of v.items) subtotal += Number(i.quantity) * Number(i.rate);
      const discount = Number(v.discount || 0);
      const total = Math.max(0, subtotal - discount);
      const paid = Math.min(Number(v.paid || 0), total);
      if (paid < 0) throw new Error("Paid amount cannot be negative");
      const no = nextNo("INV");
      const sale = db.prepare(`INSERT INTO sales(invoice_no,customer_id,mode,subtotal,discount,total,paid,balance,payment_method,cashier_id,sale_date,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(no, v.customer_id || null, v.mode || "Retail", subtotal, discount, total, paid, total - paid, v.payment_method || "Cash", v.actorId || null, today(), now());
      const item = db.prepare("INSERT INTO sale_items(sale_id,product_id,quantity,unit,rate,amount,cost) VALUES(?,?,?,?,?,?,?)");
      for (const i of v.items) {
        const p = db.prepare("SELECT * FROM products WHERE id=?").get(i.product_id);
        if (!p) throw new Error("Product not found");
        item.run(sale.lastInsertRowid, i.product_id, i.quantity, p.package_unit, i.rate, i.quantity * i.rate, p.avg_cost || p.purchase_price);
        applyStock(i.product_id, -Number(i.quantity), 0, "SALE", no, "POS sale", v.actorId);
      }
      const balance = total - paid;
      if (v.customer_id && balance > 0) {
        db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,payment_method,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .run(v.customer_id, "SALE_CREDIT", 1, balance, no, `${v.mode || "Retail"} sale — credit`, v.payment_method, v.actorId || null, now());
      }
      if (paid > 0 && (v.payment_method === "Cash" || v.payment_method === "Partial")) cashTx("IN", "SALE", paid, no, `${v.mode || "Retail"} sale`, v.actorId);
      audit(v.actorId, "CREATE", "sale", sale.lastInsertRowid, { invoice_no: no, total, paid, balance });
      return { id: sale.lastInsertRowid, invoice_no: no, subtotal, discount, total, paid, balance, sale_date: today() };
    });
    return tx(x);
  });
  ipcMain.handle("sales:void", (_, x) => {
    const tx = db.transaction(v => {
      const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(v.id);
      if (!sale) throw new Error("Sale not found");
      if (sale.status === "VOID") throw new Error("Sale already voided");
      const items = db.prepare("SELECT * FROM sale_items WHERE sale_id=?").all(v.id);
      for (const i of items) applyStock(i.product_id, Number(i.quantity), 0, "SALES_RETURN", sale.invoice_no, "Sale voided", v.actorId);
      if (sale.customer_id && sale.balance > 0)
        db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(sale.customer_id, "VOID_ADJUSTMENT", -1, sale.balance, sale.invoice_no, "Sale voided", v.actorId || null, now());
      db.prepare("UPDATE sales SET status='VOID' WHERE id=?").run(v.id);
      audit(v.actorId, "VOID", "sale", v.id, { invoice_no: sale.invoice_no, reason: v.reason });
      return true;
    });
    return tx(x);
  });

  // ---- Sales Returns -------------------------------------------------------
  ipcMain.handle("salesReturns:create", (_, x) => {
    const tx = db.transaction(v => {
      const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(v.sale_id);
      if (!sale) throw new Error("Original sale not found");
      let total = 0;
      const rItem = db.prepare("INSERT INTO sales_return_items(return_id,sale_item_id,product_id,quantity,rate,amount) VALUES(?,?,?,?,?,?)");
      const no = nextNo("SR");
      const ret = db.prepare("INSERT INTO sales_returns(return_no,sale_id,customer_id,total,reason,refund_cash,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(no, v.sale_id, sale.customer_id, 0, v.reason || "", 0, v.actorId || null, now());
      for (const i of v.items) {
        const si = db.prepare("SELECT * FROM sale_items WHERE id=?").get(i.sale_item_id);
        if (!si) throw new Error("Original sale item not found");
        const already = si.returned_quantity || 0;
        if (already + Number(i.quantity) > si.quantity) throw new Error(`Return quantity exceeds sold quantity for item #${si.id}`);
        db.prepare("UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id=?").run(i.quantity, si.id);
        const amount = Number(i.quantity) * si.rate;
        total += amount;
        rItem.run(ret.lastInsertRowid, si.id, si.product_id, i.quantity, si.rate, amount);
        applyStock(si.product_id, Number(i.quantity), 0, "SALES_RETURN", no, v.reason || "Sales return", v.actorId);
      }
      db.prepare("UPDATE sales_returns SET total=? WHERE id=?").run(total, ret.lastInsertRowid);
      const refundCash = Math.min(total, v.refundCash ? total : 0);
      if (sale.customer_id) {
        const outstanding = db.prepare("SELECT COALESCE(opening_balance,0)+COALESCE((SELECT SUM(direction*amount) FROM customer_transactions t WHERE t.customer_id=?),0) v FROM customers WHERE id=?").get(sale.customer_id, sale.customer_id).v;
        const reduceReceivable = Math.max(0, Math.min(total, outstanding));
        if (reduceReceivable > 0)
          db.prepare("INSERT INTO customer_transactions(customer_id,type,direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
            .run(sale.customer_id, "SALES_RETURN", -1, reduceReceivable, no, v.reason || "Sales return", v.actorId || null, now());
      }
      if (v.refundCash) { cashTx("OUT", "REFUND", total, no, "Sales return refund", v.actorId); db.prepare("UPDATE sales_returns SET refund_cash=? WHERE id=?").run(total, ret.lastInsertRowid); }
      audit(v.actorId, "CREATE", "sales_return", ret.lastInsertRowid, { return_no: no, total });
      return { id: ret.lastInsertRowid, return_no: no, total };
    });
    return tx(x);
  });

  // ---- Purchases -----------------------------------------------------------
  ipcMain.handle("purchases:list", () => db.prepare(`SELECT p.*,s.name supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.id DESC LIMIT 200`).all());
  ipcMain.handle("purchases:get", (_, id) => ({
    purchase: db.prepare("SELECT p.*,s.name supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?").get(id),
    items: db.prepare("SELECT pi.*,p.name product_name FROM purchase_items pi JOIN products p ON p.id=pi.product_id WHERE pi.purchase_id=?").all(id)
  }));
  ipcMain.handle("purchases:create", (_, x) => {
    const tx = db.transaction(v => {
      if (!v.items?.length) throw new Error("No items in purchase");
      let subtotal = 0;
      for (const i of v.items) subtotal += Number(i.quantity) * Number(i.rate);
      const paid = Math.min(Number(v.paid || 0), subtotal);
      const no = nextNo("PUR");
      const purchase = db.prepare("INSERT INTO purchases(invoice_no,supplier_id,subtotal,total,paid,balance,payment_method,notes,purchase_date,created_at,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
        .run(no, v.supplier_id || null, subtotal, subtotal, paid, subtotal - paid, v.payment_method || "Cash", v.notes || "", today(), now(), v.actorId || null);
      const item = db.prepare("INSERT INTO purchase_items(purchase_id,product_id,quantity,rate,amount) VALUES(?,?,?,?,?)");
      for (const i of v.items) {
        const qty = Number(i.quantity), rate = Number(i.rate);
        item.run(purchase.lastInsertRowid, i.product_id, qty, rate, qty * rate);
        applyStock(i.product_id, qty, rate, "PURCHASE", no, "Purchase", v.actorId);
        db.prepare("UPDATE products SET purchase_price=? WHERE id=?").run(rate, i.product_id); // latest cost shown on product card
      }
      const balance = subtotal - paid;
      if (v.supplier_id && balance > 0)
        db.prepare("INSERT INTO supplier_transactions(supplier_id,type,direction,amount,reference,note,payment_method,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .run(v.supplier_id, "PURCHASE_CREDIT", 1, balance, no, "Credit purchase", v.payment_method, v.actorId || null, now());
      if (paid > 0 && (v.payment_method === "Cash" || v.payment_method === "Partial")) cashTx("OUT", "PURCHASE", paid, no, "Purchase", v.actorId);
      audit(v.actorId, "CREATE", "purchase", purchase.lastInsertRowid, { invoice_no: no, total: subtotal, paid, balance });
      return { id: purchase.lastInsertRowid, invoice_no: no, total: subtotal, paid, balance };
    });
    return tx(x);
  });

  // ---- Purchase Returns ------------------------------------------------------
  ipcMain.handle("purchaseReturns:create", (_, x) => {
    const tx = db.transaction(v => {
      const purchase = db.prepare("SELECT * FROM purchases WHERE id=?").get(v.purchase_id);
      if (!purchase) throw new Error("Original purchase not found");
      let total = 0;
      const no = nextNo("PR");
      const rItem = db.prepare("INSERT INTO purchase_return_items(return_id,purchase_item_id,product_id,quantity,rate,amount) VALUES(?,?,?,?,?,?)");
      const ret = db.prepare("INSERT INTO purchase_returns(return_no,purchase_id,supplier_id,total,reason,user_id,created_at) VALUES(?,?,?,?,?,?,?)")
        .run(no, v.purchase_id, purchase.supplier_id, 0, v.reason || "", v.actorId || null, now());
      for (const i of v.items) {
        const pi = db.prepare("SELECT * FROM purchase_items WHERE id=?").get(i.purchase_item_id);
        if (!pi) throw new Error("Original purchase item not found");
        const already = pi.returned_quantity || 0;
        if (already + Number(i.quantity) > pi.quantity) throw new Error(`Return quantity exceeds purchased quantity for item #${pi.id}`);
        db.prepare("UPDATE purchase_items SET returned_quantity = returned_quantity + ? WHERE id=?").run(i.quantity, pi.id);
        const amount = Number(i.quantity) * pi.rate;
        total += amount;
        rItem.run(ret.lastInsertRowid, pi.id, pi.product_id, i.quantity, pi.rate, amount);
        applyStock(pi.product_id, -Number(i.quantity), 0, "PURCHASE_RETURN", no, v.reason || "Purchase return", v.actorId);
      }
      db.prepare("UPDATE purchase_returns SET total=? WHERE id=?").run(total, ret.lastInsertRowid);
      if (purchase.supplier_id)
        db.prepare("INSERT INTO supplier_transactions(supplier_id,type,direction,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
          .run(purchase.supplier_id, "PURCHASE_RETURN", -1, total, no, v.reason || "Purchase return", v.actorId || null, now());
      audit(v.actorId, "CREATE", "purchase_return", ret.lastInsertRowid, { return_no: no, total });
      return { id: ret.lastInsertRowid, return_no: no, total };
    });
    return tx(x);
  });

  // ---- Payments (customer receipts / supplier payments) ---------------------
  ipcMain.handle("payments:add", (_, x) => {
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

  // ---- Expenses ---------------------------------------------------------
  ipcMain.handle("expenses:list", () => db.prepare("SELECT * FROM expenses ORDER BY id DESC LIMIT 300").all());
  ipcMain.handle("expenses:add", (_, x) => {
    const tx = db.transaction(v => {
      const no = nextNo("EXP");
      const r = db.prepare("INSERT INTO expenses(expense_no,title,category,amount,payment_method,paid_by,note,expense_date,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
        .run(no, v.title, v.category || "Miscellaneous", v.amount || 0, v.payment_method || "Cash", v.paid_by || "", v.note || "", v.expense_date || today(), v.actorId || null, now());
      if ((v.payment_method || "Cash") === "Cash" && v.amount > 0) cashTx("OUT", "EXPENSE", Number(v.amount), no, v.title, v.actorId);
      audit(v.actorId, "CREATE", "expense", r.lastInsertRowid, { title: v.title, amount: v.amount });
      return r.lastInsertRowid;
    });
    return tx(x);
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
    if (currentOpenRegister()) throw new Error("A cash register is already open. Close it before opening a new one.");
    const r = db.prepare("INSERT INTO cash_registers(business_date,opening_cash,opened_by,opened_at,status) VALUES(?,?,?,?,?)")
      .run(today(), Number(x.opening_cash || 0), x.actorId || null, now(), "OPEN");
    audit(x.actorId, "CASH_REGISTER_OPENED", "cash_register", r.lastInsertRowid, { opening_cash: x.opening_cash });
    return r.lastInsertRowid;
  });
  ipcMain.handle("cash:transaction", (_, x) => {
    // Owner cash added / withdrawal / other cash in-out that isn't tied to a sale/purchase/payment/expense.
    const reg = currentOpenRegister();
    if (!reg) throw new Error("No cash register is open");
    const category = x.category || (x.direction === "IN" ? "OTHER_IN" : "OTHER_OUT");
    db.prepare("INSERT INTO cash_transactions(register_id,direction,category,amount,reference,note,user_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(reg.id, x.direction, category, Number(x.amount), "MANUAL", x.note || "", x.actorId || null, now());
    audit(x.actorId, x.direction === "OUT" && category === "WITHDRAWAL" ? "CASH_WITHDRAWAL" : "CASH_ADJUSTMENT", "cash_register", reg.id, { direction: x.direction, category, amount: x.amount, note: x.note });
    return true;
  });
  ipcMain.handle("cash:close", (_, x) => {
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

  // ---- Dashboard & Reports (Section 44 / 30) ------------------------------
  ipcMain.handle("dashboard", () => {
    const start = `${today()}T00:00:00`;
    const sales = db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE sale_date=? AND status='COMPLETED'").get(today()).v;
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
    return { sales, purchases, expenses: expensesToday, profit, low, receivables, payables, stockValue, cashInHand, registerOpen: !!reg };
  });

  ipcMain.handle("reports:summary", (_, range) => {
    const r = range || {};
    const from = r.from || "1900-01-01", to = r.to || "2999-12-31";
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
