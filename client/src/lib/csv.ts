/** Build CSV text. Values are always quoted; quotes are doubled; formulas are neutralised. */
export function toCSV(rows: Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return "";
  const columns = Object.keys(first);
  // Spreadsheet apps treat cells starting with = + - @ as formulas — prefix them with a quote.
  const safe = (v: unknown) => {
    const s = String(v ?? "");
    return /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  };
  const cell = (v: unknown) => `"${safe(v).replaceAll('"', '""')}"`;
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\n");
}

export function downloadCSV(name: string, rows: Record<string, unknown>[]): boolean {
  if (!rows.length) return false;
  const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
