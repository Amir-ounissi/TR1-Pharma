import type { ImportEntity } from "@/lib/reference-data";

export type CsvPreviewRow = {
  lineNumber: number;
  payload: Record<string, string>;
  normalizedPayload: Record<string, string>;
  errors: string[];
  isValid: boolean;
};

export type CsvPreview = {
  headers: string[];
  mapping: Record<string, string>;
  rows: CsvPreviewRow[];
};

const requiredColumns: Record<ImportEntity, string[]> = {
  pharmacies: ["legal_name"],
  contacts: ["pharmacy_id", "first_name", "last_name"],
  brand_pharmacies: ["pharmacy_id"],
  products: ["name", "sku"],
  orders: ["external_order_id", "order_date", "quantity", "unit_price_ht"],
};

function splitCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === separator && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function canonicalHeader(header: string, entity: ImportEntity) {
  const normalized = normalizeHeader(header);

  const sharedAliases: Record<string, string> = {};

  const aliasesByEntity: Partial<
    Record<ImportEntity, Record<string, string>>
  > = {
    products: {
      product_code: "sku",
      code_produit: "sku",
      reference: "sku",
      reference_produit: "sku",
      acl: "sku",
      acl_fr: "sku",

      product_name: "name",
      nom_produit: "name",
      produit: "name",

      active: "is_active",
      actif: "is_active",

      ean13: "ean",
      ean_13: "ean",
      code_ean: "ean",

      conditionnement: "format",

      unit_price_ht: "wholesale_price_ht",
      prix_achat_ht: "wholesale_price_ht",
      prix_achat_ht_eur: "wholesale_price_ht",
      prix_gros_ht: "wholesale_price_ht",
      prix_de_gros_ht: "wholesale_price_ht",

      pvc_ttc: "retail_price_ttc",
      pvc_ttc_eur: "retail_price_ttc",
      prix_public_ttc: "retail_price_ttc",
      prix_vente_ttc: "retail_price_ttc",

      strategic: "strategic_priority",
    },
  };

  return aliasesByEntity[entity]?.[normalized] ?? sharedAliases[normalized] ?? normalized;
}

function looksLikeProductCatalog(headers: string[]) {
  const productHeaders = headers.map((header) =>
    canonicalHeader(header, "products"),
  );

  const hasIdentity =
    productHeaders.includes("name") && productHeaders.includes("sku");

  const productSignals = [
    "ean",
    "format",
    "wholesale_price_ht",
    "retail_price_ttc",
  ].filter((column) => productHeaders.includes(column)).length;

  return hasIdentity && productSignals >= 1;
}

function validate(entity: ImportEntity, row: Record<string, string>) {
  const errors = requiredColumns[entity]
    .filter((column) => !row[column])
    .map((column) => `Colonne obligatoire vide : ${column}`);

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push("Adresse email invalide");
  }

  if (row.siret && !/^\d{14}$/.test(row.siret.replace(/\s/g, ""))) {
    errors.push("SIRET invalide (14 chiffres attendus)");
  }

  if (
    row.country_code &&
    !/^[A-Z]{2}$/.test(row.country_code.toUpperCase())
  ) {
    errors.push("Code pays invalide");
  }

  if (
    row.wholesale_price_ht &&
    Number.isNaN(Number(row.wholesale_price_ht.replace(",", ".")))
  ) {
    errors.push("Prix de gros invalide");
  }

  if (
    row.retail_price_ttc &&
    Number.isNaN(Number(row.retail_price_ttc.replace(",", ".")))
  ) {
    errors.push("Prix public invalide");
  }

  if (
    row.tax_rate &&
    (Number.isNaN(Number(row.tax_rate.replace(",", "."))) ||
      Number(row.tax_rate.replace(",", ".")) < 0 ||
      Number(row.tax_rate.replace(",", ".")) > 100)
  ) {
    errors.push("TVA invalide");
  }

  if (
    row.units_per_case &&
    (!Number.isInteger(Number(row.units_per_case)) ||
      Number(row.units_per_case) <= 0)
  ) {
    errors.push("Colisage invalide");
  }

  if (
    row.minimum_order_quantity &&
    (!Number.isInteger(Number(row.minimum_order_quantity)) ||
      Number(row.minimum_order_quantity) <= 0)
  ) {
    errors.push("MOQ invalide");
  }

  if (
    entity === "products" &&
    row.strategic_priority &&
    !["standard", "priority", "strategic"].includes(row.strategic_priority)
  ) {
    errors.push("Priorité stratégique invalide");
  }

  if (
    row.pharmacy_id &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      row.pharmacy_id,
    )
  ) {
    errors.push("Identifiant pharmacie invalide");
  }

  if (
    entity === "orders" &&
    !row.brand_pharmacy_id &&
    !row.siret &&
    !row.cip_code &&
    !row.finess_code
  ) {
    errors.push("Identifiant pharmacie manquant");
  }

  if (
    entity === "orders" &&
    !row.product_id &&
    !row.sku &&
    !row.ean
  ) {
    errors.push("Identifiant produit manquant");
  }

  if (
    entity === "orders" &&
    (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) <= 0)
  ) {
    errors.push("Quantité invalide");
  }

  if (
    entity === "orders" &&
    Number.isNaN(Number(row.unit_price_ht?.replace(",", ".")))
  ) {
    errors.push("Prix HT invalide");
  }

  return errors;
}

