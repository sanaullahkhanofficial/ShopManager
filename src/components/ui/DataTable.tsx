import React from "react";
import { EmptyState } from "./EmptyState";

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyField: (row: T) => React.Key;
  emptyLabel?: string;
}

export function DataTable<T>({ columns, rows, keyField, emptyLabel }: DataTableProps<T>) {
  if (!rows.length) return <EmptyState label={emptyLabel || "No records found"} />;
  return (
    <div className="overflow-x-auto rounded-card border border-stone-200">
      <table className="table-base">
        <thead>
          <tr>{columns.map((c, i) => <th key={i} className={c.className}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyField(row)} className="hover:bg-stone-50">
              {columns.map((c, i) => <td key={i} className={c.className}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
