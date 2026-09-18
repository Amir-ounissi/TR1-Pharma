import { z } from "zod";
import { extractPricePhoto, PricePhotoImportError } from "@/lib/field-data/price-photo-extraction";
import { matchPdfProduct, type ProductCandidate } from "@/lib/orders/pdf-order-matching";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
);

function readProduct(row: Record<string, unknown>): ProductCandidate & { retailPriceTtc: number | null } {
  const references = Array.isArray(row.product_references) ? row.product_references : [];
  return {
    id: String(row.id),
    name: String(row.name),
    sku: typeof row.sku === "string" ? row.sku : null,
    ean: typeof row.ean === "string" ? row.ean : null,
    wholesalePriceHt: row.wholesale_price_ht == null ? null : Number(row.wholesale_price_ht),
    taxRate: row.tax_rate == null ? null : Number(row.tax_rate),
    retailPriceTtc: row.retail_price_ttc == null ? null : Number(row.retail_price_ttc),
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
    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      return Response.json(
        { error: "Ajoutez une photo du produit et de son prix." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
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

    const { data: contexts, error: contextsError } = await supabase.rpc("get_my_brand_contexts");
    if (contextsError) {
      return Response.json(
        { error: "Impossible de vérifier votre périmètre marque." },
        { status: 503 },
      );
    }
    const context = (contexts ?? []).find(
      (item: { brand_id?: string }) => item.brand_id === relation.brand_id,
    ) as { role_key?: string } | undefined;
    if (!context || !["agent", "tr1_manager", "brand_admin", "super_admin"].includes(context.role_key ?? "")) {
      return Response.json(
        { error: "Vous ne pouvez pas relever de prix pour cette marque." },
        { status: 403 },
      );
    }

    const extraction = await extractPricePhoto(photo);

    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("id,name,sku,ean,wholesale_price_ht,retail_price_ttc,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
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
    const match = matchPdfProduct({
      label: extraction.productLabel,
      sku: null,
      ean: extraction.ean,
      quantity: null,
      freeQuantity: null,
      unitPriceHt: null,
      discountRate: null,
      taxRate: null,
    }, products);
    const selected = match.match
      ? products.find((product) => product.id === match.match?.id) ?? null
      : null;

    return Response.json({
      preview: {
        extraction,
        product: {
          status: match.status,
          method: match.method,
          selectedId: match.match?.id ?? null,
          selectedName: match.match?.name ?? null,
          referencePriceTtc: selected?.retailPriceTtc ?? null,
          candidates: match.candidates.slice(0, 5).map((candidate) => {
            const product = products.find((item) => item.id === candidate.id);
            return {
              id: candidate.id,
              name: candidate.name,
              sku: candidate.sku,
              ean: candidate.ean,
              retailPriceTtc: product?.retailPriceTtc ?? null,
            };
          }),
        },
        warnings: [
          ...extraction.warnings,
          ...(extraction.priceTtc == null ? ["Prix à saisir manuellement."] : []),
          ...(match.status === "unmatched" ? ["Produit non rapproché du catalogue TR1."] : []),
          ...(match.status === "ambiguous" ? ["Plusieurs produits possibles : confirmez le bon produit."] : []),
        ],
      },
    });
  } catch (error) {
    if (error instanceof PricePhotoImportError) {
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
    console.error("[price_photo_analysis] route failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "L’analyse automatique du prix a échoué." },
      { status: 500 },
    );
  }
}
