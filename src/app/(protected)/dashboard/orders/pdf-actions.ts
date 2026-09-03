"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";
import { extractPdfOrder, PdfOrderImportError } from "@/lib/orders/pdf-order-extraction";
import { calculateOrderTotal, hasMeaningfulTotalDifference, matchPdfPharmacy, matchPdfProduct, resolvedLinePrice, type PharmacyCandidate, type ProductCandidate } from "@/lib/orders/pdf-order-matching";
import type { PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

type PreviewPharmacy = PharmacyCandidate;
type PreviewProduct = Omit<ProductCandidate, "references">;

export type PdfOrderPreview = {
  extraction: PdfOrderExtraction;
  pharmacy: { status: "matched" | "suggested" | "unmatched" | "ambiguous"; method: string | null; selectedPharmacyId: string | null; selectedBrandPharmacyId: string | null; candidates: PreviewPharmacy[] };
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
      supabase.from("products").select("id,name,sku,ean,wholesale_price_ht,tax_rate,product_references!product_references_product_brand_fk(sku,ean,label)").eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null),
    ]);
    if (pharmaciesError || productsError) return { error: "Les données de la marque ne sont pas disponibles." };
    const pharmacies = ((directoryRows ?? []) as Array<Record<string, unknown>>)
      .map((row) => readPharmacy(row))
      .filter((row): row is PharmacyCandidate => row !== null);
    const products = (productRows ?? []).map((row) => readProduct(row as unknown as Record<string, unknown>));
    const pharmacyMatch = matchPdfPharmacy(extraction.pharmacy, pharmacies);
    const lines = extraction.lines.map((line, index) => {
      const productMatch = matchPdfProduct(line, products);
      const price = resolvedLinePrice(line, productMatch.match);
      return {
        index, label: line.label, sku: line.sku, ean: line.ean, quantity: line.quantity, unitPriceHt: line.unitPriceHt, discountRate: line.discountRate,
        product: { status: productMatch.status, method: productMatch.method, selectedId: productMatch.match?.id || null, candidates: (productMatch.status === "matched" ? productMatch.candidates : products).map((product) => ({ id: product.id, name: product.name, sku: product.sku, ean: product.ean, wholesalePriceHt: product.wholesalePriceHt, taxRate: product.taxRate })) },
        suggestedPriceHt: price.price, priceWarning: price.warning,
      };
    });
    const totalTr1Ht = calculateOrderTotal(lines.map((line) => ({ quantity: line.quantity, unitPriceHt: line.suggestedPriceHt, discountRate: line.discountRate })));
    const warnings = [...extraction.warnings, ...lines.flatMap((line) => line.priceWarning ? [line.priceWarning] : [])];
    return {
      preview: {
        extraction,
        pharmacy: { status: pharmacyMatch.status, method: pharmacyMatch.method, selectedPharmacyId: pharmacyMatch.status === "matched" ? pharmacyMatch.match?.pharmacyId || null : null, selectedBrandPharmacyId: pharmacyMatch.status === "matched" ? pharmacyMatch.match?.brandPharmacyId || null : null, candidates: pharmacyMatch.status === "matched" || pharmacyMatch.status === "suggested" ? pharmacyMatch.candidates : pharmacies },
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
  brandPharmacyId: uuid.optional(),
  pharmacyId: uuid.optional(),
  newPharmacy: z.object({ legalName: z.string().trim().min(1).max(200), tradeName: z.string().trim().max(200).optional(), siret: z.string().trim().max(32).optional(), cip: z.string().trim().max(32).optional(), finess: z.string().trim().max(32).optional(), postalCode: z.string().trim().max(16).optional(), city: z.string().trim().max(120).optional(), address: z.string().trim().max(300).optional() }).optional(),
  orderNumber: z.string().trim().min(1).max(120),
  orderDate: z.string().min(1),
  items: z.array(z.object({ productId: uuid, quantity: z.number().int().positive(), unitPriceHt: z.number().finite().nonnegative(), discountRate: z.number().finite().min(0).max(100).nullable() })).min(1),
});

