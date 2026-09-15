import React from "react";
import { money, formatDateTime } from "../lib/format";
import type { Settings } from "../types";

// Shared receipt data model (Section 77): one finalized transaction renders
// into both the Customer Copy and Office Copy so they can never diverge
// (Section 78). In the browser/PWA path this uses window.print(); a native
// ESC/POS path for the Tauri desktop build is tracked in ROADMAP.md.
export interface ReceiptData {
  invoiceNo: string;
  date: string;
  cashier: string;
  customerName?: string;
  customerPhone?: string;
  mode: "Retail" | "Wholesale";
  items: Array<{ name: string; qty: number; unit: string; rate: number; amount: number }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paid: number;
  remaining: number;
}

function ReceiptCopy({ data, settings, label, footerNote }: { data: ReceiptData; settings: Settings; label: string; footerNote: string }) {
  return (
    <div className="receipt-copy">
      <div className="center bold">{settings.business_name?.toUpperCase() || "HAJI ABDUL MANAN & ABDUL HANAN"}</div>
      <div className="center">ATTA DEALER PISHIN</div>
      <div className="center">FERTILIZERS | GRAINS | ATTA</div>
      {settings.phone && <div className="center">{settings.phone}</div>}
      <div className="divider" />
      <div className="row"><span>Invoice:</span><span>{data.invoiceNo}</span></div>
      <div className="row"><span>Date:</span><span>{formatDateTime(data.date)}</span></div>
      <div className="row"><span>Cashier:</span><span>{data.cashier}</span></div>
      <div className="row"><span>Mode:</span><span>{data.mode}</span></div>
      {data.customerName && <div className="row"><span>Customer:</span><span>{data.customerName}</span></div>}
      {data.customerPhone && <div className="row"><span>Phone:</span><span>{data.customerPhone}</span></div>}
      <div className="divider" />
      {data.items.map((it, i) => (
        <div key={i}>
          <div>{it.name}</div>
          <div className="row"><span>{it.qty} {it.unit} x {money(it.rate)}</span><span>{money(it.amount)}</span></div>
        </div>
      ))}
      <div className="divider" />
      <div className="row"><span>Subtotal</span><span>{money(data.subtotal)}</span></div>
      {data.discount > 0 && <div className="row"><span>Discount</span><span>-{money(data.discount)}</span></div>}
      <div className="row bold"><span>TOTAL</span><span>{money(data.total)}</span></div>
      <div className="divider" />
      <div className="row"><span>Payment</span><span>{data.paymentMethod}</span></div>
      <div className="row"><span>Received</span><span>{money(data.paid)}</span></div>
      <div className="row"><span>Remaining</span><span>{money(data.remaining)}</span></div>
      <div className="divider" />
      <div className="center">{footerNote}</div>
      <div className="center bold">{label}</div>
    </div>
  );
}

// variant="hidden" (default): the print-only #print-root used by Save & Print
// flows (invisible until window.print() — see index.css). variant="visible":
// the same markup rendered inline on screen, for an on-screen "Preview
// Invoice" panel — never render both variants for the same data at once,
// each already renders both copies internally.
export function ReceiptPreview({ data, settings, variant = "hidden" }: { data: ReceiptData; settings: Settings; variant?: "hidden" | "visible" }) {
  const copies = (
    <>
      {settings.print_customer_copy !== "0" && (
        <ReceiptCopy data={data} settings={settings} label="CUSTOMER COPY" footerNote={settings.invoice_footer || "Thank you for your purchase!"} />
      )}
      {settings.print_office_copy !== "0" && (
        <ReceiptCopy data={data} settings={settings} label="OFFICE COPY" footerNote="For internal record only." />
      )}
    </>
  );
  if (variant === "visible") return <div className="flex flex-wrap justify-center gap-4">{copies}</div>;
  return <div id="print-root">{copies}</div>;
}
