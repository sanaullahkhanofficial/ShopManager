const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const Database = require("better-sqlite3");

let db, win, dataDir;
const now = () => new Date().toISOString();

function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  try { const [salt, hash] = stored.split(":"); return crypto.timingSafeEqual(Buffer.from(hash,"hex"), crypto.scryptSync(pw,salt,64)); } catch { return false; }
}
function initDb() {
  const dir = app.getPath("userData"); fs.mkdirSync(dir,{recursive:true});
  db = new Database(path.join(dir,"shopmanager.db"));
  db.pragma("journal_mode = WAL"); db.pragma("foreign_keys = ON");
  dataDir = path.join(app.getPath("userData"), "images"); fs.mkdirSync(dataDir,{recursive:true});
  db.exec(`
  CREATE TABLE IF NOT EXISTS schema_meta(version INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,display_name TEXT NOT NULL,role TEXT NOT NULL,password_hash TEXT NOT NULL,status TEXT DEFAULT 'active',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,image_path TEXT DEFAULT '',status TEXT DEFAULT 'active',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,category_id INTEGER,name TEXT NOT NULL,brand TEXT,package_size REAL,package_unit TEXT,sku TEXT UNIQUE,purchase_price REAL DEFAULT 0,sale_price REAL DEFAULT 0,stock REAL DEFAULT 0,min_stock REAL DEFAULT 0,avg_cost REAL DEFAULT 0,image_path TEXT DEFAULT '',status TEXT DEFAULT 'active',created_at TEXT NOT NULL,FOREIGN KEY(category_id) REFERENCES categories(id));
  CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,address TEXT,opening_balance REAL DEFAULT 0,status TEXT DEFAULT 'active',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,address TEXT,opening_balance REAL DEFAULT 0,status TEXT DEFAULT 'active',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_no TEXT UNIQUE NOT NULL,supplier_id INTEGER,total REAL NOT NULL,paid REAL DEFAULT 0,balance REAL DEFAULT 0,purchase_date TEXT NOT NULL,FOREIGN KEY(supplier_id) REFERENCES suppliers(id));
  CREATE TABLE IF NOT EXISTS purchase_items(id INTEGER PRIMARY KEY AUTOINCREMENT,purchase_id INTEGER NOT NULL,product_id INTEGER NOT NULL,quantity REAL NOT NULL,rate REAL NOT NULL,amount REAL NOT NULL,FOREIGN KEY(purchase_id) REFERENCES purchases(id),FOREIGN KEY(product_id) REFERENCES products(id));
  CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_no TEXT UNIQUE NOT NULL,customer_id INTEGER,total REAL NOT NULL,paid REAL DEFAULT 0,balance REAL DEFAULT 0,sale_date TEXT NOT NULL,FOREIGN KEY(customer_id) REFERENCES customers(id));
  CREATE TABLE IF NOT EXISTS sale_items(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER NOT NULL,product_id INTEGER NOT NULL,quantity REAL NOT NULL,rate REAL NOT NULL,amount REAL NOT NULL,cost REAL DEFAULT 0,FOREIGN KEY(sale_id) REFERENCES sales(id),FOREIGN KEY(product_id) REFERENCES products(id));
  CREATE TABLE IF NOT EXISTS customer_transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER NOT NULL,type TEXT NOT NULL,amount REAL NOT NULL,reference TEXT,note TEXT,created_at TEXT NOT NULL,FOREIGN KEY(customer_id) REFERENCES customers(id));
  CREATE TABLE IF NOT EXISTS supplier_transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,supplier_id INTEGER NOT NULL,type TEXT NOT NULL,amount REAL NOT NULL,reference TEXT,note TEXT,created_at TEXT NOT NULL,FOREIGN KEY(supplier_id) REFERENCES suppliers(id));
  CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT,amount REAL NOT NULL,note TEXT,expense_date TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,type TEXT NOT NULL,quantity REAL NOT NULL,unit_cost REAL DEFAULT 0,reference TEXT,note TEXT,created_at TEXT NOT NULL,FOREIGN KEY(product_id) REFERENCES products(id));
  CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT NOT NULL,entity TEXT,entity_id INTEGER,details TEXT,created_at TEXT NOT NULL);
  `);
  const n = db.prepare("SELECT COUNT(*) c FROM settings").get().c;
  if(!n){
    const s=db.prepare("INSERT INTO settings(key,value) VALUES(?,?)");
    [["shop_name","My Shop"],["owner_name",""],["address",""],["phone",""],["currency","PKR"],["primary_color","#15803d"],["logo_path",""],["invoice_footer","Thank you for your business."],["invoice_prefix","INV"],["business_type","Agriculture/Fertilizer"],["setup_complete","0"]].forEach(x=>s.run(...x));
  }
  if(db.prepare("SELECT COUNT(*) c FROM users").get().c===0) db.prepare("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run("admin","Administrator","Owner",hashPassword("admin123"),now());
  if(db.prepare("SELECT COUNT(*) c FROM categories").get().c===0) {
    const cats=["Fertilizers","Atta","Gandam","Chokar / Bussa","Khal","Micronutrients","Other"];
    const st=db.prepare("INSERT INTO categories(name,created_at) VALUES(?,?)"); cats.forEach(c=>st.run(c,now()));
    const cat=n=>db.prepare("SELECT id FROM categories WHERE name=?").get(n).id;
    const p=db.prepare(`INSERT INTO products(category_id,name,brand,package_size,package_unit,sku,purchase_price,sale_price,stock,min_stock,avg_cost,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
    const seed=[
      ["Fertilizers","DAP","FFC",50,"KG","FFC-DAP-50",11000,12000,85,10],
      ["Fertilizers","Sona Urea","FFC",50,"KG","FFC-UREA-50",5200,5600,120,15],
      ["Fertilizers","Nitrophos","Fatima",50,"KG","FAT-NP-50",7500,8000,45,10],
      ["Atta","Mill Atta","",40,"KG","ATTA-40",3200,3500,60,10],
      ["Gandam","Gandam","",50,"KG","GANDAM-50",4200,4600,40,8],
      ["Chokar / Bussa","Chokar","",50,"KG","CHOKAR-50",1800,2200,30,5],
      ["Khal","Kali Khal / Binola","",50,"KG","KHAL-50",3000,3400,25,5],
      ["Micronutrients","Zinc","",1,"KG","ZINC-1",900,1200,25,5],
      ["Micronutrients","Iron","",1,"KG","IRON-1",700,1000,18,4],
      ["Micronutrients","Boron","",1,"KG","BORON-1",800,1100,12,3]
    ];
    for(const x of seed){p.run(cat(x[0]),x[1],x[2],x[3],x[4],x[5],x[6],x[7],x[8],x[9],x[6],now());}
    const ins=db.prepare("INSERT INTO stock_movements(product_id,type,quantity,unit_cost,reference,note,created_at) VALUES(?,?,?,?,?,?,?)");
    db.prepare("SELECT id,stock,avg_cost FROM products").all().forEach(r=>ins.run(r.id,"OPENING",r.stock,r.avg_cost,"OPENING","Initial stock",now()));
  }
  try{db.exec("ALTER TABLE categories ADD COLUMN image_path TEXT DEFAULT ''")}catch{}
  try{db.exec("ALTER TABLE products ADD COLUMN image_path TEXT DEFAULT ''")}catch{}
  db.prepare("INSERT OR IGNORE INTO schema_meta(version) VALUES(2)").run();
}
function settings(){ return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(r=>[r.key,r.value])); }
function setSettings(obj){ const q=db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"); const tx=db.transaction(o=>Object.entries(o).forEach(([k,v])=>q.run(k,String(v??"")))); tx(obj); return settings(); }
function audit(action,entity,id,details,userId=null){db.prepare("INSERT INTO audit_logs(user_id,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?)").run(userId,action,entity,id,details,now());}
function nextNo(prefix){ return `${prefix}-${Date.now().toString().slice(-9)}`; }

function registerIpc(){
  ipcMain.handle("settings:get",()=>settings());
  ipcMain.handle("settings:update",(_,o)=>setSettings(o));
  ipcMain.handle("auth:login",(_,username,password)=>{const u=db.prepare("SELECT * FROM users WHERE username=? AND status='active'").get(username); if(!u||!verifyPassword(password,u.password_hash)) throw new Error("Invalid username or password"); return {id:u.id,username:u.username,display_name:u.display_name,role:u.role};});
  ipcMain.handle("users:list",()=>db.prepare("SELECT id,username,display_name,role,status,created_at FROM users ORDER BY id DESC").all());
  ipcMain.handle("users:add",(_,x)=>{const r=db.prepare("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run(x.username,x.display_name,x.role,hashPassword(x.password||"admin123"),now()); audit("CREATE","user",r.lastInsertRowid,x.username); return r.lastInsertRowid;});
  ipcMain.handle("users:resetPassword",(_,id,pw)=>{db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(pw),id);audit("PASSWORD_RESET","user",id,"");return true;});
  ipcMain.handle("images:pick",async()=>{
    const r=await dialog.showOpenDialog(win,{title:"Choose image",properties:["openFile"],filters:[{name:"Images",extensions:["jpg","jpeg","png","webp"]}]});
    if(r.canceled)return null;
    const src=r.filePaths[0], ext=path.extname(src).toLowerCase(), dest=path.join(dataDir,`${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
    fs.copyFileSync(src,dest); return dest;
  });
  ipcMain.handle("images:remove",(_,p)=>{if(p&&p.startsWith(dataDir)&&fs.existsSync(p))fs.unlinkSync(p);return true;});
  ipcMain.handle("categories:list",()=>db.prepare("SELECT * FROM categories ORDER BY name").all());
  ipcMain.handle("categories:save",(_,x)=>{if(x.id) db.prepare("UPDATE categories SET name=?,image_path=?,status=? WHERE id=?").run(x.name,x.image_path||"",x.status||"active",x.id); else db.prepare("INSERT INTO categories(name,image_path,created_at) VALUES(?,?,?)").run(x.name,x.image_path||"",now()); return db.prepare("SELECT * FROM categories ORDER BY name").all();});
  ipcMain.handle("products:list",()=>db.prepare("SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.status='active' ORDER BY p.name").all());
  ipcMain.handle("products:save",(_,x)=>{if(x.id) db.prepare(`UPDATE products SET category_id=?,name=?,brand=?,package_size=?,package_unit=?,sku=?,purchase_price=?,sale_price=?,min_stock=?,image_path=? WHERE id=?`).run(x.category_id,x.name,x.brand||"",x.package_size||0,x.package_unit||"",x.sku||null,x.purchase_price||0,x.sale_price||0,x.min_stock||0,x.image_path||"",x.id); else {const r=db.prepare(`INSERT INTO products(category_id,name,brand,package_size,package_unit,sku,purchase_price,sale_price,min_stock,avg_cost,image_path,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.category_id,x.name,x.brand||"",x.package_size||0,x.package_unit||"",x.sku||null,x.purchase_price||0,x.sale_price||0,x.min_stock||0,x.purchase_price||0,x.image_path||"",now()); if(x.stock) stock(r.lastInsertRowid,x.stock,x.purchase_price,"OPENING","Product creation");} return true;});
  function stock(pid,qty,cost,type,ref,note=""){db.prepare("UPDATE products SET stock=stock+?,avg_cost=CASE WHEN ? > 0 THEN ? ELSE avg_cost END WHERE id=?").run(qty,qty,cost,pid);db.prepare("INSERT INTO stock_movements(product_id,type,quantity,unit_cost,reference,note,created_at) VALUES(?,?,?,?,?,?,?)").run(pid,type,qty,cost,ref,note,now());}
  ipcMain.handle("products:adjust",(_,x)=>{stock(x.product_id,Number(x.quantity),Number(x.unit_cost||0),"ADJUSTMENT","MANUAL",x.note||"Manual adjustment");return true;});
  ipcMain.handle("customers:list",()=>db.prepare(`SELECT c.*,COALESCE(c.opening_balance,0)+COALESCE((SELECT SUM(CASE WHEN type='DEBIT' THEN amount ELSE -amount END) FROM customer_transactions t WHERE t.customer_id=c.id),0) balance FROM customers c ORDER BY c.name`).all());
  ipcMain.handle("customers:add",(_,x)=>db.prepare("INSERT INTO customers(name,phone,address,opening_balance,created_at) VALUES(?,?,?,?,?)").run(x.name,x.phone||"",x.address||"",x.opening_balance||0,now()).lastInsertRowid);
  ipcMain.handle("suppliers:list",()=>db.prepare(`SELECT s.*,COALESCE(s.opening_balance,0)+COALESCE((SELECT SUM(CASE WHEN type='CREDIT' THEN amount ELSE -amount END) FROM supplier_transactions t WHERE t.supplier_id=s.id),0) balance FROM suppliers s ORDER BY s.name`).all());
  ipcMain.handle("suppliers:add",(_,x)=>db.prepare("INSERT INTO suppliers(name,phone,address,opening_balance,created_at) VALUES(?,?,?,?,?)").run(x.name,x.phone||"",x.address||"",x.opening_balance||0,now()).lastInsertRowid);
  ipcMain.handle("sales:list",()=>db.prepare(`SELECT s.*,c.name customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 100`).all());
  ipcMain.handle("sales:create",(_,x)=>{
    const tx=db.transaction(v=>{let total=0;for(const i of v.items) total+=i.quantity*i.rate;
      const no=nextNo(settings().invoice_prefix||"INV"); const sale=db.prepare("INSERT INTO sales(invoice_no,customer_id,total,paid,balance,sale_date) VALUES(?,?,?,?,?,?)").run(no,v.customer_id||null,total,v.paid||0,total-(v.paid||0),now());
      const item=db.prepare("INSERT INTO sale_items(sale_id,product_id,quantity,rate,amount,cost) VALUES(?,?,?,?,?,?)");
      for(const i of v.items){const p=db.prepare("SELECT * FROM products WHERE id=?").get(i.product_id);if(!p||p.stock<i.quantity)throw new Error(`Insufficient stock: ${p?.name||"product"}`);item.run(sale.lastInsertRowid,i.product_id,i.quantity,i.rate,i.quantity*i.rate,p.avg_cost||p.purchase_price);stock(i.product_id,-i.quantity,p.avg_cost||p.purchase_price,"SALE",no,"Sale");}
      if(v.customer_id && total-(v.paid||0)>0) db.prepare("INSERT INTO customer_transactions(customer_id,type,amount,reference,note,created_at) VALUES(?,?,?,?,?,?)").run(v.customer_id,"DEBIT",total-(v.paid||0),no,"Credit sale",now());
      audit("CREATE","sale",sale.lastInsertRowid,no); return {id:sale.lastInsertRowid,invoice_no:no,total,balance:total-(v.paid||0)};
    }); return tx(x);
  });
  ipcMain.handle("purchases:list",()=>db.prepare(`SELECT p.*,s.name supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.id DESC LIMIT 100`).all());
  ipcMain.handle("purchases:create",(_,x)=>{
    const tx=db.transaction(v=>{let total=0;for(const i of v.items)total+=i.quantity*i.rate;const no=nextNo("PUR");const r=db.prepare("INSERT INTO purchases(invoice_no,supplier_id,total,paid,balance,purchase_date) VALUES(?,?,?,?,?,?)").run(no,v.supplier_id||null,total,v.paid||0,total-(v.paid||0),now());const it=db.prepare("INSERT INTO purchase_items(purchase_id,product_id,quantity,rate,amount) VALUES(?,?,?,?,?)");for(const i of v.items){it.run(r.lastInsertRowid,i.product_id,i.quantity,i.rate,i.quantity*i.rate);const p=db.prepare("SELECT * FROM products WHERE id=?").get(i.product_id);const newAvg=((p.stock*(p.avg_cost||p.purchase_price))+(i.quantity*i.rate))/(p.stock+i.quantity);db.prepare("UPDATE products SET stock=stock+?,avg_cost=?,purchase_price=? WHERE id=?").run(i.quantity,newAvg,i.rate,i.product_id);db.prepare("INSERT INTO stock_movements(product_id,type,quantity,unit_cost,reference,note,created_at) VALUES(?,?,?,?,?,?,?)").run(i.product_id,"PURCHASE",i.quantity,i.rate,no,"Purchase",now());}if(v.supplier_id&&total-(v.paid||0)>0)db.prepare("INSERT INTO supplier_transactions(supplier_id,type,amount,reference,note,created_at) VALUES(?,?,?,?,?,?)").run(v.supplier_id,"CREDIT",total-(v.paid||0),no,"Credit purchase",now());return {invoice_no:no,total,balance:total-(v.paid||0)};});return tx(x);
  });
  ipcMain.handle("payments:customer",(_,x)=>{db.prepare("INSERT INTO customer_transactions(customer_id,type,amount,reference,note,created_at) VALUES(?,?,?,?,?,?)").run(x.customer_id,"CREDIT",x.amount,x.reference||"PAY",x.note||"Customer payment",now());return true;});
  ipcMain.handle("payments:supplier",(_,x)=>{db.prepare("INSERT INTO supplier_transactions(supplier_id,type,amount,reference,note,created_at) VALUES(?,?,?,?,?,?)").run(x.supplier_id,"DEBIT",x.amount,x.reference||"PAY",x.note||"Supplier payment",now());return true;});
  ipcMain.handle("expenses:list",()=>db.prepare("SELECT * FROM expenses ORDER BY id DESC LIMIT 100").all());
  ipcMain.handle("expenses:add",(_,x)=>db.prepare("INSERT INTO expenses(title,category,amount,note,expense_date) VALUES(?,?,?,?,?)").run(x.title,x.category||"General",x.amount,x.note||"",x.expense_date||now()).lastInsertRowid);
  ipcMain.handle("dashboard",()=>{const sales=db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE date(sale_date)=date('now','localtime')").get().v;const purchases=db.prepare("SELECT COALESCE(SUM(total),0) v FROM purchases WHERE date(purchase_date)=date('now','localtime')").get().v;const expenses=db.prepare("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE date(expense_date)=date('now','localtime')").get().v;const profit=db.prepare("SELECT COALESCE(SUM((si.rate-si.cost)*si.quantity),0) v FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.sale_date)=date('now','localtime')").get().v;const low=db.prepare("SELECT * FROM products WHERE status='active' AND stock<=min_stock ORDER BY stock").all();return {sales,purchases,expenses,profit,low};});
  ipcMain.handle("reports:summary",(_,x)=>{const from=x.from,to=x.to;return {sales:db.prepare("SELECT COALESCE(SUM(total),0)v FROM sales WHERE date(sale_date) BETWEEN date(?) AND date(?)").get(from,to).v,purchases:db.prepare("SELECT COALESCE(SUM(total),0)v FROM purchases WHERE date(purchase_date) BETWEEN date(?) AND date(?)").get(from,to).v,expenses:db.prepare("SELECT COALESCE(SUM(amount),0)v FROM expenses WHERE date(expense_date) BETWEEN date(?) AND date(?)").get(from,to).v,profit:db.prepare("SELECT COALESCE(SUM((si.rate-si.cost)*si.quantity),0)v FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.sale_date) BETWEEN date(?) AND date(?)").get(from,to).v};});
  ipcMain.handle("backup:create",async()=>{const f=await dialog.showSaveDialog(win,{title:"Backup database",defaultPath:`ShopManager-Backup-${new Date().toISOString().slice(0,10)}.db`,filters:[{name:"SQLite Database",extensions:["db"]}]});if(f.canceled)return null;db.pragma("wal_checkpoint(TRUNCATE)");fs.copyFileSync(path.join(app.getPath("userData"),"shopmanager.db"),f.filePath);return f.filePath;});
  ipcMain.handle("db:integrity",()=>db.prepare("PRAGMA integrity_check").get());
  ipcMain.handle("app:info",()=>({version:app.getVersion(),dataPath:app.getPath("userData")}));
}
function createWindow(){win=new BrowserWindow({width:1500,height:950,minWidth:1100,minHeight:700,webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false}});win.loadFile(path.join(__dirname,"../dist/index.html"));}
app.whenReady().then(()=>{initDb();registerIpc();createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
