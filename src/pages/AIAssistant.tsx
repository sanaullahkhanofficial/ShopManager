import React from "react";
import { Sparkles, ShieldCheck, Database } from "lucide-react";

// Honest placeholder (Section 59-60): the AI Assistant is planned but not
// built yet. Rather than a dead nav item, this page states exactly what it
// will do and the safety rule it will follow, so nobody mistakes silence
// for a working feature.
export function AIAssistant() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-wheat-100 text-brand-gold">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-brand-navy-900">AI Business Assistant — planned, not yet built</h2>
          <p className="mt-1 text-sm text-stone-500">
            This page is a placeholder, not a working feature. It will eventually answer questions like
            "What were today's sales?", "Which products are low in stock?" or "Which customer owes the most?"
            by querying this shop's real database — never by inventing figures.
          </p>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green-50 text-brand-green-700">
          <Database size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-navy-900">Answers will always cite real data</h3>
          <p className="mt-1 text-sm text-stone-500">
            Every figure it shows will be traceable to an actual database query, clearly separated from any
            explanatory text the assistant adds around it.
          </p>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-navy-900">It will never act on its own</h3>
          <p className="mt-1 text-sm text-stone-500">
            The assistant will only be able to recommend. It won't delete sales or purchases, change financial
            records or stock, withdraw cash, or change permissions — those always go through the normal screens
            with a real user behind them.
          </p>
        </div>
      </div>
    </div>
  );
}