export async function confirmPdfOrderAction(_state: PdfOrderActionState, formData: FormData): Promise<PdfOrderActionState> {
  const rawItems = formData.get("items");
  let items: unknown;
  try { items = JSON.parse(typeof rawItems === "string" ? rawItems : "[]"); } catch { return { error: "Les lignes de commande sont invalides." }; }
  let newPharmacy: unknown;
  try { newPharmacy = JSON.parse(typeof formData.get("newPharmacy") === "string" ? String(formData.get("newPharmacy")) : "null"); } catch { return { error: "Les informations de la pharmacie sont invalides." }; }
  const parsed = confirmationSchema.safeParse({ brandPharmacyId: formData.get("brandPharmacyId") || undefined, pharmacyId: formData.get("pharmacyId") || undefined, newPharmacy: newPharmacy || undefined, orderNumber: formData.get("orderNumber"), orderDate: formData.get("orderDate"), items });
  if (!parsed.success) return { error: "La confirmation de commande est invalide." };
  if (Number(Boolean(parsed.data.brandPharmacyId)) + Number(Boolean(parsed.data.pharmacyId)) + Number(Boolean(parsed.data.newPharmacy)) !== 1) return { error: "Sélectionnez ou créez explicitement une pharmacie." };
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: products, error: productsError }, { data: externalDuplicate }, { data: numberDuplicate }] = await Promise.all([
    supabase.from("products").select("id,tax_rate").eq("brand_id", brand.id).eq("is_active", true).is("discontinued_at", null).in("id", [...new Set(parsed.data.items.map((item) => item.productId))]),
    supabase.from("orders").select("id").eq("brand_id", brand.id).eq("external_order_id", parsed.data.orderNumber).maybeSingle(),
    supabase.from("orders").select("id").eq("brand_id", brand.id).eq("order_number", parsed.data.orderNumber).maybeSingle(),
  ]);
  if (productsError || products?.length !== new Set(parsed.data.items.map((item) => item.productId)).size) return { error: "Un produit sélectionné n’est plus disponible." };
  if (externalDuplicate || numberDuplicate) return { error: "Une commande avec ce numéro existe déjà pour cette marque." };
  const productById = new Map(products.map((product) => [product.id, product]));
  const trustedItems = parsed.data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, free_quantity: 0, unit_price_ht: item.unitPriceHt, discount_rate: item.discountRate, tax_rate: Number(productById.get(item.productId)?.tax_rate ?? 0) }));
  const { data, error } = await supabase.rpc("create_order_with_pharmacy_resolution", {
    target_brand_id: brand.id,
    target_brand_pharmacy_id: parsed.data.brandPharmacyId ?? null,
    target_pharmacy_id: parsed.data.pharmacyId ?? null,
    new_pharmacy_payload: parsed.data.newPharmacy ? {
      legal_name: parsed.data.newPharmacy.legalName,
      trade_name: parsed.data.newPharmacy.tradeName || null,
      siret: parsed.data.newPharmacy.siret || null,
      cip_code: parsed.data.newPharmacy.cip || null,
      finess_code: parsed.data.newPharmacy.finess || null,
      postal_code: parsed.data.newPharmacy.postalCode || null,
      city: parsed.data.newPharmacy.city || null,
      address_line_1: parsed.data.newPharmacy.address || null,
    } : null,
    order_payload: { external_order_id: parsed.data.orderNumber, order_number: parsed.data.orderNumber, order_type: "other", order_status: "confirmed", order_date: new Date(parsed.data.orderDate).toISOString(), shipping_amount_ht: 0, payment_status: "pending", notes: "Commande créée depuis un PDF vérifié par l’utilisateur.", source: "import" },
    item_payload: trustedItems,
  });
  if (error) return { error: error.code === "23505" ? "Cette commande existe déjà." : error.message };
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/pharmacies");
  const result = Array.isArray(data) ? data[0] : data;
  return { success: "Commande PDF confirmée.", orderId: result?.order_id as string };
}
