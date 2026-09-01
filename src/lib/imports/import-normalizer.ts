function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "oui", "yes", "actif"].includes(normalized)) return true;
  if (["false", "0", "non", "no", "inactif"].includes(normalized)) return false;
  return null;
}

export function normalizeAmount(value: string): number | null {
  const compact = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,4})?$/.test(compact)) return null;
  const amount = Number(compact);
  return Number.isFinite(amount) ? amount : null;
}

export function normalizeIsoDate(value: string, dateFormat?: "DMY" | "MDY"): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== trimmed ? null : trimmed;
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match || !dateFormat) return null;
  const day = dateFormat === "DMY" ? match[1] : match[2];
  const month = dateFormat === "DMY" ? match[2] : match[1];
  return normalizeIsoDate(`${match[3]}-${month}-${day}`);
}

export function normalizePhone(value: string) {
  const compact = value.trim().replace(/[().\s-]/g, "");
  if (!compact) return null;
  return /^\+?\d{8,15}$/.test(compact) ? compact : null;
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeImportValue(column: string, value: string, dateFormat?: "DMY" | "MDY") {
  if (!value.trim()) return null;
  if (["active", "is_active", "counts_for_distribution", "strategic"].includes(column)) return normalizeBoolean(value);
  if (["unit_price_ht", "wholesale_price_ht", "retail_price_ttc", "tax_rate", "total_ht", "quantity", "units_per_case", "minimum_order_quantity"].includes(column)) return normalizeAmount(value);
  if (column === "order_date") return normalizeIsoDate(value, dateFormat);
  if (column.endsWith("email")) return normalizeEmail(value);
  if (column === "phone") return normalizePhone(value);
  if (column === "currency") return value.trim().toUpperCase();
  if (column === "country") return value.trim().toUpperCase();
  if (column === "strategic_priority") {
    const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, "_");
    if (["standard", "priority", "strategic"].includes(normalized)) return normalized;
    if (["prioritaire"].includes(normalized)) return "priority";
    if (["strategique", "stratégique"].includes(normalized)) return "strategic";
    return null;
  }
  return normalizeText(value);
}
