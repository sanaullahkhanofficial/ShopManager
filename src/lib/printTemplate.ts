// Wraps inner print HTML (built per-document by callers) into a full
// standalone HTML document with print-friendly base styles, ready to hand
// to Electron's printToPDF/print via api.print.*.
export function printDocument(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 24px; }
  .doc { max-width: 800px; margin: 0 auto; }
  .doc-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
  .doc-header h1 { font-size: 18px; margin: 0; }
  .doc-header p { font-size: 12px; color: #4b5563; margin: 2px 0 0; }
  .doc-title { text-align: center; margin: 12px 0 20px; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-bottom: 16px; }
  .grid-2 div span:first-child { color: #6b7280; display: inline-block; min-width: 120px; }
  .totals { margin-top: 12px; width: 300px; margin-left: auto; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { font-weight: 700; border-top: 2px solid #111827; margin-top: 4px; padding-top: 6px; }
  .signature { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; }
  .signature div { border-top: 1px solid #111827; padding-top: 4px; width: 180px; text-align: center; }
  .footer-note { text-align: center; font-size: 11px; color: #6b7280; margin-top: 24px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-paid { background: #dcfce7; color: #166534; }
  .badge-partial { background: #fef3c7; color: #92400e; }
  .badge-unpaid { background: #fee2e2; color: #991b1b; }
  @page { margin: 16mm; }
</style>
</head>
<body>
<div class="doc">${bodyHtml}</div>
</body>
</html>`;
}

export function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
