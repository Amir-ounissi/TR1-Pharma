"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveBrand } from "@/lib/auth";

export type OrderActionState = { error?: string; success?: string; orderId?: string };

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const orderTypes = ["initial", "reorder", "complementary", "replacement", "sample", "return", "credit_note", "other"] as const;
const orderStatuses = ["draft", "pending", "confirmed", "invoiced", "partially_delivered", "delivered", "cancelled", "refunded"] as const;

export async function createOrderAction(_state: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const header = z.object({
    brandPharmacyId: uuid,
    externalOrderId: z.string().trim().max(120).optional(),
    orderNumber: z.string().trim().max(120).optional(),
    orderType: z.enum(orderTypes),
    orderStatus: z.enum(orderStatuses),
    orderDate: z.string().min(1),
    shippingAmountHt: z.coerce.number().min(0),
    paymentStatus: z.enum(["not_applicable", "pending", "partially_paid", "paid", "overdue", "refunded"]),
    notes: z.string().trim().max(4000).optional(),
  }).safeParse(Object.fromEntries(formData));
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const freeQuantities = formData.getAll("freeQuantity").map(String);
  const unitPrices = formData.getAll("unitPriceHt").map(String);
  const discountRates = formData.getAll("discountRate").map(String);
  const taxRates = formData.getAll("taxRate").map(String);
  const items = productIds.map((productId, index) => ({
    product_id: productId,
    quantity: Number(quantities[index]),
    free_quantity: Number(freeQuantities[index] || 0),
    unit_price_ht: Number(unitPrices[index]),
    discount_rate: discountRates[index] ? Number(discountRates[index]) : null,
    tax_rate: Number(taxRates[index] || 20),
  }));
  const parsedItems = z.array(z.object({ product_id: uuid, quantity: z.number().int().positive(), free_quantity: z.number().int().min(0), unit_price_ht: z.number(), discount_rate: z.number().min(0).max(100).nullable(), tax_rate: z.number().min(0).max(100) })).min(1).safeParse(items);
  if (!header.success || !parsedItems.success) return { error: "La commande ou ses lignes sont invalides." };
  const { supabase } = await requireActiveBrand();
  const { data, error } = await supabase.rpc("create_order", {
    target_brand_pharmacy_id: header.data.brandPharmacyId,
    order_payload: {
      external_order_id: header.data.externalOrderId || null,
      order_number: header.data.orderNumber || null,
      order_type: header.data.orderType,
      order_status: header.data.orderStatus,
      order_date: new Date(header.data.orderDate).toISOString(),
      shipping_amount_ht: header.data.shippingAmountHt,
      payment_status: header.data.paymentStatus,
      notes: header.data.notes || null,
      source: "manual",
    },
    item_payload: parsedItems.data,
  });
  if (error) return { error: error.code === "23505" ? "Cette commande externe existe déjà." : error.message };
  return { success: "Commande créée et indicateurs recalculés.", orderId: data as string };
}

export async function changeOrderStatusAction(_state: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const parsed = z.object({ orderId: uuid, orderStatus: z.enum(orderStatuses), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Changement de statut invalide." };
  const { supabase } = await requireActiveBrand();
  const { error } = await supabase.rpc("change_order_status", { target_order_id: parsed.data.orderId, target_status: parsed.data.orderStatus, reason: parsed.data.reason || null });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/network");
  return { success: "Statut de commande mis à jour." };
}

export async function recalculateActivityAction() {
  const { supabase, brand } = await requireActiveBrand();
  const { error } = await supabase.rpc("recalculate_brand_activity", { target_brand_id: brand.id });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/network");
  revalidatePath("/dashboard/pharmacies");
}
