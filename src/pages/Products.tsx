import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Plus, Search, Package, Boxes, AlertTriangle, Tags, Upload, Download, Printer,
  SlidersHorizontal, DollarSign, Barcode as BarcodeIcon, ListFilter, Save, RotateCcw, Trash2,
} from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField, TextAreaField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { Switch } from "../components/ui/Switch";
import { Barcode } from "../components/ui/Barcode";
import { PrintableList } from "../components/PrintableList";
import { useToast } from "../components/ui/Toast";
import { useLang } from "../lib/i18n";
import type { AuthUser, Category, Product, Settings } from "../types";
import type { PageId } from "../components/layout/Sidebar";

const emptyDraft = (): Partial<Product> => ({ package_unit: "KG", status: "active" });

export function Products({ user, settings, onNavigate }: { user: AuthUser; settings: Settings; onNavigate?: (p: PageId) => void }) {
  const { push } = useToast();
  const { t, lang } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [draft, setDraft] = useState<Partial<Product>>(emptyDraft());
  const [formTab, setFormTab] = useState("details");
  const [manageCategories, setManageCategories] = useState(false);
  const [bulkPrices, setBulkPrices] = useState(false);
  const [barcodeSheet, setBarcodeSheet] = useState(false);
  const [printList, setPrintList] = useState(false);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.categoriesList().then((c) => setCategories(c as Category[]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (printList) { const t = setTimeout(() => window.print(), 150); return () => clearTimeout(t); }
  }, [printList]);

  const rows = products.filter((p) =>
    (p.name + " " + p.name_urdu + " " + (p.sku || "")).toLowerCase().includes(query.toLowerCase()) &&
    (!categoryFilter || String(p.category_id) === categoryFilter) &&
    (!lowStockOnly || p.stock <= p.min_stock)
  );

  const lowStockCount = products.filter((p) => p.stock <= p.min_stock).length;
  const totalStock = products.reduce((a, p) => a + p.stock, 0);

  function resetForm() { setDraft(emptyDraft()); setFormTab("details"); }
  function editRow(p: Product) { setDraft(p); setFormTab("details"); }

  async function save() {
    if (!draft.name || !draft.category_id) { push("error", "Name and category are required"); return; }
    await api.productsSave({ ...draft, actorId: user.id });
    push("success", draft.id ? "Product updated" : "Product created");
    resetForm();
    load();
  }

  async function deactivate(p: Product) {
    if (!confirm(`Remove "${p.name}" from the active catalog? This can be reversed by an admin later.`)) return;
    await api.productsSave({ id: p.id, status: "inactive", actorId: user.id });
    push("success", "Product deactivated");
    if (draft.id === p.id) resetForm();
    load();
  }

  async function pickLogo() {
    const p = await api.imagesPick();
    if (p) setDraft((d) => ({ ...d, image_path: p }));
  }

  async function generateBarcodes() {
    const count = await api.productsEnsureBarcodes(user.id);
    push("success", count ? `Generated ${count} barcode${count === 1 ? "" : "s"}` : "Every product already has a barcode");
    load();
    setBarcodeSheet(true);
  }

  function exportCsv() {
    const csv = Papa.unparse(products.map((p) => ({
      name: p.name, name_urdu: p.name_urdu, category: p.category_name, sku: p.sku, barcode: p.barcode,
      package_size: p.package_size, package_unit: p.package_unit,
      purchase_price: p.purchase_price, retail_price: p.retail_price, wholesale_price: p.wholesale_price,
      stock: p.stock, min_stock: p.min_stock,
    })));
    api.filesSaveText({ title: "Export Products", defaultPath: "products.csv", content: csv }).then((path) => {
      if (path) push("success", "Products exported");
    });
  }

  async function importCsv() {
    const file = await api.filesPickCsv();
    if (!file) return;
    const parsed = Papa.parse<Record<string, string>>(file.content, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) { push("error", `CSV parse error: ${parsed.errors[0].message}`); return; }
    let created = 0, updated = 0;
    const freshCategories = await api.categoriesList() as Category[];
    const catMap = new Map(freshCategories.map((c) => [c.name.toLowerCase(), c.id]));
    for (const row of parsed.data) {
      if (!row.name) continue;
      let categoryId = catMap.get((row.category || "").toLowerCase());
      if (!categoryId && row.category) {
        const updatedCats = await api.categoriesSave({ name: row.category }) as Category[];
        const created2 = updatedCats.find((c) => c.name.toLowerCase() === row.category.toLowerCase());
        categoryId = created2?.id;
        if (categoryId) catMap.set(row.category.toLowerCase(), categoryId);
      }
      const existing = products.find((p) => p.sku && p.sku === row.sku);
      await api.productsSave({
        id: existing?.id, name: row.name, name_urdu: row.name_urdu || "", category_id: categoryId,
        sku: row.sku || undefined, barcode: row.barcode || undefined,
        package_size: Number(row.package_size) || 0, package_unit: row.package_unit || "KG",
        purchase_price: Number(row.purchase_price) || 0, retail_price: Number(row.retail_price) || 0,
        wholesale_price: Number(row.wholesale_price) || 0, min_stock: Number(row.min_stock) || 0,
        stock: existing ? undefined : Number(row.stock) || 0,
        actorId: user.id,
      });
      if (existing) updated++; else created++;
    }
    push("success", `Import complete — ${created} created, ${updated} updated`);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("totalProducts")} value={String(products.length)} hint={t("activeProductsHint")} icon={<Package size={18} />} tone="green" />
        <StatCard label={t("totalStock")} value={totalStock.toLocaleString()} hint={t("unitsAcrossProducts")} icon={<Boxes size={18} />} />
        <StatCard label={t("lowStockItems")} value={String(lowStockCount)} hint={t("needAttention")} icon={<AlertTriangle size={18} />} tone={lowStockCount ? "danger" : "default"} />
        <StatCard label={t("categories")} value={String(categories.length)} icon={<Tags size={18} />} tone="gold" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder={t("searchByNameCodeBarcode")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{lang === "ur" ? (c.name_urdu || c.name) : c.name}</option>)}
        </select>
        <Button onClick={() => { setQuery(""); setCategoryFilter(""); setLowStockOnly(false); }}><RotateCcw size={14} /> {t("resetBtn")}</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => setManageCategories(true)}><Tags size={14} /> {t("categories")}</Button>
          <Button onClick={importCsv}><Upload size={14} /> {t("importCsvBtn")}</Button>
          <Button onClick={exportCsv}><Download size={14} /> {t("exportBtn")}</Button>
          <Button onClick={() => setPrintList(true)}><Printer size={14} /> {t("printListBtn")}</Button>
          <Button variant="primary" onClick={resetForm}><Plus size={15} /> {t("addNewProduct")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card">
          <DataTable
            keyField={(r) => r.id}
            rows={rows}
            pageSize={20}
            storageKey="products-list"
            columns={[
              { key: "name", header: t("productNameCol"), render: (r) => r.name },
              { key: "name_urdu", header: "نام (Urdu)", render: (r) => <span dir="rtl">{r.name_urdu}</span> },
              { key: "category", header: t("categoryCol"), render: (r) => <span className="rounded-full bg-brand-green-50 px-2 py-0.5 text-xs font-medium text-brand-green-700">{lang === "ur" ? (r.category_name_urdu || r.category_name) : r.category_name}</span> },
              { key: "unit", header: t("unitCol"), render: (r) => `${r.package_size} ${r.package_unit}` },
              { key: "stock", header: t("stockCol"), render: (r) => `${r.stock} ${r.package_unit}` },
              { key: "purchase", header: t("purchaseCol"), render: (r) => money(r.purchase_price) },
              { key: "sale", header: t("saleCol"), render: (r) => money(r.retail_price) },
              { key: "status", header: t("statusCol"), render: (r) => r.stock <= r.min_stock
                ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t("lowStock")}</span>
                : <span className="rounded-full bg-brand-green-50 px-2 py-0.5 text-xs font-medium text-brand-green-700">{t("activeStatus")}</span> },
              { header: t("actionCol"), render: (r) => (
                <div className="flex gap-2">
                  <button className="text-stone-400 hover:text-brand-green-700" title={t("editTooltip")} onClick={() => editRow(r)}><SlidersHorizontal size={14} /></button>
                  <button className="text-stone-400 hover:text-red-600" title={t("deactivateTooltip")} onClick={() => deactivate(r)}><Trash2 size={14} /></button>
                </div>
              ) },
            ]}
          />
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-brand-navy-900">{draft.id ? t("editProductTitle") : t("addEditProductTitle")}</h3>
          <Tabs
            tabs={[{ id: "details", label: t("productDetailsTab"), icon: Tags }, { id: "pricing", label: t("pricingStockTab"), icon: DollarSign }]}
            active={formTab} onChange={setFormTab}
          />

          {formTab === "details" && (
            <div className="space-y-3">
              <Field label={t("productNameEnglish")} value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <Field label={t("productNameUrdu")} dir="rtl" value={draft.name_urdu || ""} onChange={(e) => setDraft({ ...draft, name_urdu: e.target.value })} placeholder="مثال: سونا یوریا" />
              <SelectField label={t("categoryRequired")} value={draft.category_id || ""} onChange={(e) => setDraft({ ...draft, category_id: Number(e.target.value) })}>
                <option value="">{t("selectCategory")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{lang === "ur" ? (c.name_urdu || c.name) : c.name}</option>)}
              </SelectField>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("packageSize")} type="number" value={draft.package_size ?? 0} onChange={(e) => setDraft({ ...draft, package_size: Number(e.target.value) })} />
                <SelectField label={t("unitCol")} value={draft.package_unit || "KG"} onChange={(e) => setDraft({ ...draft, package_unit: e.target.value })}>
                  {["KG", "Bag", "L", "Piece", "Ton"].map((u) => <option key={u}>{u}</option>)}
                </SelectField>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1"><Field label={t("barcodeOptional")} value={draft.barcode || ""} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} /></div>
                <Button onClick={() => setDraft((d) => ({ ...d, barcode: d.sku || `PRD${String(d.id ?? "").padStart(6, "0")}` }))}><BarcodeIcon size={14} /></Button>
              </div>
              <TextAreaField label={t("descriptionOptional")} value={draft.brand || ""} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
              <div>
                <span className="label">{t("productImage")}</span>
                <div className="flex items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                    {draft.image_path ? <img src={`file://${draft.image_path}`} className="h-full w-full object-cover" /> : <Package size={16} className="text-stone-300" />}
                  </div>
                  <Button onClick={pickLogo}>{t("uploadImage")}</Button>
                </div>
              </div>
              {draft.id && (
                <Switch checked={(draft.status || "active") === "active"} onChange={(v) => setDraft({ ...draft, status: v ? "active" : "inactive" })} label={t("activeProductSwitch")} />
              )}
            </div>
          )}

          {formTab === "pricing" && (
            <div className="space-y-3">
              <Field label={t("purchaseCostPrice")} type="number" value={draft.purchase_price ?? 0} onChange={(e) => setDraft({ ...draft, purchase_price: Number(e.target.value) })} />
              <Field label={t("retailPriceLabel")} type="number" value={draft.retail_price ?? 0} onChange={(e) => setDraft({ ...draft, retail_price: Number(e.target.value) })} />
              <Field label={t("wholesalePriceLabel")} type="number" value={draft.wholesale_price ?? 0} onChange={(e) => setDraft({ ...draft, wholesale_price: Number(e.target.value) })} />
              <Field label={t("minimumReorderStock")} type="number" value={draft.min_stock ?? 0} onChange={(e) => setDraft({ ...draft, min_stock: Number(e.target.value) })} />
              {!draft.id ? (
                <Field label={t("openingStock")} type="number" value={(draft as { stock?: number }).stock ?? 0} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) } as Partial<Product>)} />
              ) : (
                <p className="rounded-md bg-stone-50 p-2 text-xs text-stone-500">
                  {t("currentStockPrefix")} <strong>{draft.stock} {draft.package_unit}</strong>. {t("stockAdjustHint")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={resetForm}><RotateCcw size={14} /> {t("resetBtn")}</Button>
            <Button variant="primary" className="flex-1" onClick={save}><Save size={14} /> {t("saveProduct")}</Button>
          </div>

          <div className="border-t border-stone-100 pt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{t("quickActions")}</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onNavigate?.("stockAdjustment")}><SlidersHorizontal size={14} /> {t("stockAdjustment")}</Button>
              <Button onClick={() => setBulkPrices(true)}><DollarSign size={14} /> {t("updatePrices")}</Button>
              <Button onClick={generateBarcodes}><BarcodeIcon size={14} /> {t("generateBarcodesBtn")}</Button>
              <Button onClick={() => setLowStockOnly((v) => !v)}><ListFilter size={14} /> {lowStockOnly ? t("showAll") : t("lowStockReport")}</Button>
            </div>
          </div>
        </div>
      </div>

      {manageCategories && <CategoriesModal categories={categories} onClose={() => setManageCategories(false)} onChanged={load} />}
      {bulkPrices && <BulkPricesModal products={products} onClose={() => setBulkPrices(false)} onSaved={load} actorId={user.id} />}
      {barcodeSheet && <BarcodeSheetModal products={products} onClose={() => setBarcodeSheet(false)} />}
      {printList && (
        <PrintableList
          title={t("productListTitle")}
          settings={settings}
          rows={rows}
          keyField={(r) => r.id}
          columns={[
            { header: t("productNameCol"), render: (r) => r.name },
            { header: t("categoryCol"), render: (r) => (lang === "ur" ? (r.category_name_urdu || r.category_name) : r.category_name) || "" },
            { header: t("unitCol"), render: (r) => `${r.package_size} ${r.package_unit}` },
            { header: t("stockCol"), render: (r) => `${r.stock} ${r.package_unit}` },
            { header: t("purchaseCol"), render: (r) => money(r.purchase_price) },
            { header: t("retail"), render: (r) => money(r.retail_price) },
            { header: t("wholesale"), render: (r) => money(r.wholesale_price) },
          ]}
        />
      )}
    </div>
  );
}

