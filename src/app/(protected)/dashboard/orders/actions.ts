"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { translateUiMessage } from "@/lib/ui-copy";

export type OrderActionState = { error?: string; success?: string; orderId?: string };
export type OrderPharmacySearchResult = {
  pharmacyId: string;
  brandPharmacyId: string | null;
  relationStatus: "existing_brand_relation" | "global_only";
  name: string;
  detail: string;
};

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const optionalUuid = z.preprocess(
  (value) => value === "" || value == null ? undefined : value,
  uuid.optional(),
);
const orderTypes = ["initial", "reorder", "complementary", "replacement", "sample", "return", "credit_note", "other"] as const;
const orderStatuses = ["draft", "pending", "needs_correction", "confirmed", "invoiced", "partially_delivered", "delivered", "rejected", "cancelled", "refunded"] as const;

export async function createOrderAction(_state: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const header = z.object({
    brandPharmacyId: optionalUuid,
    pharmacyId: optionalUuid,
    externalOrderId: z.string().trim().max(120).optional(),
    orderNumber: z.string().trim().max(120).optional(),
    orderType: z.enum(orderTypes),
    orderStatus: z.enum(orderStatuses),
    orderDate: z.string().min(1),
    shippingAmountHt: z.coerce.number().min(0),
    notes: z.string().trim().max(4000).optional(),
  }).safeParse(Object.fromEntries(formData));
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const freeQuantities = formData.getAll("freeQuantity").map(String);
  const unitPrices = formData.getAll("unitPriceHt").map(String);
  const discountRates = formData.getAll("discountRate").map(String);
  const items = productIds.map((productId, index) => ({
    product_id: productId,
    quantity: Number(quantities[index]),
    free_quantity: Number(freeQuantities[index] || 0),
    unit_price_ht: Number(unitPrices[index]),
    discount_rate: discountRates[index] ? Number(discountRates[index]) : null,
  }));
  const parsedItems = z.array(z.object({ product_id: uuid, quantity: z.number().int().positive(), free_quantity: z.number().int().min(0), unit_price_ht: z.number(), discount_rate: z.number().min(0).max(100).nullable() })).min(1).safeParse(items);
  if (!header.success || !parsedItems.success) return { error: "La commande ou ses lignes sont invalides." };
  if (Number(Boolean(header.data.brandPharmacyId)) + Number(Boolean(header.data.pharmacyId)) !== 1) return { error: "Sélectionnez une pharmacie du référentiel." };
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === brand.id)?.role;
  if (role === "agent" && !["draft", "pending"].includes(header.data.orderStatus)) {
    return { error: "Une commande agent doit être enregistrée en brouillon ou envoyée à la marque." };
  }
  const uniqueProductIds = [...new Set(parsedItems.data.map((item) => item.product_id))];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,tax_rate")
    .eq("brand_id", brand.id)
    .eq("is_active", true)
    .is("discontinued_at", null)
    .in("id", uniqueProductIds);
  if (productsError || products?.length !== uniqueProductIds.length) return { error: "Un produit sélectionné n’est plus disponible pour cette marque." };
  const productById = new Map(products.map((product) => [product.id, product]));
  const trustedItems = parsedItems.data.map((item) => ({ ...item, tax_rate: Number(productById.get(item.product_id)?.tax_rate ?? 0) }));
  const { data, error } = await supabase.rpc("create_order_with_pharmacy_resolution", {
    target_brand_id: brand.id,
    target_brand_pharmacy_id: header.data.brandPharmacyId ?? null,
    target_pharmacy_id: header.data.pharmacyId ?? null,
    new_pharmacy_payload: null,
    order_payload: {
      external_order_id: header.data.externalOrderId || null,
      order_number: header.data.orderNumber || null,
      order_type: header.data.orderType,
      order_status: header.data.orderStatus,
      order_date: new Date(header.data.orderDate).toISOString(),
      shipping_amount_ht: header.data.shippingAmountHt,
      payment_status: "not_applicable",
      notes: header.data.notes || null,
      source: "manual",
    },
    item_payload: trustedItems,
  });
  if (error) return { error: error.code === "23505" ? "Cette commande externe existe déjà." : error.message };
  const result = Array.isArray(data) ? data[0] : data;
  return { success: "Commande créée et indicateurs recalculés.", orderId: result?.order_id as string };
}

export async function searchOrderPharmaciesAction(search: string): Promise<OrderPharmacySearchResult[]> {
  const parsedSearch = z.string().trim().min(2).max(120).safeParse(search);
  if (!parsedSearch.success) return [];
  const { supabase, brand } = await requireActiveBrand();
  const { data, error } = await supabase.rpc("search_pharmacy_directory_for_order", {
    target_brand_id: brand.id,
    search_term: parsedSearch.data,
    candidate_siret: null,
    candidate_cip: null,
    candidate_finess: null,
    candidate_name: null,
    candidate_postal_code: null,
    result_limit: 12,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    pharmacy_id: string;
    brand_pharmacy_id: string | null;
    relation_status: string;
    legal_name: string | null;
    trade_name: string | null;
    city: string | null;
    cip_code: string | null;
    siret: string | null;
  }>).map((row) => ({
    pharmacyId: String(row.pharmacy_id),
    brandPharmacyId: row.brand_pharmacy_id ? String(row.brand_pharmacy_id) : null,
    relationStatus: row.relation_status === "existing_brand_relation" ? "existing_brand_relation" : "global_only",
    name: String(row.trade_name || row.legal_name || "Pharmacie"),
    detail: [row.city, row.cip_code ? `CIP ${row.cip_code}` : null, row.siret ? `SIRET ${row.siret}` : null].filter(Boolean).join(" · "),
  }));
}

export async function changeOrderStatusAction(_state: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const parsed = z.object({ orderId: uuid, orderStatus: z.enum(orderStatuses), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Changement de statut invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("change_order_status", { target_order_id: parsed.data.orderId, target_status: parsed.data.orderStatus, reason: parsed.data.reason || null });
  if (error) return { error: translateUiMessage(error.message) };
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/network");
  const success =
    parsed.data.orderStatus === "pending"
      ? "Commande envoyée à la marque."
      : parsed.data.orderStatus === "confirmed"
        ? "Commande validée."
        : parsed.data.orderStatus === "needs_correction"
          ? "Correction demandée à l’agent."
          : parsed.data.orderStatus === "rejected"
            ? "Commande refusée."
            : "Statut de commande mis à jour.";
  return { success };
}

export async function recalculateActivityAction() {
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.rpc("recalculate_brand_activity", { target_brand_id: brand.id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/network");
  revalidatePath("/dashboard/pharmacies");
}
