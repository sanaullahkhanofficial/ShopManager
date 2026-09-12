/** Formats a nutrition value for display: null becomes an em dash, never "0" or "N/A". */
export function formatValue(value: number | null, unit = ''): string {
  if (value === null) return '—';
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

export function formatSigned(value: number | null, unit = ''): string {
  if (value === null) return 'Data unavailable';
  if (value === 0) return `Same${unit ? ' (' + unit + ')' : ''}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatValue(value, unit)}`;
}
