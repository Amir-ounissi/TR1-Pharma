import { NextResponse } from "next/server";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { buildTr1OrderPdf } from "@/lib/orders/order-email";
import { buildOrderPdfPayload } from "@/lib/orders/order-pdf-payload";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedRoles = new Set(["agent", "brand_user", "brand_admin", "tr1_manager", "super_admin"]);

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "commande";
}

function commercialLabel(fullName?: string | null, email?: string | null) {
  return [fullName?.trim(), email?.trim()].filter(Boolean).join(" · ") || null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, brand, userId } = await requireActiveBrand();
    const contexts = await getBrandContexts();
    const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
    if (!allowedRoles.has(role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const admin = createAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,brand_id,pharmacy_id,order_number,external_order_id,order_date,subtotal_ht,discount_amount_ht,net_amount_ht,tax_amount,total_ttc,notes,created_by")
      .eq("id", id)
      .eq("brand_id", brand.id)
      .maybeSingle();
    if (orderError || !order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    const creatorId = order.created_by || userId;
    const [
      { data: brandData, error: brandError },
      { data: pharmacy, error: pharmacyError },
      { data: items, error: itemsError },
      { data: creator },
      { data: creatorProfile },
    ] = await Promise.all([
      supabase.from("brands").select("name,code,order_email").eq("id", brand.id).single(),
      supabase.from("pharmacies").select("legal_name,trade_name,cip_code,siret,vat_number,email,phone,address_line_1,address_line_2,postal_code,city").eq("id", order.pharmacy_id).single(),
      supabase.from("order_items").select("product_id,product_name_snapshot,sku_snapshot,quantity,free_quantity,unit_price_ht,discount_rate,net_unit_price_ht,line_total_ht,tax_rate").eq("order_id", order.id).order("created_at"),
      admin.from("users").select("email").eq("id", creatorId).maybeSingle(),
      admin.from("user_profiles").select("full_name").eq("user_id", creatorId).maybeSingle(),
    ]);

    if (brandError || pharmacyError || itemsError || !brandData || !pharmacy) {
      return NextResponse.json({ error: "Impossible de préparer le bon de commande." }, { status: 500 });
    }
    if (!(items ?? []).length) {
      return NextResponse.json({ error: "Le bon de commande ne peut pas être généré sans ligne produit." }, { status: 422 });
    }

    const productIds = [
      ...new Set(
        (items ?? [])
          .map((item) => item.product_id)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    ];
    const { data: products, error: productsError } = productIds.length
      ? await supabase
          .from("products")
          .select("id,ean,units_per_case")
          .eq("brand_id", brand.id)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) {
      return NextResponse.json({ error: "Impossible de charger le référentiel produits." }, { status: 500 });
    }

    const payload = buildOrderPdfPayload({
      order,
      brand: brandData,
      pharmacy,
      items: items ?? [],
      products: products ?? [],
      commercialEmail: commercialLabel(creatorProfile?.full_name, creator?.email),
    });
    const pdf = buildTr1OrderPdf(payload);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"bon-de-commande-${safeFileName(payload.reference)}.pdf\"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de générer le bon de commande." }, { status: 500 });
  }
}
