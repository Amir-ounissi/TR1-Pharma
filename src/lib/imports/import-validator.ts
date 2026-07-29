import { missingRequiredColumns } from "./import-mapper";
import { normalizeImportValue } from "./import-normalizer";
import { IMPORT_COLUMNS, type ColumnMapping, type ImportIssue, type ImportType, type ParsedImportRow, type ValidatedImportRow } from "./import-types";

export function validateImportRows(
  rows: ParsedImportRow[],
  mapping: ColumnMapping,
  type: ImportType,
  dateFormat?: "DMY" | "MDY",
): ValidatedImportRow[] {
  const missing = missingRequiredColumns(mapping, type);
  if (missing.length) throw new Error(`Colonnes obligatoires manquantes : ${missing.join(", ")}.`);

  return rows.map((row) => {
    const normalized: Record<string, string | number | boolean | null> = {};
    const issues: ImportIssue[] = [];
    for (const [source, target] of Object.entries(mapping)) {
      if (!target) continue;
      const rawValue = row.raw[source] ?? "";
      const value = normalizeImportValue(target, rawValue, dateFormat);
      normalized[target] = value;
      if (rawValue && value === null) {
        issues.push({ column: target, value: rawValue, message: "Valeur invalide ou ambiguë.", suggestion: target === "order_date" ? "Utilisez AAAA-MM-JJ ou choisissez explicitement le format." : undefined, severity: "error" });
      }
    }
    for (const column of IMPORT_COLUMNS[type].required) {
      if (normalized[column] === null || normalized[column] === undefined || normalized[column] === "") {
        issues.push({ column, value: "", message: "Valeur obligatoire manquante.", severity: "error" });
      }
    }
    if (type === "orders" && typeof normalized.total_ht === "number" && normalized.total_ht < 0) {
      issues.push({ column: "total_ht", value: String(normalized.total_ht), message: "Le montant doit être positif.", severity: "error" });
    }
    if (type === "orders" && (
      typeof normalized.quantity !== "number"
      || !Number.isInteger(normalized.quantity)
      || normalized.quantity <= 0
    )) {
      issues.push({ column: "quantity", value: String(normalized.quantity ?? ""), message: "La quantité doit être un entier strictement positif.", severity: "error" });
    }
    if (type === "orders" && !["draft", "pending", "confirmed", "invoiced", "partially_delivered", "delivered", "cancelled", "refunded"].includes(String(normalized.status))) {
      issues.push({ column: "status", value: String(normalized.status ?? ""), message: "Statut de commande inconnu.", severity: "error" });
    }
    if ("currency" in normalized && !/^[A-Z]{3}$/.test(String(normalized.currency ?? ""))) {
      issues.push({ column: "currency", value: String(normalized.currency ?? ""), message: "La devise doit être un code ISO à trois lettres.", severity: "error" });
    }
    if ("country" in normalized && !/^[A-Z]{2}$/.test(String(normalized.country ?? ""))) {
      issues.push({ column: "country", value: String(normalized.country ?? ""), message: "Le pays doit être un code ISO à deux lettres.", severity: "error" });
    }
    if (type === "users" && !["brand_admin", "brand_user", "agent", "facilitator"].includes(String(normalized.role))) {
      issues.push({ column: "role", value: String(normalized.role ?? ""), message: "Ce rôle ne peut pas être importé.", severity: "error" });
    }
    const status = issues.some((issue) => issue.severity === "error") ? "invalid" : issues.length ? "warning" : "valid";
    return { ...row, normalized, issues, status, deduplicationKey: null };
  });
}
