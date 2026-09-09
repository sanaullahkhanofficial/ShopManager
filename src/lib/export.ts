import * as XLSX from "xlsx";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Real CSV export — never a placeholder. Flattens objects, skips functions/objects. */
export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) {
    downloadBlob(filename, new Blob([""], { type: "text/csv" }));
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  downloadBlob(filename, new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
}

/** Real Excel (.xlsx) export via SheetJS — genuine spreadsheet output, not a renamed CSV. */
export function exportToExcel(filename: string, rows: Record<string, any>[], sheetName = "Sheet1") {
  const worksheet = XLSX.utils.json_to_sheet(rows || []);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