export function parseCsv(
  content: string,
  entity: ImportEntity,
): CsvPreview {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length === 0) {
    return { headers: [], mapping: {}, rows: [] };
  }

  const separator =
    (lines[0].match(/;/g)?.length ?? 0) >
    (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const headers = splitCsvLine(lines[0], separator);
  const normalizedHeaders = headers.map((header) =>
    canonicalHeader(header, entity),
  );

  const mapping = Object.fromEntries(
    headers.map((header, index) => [header, normalizedHeaders[index]]),
  );

  if (entity === "pharmacies" && looksLikeProductCatalog(headers)) {
    return {
      headers,
      mapping,
      rows: [
        {
          lineNumber: 1,
          payload: {},
          normalizedPayload: {},
          errors: [
            "Ce fichier ressemble à un catalogue produits. Sélectionnez « Produits » dans Type de données.",
          ],
          isValid: false,
        },
      ],
    };
  }

  const missing = requiredColumns[entity].filter(
    (column) => !normalizedHeaders.includes(column),
  );

  if (missing.length > 0) {
    return {
      headers,
      mapping,
      rows: [
        {
          lineNumber: 1,
          payload: {},
          normalizedPayload: {},
          errors: missing.map(
            (column) => `Colonne manquante : ${column}`,
          ),
          isValid: false,
        },
      ],
    };
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line, separator);

    const payload = Object.fromEntries(
      headers.map((header, column) => [
        header,
        values[column] ?? "",
      ]),
    );

    const normalizedPayload = Object.fromEntries(
      normalizedHeaders.map((header, column) => [
        header,
        (values[column] ?? "").trim(),
      ]),
    );

    if (normalizedPayload.country_code) {
      normalizedPayload.country_code =
        normalizedPayload.country_code.toUpperCase();
    }

    if (normalizedPayload.wholesale_price_ht) {
      normalizedPayload.wholesale_price_ht =
        normalizedPayload.wholesale_price_ht.replace(",", ".");
    }

    if (normalizedPayload.retail_price_ttc) {
      normalizedPayload.retail_price_ttc =
        normalizedPayload.retail_price_ttc.replace(",", ".");
    }

    if (normalizedPayload.tax_rate) {
      normalizedPayload.tax_rate =
        normalizedPayload.tax_rate.replace(",", ".");
    }

    if (normalizedPayload.unit_price_ht) {
      normalizedPayload.unit_price_ht =
        normalizedPayload.unit_price_ht.replace(",", ".");
    }

    const errors = validate(entity, normalizedPayload);

    return {
      lineNumber: index + 2,
      payload,
      normalizedPayload,
      errors,
      isValid: errors.length === 0,
    };
  });

  return { headers, mapping, rows };
}
