import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { useToast } from "../components/ui/Toast";
import type { AuthUser, Location, LocationStock, Product, Settings, StockMovement } from "../types";

export function StockAdjustment({ user, settings }: { user: AuthUser; settings: Settings }) {
  const { push } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationStock, setLocationStock] = useState<LocationStock[]>([]);
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<StockMovement[]>([]);

  const multiLocation = settings.enable_multi_location === "1";

  const load = () => {
    api.productsList().then((p) => setProducts(p as Product[]));
    api.locationsList().then((l) => setLocations(l as Location[]));
    api.stockMovementsList({ types: ["STOCK_ADJUSTMENT_IN", "STOCK_ADJUSTMENT_OUT"], limit: 50 }).then((r) => setRows(r as StockMovement[]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!productId) { setLocationStock([]); return; }
    api.stockByLocation(Number(productId)).then((r) => setLocationStock(r as LocationStock[]));
  }, [productId]);

  const product = products.find((p) => String(p.id) === productId);

  async function save() {
    if (!productId || !quantity) { push("error", "Select a product and a non-zero quantity"); return; }
    await api.productsAdjust({
      product_id: Number(productId), location_id: locationId ? Number(locationId) : undefined,
      quantity, unit_cost: product?.purchase_price, reason, actorId: user.id,
    });
    push("success", "Stock adjusted");
    setQuantity(0); setReason("");
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="card space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy-900"><SlidersHorizontal size={16} /> Adjust Stock</h3>
        <SelectField label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.stock} {p.package_unit} total</option>)}
        </SelectField>
        {multiLocation && (
          <SelectField label="Location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Default location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </SelectField>
        )}
        {locationStock.length > 0 && (
          <div className="rounded-md bg-stone-50 p-2 text-xs text-stone-500">
            {locationStock.map((l) => <div key={l.location_id} className="flex justify-between"><span>{l.location_name}</span><span>{l.stock} {product?.package_unit}</span></div>)}
          </div>
        )}
        <Field label="Quantity (negative to reduce stock)" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <Field label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damage, loss, recount, opening stock…" />
        <Button variant="primary" className="w-full" onClick={save} disabled={!productId || !quantity}>Save Adjustment</Button>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-brand-navy-900">Recent Adjustments</h3>
        <DataTable
          keyField={(r) => r.id}
          rows={rows}
          pageSize={20}
          columns={[
            { header: "Date", render: (r) => formatDateTime(r.created_at) },
            { header: "Product", render: (r) => r.product_name },
            { header: "Location", render: (r) => r.location_name || "—" },
            { header: "Quantity", render: (r) => <span className={r.quantity >= 0 ? "text-brand-green-700" : "text-red-600"}>{r.quantity >= 0 ? "+" : ""}{r.quantity} {r.package_unit}</span> },
            { header: "New Stock", render: (r) => `${r.new_stock} ${r.package_unit}` },
            { header: "Reason", render: (r) => r.reason },
          ]}
        />
      </div>
    </div>
  );
}
