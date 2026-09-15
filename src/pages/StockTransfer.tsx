import React, { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Location, LocationStock, Product, Settings, StockMovement } from "../types";

export function StockTransfer({ user, settings }: { user: AuthUser; settings: Settings }) {
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locationStock, setLocationStock] = useState<LocationStock[]>([]);
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<StockMovement[]>([]);

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.locationsList().then((l) => setLocations(l as Location[]));
    api.stockMovementsList({ types: ["TRANSFER"], limit: 50 }).then((r) => setRows(r as StockMovement[]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!productId) { setLocationStock([]); return; }
    api.stockByLocation(Number(productId)).then((r) => setLocationStock(r as LocationStock[]));
  }, [productId]);

  const product = products.find((p) => String(p.id) === productId);
  const available = locationStock.find((l) => String(l.location_id) === from)?.stock ?? 0;

  async function save() {
    if (!productId || !from || !to || from === to || quantity <= 0) { push("error", "Select a product, two different locations, and a positive quantity"); return; }
    try {
      await api.stockTransfer({ product_id: Number(productId), from_location_id: Number(from), to_location_id: Number(to), quantity, reason, actorId: user.id });
      push("success", "Stock transferred");
      setQuantity(0); setReason("");
      load();
      api.stockByLocation(Number(productId)).then((r) => setLocationStock(r as LocationStock[]));
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Unable to transfer stock");
    }
  }

  if (settings.enable_multi_location !== "1" && locations.length < 2) {
    return (
      <div className="card max-w-lg">
        <p className="text-sm text-stone-500">
          Stock transfer moves quantity between locations. Add a second location under
          Settings → Locations &amp; Warehouses (and turn on "Enable Multi-Location Stock Selector" under System
          Settings) to use this page — today everything is tracked under a single default location.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="card space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><ArrowLeftRight size={16} /> Transfer Stock</h3>
        <SelectField label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectField>
        <SelectField label="From Location" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Select</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </SelectField>
        <SelectField label="To Location" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Select</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </SelectField>
        {from && <p className="text-xs text-stone-400">Available at source: {available} {product?.package_unit}</p>}
        <Field label="Quantity" type="number" min={0} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rebalancing, restock godown…" />
        <Button variant="primary" className="w-full" onClick={save} disabled={!productId || !from || !to || quantity <= 0}>Save Transfer</Button>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Recent Transfers</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          pageSize={20}
          columns={[
            { header: "Date", render: (r) => formatDateTime(r.created_at) },
            { header: "Product", render: (r) => r.product_name },
            { header: "Location", render: (r) => r.location_name || "—" },
            { header: "Quantity", render: (r) => <span className={r.quantity >= 0 ? "text-brand-green-700" : "text-red-600"}>{r.quantity >= 0 ? "+" : ""}{r.quantity} {r.package_unit}</span> },
            { header: "Reference", render: (r) => r.reference },
          ]}
        />
      </div>
    </div>
  );
}
