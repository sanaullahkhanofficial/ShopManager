import React from "react";
import { formatDate } from "../lib/format";
import type { Settings } from "../types";

export interface PrintableColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

// Generic "Print List" output shared by every page's Print List/Print
// Customer List/Print Supplier List button — reuses the same hidden
// #print-root mechanism as receipt printing (see index.css), sized for A4
// via the .print-a4 modifier instead of 58mm.
export function PrintableList<T>({ title, settings, columns, rows, keyField }: {
  title: string; settings: Settings; columns: PrintableColumn<T>[]; rows: T[]; keyField: (row: T) => React.Key;
}) {
  return (
    <div id="print-root" className="print-a4">
      <div className="print-list">
        <h1>{settings.business_title || settings.business_name}</h1>
        <p>{title} — printed {formatDate(new Date().toISOString())}</p>
        <table>
          <thead><tr>{columns.map((c, i) => <th key={i}>{c.header}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={keyField(row)}>{columns.map((c, i) => <td key={i}>{c.render(row)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
