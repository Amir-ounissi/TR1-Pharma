import type { ProductCandidate } from "@/lib/orders/pdf-order-matching";
import { requireActiveBrand } from "@/lib/auth";
import { assertActiveBrandCapability } from "@/lib/saas/server";
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
    const captureId = String(formData.get("captureId") ?? "").trim();
    const document = formData.get("document");
    if (!(document instanceof File) || document.size === 0) {
      return Response.json({ error: "Ajoutez une sortie de caisse en photo ou PDF." }, { status: 400 });
    }
    if (!captureId) return Response.json({ error: "Relevé sell-out manquant." }, { status: 400 });

    const [{ supabase, brand }] = await Promise.all([
      requireActiveBrand(),
      assertActiveBrandCapability("sell_out"),
    ]);

    const { data: capture, error: captureError } = await supabase
      .from("sell_out_captures")
      .select("id,brand_id,brand_pharmacy_id,method,status,period_start,period_end")
      .eq("id", captureId)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .maybeSingle();

    if (captureError || !capture) {
      return Response.json({ error: "Ce relevé sell-out n’est pas disponible." }, { status: 403 });
    }
    if (capture.method !== "document") {
      return Response.json({ error: "L’analyse automatique est réservée aux relevés Photo / PDF." }, { status: 409 });
    }
    if (!["draft", "review_required"].includes(String(capture.status))) {
      return Response.json({ error: "Ce relevé a déjà été validé et ne peut plus être analysé." }, { status: 409 });
    }

    const extraction = await extractSellOutDocument(document);
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null);

    if (productsError) {
      return Response.json({ error: "Le catalogue de la marque n’est pas disponible." }, { status: 503 });
    }

    const products = (productRows ?? []).map((row) => readProduct(row as unknown as Record<string, unknown>));
    const lines = matchSellOutDocument(extraction, products);
    const periodStart = extraction.periodStart ?? String(capture.period_start);
    const periodEnd = extraction.periodEnd ?? String(capture.period_end);

    return Response.json({
      preview: {
        captureId: capture.id,
        periodStart,
        periodEnd,
        confidence: extraction.confidence,
        extraction,
        lines,
        warnings: [
          ...extraction.warnings,
          ...(extraction.periodStart == null ? ["Période absente du document : période du relevé conservée."] : []),
          ...(lines.some((line) => line.product.status !== "matched")
            ? ["Au moins un produit doit être confirmé manuellement."]
            : []),
          ...(lines.some((line) => line.unitsSold == null)
            ? ["Au moins une quantité vendue doit être confirmée."]
            : []),
        ],
      },
    });
  } catch (error) {
    if (error instanceof SellOutDocumentImportError) {
      const status = error.code === "invalid_file" ? 400 : error.code === "pii_detected" ? 422 : 503;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    return Response.json({ error: "Le document n’a pas pu être analysé." }, { status: 500 });
  }
}
