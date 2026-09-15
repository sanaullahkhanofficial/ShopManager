import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  /** Enables built-in client-side pagination (e.g. 20) with a page-size selector and page numbers. Omit for a plain unpaginated table. */
  pageSize?: number;
  /** Makes each row clickable (e.g. select a record to view detail in a side panel). */
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, keyField, emptyLabel, pageSize, onRowClick }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(pageSize || 20);
  useEffect(() => setPage(1), [rows.length, perPage]);

  if (!rows.length) return <EmptyState label={emptyLabel || "No records found"} />;

  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / perPage)) : 1;
  const clampedPage = Math.min(page, totalPages);
  const pageRows = pageSize ? rows.slice((clampedPage - 1) * perPage, clampedPage * perPage) : rows;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-card border border-stone-200">
        <table className="table-base">
          <thead>
            <tr>{columns.map((c, i) => <th key={i} className={c.className}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={keyField(row)}
                className={`hover:bg-stone-50 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c, i) => <td key={i} className={c.className}>{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <span>
            Showing {(clampedPage - 1) * perPage + 1} to {Math.min(clampedPage * perPage, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <select className="rounded-md border border-stone-300 px-1.5 py-1" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button className="rounded border border-stone-300 p-1 disabled:opacity-30" disabled={clampedPage <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={14} />
            </button>
            <span>Page {clampedPage} of {totalPages}</span>
            <button className="rounded border border-stone-300 p-1 disabled:opacity-30" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
