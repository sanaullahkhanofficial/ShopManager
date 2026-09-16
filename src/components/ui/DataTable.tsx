import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Stable id enabling this column to be hidden via the Columns toggle (storageKey prop). Columns without a key can never be hidden. */
  key?: string;
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
  /** Enables a "Columns" show/hide toggle for every column that has a `key`, persisted in localStorage under this key. Omit for a table where every column always shows (the previous, default behavior). */
  storageKey?: string;
}

function useHiddenColumns(storageKey?: string) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (!storageKey) return new Set();
    try {
      const raw = localStorage.getItem(`dataTableHiddenCols:${storageKey}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(`dataTableHiddenCols:${storageKey}`, JSON.stringify([...hidden])); } catch { /* per-viewer convenience only */ }
  }, [hidden, storageKey]);
  return [hidden, setHidden] as const;
}

function ColumnsToggle<T>({ columns, hidden, setHidden }: { columns: Column<T>[]; hidden: Set<string>; setHidden: (fn: (h: Set<string>) => Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  const toggleable = columns.filter((c) => c.key);
  if (!toggleable.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
      >
        <Columns3 size={13} /> Columns <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 space-y-1 rounded-card border border-stone-200 bg-white p-2 shadow-xl">
          {toggleable.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-stone-700 hover:bg-stone-50">
              <input
                type="checkbox"
                checked={!hidden.has(c.key as string)}
                onChange={() => setHidden((h) => {
                  const next = new Set(h);
                  next.has(c.key as string) ? next.delete(c.key as string) : next.add(c.key as string);
                  return next;
                })}
              />
              {c.header}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataTable<T>({ columns, rows, keyField, emptyLabel, pageSize, onRowClick, storageKey }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(pageSize || 20);
  const [hidden, setHidden] = useHiddenColumns(storageKey);
  useEffect(() => setPage(1), [rows.length, perPage]);

  const visibleColumns = columns.filter((c) => !c.key || !hidden.has(c.key));
  const columnsButton = storageKey ? <ColumnsToggle columns={columns} hidden={hidden} setHidden={setHidden} /> : null;

  if (!rows.length) return <EmptyState label={emptyLabel || "No records found"} />;

  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / perPage)) : 1;
  const clampedPage = Math.min(page, totalPages);
  const pageRows = pageSize ? rows.slice((clampedPage - 1) * perPage, clampedPage * perPage) : rows;

  return (
    <div className="space-y-2">
      {columnsButton && <div className="flex justify-end">{columnsButton}</div>}
      <div className="overflow-x-auto rounded-card border border-stone-200">
        <table className="table-base">
          <thead>
            <tr>{visibleColumns.map((c, i) => <th key={i} className={c.className}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={keyField(row)}
                className={`hover:bg-stone-50 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {visibleColumns.map((c, i) => <td key={i} className={c.className}>{c.render(row)}</td>)}
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
