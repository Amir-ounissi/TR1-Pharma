import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { matchPricePhotoProduct } from "@/lib/price-observations/photo-matching";
import { extractStockPhoto, StockPhotoError } from "@/lib/stock-observations/extraction";
import type { ProductCandidate } from "@/lib/orders/pdf-order-matching";

const uuid = z.string().uuid();

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const parsed = uuid.safeParse(form.get("brandPharmacyId"));
    if (!parsed.success) return NextResponse.json({ error: "Pharmacie invalide." }, { status: 400 });
    if (!(photo instanceof File)) return NextResponse.json({ error: "Photo manquante." }, { status: 400 });

    const { supabase, brand } = await requireActiveBrand();
    const { data: relation, error: relationError } = await supabase
      .from("brand_pharmacies").select("id").eq("id", parsed.data)
      .eq("brand_id", brand.id).is("archived_at", null).maybeSingle();
    if (relationError || !relation) {
      return NextResponse.json({ error: "Pharmacie non accessible dans cette marque." }, { status: 403 });
    }

    const extraction = await extractStockPhoto(photo);
    const { data: rows, error } = await supabase
      .from("products")
      .select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)")
      .eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null);
    if (error) return NextResponse.json({ error: "Catalogue indisponible." }, { status: 503 });

    const products: ProductCandidate[] = (rows ?? []).map((row) => ({
      id: row.id, name: row.name, sku: row.sku, ean: row.ean,
      wholesalePriceHt: row.wholesale_price_ht == null ? null : Number(row.wholesale_price_ht),
      taxRate: row.tax_rate == null ? null : Number(row.tax_rate),
      references: (row.product_references ?? []).map((ref) => ({
        sku: ref.sku, ean: ref.ean, label: ref.label,
      })),
    }));
    const match = matchPricePhotoProduct({
      personalDataDetected: false, productLabel: extraction.productLabel, ean: extraction.ean,
      priceTtc: null, priceType: null, bundleQuantity: null,
      confidence: extraction.confidence, warnings: extraction.warnings,
    }, products);
    return NextResponse.json({ preview: { ...extraction, product: match } });
  } catch (error) {
    if (error instanceof StockPhotoError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "invalid_file" ? 400 : error.code === "pii_detected" ? 422 : 503 },
      );
    }
    return NextResponse.json({ error: "Analyse de l'étiquette impossible." }, { status: 500 });
  }
}
