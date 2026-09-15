import React, { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Category, Product } from "../types";

export function Products({ user }: { user: AuthUser }) {
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [manageCategories, setManageCategories] = useState(false);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.categoriesList().then((c) => setCategories(c as Category[]));
  };
  useEffect(load, []);

  const rows = products.filter((p) => (p.name + " " + p.name_urdu + " " + (p.sku || "")).toLowerCase().includes(query.toLowerCase()));

  async function save() {
    if (!edit?.name || !edit.category_id) { push("error", "Name and category are required"); return; }
    await api.productsSave({ ...edit, actorId: user.id });
    push("success", "Product saved");
    setEdit(null);
    load();
  }

  async function saveAdjustment(qty: number, reason: string) {
    if (!adjust) return;
    await api.productsAdjust({ product_id: adjust.id, quantity: qty, unit_cost: adjust.purchase_price, reason, actorId: user.id });
    push("success", "Stock adjusted");
    setAdjust(null);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={() => setManageCategories(true)}>Categories</Button>
        <Button variant="primary" onClick={() => setEdit({ package_unit: "KG" })}><Plus size={15} /> Add Product</Button>
      </div>

      <DataTable
        keyField={(r) => r.id}
        rows={rows}
        columns={[
          { header: "Product", render: (r) => <div><p className="font-medium text-stone-800">{r.name}</p><p className="text-xs text-stone-400" dir="rtl">{r.name_urdu}</p></div> },
          { header: "Category", render: (r) => r.category_name },
          { header: "Pack", render: (r) => `${r.package_size} ${r.package_unit}` },
          { header: "Cost", render: (r) => money(r.avg_cost || r.purchase_price) },
          { header: "Retail", render: (r) => money(r.retail_price) },
          { header: "Wholesale", render: (r) => money(r.wholesale_price) },
          { header: "Stock", render: (r) => `${r.stock} ${r.package_unit}` },
          { header: "Status", render: (r) => r.stock <= r.min_stock ? <span className="text-amber-600">⚠ Low</span> : <span className="text-brand-green-600">OK</span> },
          { header: "", render: (r) => (
            <div className="flex gap-2">
              <button className="text-xs font-medium text-brand-green-700 hover:underline" onClick={() => setEdit(r)}>Edit</button>
              <button className="text-xs font-medium text-stone-500 hover:underline" onClick={() => setAdjust(r)}>Adjust Stock</button>
            </div>
          ) },
        ]}
      />

      {edit && (
        <Modal title={edit.id ? "Edit Product" : "Add Product"} onClose={() => setEdit(null)} wide>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Product Name (English)" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Field label="Product Name (Urdu)" dir="rtl" value={edit.name_urdu || ""} onChange={(e) => setEdit({ ...edit, name_urdu: e.target.value })} />
            <SelectField label="Category" value={edit.category_id || ""} onChange={(e) => setEdit({ ...edit, category_id: Number(e.target.value) })}>
              <option value="">Select</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
            <Field label="SKU / Barcode" value={edit.sku || ""} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} />
            <Field label="Package Size" type="number" value={edit.package_size ?? 0} onChange={(e) => setEdit({ ...edit, package_size: Number(e.target.value) })} />
            <Field label="Unit" value={edit.package_unit || "KG"} onChange={(e) => setEdit({ ...edit, package_unit: e.target.value })} />
            <Field label="Cost / Purchase Price" type="number" value={edit.purchase_price ?? 0} onChange={(e) => setEdit({ ...edit, purchase_price: Number(e.target.value) })} />
            <Field label="Retail Price" type="number" value={edit.retail_price ?? 0} onChange={(e) => setEdit({ ...edit, retail_price: Number(e.target.value) })} />
            <Field label="Wholesale Price" type="number" value={edit.wholesale_price ?? 0} onChange={(e) => setEdit({ ...edit, wholesale_price: Number(e.target.value) })} />
            <Field label="Minimum / Reorder Stock" type="number" value={edit.min_stock ?? 0} onChange={(e) => setEdit({ ...edit, min_stock: Number(e.target.value) })} />
            {!edit.id && <Field label="Opening Stock" type="number" value={(edit as any).stock ?? 0} onChange={(e) => setEdit({ ...edit, stock: Number(e.target.value) } as any)} />}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Product</Button>
          </div>
        </Modal>
      )}

      {adjust && <AdjustModal product={adjust} onClose={() => setAdjust(null)} onSave={saveAdjustment} />}
      {manageCategories && <CategoriesModal categories={categories} onClose={() => setManageCategories(false)} onChanged={load} />}
    </div>
  );
}

function CategoriesModal({ categories, onClose, onChanged }: { categories: Category[]; onClose: () => void; onChanged: () => void }) {
  const { push } = useToast();
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
    <Modal title="Categories" onClose={onClose}>
      <div className="mb-4 space-y-1">
        {categories.map((c) => (
          <div key={c.id} className="flex justify-between rounded-md border border-stone-100 px-3 py-1.5 text-sm">
            <span>{c.name}</span><span className="text-stone-400" dir="rtl">{c.name_urdu}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Field label="Category (English)" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Category (Urdu)" dir="rtl" value={nameUrdu} onChange={(e) => setNameUrdu(e.target.value)} />
      </div>
      <div className="mt-3 flex justify-end"><Button variant="primary" onClick={add} disabled={!name}>Add Category</Button></div>
    </Modal>
  );
}

function AdjustModal({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (qty: number, reason: string) => void }) {
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Adjust Stock — ${product.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-stone-500">Current stock: {product.stock} {product.package_unit}</p>
      <div className="space-y-3">
        <Field label="Quantity (use a negative number to reduce stock)" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damage, loss, recount, opening stock…" />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave(qty, reason)} disabled={!qty}>Save Adjustment</Button>
      </div>
    </Modal>
  );
}