function CategoriesModal({ categories, onClose, onChanged }: { categories: Category[]; onClose: () => void; onChanged: () => void }) {
  const { push } = useToast();
  const { t } = useLang();
  const [name, setName] = useState("");
  const [nameUrdu, setNameUrdu] = useState("");

  async function add() {
    if (!name) return;
    await api.categoriesSave({ name, name_urdu: nameUrdu });
    push("success", "Category saved");
    setName(""); setNameUrdu("");
    onChanged();
  }

  return (
    <Modal title={t("categories")} onClose={onClose}>
      <div className="mb-4 space-y-1">
        {categories.map((c) => (
          <div key={c.id} className="flex justify-between rounded-md border border-stone-100 px-3 py-1.5 text-sm">
            <span>{c.name}</span><span className="text-stone-400" dir="rtl">{c.name_urdu}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Field label={t("categoryEnglish")} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t("categoryUrdu")} dir="rtl" value={nameUrdu} onChange={(e) => setNameUrdu(e.target.value)} />
      </div>
      <div className="mt-3 flex justify-end"><Button variant="primary" onClick={add} disabled={!name}>{t("addCategory")}</Button></div>
    </Modal>
  );
}

function BulkPricesModal({ products, onClose, onSaved, actorId }: { products: Product[]; onClose: () => void; onSaved: () => void; actorId: number }) {
  const { push } = useToast();
  const { t } = useLang();
  const [edits, setEdits] = useState<Record<number, { retail_price: number; wholesale_price: number }>>({});

  function set(id: number, field: "retail_price" | "wholesale_price", value: number, base: Product) {
    setEdits((v) => ({ ...v, [id]: { retail_price: v[id]?.retail_price ?? base.retail_price, wholesale_price: v[id]?.wholesale_price ?? base.wholesale_price, [field]: value } }));
  }

  async function saveAll() {
    const updates = Object.entries(edits).map(([id, v]) => ({ id: Number(id), ...v }));
    if (!updates.length) { onClose(); return; }
    await api.productsBulkUpdatePrices({ updates, actorId });
    push("success", `Updated prices for ${updates.length} product${updates.length === 1 ? "" : "s"}`);
    onSaved();
    onClose();
  }

  return (
    <Modal title={t("updatePrices")} onClose={onClose} wide>
      <div className="max-h-[60vh] overflow-y-auto">
        <DataTable
          keyField={(r) => r.id}
          rows={products}
          columns={[
            { header: t("productNameCol"), render: (r) => r.name },
            { header: t("retailPriceLabel"), render: (r) => (
              <input type="number" className="input" defaultValue={r.retail_price} onChange={(e) => set(r.id, "retail_price", Number(e.target.value), r)} />
            ) },
            { header: t("wholesalePriceLabel"), render: (r) => (
              <input type="number" className="input" defaultValue={r.wholesale_price} onChange={(e) => set(r.id, "wholesale_price", Number(e.target.value), r)} />
            ) },
          ]}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t("cancelBtn")}</Button>
        <Button variant="primary" onClick={saveAll}>{t("saveChangesBtn")}</Button>
      </div>
    </Modal>
  );
}

function BarcodeSheetModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => { const timer = setTimeout(() => window.print(), 200); return () => clearTimeout(timer); }, []);
  const withBarcode = products.filter((p) => p.barcode);
  return (
    <>
      <Modal title={t("barcodeLabelsTitle")} onClose={onClose} wide>
        <p className="mb-3 text-sm text-stone-500">{withBarcode.length} {t("labelsReadyHint")}</p>
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          {withBarcode.map((p) => (
            <div key={p.id} className="rounded-md border border-stone-200 p-2 text-center">
              <p className="truncate text-xs font-medium">{p.name}</p>
              <Barcode value={p.barcode || ""} height={30} />
              <p className="text-xs text-stone-500">{money(p.retail_price)}</p>
            </div>
          ))}
        </div>
      </Modal>
      <div id="print-root" className="print-a4">
        <div className="print-list">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6mm" }}>
            {withBarcode.map((p) => (
              <div key={p.id} style={{ textAlign: "center", border: "1px solid #ccc", padding: "3mm" }}>
                <div style={{ fontSize: 10 }}>{p.name}</div>
                <Barcode value={p.barcode || ""} height={28} fontSize={9} />
                <div style={{ fontSize: 10, fontWeight: 700 }}>Rs. {p.retail_price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
