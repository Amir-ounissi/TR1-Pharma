import { z } from "zod";
import { MobileApiError, mobileApiError, requireMobileBrand } from "@/lib/mobile-api";

export const runtime = "nodejs";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const orderTypes = ["initial", "reorder", "complementary", "replacement", "sample", "return", "credit_note", "other"] as const;
const orderStatuses = ["draft", "pending", "confirmed"] as const;
const allowedRoles = new Set(["agent", "tr1_manager", "brand_admin", "super_admin"]);

const confirmationSchema = z.object({
  brandId: uuid,
  brandPharmacyId: uuid.nullable().optional(),
  pharmacyId: uuid.nullable().optional(),
  externalOrderId: z.string().trim().max(120).optional(),
  orderNumber: z.string().trim().max(120).optional(),
  orderType: z.enum(orderTypes),
  orderStatus: z.enum(orderStatuses),
  orderDate: z.string().min(1),
  shippingAmountHt: z.number().finite().min(0),
  notes: z.string().trim().max(4000).optional(),
  items: z.array(z.object({
    productId: uuid,
    quantity: z.number().int().positive(),
    freeQuantity: z.number().int().min(0),
    unitPriceHt: z.number().finite(),
    discountRate: z.number().finite().min(0).max(100).nullable(),
  })).min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = confirmationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "La commande ou ses lignes sont invalides." }, { status: 400 });
    }

    const input = parsed.data;
    if (Number(Boolean(input.brandPharmacyId)) + Number(Boolean(input.pharmacyId)) !== 1) {
      return Response.json({ error: "Sélectionnez une pharmacie du référentiel." }, { status: 400 });
    }

    const { supabase, brand } = await requireMobileBrand(request, input.brandId);
    if (!allowedRoles.has(brand.role)) {
      throw new MobileApiError(403, "Votre rôle ne permet pas de créer une commande.");
    }
    if (brand.role === "agent" && !["draft", "pending"].includes(input.orderStatus)) {
      return Response.json({ error: "Une commande agent doit être enregistrée en brouillon ou envoyée à la marque." }, { status: 403 });
    }
    if (brand.role !== "agent" && !["draft", "confirmed"].includes(input.orderStatus)) {
      return Response.json({ error: "Une saisie manuelle marque doit être créée en brouillon ou validée." }, { status: 403 });
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,tax_rate")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null)
      .in("id", productIds);

    if (productsError || products?.length !== productIds.length) {
      return Response.json({ error: "Un produit sélectionné n’est plus disponible pour cette marque." }, { status: 409 });
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const trustedItems = input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      free_quantity: item.freeQuantity,
      unit_price_ht: item.unitPriceHt,
      discount_rate: item.discountRate,
      tax_rate: Number(productById.get(item.productId)?.tax_rate ?? 0),
    }));

    const { data, error } = await supabase.rpc("create_order_with_pharmacy_resolution", {
      target_brand_id: brand.id,
      target_brand_pharmacy_id: input.brandPharmacyId ?? null,
      target_pharmacy_id: input.pharmacyId ?? null,
      new_pharmacy_payload: null,
      order_payload: {
        external_order_id: input.externalOrderId || null,
        order_number: input.orderNumber || null,
        order_type: input.orderType,
        order_status: input.orderStatus,
        order_date: new Date(input.orderDate).toISOString(),
        shipping_amount_ht: input.shippingAmountHt,
        payment_status: "not_applicable",
        notes: input.notes || null,
        source: "manual",
      },
      item_payload: trustedItems,
    });

    if (error) {
      return Response.json({ error: error.code === "23505" ? "Cette commande externe existe déjà." : error.message }, { status: 409 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    return Response.json({
      success:
        input.orderStatus === "draft"
          ? "Commande enregistrée en brouillon."
          : input.orderStatus === "pending"
            ? "Commande envoyée à la marque."
            : "Commande créée et validée.",
      orderId: result?.order_id ?? null,
    });
  } catch (error) {
    return mobileApiError(error);
  }
}
