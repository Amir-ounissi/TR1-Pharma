"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE, getBrandContexts, isPlatformAdmin, requireActiveBrand, requireUser } from "@/lib/auth";
import { presentationLabel, presentationText } from "@/lib/presentation";
import { getActiveBrandSaasContext } from "@/lib/saas/server";
import { getRoleFamily } from "@/lib/ux/navigation";
import { mentionedSearchBrands, searchCandidateFragments, searchIntent } from "@/lib/ux/search";
import type { SearchItem } from "@/lib/ux/search";

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  // Keep the non-sensitive active-brand preference so the next login can
  // reopen the last workspace without a forced context-selection step.
  redirect("/login");
}

export async function changeBrandAction() {
  redirect("/dashboard/account");
}

export async function returnToPlatformAdministrationAction() {
  if (!(await isPlatformAdmin())) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRAND_COOKIE);
  redirect("/dashboard");
}


type BrandSearchScope = {
  id: string;
  name: string;
  role: string;
  capabilities: ReadonlySet<string>;
};

const searchOrderRoles = new Set(["agent", "tr1_manager", "brand_admin", "super_admin"]);

function scopedHref(brandId: string, activeBrandId: string, destination: string) {
  return brandId === activeBrandId
    ? destination
    : `/dashboard/search/open?brand=${encodeURIComponent(brandId)}&to=${encodeURIComponent(destination)}`;
}

function brandDescription(brandName: string, detail?: string | null) {
  return [brandName, detail].filter(Boolean).join(" · ");
}

/**
 * Cross-brand reads use the requesting user's Supabase session and RLS.
 * Context membership alone is insufficient: inspect brand-specific feature entitlements.
 * No service-role key is used and a result never exposes a write operation.
 */
