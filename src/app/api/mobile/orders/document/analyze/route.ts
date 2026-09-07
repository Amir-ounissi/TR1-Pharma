import { extractPdfOrder, PdfOrderImportError } from "@/lib/orders/pdf-order-extraction";
import {
  calculateOrderTotal,
  consolidatePdfOrderLines,
  hasMeaningfulTotalDifference,
  matchPdfPharmacy,
  matchPdfProduct,
  resolvePdfOrderDate,
  resolvedLinePrice,
  type PharmacyCandidate,
  type ProductCandidate,
} from "@/lib/orders/pdf-order-matching";
import type { PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";
import { mobileApiError, requireMobileBrand, requireMobileCapability } from "@/lib/mobile-api";

export const runtime = "nodejs";

function readPharmacy(row: Record<string, unknown>): PharmacyCandidate | null {
  if (!row.pharmacy_id) return null;
  return {
    pharmacyId: String(row.pharmacy_id),
    brandPharmacyId: typeof row.brand_pharmacy_id === "string" ? row.brand_pharmacy_id : null,
    relationStatus: row.relation_status === "existing_brand_relation" ? "existing_brand_relation" : "global_only",
    name: String(row.trade_name || row.legal_name || "Pharmacie"),
    siret: typeof row.siret === "string" ? row.siret : null,
    cip: typeof row.cip_code === "string" ? row.cip_code : null,
    finess: typeof row.finess_code === "string" ? row.finess_code : null,
    postalCode: typeof row.postal_code === "string" ? row.postal_code : null,
  };
}

function readProduct(row: Record<string, unknown>): ProductCandidate {
  const references = Array.isArray(row.product_references) ? row.product_references : [];
  return {
    id: String(row.id),
    name: String(row.name),
    sku: typeof row.sku === "string" ? row.sku : null,
    ean: typeof row.ean === "string" ? row.ean : null,
    wholesalePriceHt: typeof row.wholesale_price_ht === "number" ? row.wholesale_price_ht : row.wholesale_price_ht == null ? null : Number(row.wholesale_price_ht),
    taxRate: typeof row.tax_rate === "number" ? row.tax_rate : row.tax_rate == null ? null : Number(row.tax_rate),
    references: references.map((reference) => {
      const item = reference as Record<string, unknown>;
      return {
        sku: typeof item.sku === "string" ? item.sku : null,
        ean: typeof item.ean === "string" ? item.ean : null,
        label: typeof item.label === "string" ? item.label : null,
      };
    }),
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const brandId = String(formData.get("brandId") ?? "");
    const document = formData.get("document");
    if (!(document instanceof File) || document.size === 0) {
      return Response.json({ error: "Ajoutez une photo de la commande." }, { status: 400 });
    }

    const { supabase, brand } = await requireMobileBrand(request, brandId);
    await requireMobileCapability(supabase, brand.id, "pdf_order_import");

    const rawExtraction = await extractPdfOrder(document);
    const resolvedOrderDate = resolvePdfOrderDate(rawExtraction);
    const dateWarning = rawExtraction.orderDate && !resolvedOrderDate
      ? "Date de livraison ou date non fiable ignorée : renseignez la date de commande."
      : null;
    const extraction: PdfOrderExtraction = {
      ...rawExtraction,
      orderDate: resolvedOrderDate,
      lines: consolidatePdfOrderLines(rawExtraction.lines),
    };

    const [{ data: directoryRows, error: pharmaciesError }, { data: productRows, error: productsError }] = await Promise.all([
      supabase.rpc("search_pharmacy_directory_for_order", {
        target_brand_id: brand.id,
        search_term: null,
        candidate_siret: extraction.pharmacy.siret,
        candidate_cip: extraction.pharmacy.cip,
        candidate_finess: extraction.pharmacy.finess,
        candidate_name: extraction.pharmacy.name,
        candidate_postal_code: extraction.pharmacy.postalCode,
        result_limit: 25,
      }),
      supabase
        .from("products")
        .select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .is("discontinued_at", null),
    ]);
    if (pharmaciesError || productsError) {
      return Response.json({ error: "Les données de la marque ne sont pas disponibles." }, { status: 503 });
    }

    const pharmacies = ((directoryRows ?? []) as Array<Record<string, unknown>>)
      .map(readPharmacy)
      .filter((row): row is PharmacyCandidate => row !== null);
    const products = (productRows ?? []).map((row) => readProduct(row as unknown as Record<string, unknown>));
    const pharmacyMatch = matchPdfPharmacy(extraction.pharmacy, pharmacies);

    const lines = extraction.lines.map((line, index) => {
      const productMatch = matchPdfProduct(line, products);
      const price = resolvedLinePrice(line, productMatch.match);
      return {
        index,
        label: line.label,
        sku: line.sku,
        ean: line.ean,
        quantity: line.quantity,
        freeQuantity: line.freeQuantity ?? 0,
        unitPriceHt: line.unitPriceHt,
        discountRate: line.discountRate,
        suggestedPriceHt: price.price,
        priceWarning: price.warning,
        product: {
          status: productMatch.status,
          method: productMatch.method,
          selectedId: productMatch.match?.id ?? null,
          selectedName: productMatch.match?.name ?? null,
          candidates: productMatch.candidates.slice(0, 5).map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            ean: product.ean,
            wholesalePriceHt: product.wholesalePriceHt,
          })),
        },
      };
    });

    const totalTr1Ht = calculateOrderTotal(lines.map((line) => ({
      quantity: line.quantity,
      unitPriceHt: line.suggestedPriceHt,
      discountRate: line.discountRate,
    })));
    const warnings = [
      ...extraction.warnings,
      ...(dateWarning ? [dateWarning] : []),
      ...lines.flatMap((line) => (line.priceWarning ? [line.priceWarning] : [])),
    ];

    return Response.json({
      preview: {
        extraction,
        pharmacy: {
          status: pharmacyMatch.status,
          method: pharmacyMatch.method,
          selectedPharmacyId: pharmacyMatch.status === "matched" ? pharmacyMatch.match?.pharmacyId ?? null : null,
          selectedBrandPharmacyId: pharmacyMatch.status === "matched" ? pharmacyMatch.match?.brandPharmacyId ?? null : null,
          selectedName: pharmacyMatch.status === "matched" ? pharmacyMatch.match?.name ?? null : null,
          candidates: pharmacyMatch.candidates.slice(0, 5),
        },
        lines,
        totalTr1Ht,
        totalDifferenceWarning: hasMeaningfulTotalDifference(extraction.totalHt, totalTr1Ht),
        warnings,
      },
    });
  } catch (error) {
    if (error instanceof PdfOrderImportError) {
      return Response.json({ error: error.message }, { status: error.code === "invalid_file" ? 400 : 503 });
    }
    return mobileApiError(error);
  }
}
