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
  const ean = normalizeIdentifier(line.ean);
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

  if (name && postalCode) {
    const samePostalCode = candidates.filter(
      (candidate) => normalizeIdentifier(candidate.postalCode) === postalCode,
    );

    const exact = resolve(
      samePostalCode.filter((candidate) => normalizeText(candidate.name) === name),
      "name_postal_code",
    );

    if (exact.status === "matched") {
      if (exact.match?.relationStatus === "global_only") {
        return { ...exact, status: "suggested" };
      }
      return exact;
    }

    if (exact.status === "ambiguous") return exact;

    const extractedCore = normalizePharmacyNameCore(pharmacy.name);

    const contained = resolve(
      samePostalCode.filter((candidate) => {
        const candidateCore = normalizePharmacyNameCore(candidate.name);

        if (extractedCore.length < 4 || candidateCore.length < 4) return false;

        return (
          extractedCore.includes(candidateCore) ||
          candidateCore.includes(extractedCore)
        );
      }),
      "name_contains_postal_code",
    );

    if (contained.status === "matched") {
      return { ...contained, status: "suggested" };
    }

    if (contained.status === "ambiguous") return contained;

    if (samePostalCode.length > 0) {
      return {
        status: "unmatched",
        method: "postal_code",
        match: null,
        candidates: samePostalCode,
      };
    }
  }

  return { status: "unmatched", method: null, match: null, candidates: [] };
}

export function matchPdfProduct(line: PdfOrderExtraction["lines"][number], candidates: ProductCandidate[]): MatchResult<ProductCandidate> {
  const ean = normalizeIdentifier(line.ean);
  if (ean) {
    const direct = resolve(candidates.filter((candidate) => normalizeIdentifier(candidate.ean) === ean), "ean");
    if (direct.status !== "unmatched") return direct;
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
  if (label) return resolve(candidates.filter((candidate) => normalizeText(candidate.name) === label), "exact_name");
  return { status: "unmatched", method: null, match: null, candidates: [] };
}

export function resolvedLinePrice(line: PdfOrderExtraction["lines"][number], product: ProductCandidate | null) {
  if (line.unitPriceHt != null) return { price: line.unitPriceHt, warning: null };
  if (product?.wholesalePriceHt != null) return { price: product.wholesalePriceHt, warning: "Prix PDF absent : prix catalogue proposé." };
  return { price: null, warning: "Prix PDF et prix catalogue absents." };
}

export function calculateOrderTotal(lines: Array<{ quantity: number | null; unitPriceHt: number | null; discountRate: number | null }>) {
  return Number(lines.reduce((total, line) => {
    if (line.quantity == null || line.unitPriceHt == null) return total;
    return total + line.quantity * line.unitPriceHt * (1 - (line.discountRate ?? 0) / 100);
  }, 0).toFixed(2));
}

export function hasMeaningfulTotalDifference(pdfTotal: number | null, tr1Total: number) {
  return pdfTotal != null && Math.abs(pdfTotal - tr1Total) > 0.02;
}
