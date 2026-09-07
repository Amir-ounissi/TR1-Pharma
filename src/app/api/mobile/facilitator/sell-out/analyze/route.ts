import type { ProductCandidate } from "@/lib/orders/pdf-order-matching";
import { mobileApiError, MobileApiError, requireMobileBrand, requireMobileCapability } from "@/lib/mobile-api";
import { extractSellOutDocument, SellOutDocumentImportError } from "@/lib/sell-out/document-extraction";
import { matchSellOutDocument } from "@/lib/sell-out/document-matching";

export const runtime = "nodejs";

function readProduct(row: Record<string, unknown>): ProductCandidate {
  const references = Array.isArray(row.product_references) ? row.product_references : [];
  return {
    id: String(row.id),
    name: String(row.name),
    sku: typeof row.sku === "string" ? row.sku : null,
    ean: typeof row.ean === "string" ? row.ean : null,
    wholesalePriceHt: row.wholesale_price_ht == null ? null : Number(row.wholesale_price_ht),
    taxRate: row.tax_rate == null ? null : Number(row.tax_rate),
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
    const missionId = String(formData.get("missionId") ?? "");
    const document = formData.get("document");
    if (!(document instanceof File) || document.size === 0) {
      return Response.json({ error: "Ajoutez une sortie de caisse en photo ou PDF." }, { status: 400 });
    }
    if (!missionId) return Response.json({ error: "Mission manquante." }, { status: 400 });

    const { supabase, brand, user } = await requireMobileBrand(request, brandId);
    if (brand.role !== "facilitator") throw new MobileApiError(403, "Cette analyse est réservée aux intervenants terrain affectés à la mission.");
    await requireMobileCapability(supabase, brand.id, "sell_out");

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id,brand_id,brand_pharmacy_id,pharmacy_id,assigned_user_id,status,mission_type,scheduled_start_at,scheduled_end_at")
      .eq("id", missionId)
      .eq("brand_id", brand.id)
      .eq("assigned_user_id", user.id)
      .is("archived_at", null)
      .maybeSingle();
    if (missionError || !mission) throw new MobileApiError(403, "Cette mission n’est pas disponible dans votre périmètre.");
    if (["cancelled", "rejected", "no_show"].includes(String(mission.status))) {
      throw new MobileApiError(409, "Une mission annulée, refusée ou en absence ne peut pas produire de sell-out.");
    }
    if (!["animation", "training", "merchandising", "pharmacy_audit", "product_launch", "stock_check", "other"].includes(String(mission.mission_type))) {
      throw new MobileApiError(403, "Ce type de mission ne permet pas de relever une sortie de caisse.");
    }

    const extraction = await extractSellOutDocument(document);
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null);
    if (productsError) throw new MobileApiError(503, "Le catalogue de la marque n’est pas disponible.");

    const products = (productRows ?? []).map((row) => readProduct(row as unknown as Record<string, unknown>));
    const lines = matchSellOutDocument(extraction, products);
    const fallbackDate = typeof mission.scheduled_start_at === "string"
      ? mission.scheduled_start_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const periodStart = extraction.periodStart ?? fallbackDate;
    const periodEnd = extraction.periodEnd ?? periodStart;

    return Response.json({
      preview: {
        missionId: mission.id,
        brandPharmacyId: mission.brand_pharmacy_id,
        pharmacyId: mission.pharmacy_id,
        periodStart,
        periodEnd,
        extraction,
        lines,
        warnings: [
          ...extraction.warnings,
          ...(extraction.periodStart == null ? ["Période absente du document : date de mission proposée."] : []),
          ...(lines.some((line) => line.product.status !== "matched") ? ["Au moins un produit doit être confirmé manuellement."] : []),
          ...(lines.some((line) => line.unitsSold == null) ? ["Au moins une quantité vendue doit être confirmée."] : []),
        ],
      },
    });
  } catch (error) {
    if (error instanceof SellOutDocumentImportError) {
      const status = error.code === "invalid_file" ? 400 : error.code === "pii_detected" ? 422 : 503;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    return mobileApiError(error);
  }
}
