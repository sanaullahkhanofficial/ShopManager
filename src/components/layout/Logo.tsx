import React from "react";
import { Wheat } from "lucide-react";

// Circular emblem badge — a crafted placeholder (no photography/external
// assets, so it renders identically offline) standing in for a supplied
// business logo until the owner provides real artwork.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-wheat-300 via-brand-wheat-500 to-brand-gold shadow-md ring-2 ring-white"
      style={{ width: size, height: size }}
    >
      <div className="flex items-center justify-center rounded-full bg-brand-green-700" style={{ width: size * 0.78, height: size * 0.78 }}>
        <Wheat className="text-brand-wheat-300" size={size * 0.5} />
      </div>
    </div>
  );
}
