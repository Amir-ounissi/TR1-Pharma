export type ParsedCsvContent = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

export type MatchableProduct = {
  id: string;
  name: string;
  brand_name: string;
  ean: string | null;
  format: string | null;
  normalizedName?: string;
  normalizedBrand?: string;
  normalizedFormat?: string;
};

export type ProductMatch = {
  productId: string | null;
  suggestedProductId: string | null;
  method: "ean" | "exact" | "suggested" | "none";
};

export type PharmacyCsvRecord = {
  id: string;
  lineNumber: number;
  name: string;
  brand: string | null;
  ean: string | null;
  format: string | null;
  purchasePriceHt: number | null;
};

export type CsvColumnMapping = {
  name: number | null;
  price: number | null;
  ean: number | null;
  brand: number | null;
  format: number | null;
};

export function detectCsvDelimiter(input: string): string {
  const candidates = [";", ",", "\t"];
  const sample = input.split(/\r?\n/).slice(0, 8).join("\n");
  const counts = candidates.map((delimiter) => {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < sample.length; index += 1) {
      const char = sample[index];
      if (char === '"') {
        if (quoted && sample[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && char === delimiter) {
        count += 1;
      }
    }
    return { delimiter, count };
  });
  const best = counts.sort((a, b) => b.count - a.count)[0];
  return best?.count ? best.delimiter : ";";
}

export function parseCsvContent(input: string): ParsedCsvContent {
  let source = input.replace(/^\uFEFF/, "");
  const separatorHint = source.match(/^sep=(;|,|\t)\s*(?:\r?\n)/i);
  if (separatorHint) source = source.slice(separatorHint[0].length);
  const delimiter = detectCsvDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length < 2) {
    throw new Error("Le fichier doit contenir une ligne d’en-têtes et au moins une ligne de produits.");
  }

  const headers = rows[0].map((value) => value.trim());
  if (headers.length < 2 || headers.every((header) => !header)) {
    throw new Error("Les en-têtes de colonnes sont introuvables.");
  }

  return {
    headers,
    rows: rows.slice(1).map((cells) => headers.map((_, index) => (cells[index] ?? "").trim())),
    delimiter,
  };
}

export function normalizeCsvText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeEan(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().replace(/\.0+$/, "");
  if (/^\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(raw)) {
    const numeric = Number(raw.replace(",", "."));
    if (Number.isSafeInteger(numeric)) {
      const expanded = String(numeric);
      return expanded.length >= 8 && expanded.length <= 14 ? expanded : null;
    }
  }
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

export function parseFrenchAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  let cleaned = value.replace(/[\s\u00a0\u202f€]/g, "").replace(/[^0-9,.-]/g, "");
  if (!cleaned || !/[0-9]/.test(cleaned)) return null;

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    cleaned = comma > dot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (comma >= 0) {
    cleaned = cleaned.replace(",", ".");
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const HEADER_PATTERNS: Record<keyof CsvColumnMapping, string[]> = {
  name: ["designation", "libelle", "nom produit", "nom article", "intitule produit"],
  price: ["prix achat ht", "prix d achat ht", "prix achat net", "prix d achat net", "prix net achat", "prix d achat", "pamp ht", "pamp", "cout achat ht", "cout unitaire ht", "prix achat"],
  ean: ["ean", "gtin", "code barre", "codebarre", "cip13", "cip 13", "code ean"],
  brand: ["marque", "laboratoire", "brand"],
  format: ["conditionnement", "format", "contenance", "unite de vente", "unite vente"],
};

export function detectCsvColumn(
  headers: string[],
  kind: keyof CsvColumnMapping,
): number | null {
  const normalized = headers.map(normalizeCsvText);
  const patterns = HEADER_PATTERNS[kind].map(normalizeCsvText);
  const candidates = normalized.map((header, index) => ({ header, index }))
    .filter(({ header }) => kind !== "price" || !/(ttc|prix vente|vente|pv )/.test(header));
  const exact = candidates.find(({ header }) => patterns.includes(header));
  if (exact) return exact.index;
  const partial = candidates.find(({ header }) => patterns.some((pattern) => header.includes(pattern)));
  return partial ? partial.index : null;
}

export function buildPharmacyCsvRecords(
  rows: string[][],
  mapping: CsvColumnMapping,
): PharmacyCsvRecord[] {
  if (mapping.name === null || mapping.price === null) return [];
  return rows.flatMap((cells, index) => {
    const name = (cells[mapping.name!] ?? "").trim();
    if (!name) return [];
    const brand = mapping.brand === null ? "" : (cells[mapping.brand] ?? "").trim();
    const ean = mapping.ean === null ? null : normalizeEan(cells[mapping.ean] ?? "");
    const format = mapping.format === null ? "" : (cells[mapping.format] ?? "").trim();
    const purchasePriceHt = parseFrenchAmount(cells[mapping.price] ?? "");
    return [{
      id: "csv-row-" + (index + 2),
      lineNumber: index + 2,
      name,
      brand: brand || null,
      ean,
      format: format || null,
      purchasePriceHt,
    }];
  });
}

export function normalizeCsvFormat(value: string): string {
  const spaced = value.replace(/(\d)([a-z])/gi, "$1 $2").replace(/([a-z])(\d)/gi, "$1 $2");
  return normalizeCsvText(spaced).replace(/\b(?:boite|de|format|unite|unites)\b/g, " ").replace(/\s+/g, " ").trim();
}

function levenshteinSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 1));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 1));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let common = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) common += 1;
  return (2 * common) / (leftTokens.size + rightTokens.size);
}