export async function searchDashboardAction(rawQuery: string): Promise<SearchItem[]> {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return [];

  const [{ supabase, brand }, contexts] = await Promise.all([
    requireActiveBrand(),
    getBrandContexts(),
  ]);
  if (!contexts.some((context) => context.id === brand.id)) return [];

  const eligibleContexts = contexts.filter((context) =>
    getRoleFamily(context.role) !== "facilitator" &&
    getRoleFamily(context.role) !== "direction",
  );
  if (!eligibleContexts.some((context) => context.id === brand.id)) return [];

  const scopes = (await Promise.all(eligibleContexts.map(async (context): Promise<BrandSearchScope | null> => {
    try {
      const { data, error } = await supabase.rpc("get_my_brand_capabilities", { target_brand_id: context.id });
      if (error) return null;
      return {
        id: context.id,
        name: context.name,
        role: context.role,
        capabilities: new Set((data ?? [])
          .filter((entry: { enabled: boolean }) => entry.enabled)
          .map((entry: { capability_key: string }) => entry.capability_key)),
      };
    } catch {
      // Failure for one brand must not expose data from another brand.
      return null;
    }
  }))).filter((scope): scope is BrandSearchScope => scope !== null);

  const mentioned = mentionedSearchBrands(query, scopes);
  const targets = mentioned.length ? mentioned : scopes;
  const byId = new Map(targets.map((scope) => [scope.id, scope]));
  const activeBrandId = brand.id;
  const intent = searchIntent(query);
  const fragments = searchCandidateFragments(query, scopes).map((value) => value.replace(/[^a-z0-9]/g, ""));
  const safeFragments = fragments.filter(Boolean);
  const result: SearchItem[] = [];

  for (const scope of targets) {
    const href = (path: string) => scopedHref(scope.id, activeBrandId, path);
    const suffix = targets.length > 1 ? ` · ${scope.name}` : "";
    if (scope.capabilities.has("core_crm") && intent.followUps) {
      result.push({
        id: `action-followups-${scope.id}`, kind: "action",
        label: `Pharmacies à relancer${suffix}`,
        description: brandDescription(scope.name, "Portefeuille à risque et dormant"),
        href: href("/dashboard/pharmacies?view=list&attention=1"),
        keywords: ["pharmacies inactives relance relancer dormant"],
      });
    } else if (scope.capabilities.has("core_crm") && intent.priority) {
      result.push({
        id: `action-priority-${scope.id}`, kind: "action",
        label: `Pharmacies prioritaires${suffix}`,
        description: scope.name,
        href: href("/dashboard/pharmacies?view=list&priority=strategic"),
        keywords: ["stratégiques priorités pharmacies"],
      });
    }
    if (scope.capabilities.has("orders") && intent.orders && !intent.createOrder) {
      result.push({
        id: `action-orders-${scope.id}`, kind: "action",
        label: `Voir les commandes${suffix}`,
        description: scope.name, href: href("/dashboard/orders"),
        keywords: ["commandes réassorts commandes en cours"],
      });
    }
    if (scope.capabilities.has("orders") && intent.createOrder && searchOrderRoles.has(scope.role)) {
      result.push({
        id: `action-new-order-${scope.id}`, kind: "action",
        label: `Créer une commande${suffix}`,
        description: brandDescription(scope.name, "Choisir une pharmacie et des produits"),
        href: href("/dashboard/orders/new"),
        keywords: ["nouvelle commande saisir commande pharmacie"],
      });
    }
    if (scope.capabilities.has("core_crm") && intent.products) {
      result.push({
        id: `action-catalog-${scope.id}`, kind: "action",
        label: `Consulter les produits${suffix}`,
        description: scope.name,
        href: href("/dashboard/products"),
        keywords: ["rechercher un produit", "produits références stocks catalogue"],
      });
    }
  }

  if (!safeFragments.length || targets.length === 0) return result;
  const fragmentsOr = (column: string) => safeFragments.map((fragment) => `${column}.ilike.%${fragment}%`).join(",");
  const columnsOr = (...columns: string[]) => columns.map(fragmentsOr).join(",");
  const crmIds = targets.filter((scope) => scope.capabilities.has("core_crm")).map((scope) => scope.id);
  const orderIds = targets.filter((scope) => scope.capabilities.has("orders")).map((scope) => scope.id);
  const missionIds = targets.filter((scope) => scope.capabilities.has("missions")).map((scope) => scope.id);

  const [pharmaciesResult, productsResult, ordersResult, missionsResult, tasksResult] = await Promise.all([
    crmIds.length ? supabase.from("brand_pharmacy_directory")
      .select("id,brand_id,trade_name,legal_name,city,postal_code")
      .in("brand_id", crmIds).is("archived_at", null).or(fragmentsOr("search_text")).limit(35)
      : Promise.resolve({ data: [], error: null }),
    crmIds.length ? supabase.from("products")
      .select("id,brand_id,name,sku,ean")
      .in("brand_id", crmIds).is("discontinued_at", null)
      .or(columnsOr("name", "sku", "ean")).limit(24)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length ? supabase.from("orders")
      .select("id,brand_id,order_number,external_order_id")
      .in("brand_id", orderIds).is("archived_at", null)
      .or(columnsOr("order_number", "external_order_id")).limit(12)
      : Promise.resolve({ data: [], error: null }),
    missionIds.length ? supabase.from("missions")
      .select("id,brand_id,title,status")
      .in("brand_id", missionIds).is("archived_at", null)
      .or(fragmentsOr("title")).limit(12)
      : Promise.resolve({ data: [], error: null }),
    crmIds.length ? supabase.from("commercial_tasks")
      .select("id,brand_id,title,pharmacy_name")
      .in("brand_id", crmIds).is("archived_at", null)
      .or(columnsOr("title", "pharmacy_name")).limit(12)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const scopeHref = (brandId: string, path: string) => scopedHref(brandId, activeBrandId, path);
  for (const row of pharmaciesResult.data ?? []) {
    const scope = byId.get(row.brand_id);
    if (!scope) continue;
    const name = row.trade_name || row.legal_name || "Pharmacie";
    const city = [row.postal_code, row.city].filter(Boolean).join(" ");
    result.push({
      id: `pharmacy-${scope.id}-${row.id}`, kind: "pharmacy",
      label: name, description: brandDescription(scope.name, city),
      href: scopeHref(scope.id, `/dashboard/pharmacies/${row.id}`),
      keywords: [scope.name],
    });
    if (intent.createOrder && scope.capabilities.has("orders") && searchOrderRoles.has(scope.role)) {
      result.push({
        id: `action-order-pharmacy-${scope.id}-${row.id}`, kind: "action",
        label: `Créer commande · ${name}`,
        description: brandDescription(scope.name, city),
        href: scopeHref(scope.id, `/dashboard/orders/new?pharmacy=${row.id}`),
        keywords: ["créer une commande pharmacie", scope.name],
      });
    }
  }
  for (const row of productsResult.data ?? []) {
    const scope = byId.get(row.brand_id);
    if (!scope) continue;
    result.push({
      id: `product-${scope.id}-${row.id}`, kind: "product",
      label: row.name, description: brandDescription(scope.name, [row.sku, row.ean].filter(Boolean).join(" · ")),
      href: scopeHref(scope.id, `/dashboard/products?product=${row.id}`),
      keywords: ["produit référence catalogue", scope.name, row.sku, row.ean].filter((value): value is string => Boolean(value)),
    });
  }
  for (const row of ordersResult.data ?? []) {
    const scope = byId.get(row.brand_id);
    if (!scope) continue;
    const reference = row.order_number || row.external_order_id || row.id.slice(0, 8);
    result.push({
      id: `order-${scope.id}-${row.id}`, kind: "order",
      label: `Commande ${reference}`, description: scope.name,
      href: scopeHref(scope.id, `/dashboard/orders/${row.id}`),
      keywords: [scope.name, reference],
    });
  }
  for (const row of missionsResult.data ?? []) {
    const scope = byId.get(row.brand_id);
    if (!scope) continue;
    result.push({
      id: `mission-${scope.id}-${row.id}`, kind: "mission",
      label: presentationText(row.title), description: brandDescription(scope.name, presentationLabel(row.status)),
      href: scopeHref(scope.id, `/dashboard/missions/${row.id}`),
      keywords: [scope.name],
    });
  }
  for (const row of tasksResult.data ?? []) {
    const scope = byId.get(row.brand_id);
    if (!scope) continue;
    result.push({
      id: `task-${scope.id}-${row.id}`, kind: "task",
      label: presentationText(row.title), description: brandDescription(scope.name, row.pharmacy_name),
      href: scopeHref(scope.id, "/dashboard/tasks"),
      keywords: [scope.name],
    });
  }
  // Search results already passed RLS. Do not manufacture entities for failures,
  // and do not return arbitrary remote URLs or data outside the user's brands.
  return result;
}
