import { markFileDuplicates } from "./import-deduplication";
import { autoMapColumns, mergeManualMapping } from "./import-mapper";
import { parseImportCsv } from "./import-parser";
import type { ColumnMapping, ImportLimits, ImportPreview, ImportType } from "./import-types";
import { validateImportRows } from "./import-validator";

export function previewImport(options: {
  content: string;
  type: ImportType;
  delimiter?: "," | ";";
  manualMapping?: ColumnMapping;
  dateFormat?: "DMY" | "MDY";
  limits?: ImportLimits;
}): ImportPreview {
  const parsed = parseImportCsv(options.content, options.limits, options.delimiter);
  const automatic = autoMapColumns(parsed.headers, options.type);
  const mapping = options.manualMapping ? mergeManualMapping(automatic, options.manualMapping) : automatic;
  const rows = markFileDuplicates(options.type, validateImportRows(parsed.rows, mapping, options.type, options.dateFormat));
  return {
    type: options.type,
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    mapping,
    rows,
    summary: {
      total: rows.length,
      valid: rows.filter((row) => row.status === "valid").length,
      warnings: rows.filter((row) => row.status === "warning").length,
      errors: rows.filter((row) => row.status === "invalid").length,
      duplicates: rows.filter((row) => row.issues.some((issue) => issue.message.includes("Doublon"))).length,
    },
  };
}
