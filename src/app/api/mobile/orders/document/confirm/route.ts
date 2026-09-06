import { z } from "zod";
import { mobileApiError, requireMobileBrand, requireMobileCapability } from "@/lib/mobile-api";

export const runtime = "nodejs";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const confirmationSchema = z.object({
  brandId: uuid,
  brandPharmacyId: uuid.nullable().optional(),
  pharmacyId: uuid.nullable().optional(),
  newPharmacy: z.object({
    legalName: z.string().trim().min(1).max(200),
    tradeName: z.string().trim().max(200).optional(),
    siret: z.string().trim().max(32).optional(),
    cip: z.string().trim().max(32).optional(),
    finess: z.string().trim().max(32).optional(),
    postalCode: z.string().trim().max(16).optional(),
    city: z.string().trim().max(120).optional(),
    address: z.string().trim().max(300).optional(),
  }).nullable().optional(),
  orderNumber: z.string().trim().min(1).max(120),
  orderDate: z.string().min(1),
  items: z.array(z.object({
    productId: uuid,
    quantity: z.number().int().positive(),
    freeQuantity: z.number().int().nonnegative(),
    unitPriceHt: z.number().finite().nonnegative(),
    discountRate: z.number().finite().min(0).max(100).nullable(),
  })).min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = confirmationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "La confirmation de commande est invalide." }, { status: 400 });
    }
    const input = parsed.data;
    const selectedCount = Number(Boolean(input.brandPharmacyId)) + Number(Boolean(input.pharmacyId)) + Number(Boolean(input.newPharmacy));
    if (selectedCount !== 1) {
      return Response.json({ error: "Sélectionnez ou créez explicitement une pharmacie." }, { status: 400 });
    }

    const { supabase, brand } = await requireMobileBrand(request, input.brandId);
    await requireMobileCapability(supabase, brand.id, "pdf_order_import");

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const [{ data: products, error: productsError }, { data: externalDuplicate }, { data: numberDuplicate }] = await Promise.all([
      supabase
        .from("products")
        .select("id,tax_rate")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .is("discontinued_at", null)
        .in("id", productIds),
      supabase.from("orders").select("id").eq("brand_id", brand.id).eq("external_order_id", input.orderNumber).maybeSingle(),
      supabase.from("orders").select("id").eq("brand_id", brand.id).eq("order_number", input.orderNumber).maybeSingle(),
    ]);

    if (productsError || products?.length !== productIds.length) {
      return Response.json({ error: "Un produit sélectionné n’est plus disponible." }, { status: 409 });
    }
    if (externalDuplicate || numberDuplicate) {
      return Response.json({ error: "Une commande avec ce numéro existe déjà pour cette marque." }, { status: 409 });
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

    const isAgent = brand.role === "agent";
    const { data, error } = await supabase.rpc("create_order_with_pharmacy_resolution", {
      target_brand_id: brand.id,
      target_brand_pharmacy_id: input.brandPharmacyId ?? null,
      target_pharmacy_id: input.pharmacyId ?? null,
      new_pharmacy_payload: input.newPharmacy ? {
        legal_name: input.newPharmacy.legalName,
        trade_name: input.newPharmacy.tradeName || null,
        siret: input.newPharmacy.siret || null,
        cip_code: input.newPharmacy.cip || null,
        finess_code: input.newPharmacy.finess || null,
        postal_code: input.newPharmacy.postalCode || null,
        city: input.newPharmacy.city || null,
        address_line_1: input.newPharmacy.address || null,
      } : null,
      order_payload: {
        external_order_id: input.orderNumber,
        order_number: input.orderNumber,
        order_type: "other",
        order_status: isAgent ? "pending" : "confirmed",
        order_date: new Date(input.orderDate).toISOString(),
        shipping_amount_ht: 0,
        payment_status: "not_applicable",
        notes: "Commande créée depuis l’application mobile après analyse photo et validation humaine.",
        source: "import",
      },
      item_payload: trustedItems,
    });

    if (error) {
      return Response.json({ error: error.code === "23505" ? "Cette commande existe déjà." : error.message }, { status: 409 });
    }
    const result = Array.isArray(data) ? data[0] : data;
    return Response.json({
      success: isAgent ? "Commande envoyée à la marque." : "Commande importée et validée.",
      orderId: result?.order_id ?? null,
    });
  } catch (error) {
    return mobileApiError(error);
  }
}
