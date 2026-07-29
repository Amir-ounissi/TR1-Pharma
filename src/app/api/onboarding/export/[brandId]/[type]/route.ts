import type { NextRequest } from "next/server";
import { recordsToCsv } from "@/lib/imports/control-export";
import { requirePlatformAdmin } from "@/lib/auth";

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ brandId: string; type: string }> },
) {
  const { brandId, type } = await params;
  const { supabase, userId } = await requirePlatformAdmin();
  const { data: brand } = await supabase.from("brands").select("id,organization_id,name,status,activated_at").eq("id", brandId).single();
  if (!brand) return new Response("Marque inaccessible.", { status: 404 });

  let records: Array<Record<string, unknown>> = [];
  if (type === "products") {
    const { data } = await supabase.from("products").select("sku,name,category,is_active,wholesale_price_ht,ean,strategic_priority").eq("brand_id", brandId).order("sku");
    records = (data ?? []).map((row) => ({ product_code: row.sku, product_name: row.name, category: row.category, active: row.is_active, unit_price_ht: row.wholesale_price_ht, ean: row.ean, strategic: row.strategic_priority === "strategic" }));
  } else if (type === "pharmacies") {
    const { data } = await supabase.from("brand_pharmacies").select("external_id,potential_level,priority_level,territories(code),pharmacies(legal_name,address_line_1,address_line_2,postal_code,city,country_code,phone,email)").eq("brand_id", brandId).is("archived_at", null);
    records = (data ?? []).map((row) => {
      const pharmacy = firstRelation(row.pharmacies);
      const territory = firstRelation(row.territories);
      return { external_id: row.external_id, pharmacy_name: pharmacy?.legal_name, address_line_1: pharmacy?.address_line_1, address_line_2: pharmacy?.address_line_2, postal_code: pharmacy?.postal_code, city: pharmacy?.city, country: pharmacy?.country_code, phone: pharmacy?.phone, email: pharmacy?.email, potential: row.potential_level, strategic: row.priority_level === "strategic", territory_code: territory?.code };
    });
  } else if (type === "orders") {
    const { data } = await supabase.from("orders").select("external_order_id,order_date,order_status,net_amount_ht,currency_code,brand_pharmacies(external_id)").eq("brand_id", brandId).eq("source", "import").order("order_date");
    records = (data ?? []).map((row) => ({ external_order_id: row.external_order_id, pharmacy_external_id: firstRelation(row.brand_pharmacies)?.external_id, order_date: row.order_date, status: row.order_status, total_ht: row.net_amount_ht, currency: row.currency_code }));
  } else if (type === "users") {
    const { data } = await supabase.from("memberships").select("status,roles(key),users(email,user_profiles(full_name)),territories(code)").eq("brand_id", brandId);
    records = (data ?? []).map((row) => {
      const user = firstRelation(row.users);
      const profile = firstRelation(user?.user_profiles ?? null);
      const [firstName, ...lastName] = (profile?.full_name ?? "").split(" ");
      return { email: user?.email, first_name: firstName, last_name: lastName.join(" "), role: firstRelation(row.roles)?.key, territory_code: firstRelation(row.territories)?.code, active: row.status === "active" };
    });
  } else if (type === "territories") {
    const { data } = await supabase.from("territories").select("code,name,country_code,region_code,users(email)").eq("brand_id", brandId).is("archived_at", null).order("code");
    records = (data ?? []).map((row) => ({ territory_code: row.code, territory_name: row.name, country: row.country_code, department_or_region: row.region_code, manager_email: firstRelation(row.users)?.email }));
  } else if (type === "summary") {
    const [{ data: organization }, { data: jobs }, { data: checklist }] = await Promise.all([
      supabase.from("organizations").select("legal_name,trade_name").eq("id", brand.organization_id).single(),
      supabase.from("import_batches").select("entity_type,lifecycle_status,valid_rows,warning_rows,error_rows,executed_at").eq("brand_id", brandId),
      supabase.rpc("get_brand_activation_checklist", { target_brand_id: brandId }),
    ]);
    records = [{
      organisation: organization?.legal_name,
      marque: brand.name,
      statut: brand.status,
      activation: brand.activated_at,
      imports_termines: (jobs ?? []).filter((job) => job.lifecycle_status.startsWith("completed")).length,
      lignes_importees: (jobs ?? []).filter((job) => job.lifecycle_status.startsWith("completed")).reduce((sum, job) => sum + job.valid_rows, 0),
      avertissements: (jobs ?? []).reduce((sum, job) => sum + job.warning_rows, 0),
      erreurs_ouvertes: (jobs ?? []).filter((job) => job.lifecycle_status === "failed").reduce((sum, job) => sum + job.error_rows, 0),
      controles_reussis: (checklist ?? []).filter((item: { completed: boolean }) => item.completed).length,
      controles_total: checklist?.length ?? 0,
    }];
  } else {
    return new Response("Export inconnu.", { status: 404 });
  }

  await supabase.from("onboarding_audit_logs").insert({
    organization_id: brand.organization_id,
    brand_id: brandId,
    actor_user_id: userId,
    event_name: "control_exported",
    metadata: { type, rows: records.length },
  });
  return new Response(`\uFEFF${recordsToCsv(records)}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${brandId.slice(0, 8)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