export function findProductMatch(
  record: Pick<PharmacyCsvRecord, "name" | "brand" | "ean" | "format">,
  products: MatchableProduct[],
): ProductMatch {
  if (record.ean) {
    const eanMatches = products.filter((product) => normalizeEan(product.ean) === record.ean);
    if (eanMatches.length === 1) {
      return { productId: eanMatches[0].id, suggestedProductId: null, method: "ean" };
    }
  }

  const name = normalizeCsvText(record.name);
  const brand = record.brand ? normalizeCsvText(record.brand) : null;
  if (!name) return { productId: null, suggestedProductId: null, method: "none" };

  const candidates = products
    .filter((product) => !brand || (product.normalizedBrand ?? normalizeCsvText(product.brand_name)) === brand)
    .map((product) => {
      const productName = product.normalizedName ?? normalizeCsvText(product.name);
      const tokens = tokenSimilarity(name, productName);
      const likelyCandidate = tokens >= 0.25 || name.length < 8 || productName.length < 8
        || name.includes(productName) || productName.includes(name);
      const editScore = likelyCandidate ? levenshteinSimilarity(name, productName) : 0;
      const score = (editScore * 0.55) + (tokens * 0.45);
      const csvFormat = record.format ? normalizeCsvFormat(record.format) : null;
      const productFormat = product.format ? (product.normalizedFormat ?? normalizeCsvFormat(product.format)) : null;
      const formatMismatch = Boolean(csvFormat && productFormat && csvFormat !== productFormat);
      return { product, score, exact: name === productName, formatMismatch };
    })
    .sort((a, b) => b.score - a.score);

  const exactMatches = candidates.filter((candidate) => candidate.exact && !candidate.formatMismatch);
  if (exactMatches.length === 1) {
    return { productId: exactMatches[0].product.id, suggestedProductId: null, method: "exact" };
  }
  if (exactMatches.length > 1) {
    return { productId: null, suggestedProductId: null, method: "none" };
  }

  const best = candidates[0];
  if (!best) return { productId: null, suggestedProductId: null, method: "none" };
  const second = candidates[1];
  if (second && best.score - second.score < 0.05 && second.score >= 0.86) {
    return { productId: null, suggestedProductId: null, method: "none" };
  }
  if (best.exact || best.score >= 0.86) {
    return { productId: null, suggestedProductId: best.product.id, method: "suggested" };
  }
  return { productId: null, suggestedProductId: null, method: "none" };
}
