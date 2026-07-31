export function neutralizeSpreadsheetFormula(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown) {
  const text = neutralizeSpreadsheetFormula(value === null || value === undefined ? "" : String(value));
  return `"${text.replaceAll('"', '""')}"`;
}

export function recordsToCsv(records: Array<Record<string, unknown>>, fallbackHeaders: string[] = []) {
  const headers = records.length ? Object.keys(records[0]) : fallbackHeaders;
  return [
    headers.map(csvCell).join(";"),
    ...records.map((record) => headers.map((header) => csvCell(record[header])).join(";")),
  ].join("\n");
}
