import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
}

export function Barcode({ value, height = 40, width = 1.4, fontSize = 12, displayValue = true }: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", height, width, fontSize, displayValue, margin: 4 });
    } catch {
      // Invalid characters for CODE128 (rare for our SKUs) — leave the SVG empty rather than crash the page.
    }
  }, [value, height, width, fontSize, displayValue]);
  if (!value) return null;
  return <svg ref={ref} />;
}
