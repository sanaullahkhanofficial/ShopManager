import React, { useState } from "react";
import { Sparkles, ShieldCheck, Send, Bot, User as UserIcon } from "lucide-react";
import { api } from "../lib/api";
import { money, formatDate } from "../lib/format";
import { Button } from "../components/ui/Button";
import type { AssistantResponse } from "../types";

const SAMPLE_QUESTIONS = [
  "What were today's sales?", "Which products are low in stock?", "Which customer owes the most?",
  "How much cash do we have?", "What's our best selling product?",
];

// Every answer sentence here is built purely from the real `data` this
// intent's SQL query returned (see assistant:ask in electron/main.cjs) —
// never invented text. The raw data is also rendered underneath as its own
// labeled breakdown so a figure in the sentence is always traceable back to
// the exact number it came from, not just prose that might drift from it.
function describe(res: AssistantResponse): { sentence: string; facts: Array<[string, string]> } {
  const d: any = res.data;
  switch (res.intent) {
    case "sales_today":
    case "sales_yesterday": {
      const label = res.intent === "sales_today" ? "Today" : "Yesterday";
      return {
        sentence: d.count > 0
          ? `${label} (${formatDate(d.date)}) had ${money(d.total)} in sales across ${d.count} invoice${d.count === 1 ? "" : "s"}.`
          : `${label} (${formatDate(d.date)}) has no completed sales recorded.`,
        facts: [["Date", formatDate(d.date)], ["Total sales", money(d.total)], ["Invoices", String(d.count)]],
      };
    }
    case "sales_month":
      return {
        sentence: d.count > 0
          ? `This month so far (${formatDate(d.from)} – ${formatDate(d.to)}) totals ${money(d.total)} across ${d.count} invoice${d.count === 1 ? "" : "s"}.`
          : `No completed sales recorded yet this month.`,
        facts: [["From", formatDate(d.from)], ["To", formatDate(d.to)], ["Total sales", money(d.total)], ["Invoices", String(d.count)]],
      };
    case "low_stock":
      return {
        sentence: d.count > 0
          ? `${d.count} product${d.count === 1 ? " is" : "s are"} at or below its reorder level: ${d.items.slice(0, 5).map((i: any) => i.name).join(", ")}${d.count > 5 ? `, and ${d.count - 5} more` : ""}.`
          : `No products are currently at or below their reorder level.`,
        facts: d.items.slice(0, 8).map((i: any) => [i.name, `${i.stock} ${i.package_unit} (reorder at ${i.min_stock})`]),
      };
    case "top_debtor":
      return d
        ? { sentence: `${d.name} owes the most of any customer, with an outstanding balance of ${money(d.balance)}.`, facts: [["Customer", d.name], ["Outstanding balance", money(d.balance)]] }
        : { sentence: "No customer currently has an outstanding balance.", facts: [] };
    case "top_payable":
      return d
        ? { sentence: `We owe ${d.name} the most of any supplier, with an outstanding balance of ${money(d.balance)}.`, facts: [["Supplier", d.name], ["Outstanding balance", money(d.balance)]] }
        : { sentence: "We don't currently owe any supplier an outstanding balance.", facts: [] };
    case "cash_in_hand":
      return d.open
        ? { sentence: `The cash register is open with ${money(d.cashInHand)} in hand.`, facts: [["Register", "Open"], ["Cash in hand", money(d.cashInHand)]] }
        : { sentence: "The cash register is currently closed, so there's no cash-in-hand figure to report.", facts: [["Register", "Closed"]] };
    case "top_product":
      return d
        ? { sentence: `${d.name} is the best seller this month by revenue — ${d.qty} ${d.package_unit} sold for ${money(d.revenue)}.`, facts: [["Product", d.name], ["Quantity sold", `${d.qty} ${d.package_unit}`], ["Revenue", money(d.revenue)], ["Period", `${formatDate(d.from)} – ${formatDate(d.to)}`]] }
        : { sentence: "No products have sold yet this month.", facts: [] };
    case "profit_today":
      return {
        sentence: `Today's profit is ${money(d.profit)} — ${money(d.sales)} in sales minus ${money(d.cogs)} cost of goods sold.`,
        facts: [["Sales", money(d.sales)], ["Cost of goods sold", money(d.cogs)], ["Profit", money(d.profit)]],
      };
    case "stock_value":
      return { sentence: `Current stock on hand is worth ${money(d.value)} at average cost.`, facts: [["Stock value", money(d.value)]] };
    default:
      return { sentence: "", facts: [] };
  }
}

interface Turn { question: string; res: AssistantResponse }

export function AIAssistant() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuestion("");
    try {
      const res = await api.assistantAsk(text);
      setTurns((t) => [...t, { question: text, res }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-4">
      <div className="card flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-wheat-100 text-brand-gold">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-brand-navy-900">AI Business Assistant</h2>
          <p className="mt-1 text-sm text-stone-500">
            A small, fixed set of real questions answered straight from this shop's own database — not a general
            chatbot. Every figure below is traceable to an actual query, shown separately underneath the sentence.
          </p>
        </div>
      </div>

      {turns.length === 0 && (
        <div className="card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto">
        {turns.map((t, i) => {
          const { sentence, facts } = t.res.matched ? describe(t.res) : { sentence: "", facts: [] };
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-start justify-end gap-2">
                <div className="max-w-md rounded-2xl rounded-tr-sm bg-brand-green-600 px-3.5 py-2 text-sm text-white">{t.question}</div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy-100 text-brand-navy-700"><UserIcon size={14} /></div>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold"><Bot size={14} /></div>
                <div className="max-w-md space-y-2 rounded-2xl rounded-tl-sm bg-stone-100 px-3.5 py-2.5 text-sm text-brand-navy-900">
                  {t.res.matched ? (
                    <>
                      <p>{sentence}</p>
                      {facts.length > 0 && (
                        <dl className="space-y-0.5 border-t border-stone-200 pt-2 text-xs text-stone-500">
                          {facts.map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3">
                              <dt>{k}</dt><dd className="font-medium text-stone-700">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  ) : (
                    <>
                      <p>I don&apos;t have an answer for that yet. I can help with:</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {t.res.capabilities.map((c) => (
                          <span key={c} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-stone-600">{c}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(question)}
          placeholder="Ask about sales, stock, customers, cash…"
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-green-600"
        />
        <Button variant="primary" onClick={() => ask(question)} disabled={busy || !question.trim()}>
          <Send size={14} />
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>Read-only: it can only report real numbers from this database. It never deletes or changes sales, purchases, stock, cash, or permissions.</span>
      </div>
    </div>
  );
}
