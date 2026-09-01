export type ImportType = "products" | "pharmacies" | "orders" | "users" | "territories";
export type ImportMode = "create_only" | "update_only" | "upsert" | "append_only" | "invite";
export type ImportRowStatus = "valid" | "warning" | "invalid";

export type ColumnMapping = Record<string, string | null>;

export type ImportIssue = {
  column: string;
  value: string;
  message: string;
  suggestion?: string;
  severity: "warning" | "error";
};

export type ParsedImportRow = {
  lineNumber: number;
  raw: Record<string, string>;
};

export type ValidatedImportRow = ParsedImportRow & {
  normalized: Record<string, string | number | boolean | null>;
  status: ImportRowStatus;
  issues: ImportIssue[];
  deduplicationKey: string | null;
};

export type ImportPreview = {
  type: ImportType;
  delimiter: "," | ";";
  headers: string[];
  mapping: ColumnMapping;
  rows: ValidatedImportRow[];
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
  };
};

export type ImportLimits = {
  maxBytes: number;
  maxRows: number;
  maxFieldLength: number;
};

export const DEFAULT_IMPORT_LIMITS: ImportLimits = {
  maxBytes: 5_000_000,
  maxRows: 10_000,
  maxFieldLength: 500,
};

export const IMPORT_COLUMNS: Record<ImportType, { required: string[]; optional: string[] }> = {
  products: {
    required: ["sku", "name", "is_active"],
    optional: [
      "ean",
      "description",
      "category",
      "product_family",
      "format",
      "wholesale_price_ht",
      "retail_price_ttc",
      "tax_rate",
      "units_per_case",
      "minimum_order_quantity",
      "strategic_priority",
      "counts_for_distribution",
    ],
  },
  pharmacies: {
    required: ["pharmacy_name", "address_line_1", "postal_code", "city", "country"],
    optional: ["external_id", "address_line_2", "phone", "email", "group_name", "potential", "strategic", "territory_code"],
  },
  orders: {
    required: ["external_order_id", "pharmacy_external_id", "order_date", "status", "total_ht", "currency", "product_code", "quantity"],
    optional: ["salesperson_email"],
  },
  users: {
    required: ["email", "first_name", "last_name", "role", "active"],
    optional: ["territory_code"],
  },
  territories: {
    required: ["territory_code", "territory_name", "country"],
    optional: ["department_or_region", "manager_email"],
  },
};
