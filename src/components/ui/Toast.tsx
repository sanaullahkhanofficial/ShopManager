import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; message: string }

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((v) => [...v, { id, kind, message }]);
    setTimeout(() => setItems((v) => v.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${
              t.kind === "success" ? "border-brand-green-300 bg-brand-green-50 text-brand-green-800" :
              t.kind === "error" ? "border-red-300 bg-red-50 text-red-800" :
              "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {t.kind === "success" ? <CheckCircle2 size={16} /> : t.kind === "error" ? <AlertTriangle size={16} /> : <Info size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
