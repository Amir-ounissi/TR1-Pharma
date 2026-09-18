import { NextResponse } from "next/server";
import { requireActiveBrand } from "@/lib/auth";
import { type ProductCandidate } from "@/lib/orders/pdf-order-matching";
import { extractPricePhoto, PricePhotoAnalysisError } from "@/lib/price-observations/photo-extraction";
import { matchPricePhotoProduct } from "@/lib/price-observations/photo-matching";

function readProduct(row: Record<string, unknown>): ProductCandidate {
  const references = Array.isArray(row.product_references) ? row.product_references : [];
  return {
    id: String(row.id),
    name: String(row.name),
    sku: typeof row.sku === "string" ? row.sku : null,
    ean: typeof row.ean === "string" ? row.ean : null,
    wholesalePriceHt: typeof row.wholesale_price_ht === "number"
      ? row.wholesale_price_ht
      : row.wholesale_price_ht == null
        ? null
        : Number(row.wholesale_price_ht),
    taxRate: typeof row.tax_rate === "number"
      ? row.tax_rate
      : row.tax_rate == null
        ? null
        : Number(row.tax_rate),
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
    const photo = formData.get("photo");
    const brandPharmacyId = String(formData.get("brandPharmacyId") ?? "").trim();

    if (!(photo instanceof File) || photo.size < 1) {
      return NextResponse.json({ error: "Ajoutez une photo du produit et de son prix." }, { status: 400 });
    }
    if (!brandPharmacyId) {
      return NextResponse.json({ error: "Pharmacie manquante." }, { status: 400 });
    }

    const { supabase, brand } = await requireActiveBrand();
    const { data: relation, error: relationError } = await supabase
      .from("brand_pharmacies")
      .select("id")
      .eq("id", brandPharmacyId)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .maybeSingle();

    if (relationError || !relation) {
      return NextResponse.json({ error: "Pharmacie indisponible pour cette marque." }, { status: 403 });
    }

    const extraction = await extractPricePhoto(photo);
    const { data: productRows, error: productsError } = await supabase
      .from("products")
      .select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null);

    if (productsError) {
      return NextResponse.json({ error: "Le catalogue produit est indisponible." }, { status: 500 });
    }

    const products = (productRows ?? []).map((row) => readProduct(row as unknown as Record<string, unknown>));
    const product = matchPricePhotoProduct(extraction, products);

    return NextResponse.json({
      preview: {
        productLabel: extraction.productLabel,
        ean: extraction.ean,
        priceTtc: extraction.priceTtc,
        priceType: extraction.priceType ?? "regular",
        bundleQuantity: extraction.bundleQuantity,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        product,
      },
    });
  } catch (error) {
    if (error instanceof PricePhotoAnalysisError) {
      const status = error.code === "invalid_file" ? 400 : error.code === "pii_detected" ? 422 : 503;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "La photo n’a pas pu être analysée." }, { status: 500 });
  }
}
