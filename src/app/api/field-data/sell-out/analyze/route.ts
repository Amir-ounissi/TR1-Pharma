import { z } from "zod";
import type { ProductCandidate } from "@/lib/orders/pdf-order-matching";
import { extractSellOutDocument, SellOutDocumentImportError } from "@/lib/sell-out/document-extraction";
import { matchSellOutDocument } from "@/lib/sell-out/document-matching";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
);

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
    const brandPharmacyId = databaseUuid.parse(
      String(formData.get("brandPharmacyId") ?? ""),
    );
    const document = formData.get("document");
    if (!(document instanceof File) || document.size === 0) {
      return Response.json(
        { error: "Ajoutez la sortie de caisse en photo ou PDF." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) {
      return Response.json({ error: "Session expirée." }, { status: 401 });
    }

    const { data: relation, error: relationError } = await supabase
      .from("brand_pharmacies")
      .select("id,brand_id")
      .eq("id", brandPharmacyId)
      .is("archived_at", null)
      .maybeSingle();
    if (relationError || !relation) {
      return Response.json(
        { error: "Cette pharmacie n’est pas disponible dans votre périmètre." },
        { status: 403 },
      );
    }

    const [{ data: contexts, error: contextsError }, { data: sellOutEnabled, error: capabilityError }] = await Promise.all([
      supabase.rpc("get_my_brand_contexts"),
      supabase.rpc("has_brand_capability", {
        target_brand_id: relation.brand_id,
        target_capability_key: "sell_out",
      }),
    ]);
    if (contextsError || capabilityError) {
      return Response.json(
        { error: "Impossible de vérifier votre accès sell-out." },
        { status: 503 },
      );
    }
    const context = (contexts ?? []).find(
      (item: { brand_id?: string }) => item.brand_id === relation.brand_id,
    ) as { role_key?: string } | undefined;
    if (!sellOutEnabled || !context || !["agent", "tr1_manager", "brand_admin", "super_admin"].includes(context.role_key ?? "")) {
      return Response.json(
        { error: "Vous ne pouvez pas relever de sell-out pour cette marque." },
        { status: 403 },
      );
    }

    const extraction = await extractSellOutDocument(document);
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
      .eq("brand_id", relation.brand_id)
      .eq("is_active", true)
      .is("discontinued_at", null);
    if (productsError) {
      return Response.json(
        { error: "Le catalogue produit n’est pas disponible." },
        { status: 503 },
      );
    }

    const products = (productRows ?? []).map((row) =>
      readProduct(row as unknown as Record<string, unknown>),
    );
    const lines = matchSellOutDocument(extraction, products);
    const fallbackDate = new Date().toISOString().slice(0, 10);
    const periodStart = extraction.periodStart ?? fallbackDate;
    const periodEnd = extraction.periodEnd ?? periodStart;

    return Response.json({
      preview: {
        brandPharmacyId,
        periodStart,
        periodEnd,
        extraction,
        lines,
        warnings: [
          ...extraction.warnings,
          ...(extraction.periodStart == null
            ? ["Période absente du document : date du jour proposée."]
            : []),
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
      const status = error.code === "invalid_file"
        ? 400
        : error.code === "pii_detected"
          ? 422
          : 503;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Pharmacie invalide." }, { status: 400 });
    }
    console.error("[sell_out_document_analysis] route failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "L’analyse du document sell-out a échoué." },
      { status: 500 },
    );
  }
}
