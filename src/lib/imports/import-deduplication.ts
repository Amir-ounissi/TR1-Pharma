import type { ImportType, ValidatedImportRow } from "./import-types";

function keyPart(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function buildDeduplicationKey(type: ImportType, row: ValidatedImportRow) {
  const value = row.normalized;
  if (type === "products") return value.sku ? `product:${keyPart(value.sku)}` : value.ean ? `ean:${keyPart(value.ean)}` : null;
  if (type === "pharmacies") return value.external_id
    ? `pharmacy:${keyPart(value.external_id)}`
    : `pharmacy-address:${keyPart(value.pharmacy_name)}|${keyPart(value.address_line_1)}|${keyPart(value.postal_code)}`;
  if (type === "orders") return value.external_order_id ? `order:${keyPart(value.external_order_id)}` : null;
  if (type === "users") return value.email ? `user:${keyPart(value.email)}` : null;
  return value.territory_code ? `territory:${keyPart(value.territory_code)}` : null;
}

export function markFileDuplicates(type: ImportType, rows: ValidatedImportRow[]) {
  const counts = new Map<string, number>();
  return rows.map((row) => {
    const deduplicationKey = buildDeduplicationKey(type, row);
    if (deduplicationKey) counts.set(deduplicationKey, (counts.get(deduplicationKey) ?? 0) + 1);
    return { ...row, deduplicationKey };
  }).map((row) => {
    if (!row.deduplicationKey || (counts.get(row.deduplicationKey) ?? 0) === 1) return row;
    return {
      ...row,
      status: row.status === "invalid" ? "invalid" as const : "warning" as const,
      issues: [...row.issues, { column: "*", value: row.deduplicationKey, message: "Doublon présent dans le fichier.", suggestion: "Choisissez créer, mettre à jour, ignorer ou résoudre manuellement.", severity: "warning" as const }],
    };
  });
}
