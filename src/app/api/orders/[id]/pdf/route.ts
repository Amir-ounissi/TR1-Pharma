import { NextResponse } from "next/server";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { buildTr1OrderPdf } from "@/lib/orders/order-email";
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

    const [
      { data: brandData, error: brandError },
      { data: pharmacy, error: pharmacyError },
      { data: items, error: itemsError },
      { data: creator },
    ] = await Promise.all([
      supabase.from("brands").select("name,code,order_email").eq("id", brand.id).single(),
      supabase.from("pharmacies").select("legal_name,trade_name,cip_code,siret,vat_number,email,phone,address_line_1,address_line_2,postal_code,city").eq("id", order.pharmacy_id).single(),
      supabase.from("order_items").select("product_id,product_name_snapshot,sku_snapshot,quantity,free_quantity,unit_price_ht,discount_rate,net_unit_price_ht,line_total_ht,tax_rate").eq("order_id", order.id).order("created_at"),
      admin.from("users").select("email").eq("id", order.created_by || userId).maybeSingle(),
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
    const productById = new Map((products ?? []).map((product) => [product.id, product]));

    const reference = order.order_number || order.external_order_id || order.id.slice(0, 8);
    const pharmacyName = pharmacy.trade_name || pharmacy.legal_name || "Pharmacie";
    const pdf = buildTr1OrderPdf({
      reference,
      orderDate: order.order_date,
      brandName: brandData.name,
      brandCode: brandData.code,
      brandOrderEmail: brandData.order_email,
      commercialEmail: creator?.email,
      pharmacy: {
        name: pharmacyName,
        legalName: pharmacy.legal_name,
        code: pharmacy.cip_code,
        addressLine1: pharmacy.address_line_1,
        addressLine2: pharmacy.address_line_2,
        postalCode: pharmacy.postal_code,
        city: pharmacy.city,
        email: pharmacy.email,
        phone: pharmacy.phone,
        siret: pharmacy.siret,
        vatNumber: pharmacy.vat_number,
      },
      items: (items ?? []).map((item) => {
        const product = item.product_id ? productById.get(item.product_id) : undefined;
        return {
          reference: item.sku_snapshot,
          ean: product?.ean ?? null,
          designation: item.product_name_snapshot,
          quantity: item.quantity,
          freeQuantity: item.free_quantity,
          unitPriceHt: item.unit_price_ht,
          discountRate: item.discount_rate,
          netUnitPriceHt: item.net_unit_price_ht,
          lineTotalHt: item.line_total_ht,
          taxRate: item.tax_rate,
          unitsPerCase: product?.units_per_case ?? null,
        };
      }),
      totals: {
        subtotalHt: order.subtotal_ht,
        discountAmountHt: order.discount_amount_ht,
        netAmountHt: order.net_amount_ht,
        taxAmount: order.tax_amount,
        totalTtc: order.total_ttc,
      },
      notes: order.notes,
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"bon-de-commande-${safeFileName(reference)}.pdf\"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de générer le bon de commande." }, { status: 500 });
  }
}
