import type { PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

export type PharmacyCandidate = {
  pharmacyId: string;
  brandPharmacyId: string | null;
  relationStatus: "existing_brand_relation" | "global_only";
  name: string;
  siret: string | null;
  cip: string | null;
  finess: string | null;
  postalCode: string | null;
};

export type PharmacyMatchResult = {
  status: "matched" | "suggested" | "unmatched" | "ambiguous";
  method: string | null;
  match: PharmacyCandidate | null;
  candidates: PharmacyCandidate[];
};

export type ProductCandidate = {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  wholesalePriceHt: number | null;
  taxRate: number | null;
  references: Array<{ sku: string | null; ean: string | null; label: string | null }>;
};

export type MatchResult<T> = {
  status: "matched" | "unmatched" | "ambiguous";
  method: string | null;
  match: T | null;
  candidates: T[];
};

export function normalizeIdentifier(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
}

function normalizeNumericIdentifier(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 && digits.length <= 14 ? digits : "";
}

export function normalizeText(value: string | null | undefined) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

export function normalizePdfOrderDate(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const french = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/);
  if (french) {
    return `${french[3]}-${french[2].padStart(2, "0")}-${french[1].padStart(2, "0")}`;
  }

  return null;
}

export function resolvePdfOrderDate(extraction: Pick<PdfOrderExtraction, "orderDate" | "orderDateSource" | "deliveryDate">) {
  const normalized = normalizePdfOrderDate(extraction.orderDate);
  if (!normalized) return null;

  // Backward compatibility for older mocked/test payloads that predate source tracking.
  if (extraction.orderDateSource == null) return normalized;

  if (extraction.orderDateSource === "delivery_date" || extraction.orderDateSource === "other") {
    return null;
  }

  // Only a date explicitly identified as the order date or a genuine document header date is accepted.
  return normalized;
}

function pdfLineIdentity(line: PdfOrderExtraction["lines"][number]) {
  const ean = normalizeNumericIdentifier(line.ean) || normalizeIdentifier(line.ean);
  if (ean) return `ean:${ean}`;

  const sku = normalizeIdentifier(line.sku);
  if (sku) return `sku:${sku}`;

  const label = normalizeText(line.label);
  return label ? `label:${label}` : "";
}

export function consolidatePdfOrderLines(lines: PdfOrderExtraction["lines"]) {
  const meaningful = lines.filter(
    (line) => (line.quantity ?? 0) > 0 || (line.freeQuantity ?? 0) > 0,
  );

  const result = meaningful
    .filter((line) => (line.quantity ?? 0) > 0)
    .map((line) => ({
      ...line,
      freeQuantity: line.freeQuantity ?? 0,
    }));

  const freeOnlyLines = meaningful.filter(
    (line) => (line.quantity ?? 0) <= 0 && (line.freeQuantity ?? 0) > 0,
  );

  for (const freeLine of freeOnlyLines) {
    const identity = pdfLineIdentity(freeLine);
    const matches = result.filter(
      (candidate) =>
        (candidate.quantity ?? 0) > 0 &&
        identity &&
        pdfLineIdentity(candidate) === identity,
    );

    if (matches.length === 1) {
      matches[0].freeQuantity =
        (matches[0].freeQuantity ?? 0) + (freeLine.freeQuantity ?? 0);
      continue;
    }

    result.push({
      ...freeLine,
      freeQuantity: freeLine.freeQuantity ?? 0,
    });
  }

  return result;
}

