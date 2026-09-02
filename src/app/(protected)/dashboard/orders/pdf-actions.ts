"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { extractPdfOrder, PdfOrderImportError } from "@/lib/orders/pdf-order-extraction";
import { calculateOrderTotal, hasMeaningfulTotalDifference, matchPdfPharmacy, matchPdfProduct, resolvedLinePrice, type PharmacyCandidate, type ProductCandidate } from "@/lib/orders/pdf-order-matching";
import type { PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

const uuid = z.string().uuid();

type PreviewPharmacy = PharmacyCandidate;
type PreviewProduct = Omit<ProductCandidate, "references">;

export type PdfOrderPreview = {
  extraction: PdfOrderExtraction;
  pharmacy: { status: "matched" | "unmatched" | "ambiguous"; method: string | null; selectedId: string | null; candidates: PreviewPharmacy[] };
  lines: Array<{
    index: number;
    label: string | null;
    sku: string | null;
    ean: string | null;
    quantity: number | null;
    unitPriceHt: number | null;
    discountRate: number | null;
    product: { status: "matched" | "unmatched" | "ambiguous"; method: string | null; selectedId: string | null; candidates: PreviewProduct[] };
    suggestedPriceHt: number | null;
    priceWarning: string | null;
  }>;
  totalTr1Ht: number;
  totalDifferenceWarning: boolean;
  warnings: string[];
};

export type PdfOrderActionState = { error?: string; preview?: PdfOrderPreview; success?: string; orderId?: string };

function readPharmacy(row: { id: string; pharmacies: unknown }): PharmacyCandidate | null {
  const pharmacy = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies as Record<string, unknown> | null;
  if (!pharmacy) return null;
  return {
    id: row.id,
    name: String(pharmacy.trade_name || pharmacy.legal_name || "Pharmacie"),
    siret: typeof pharmacy.siret === "string" ? pharmacy.siret : null,
    cip: typeof pharmacy.cip_code === "string" ? pharmacy.cip_code : null,
    finess: typeof pharmacy.finess_code === "string" ? pharmacy.finess_code : null,
    postalCode: typeof pharmacy.postal_code === "string" ? pharmacy.postal_code : null,
  };
}

function readProduct(row: Record<string, unknown>): ProductCandidate {
  const references = Array.isArray(row.product_references) ? row.product_references : [];
  return {
    id: String(row.id), name: String(row.name), sku: typeof row.sku === "string" ? row.sku : null, ean: typeof row.ean === "string" ? row.ean : null,
    wholesalePriceHt: typeof row.wholesale_price_ht === "number" ? row.wholesale_price_ht : row.wholesale_price_ht == null ? null : Number(row.wholesale_price_ht),
    taxRate: typeof row.tax_rate === "number" ? row.tax_rate : row.tax_rate == null ? null : Number(row.tax_rate),
    references: references.map((reference) => {
      const item = reference as Record<string, unknown>;
      return { sku: typeof item.sku === "string" ? item.sku : null, ean: typeof item.ean === "string" ? item.ean : null, label: typeof item.label === "string" ? item.label : null };
    }),
  };
}

export async function analyzePdfOrderAction(_state: PdfOrderActionState, formData: FormData): Promise<PdfOrderActionState> {
  const candidate = formData.get("pdf");
  if (!(candidate instanceof File) || candidate.size === 0) return { error: "Ajoutez un PDF de commande." };
  try {
    const { supabase, brand } = await requireActiveBrand();
    const extraction = await extractPdfOrder(candidate);
    const [{ data: relationRows, error: pharmaciesError }, { data: productRows, error: productsError }] = await Promise.all([
      supabase.from("brand_pharmacies").select("id,pharmacies(legal_name,trade_name,siret,cip_code,finess_code,postal_code)").eq("brand_id", brand.id).is("archived_at", null),
      supabase.from("products").select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references(sku,ean,label)").eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null),
    ]);
    if (pharmaciesError || productsError) return { error: "Les données de la marque ne sont pas disponibles." };
    const pharmacies = (relationRows ?? []).map(readPharmacy).filter((row): row is PharmacyCandidate => row !== null);
    const products = (productRows ?? []).map((row) => readProduct(row as unknown as Record<string, unknown>));
    const pharmacyMatch = matchPdfPharmacy(extraction.pharmacy, pharmacies);
    const lines = extraction.lines.map((line, index) => {
      const productMatch = matchPdfProduct(line, products);
      const price = resolvedLinePrice(line, productMatch.match);
      return {
        index, label: line.label, sku: line.sku, ean: line.ean, quantity: line.quantity, unitPriceHt: line.unitPriceHt, discountRate: line.discountRate,
        product: { status: productMatch.status, method: productMatch.method, selectedId: productMatch.match?.id ?? null, candidates: (productMatch.status === "matched" ? productMatch.candidates : products).map(({ references: _references, ...product }) => product) },
        suggestedPriceHt: price.price, priceWarning: price.warning,
      };
    });
    const totalTr1Ht = calculateOrderTotal(lines.map((line) => ({ quantity: line.quantity, unitPriceHt: line.suggestedPriceHt, discountRate: line.discountRate })));
    const warnings = [...extraction.warnings, ...lines.flatMap((line) => line.priceWarning ? [line.priceWarning] : [])];
    return {
      preview: {
        extraction,
        pharmacy: { status: pharmacyMatch.status, method: pharmacyMatch.method, selectedId: pharmacyMatch.match?.id ?? null, candidates: pharmacyMatch.status === "matched" ? pharmacyMatch.candidates : pharmacies },
        lines,
        totalTr1Ht,
        totalDifferenceWarning: hasMeaningfulTotalDifference(extraction.totalHt, totalTr1Ht),
        warnings,
      },
    };
  } catch (error) {
    return { error: error instanceof PdfOrderImportError ? error.message : "Une erreur est survenue pendant l’analyse du PDF." };
  }
}

const confirmationSchema = z.object({
  brandPharmacyId: uuid,
  orderNumber: z.string().trim().min(1).max(120),
  orderDate: z.string().min(1),
  items: z.array(z.object({ productId: uuid, quantity: z.number().int().positive(), unitPriceHt: z.number().finite().nonnegative(), discountRate: z.number().finite().min(0).max(100).nullable() })).min(1),
});

export async function confirmPdfOrderAction(_state: PdfOrderActionState, formData: FormData): Promise<PdfOrderActionState> {
  const rawItems = formData.get("items");
  let items: unknown;
  try { items = JSON.parse(typeof rawItems === "string" ? rawItems : "[]"); } catch { return { error: "Les lignes de commande sont invalides." }; }
  const parsed = confirmationSchema.safeParse({ brandPharmacyId: formData.get("brandPharmacyId"), orderNumber: formData.get("orderNumber"), orderDate: formData.get("orderDate"), items });
  if (!parsed.success) return { error: "La confirmation de commande est invalide." };
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: relation, error: relationError }, { data: products, error: productsError }, { data: externalDuplicate }, { data: numberDuplicate }] = await Promise.all([
    supabase.from("brand_pharmacies").select("id").eq("id", parsed.data.brandPharmacyId).eq("brand_id", brand.id).is("archived_at", null).maybeSingle(),
    supabase.from("products").select("id,tax_rate").eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null).in("id", [...new Set(parsed.data.items.map((item) => item.productId))]),
    supabase.from("orders").select("id").eq("brand_id", brand.id).eq("external_order_id", parsed.data.orderNumber).maybeSingle(),
    supabase.from("orders").select("id").eq("brand_id", brand.id).eq("order_number", parsed.data.orderNumber).maybeSingle(),
  ]);
  if (relationError || !relation) return { error: "Cette pharmacie n’est pas accessible." };
  if (productsError || products?.length !== new Set(parsed.data.items.map((item) => item.productId)).size) return { error: "Un produit sélectionné n’est plus disponible." };
  if (externalDuplicate || numberDuplicate) return { error: "Une commande avec ce numéro existe déjà pour cette marque." };
  const productById = new Map(products.map((product) => [product.id, product]));
  const trustedItems = parsed.data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, free_quantity: 0, unit_price_ht: item.unitPriceHt, discount_rate: item.discountRate, tax_rate: Number(productById.get(item.productId)?.tax_rate ?? 0) }));
  const { data: orderId, error } = await supabase.rpc("create_order", {
    target_brand_pharmacy_id: parsed.data.brandPharmacyId,
    order_payload: { external_order_id: parsed.data.orderNumber, order_number: parsed.data.orderNumber, order_type: "other", order_status: "confirmed", order_date: new Date(parsed.data.orderDate).toISOString(), shipping_amount_ht: 0, payment_status: "pending", notes: "Commande créée depuis un PDF vérifié par l’utilisateur.", source: "import" },
    item_payload: trustedItems,
  });
  if (error) return { error: error.code === "23505" ? "Cette commande existe déjà." : error.message };
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/pharmacies");
  return { success: "Commande PDF confirmée.", orderId: orderId as string };
}
