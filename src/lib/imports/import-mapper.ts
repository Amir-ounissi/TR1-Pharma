import { IMPORT_COLUMNS, type ColumnMapping, type ImportType } from "./import-types";

const aliasesByType: Partial<Record<ImportType, Record<string, string>>> = {
  products: {
    product_code: "sku",
    code_produit: "sku",
    product_name: "name",
    nom_produit: "name",
    active: "is_active",
    strategic: "strategic_priority",
    unit_price_ht: "wholesale_price_ht",
  },
  pharmacies: {
    legal_name: "pharmacy_name",
    nom_pharmacie: "pharmacy_name",
    external_code: "external_id",
  },
  territories: {
    code_territoire: "territory_code",
    name_territory: "territory_name",
  },
  orders: {
    order_status: "status",
    order_date: "order_date",
  },
};

const sharedAliases: Record<string, string> = {
  legal_name: "pharmacy_name",
  external_code: "external_id",
  total_amount: "total_ht",
};

export function normalizeColumnName(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function autoMapColumns(headers: string[], type: ImportType): ColumnMapping {
  const allowed = new Set([...IMPORT_COLUMNS[type].required, ...IMPORT_COLUMNS[type].optional]);
  return Object.fromEntries(headers.map((header) => {
    const normalized = normalizeColumnName(header);
    const aliases = { ...sharedAliases, ...(aliasesByType[type] ?? {}) };
    const candidate = aliases[normalized] ?? normalized;
    return [header, allowed.has(candidate) ? candidate : null];
  }));
}

export function mergeManualMapping(automatic: ColumnMapping, manual: ColumnMapping): ColumnMapping {
  return Object.fromEntries(Object.keys(automatic).map((header) => [header, header in manual ? manual[header] : automatic[header]]));
}

export function missingRequiredColumns(mapping: ColumnMapping, type: ImportType) {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return IMPORT_COLUMNS[type].required.filter((column) => !mapped.has(column));
}