function normalizePharmacyNameCore(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/\b(pharmacie|phcie|officine|selarl|selas|eurl|sarl|sas)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolve<T>(candidates: T[], method: string): MatchResult<T> {
  if (candidates.length === 1) return { status: "matched", method, match: candidates[0], candidates };
  if (candidates.length > 1) return { status: "ambiguous", method, match: null, candidates };
  return { status: "unmatched", method: null, match: null, candidates: [] };
}

function pharmacyResult(result: MatchResult<PharmacyCandidate>, approximate = false): PharmacyMatchResult {
  if (result.status !== "matched") return result;
  if (result.match?.relationStatus === "global_only" || approximate) {
    return { ...result, status: "suggested" };
  }
  return result;
}

function pharmacyNameContains(extractedName: string | null | undefined, candidateName: string | null | undefined) {
  const extractedCore = normalizePharmacyNameCore(extractedName);
  const candidateCore = normalizePharmacyNameCore(candidateName);
  if (extractedCore.length < 8 || candidateCore.length < 8) return false;
  return extractedCore.includes(candidateCore) || candidateCore.includes(extractedCore);
}

export function matchPdfPharmacy(pharmacy: PdfOrderExtraction["pharmacy"], candidates: PharmacyCandidate[]): PharmacyMatchResult {
  const identifiers: Array<[string, string, keyof PharmacyCandidate]> = [
    ["siret", normalizeIdentifier(pharmacy.siret), "siret"],
    ["cip", normalizeIdentifier(pharmacy.cip), "cip"],
    ["finess", normalizeIdentifier(pharmacy.finess), "finess"],
  ];
  for (const [method, value, key] of identifiers) {
    if (!value) continue;
    const result = resolve(candidates.filter((candidate) => normalizeIdentifier(String(candidate[key] ?? "")) === value), method);
    if (result.status !== "unmatched") return result;
  }

  const name = normalizeText(pharmacy.name);
  const postalCode = normalizeIdentifier(pharmacy.postalCode);
  let samePostalCode: PharmacyCandidate[] = [];

  if (name && postalCode) {
    samePostalCode = candidates.filter(
      (candidate) => normalizeIdentifier(candidate.postalCode) === postalCode,
    );

    const exact = resolve(
      samePostalCode.filter((candidate) => normalizeText(candidate.name) === name),
      "name_postal_code",
    );
    if (exact.status !== "unmatched") return pharmacyResult(exact);

    const contained = resolve(
      samePostalCode.filter((candidate) => pharmacyNameContains(pharmacy.name, candidate.name)),
      "name_contains_postal_code",
    );
    if (contained.status !== "unmatched") return pharmacyResult(contained, true);
  }

  if (name) {
    const exactByName = resolve(
      candidates.filter((candidate) => normalizeText(candidate.name) === name),
      "name",
    );
    if (exactByName.status !== "unmatched") return pharmacyResult(exactByName);

    const containedByName = resolve(
      candidates.filter((candidate) => pharmacyNameContains(pharmacy.name, candidate.name)),
      "name_contains",
    );
    if (containedByName.status === "matched" && containedByName.match?.relationStatus === "existing_brand_relation") {
      return containedByName;
    }
    if (containedByName.status !== "unmatched") return pharmacyResult(containedByName, true);
  }

  if (samePostalCode.length > 0) {
    return {
      status: "unmatched",
      method: "postal_code",
      match: null,
      candidates: samePostalCode,
    };
  }

  return { status: "unmatched", method: null, match: null, candidates: [] };
}

const PRODUCT_GENERIC_TOKENS = new Set([
  "naali", "gummies", "gummy", "gommes", "gomme", "gelu", "gelule", "gelules",
  "sachet", "decouverte", "bte", "boite", "capsule", "capsules", "complement",
  "alimentaire", "fr", "x",
]);

function productNameTokens(value: string | null | undefined) {
  return normalizeText(value)
    .split(" ")
    .map((token) => /^x\d+$/.test(token) ? token.slice(1) : token)
    .filter((token) => token && !PRODUCT_GENERIC_TOKENS.has(token));
}

function matchProductByLabelTokens(line: PdfOrderExtraction["lines"][number], candidates: ProductCandidate[]): MatchResult<ProductCandidate> {
  const lineTokens = productNameTokens(line.label);
  if (lineTokens.length === 0) return { status: "unmatched", method: null, match: null, candidates: [] };
  const lineSet = new Set(lineTokens);

  const scored = candidates.flatMap((candidate) => {
    const candidateTokens = productNameTokens(candidate.name);
    if (candidateTokens.length === 0) return [];
    const candidateSet = new Set(candidateTokens);
    const overlap = [...candidateSet].filter((token) => lineSet.has(token)).length;
    if (overlap === 0) return [];
    const candidateCoverage = overlap / candidateSet.size;
    const lineCoverage = overlap / lineSet.size;
    const candidateContained = candidateCoverage === 1 && (candidateSet.size >= 2 || candidateTokens[0].length >= 5);
    const lineContained = lineCoverage === 1 && lineSet.size >= 2;
    const score = candidateCoverage * 0.75 + lineCoverage * 0.25;
    if (!candidateContained && !lineContained && !(overlap >= 2 && score >= 0.82)) return [];
    return [{ candidate, score, overlap, specificity: candidateSet.size }];
  }).sort((left, right) => right.score - left.score || right.overlap - left.overlap || right.specificity - left.specificity);

  if (scored.length === 0) return { status: "unmatched", method: null, match: null, candidates: [] };
  const best = scored[0];
  const tied = scored.filter((item) => Math.abs(item.score - best.score) < 0.05 && item.overlap === best.overlap && item.specificity === best.specificity);
  if (tied.length > 1) return { status: "ambiguous", method: "label_tokens", match: null, candidates: tied.map((item) => item.candidate) };
  return { status: "matched", method: "label_tokens", match: best.candidate, candidates: [best.candidate] };
}

export function matchPdfProduct(line: PdfOrderExtraction["lines"][number], candidates: ProductCandidate[]): MatchResult<ProductCandidate> {
  const ean = normalizeIdentifier(line.ean);
  if (ean) {
    const direct = resolve(candidates.filter((candidate) => normalizeIdentifier(candidate.ean) === ean), "ean");
    if (direct.status !== "unmatched") return direct;
  }

  const numericCodes = [...new Set([normalizeNumericIdentifier(line.ean), normalizeNumericIdentifier(line.sku)].filter(Boolean))];
  for (const code of numericCodes) {
    const direct = resolve(candidates.filter((candidate) => normalizeNumericIdentifier(candidate.ean) === code), "barcode");
    if (direct.status !== "unmatched") return direct;
    const references = resolve(candidates.filter((candidate) => candidate.references.some((reference) => normalizeNumericIdentifier(reference.ean) === code)), "reference_barcode");
    if (references.status !== "unmatched") return references;
  }

  const sku = normalizeIdentifier(line.sku);
  if (sku) {
    const direct = resolve(candidates.filter((candidate) => normalizeIdentifier(candidate.sku) === sku), "sku");
    if (direct.status !== "unmatched") return direct;
  }
  if (ean) {
    const references = resolve(candidates.filter((candidate) => candidate.references.some((reference) => normalizeIdentifier(reference.ean) === ean)), "reference_ean");
    if (references.status !== "unmatched") return references;
  }
  if (sku) {
    const references = resolve(candidates.filter((candidate) => candidate.references.some((reference) => normalizeIdentifier(reference.sku) === sku)), "reference_sku");
    if (references.status !== "unmatched") return references;
  }

  const label = normalizeText(line.label);
  if (label) {
    const exact = resolve(candidates.filter((candidate) => normalizeText(candidate.name) === label), "exact_name");
    if (exact.status !== "unmatched") return exact;
    return matchProductByLabelTokens(line, candidates);
  }
  return { status: "unmatched", method: null, match: null, candidates: [] };
}

export function resolvedLinePrice(line: PdfOrderExtraction["lines"][number], product: ProductCandidate | null) {
  if (line.unitPriceHt != null) return { price: line.unitPriceHt, warning: null };
  if (product?.wholesalePriceHt != null) return { price: product.wholesalePriceHt, warning: "Prix PDF absent : prix catalogue proposé." };
  return { price: null, warning: "Prix PDF et prix catalogue absents." };
}

export function calculateOrderTotal(lines: Array<{ quantity: number | null; unitPriceHt: number | null; discountRate: number | null }>) {
  const total = lines.reduce((sum, line) => {
    if (line.quantity == null || line.unitPriceHt == null) return sum;
    const lineTotal = line.quantity * line.unitPriceHt * (1 - (line.discountRate ?? 0) / 100);
    return sum + Math.round((lineTotal + Number.EPSILON) * 100) / 100;
  }, 0);
  return Number(total.toFixed(2));
}

export function hasMeaningfulTotalDifference(pdfTotal: number | null, tr1Total: number) {
  return pdfTotal != null && Math.abs(pdfTotal - tr1Total) > 0.02;
}
