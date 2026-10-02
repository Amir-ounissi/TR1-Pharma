import { NextResponse } from "next/server";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { buildBlankSepaMandatePdf } from "@/lib/orders/order-email";
import { isVkSwissBrand } from "@/lib/orders/order-email-transmission";

const allowedRoles = new Set(["agent", "brand_user", "brand_admin", "tr1_manager", "super_admin"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, brand } = await requireActiveBrand();
    const contexts = await getBrandContexts();
    const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
    if (!allowedRoles.has(role)) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    if (!isVkSwissBrand({ name: brand.name })) {
      return NextResponse.json({ error: "Mandat SEPA non disponible pour cette marque." }, { status: 404 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id")
      .eq("id", id)
      .eq("brand_id", brand.id)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    return new Response(buildBlankSepaMandatePdf(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="mandat-sepa-core-a-remplir.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de générer le mandat SEPA." }, { status: 500 });
  }
}
