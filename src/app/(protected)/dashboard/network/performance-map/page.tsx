import { notFound } from "next/navigation";
import { PerformanceMap } from "@/components/performance-map/performance-map";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { getApproximateCoordinateFromPostalCode } from "@/lib/network-map";
import type {
  PerformanceMapDataset,
  PerformanceMapFilterOptions,
  PerformanceMapFilters,
  PerformanceMapNextAction,
  PerformanceMapPharmacy,
} from "@/lib/performance-map";
import { formatPerformanceMetric } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";
import { commercialStatuses, labels, potentialLevels, priorityLevels } from "@/lib/reference-data";
import type { NextBestActionRow } from "@/lib/next-best-action";

const PAGE_SIZE = 500;
const ORDER_BATCH_SIZE = 100;

type SearchParams = Promise<{
  from?: string;
  to?: string;
  territory?: string;
  agent?: string;
  group?: string;
  product?: string;
  status?: string;
  potential?: string;
  priority?: string;
  q?: string;
}>;

type DirectoryRow = {
  id: string;
  pharmacy_id: string;
  trade_name: string | null;
  legal_name: string | null;
  city: string | null;
  postal_code: string | null;
  commercial_status: string;
  priority_level: string;
  potential_level: string;
  territory_id: string | null;
  territory_name: string | null;
  current_agent_user_id: string | null;
  agent_name: string | null;
  pharmacy_group_id: string | null;
  pharmacy_group_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

type PerformanceRow = {
  brand_pharmacy_id: string;
  health_status: string;
  priority_score: number;
  recommendation: string;
  revenue_ht: number;
  implantations: number;
  reorders: number;
  distribution_rate: number | null;
  strategic_distribution_rate: number | null;
  missions_completed: number;
  animations_completed: number;
  trainings_completed: number;
  sell_out_units: number;
};

type ObjectiveRow = {
  scope_type: "brand" | "territory" | "agent";
  territory_id: string | null;
  user_id: string | null;
  metric_key: string;
  attainment_percent: number | null;
  period_start: string;
};

type TerritoryRow = {
  id: string;
  name: string;
  department_code: string | null;
  department_codes: string[] | null;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  product_family: string | null;
};

type PerformanceOrderFact = {
  order_id: string;
  brand_pharmacy_id: string;
  is_initial_order: boolean;
  is_reorder: boolean;
};

type OrderItemRow = {
  order_id: string;
  line_total_ht: number | string | null;
};

type ProductRollup = {
  revenueHt: number;
  implantations: number;
  reorders: number;
};

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safeDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

function nullable(value: string | undefined) {
  return value && value !== "all" ? value : null;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function coordinate(value: number | string | null, min: number, max: number) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function chunk<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

export default async function PerformanceMapPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const from = safeDate(query.from, dateInput(thirtyDaysAgo));
  const to = safeDate(query.to, dateInput(today));
  const territoryId = nullable(query.territory);
  const agentId = nullable(query.agent);
  const groupId = nullable(query.group);
  const productScope = nullable(query.product);
  const status = nullable(query.status);
  const potential = nullable(query.potential);
  const priority = nullable(query.priority);
  const search = query.q?.trim() ?? "";

  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();

  const [
    { data: territoriesData },
    { data: membershipsData },
    { data: groupsData },
    { data: productsData },
    { data: objectivesData, error: objectivesError },
    { data: nextActionsData },
    { data: lastUpdatedData },
  ] = await Promise.all([
    supabase.from("territories").select("id,name,department_code,department_codes").eq("brand_id", brand.id).is("archived_at", null).order("name"),
    supabase
      .from("memberships")
      .select("user_id,roles!inner(key),users(user_profiles(full_name))")
      .eq("brand_id", brand.id)
      .eq("status", "active")
      .eq("roles.key", "agent"),
    supabase.from("pharmacy_groups").select("id,name").is("archived_at", null).order("name"),
    supabase.from("products").select("id,name,sku,product_family").eq("brand_id", brand.id).eq("is_active", true).order("name"),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: from,
      target_filter_end: to,
      target_scope_type: null,
      target_territory_id: territoryId,
      target_agent_id: agentId,
    }),
    supabase.rpc("get_next_best_actions", {
      target_brand_id: brand.id,
      result_limit: 500,
      target_brand_pharmacy_id: null,
    }),
    supabase.from("brand_pharmacies").select("updated_at").eq("brand_id", brand.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (objectivesError) throw objectivesError;
  const territories = (territoriesData ?? []) as TerritoryRow[];
  const products = (productsData ?? []) as ProductRow[];
  const objectives = (objectivesData ?? []) as ObjectiveRow[];

  const directoryRows: DirectoryRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let directoryQuery = supabase
      .from("brand_pharmacy_directory")
      .select("id,pharmacy_id,trade_name,legal_name,city,postal_code,commercial_status,priority_level,potential_level,territory_id,territory_name,current_agent_user_id,agent_name,pharmacy_group_id,pharmacy_group_name,latitude,longitude")
      .eq("brand_id", brand.id)
      .is("archived_at", null);
    if (territoryId) directoryQuery = directoryQuery.eq("territory_id", territoryId);
    if (agentId) directoryQuery = directoryQuery.eq("current_agent_user_id", agentId);
    if (groupId) directoryQuery = directoryQuery.eq("pharmacy_group_id", groupId);
    if (status) directoryQuery = directoryQuery.eq("commercial_status", status);
    if (potential) directoryQuery = directoryQuery.eq("potential_level", potential);
    if (priority) directoryQuery = directoryQuery.eq("priority_level", priority);
    if (search) directoryQuery = directoryQuery.ilike("search_text", `%${search}%`);
    const { data, error } = await directoryQuery.order("trade_name", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as DirectoryRow[];
    directoryRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const performanceRows: PerformanceRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("get_performance_network", {
        target_brand_id: brand.id,
        target_period_start: from,
        target_period_end: to,
        target_territory_id: territoryId,
        target_agent_id: agentId,
      })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as PerformanceRow[];
    performanceRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const taskCounts = new Map<string, { open: number; overdue: number }>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("tasks")
      .select("brand_pharmacy_id,status")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .in("status", ["open", "in_progress", "overdue"])
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    page.forEach((task) => {
      if (!task.brand_pharmacy_id) return;
      const current = taskCounts.get(task.brand_pharmacy_id) ?? { open: 0, overdue: 0 };
      current.open += 1;
      if (task.status === "overdue") current.overdue += 1;
      taskCounts.set(task.brand_pharmacy_id, current);
    });
    if (page.length < PAGE_SIZE) break;
  }

  const nextActions = new Map<string, PerformanceMapNextAction>();
  ((nextActionsData ?? []) as NextBestActionRow[]).forEach((row) => nextActions.set(row.brand_pharmacy_id, {
    type: row.action_type,
    label: row.action_label,
    dueAt: row.suggested_due_at,
  }));

  const productIds = resolveProductIds(productScope, products);
  const productScopeLabel = resolveProductScopeLabel(productScope, products);
  const productRollups = new Map<string, ProductRollup>();

  if (productScope) {
    if (productIds.length) {
      const facts: PerformanceOrderFact[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        let factsQuery = supabase
          .from("performance_order_facts")
          .select("order_id,brand_pharmacy_id,is_initial_order,is_reorder")
          .eq("brand_id", brand.id)
          .gte("order_date", `${from}T00:00:00.000Z`)
          .lt("order_date", `${nextDate(to)}T00:00:00.000Z`);
        if (territoryId) factsQuery = factsQuery.eq("territory_id", territoryId);
        if (agentId) factsQuery = factsQuery.eq("agent_user_id_at_order", agentId);
        const { data, error } = await factsQuery.range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as PerformanceOrderFact[];
        facts.push(...page);
        if (page.length < PAGE_SIZE) break;
      }

      const factByOrder = new Map(facts.map((fact) => [fact.order_id, fact]));
      const matchedOrderIds = new Set<string>();
      for (const orderBatch of chunk(facts.map((fact) => fact.order_id), ORDER_BATCH_SIZE)) {
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await supabase
            .from("order_items")
            .select("order_id,line_total_ht")
            .eq("brand_id", brand.id)
            .in("order_id", orderBatch)
            .in("product_id", productIds)
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          const page = (data ?? []) as OrderItemRow[];
          page.forEach((item) => {
            const fact = factByOrder.get(item.order_id);
            if (!fact) return;
            matchedOrderIds.add(item.order_id);
            const current = productRollups.get(fact.brand_pharmacy_id) ?? { revenueHt: 0, implantations: 0, reorders: 0 };
            current.revenueHt += numberValue(item.line_total_ht);
            productRollups.set(fact.brand_pharmacy_id, current);
          });
          if (page.length < PAGE_SIZE) break;
        }
      }
      matchedOrderIds.forEach((orderId) => {
        const fact = factByOrder.get(orderId);
        if (!fact) return;
        const current = productRollups.get(fact.brand_pharmacy_id) ?? { revenueHt: 0, implantations: 0, reorders: 0 };
        if (fact.is_initial_order) current.implantations += 1;
        if (fact.is_reorder) current.reorders += 1;
        productRollups.set(fact.brand_pharmacy_id, current);
      });
    }
  }

  const performanceByPharmacy = new Map(performanceRows.map((row) => [row.brand_pharmacy_id, row]));
  const pharmacies: PerformanceMapPharmacy[] = directoryRows
    .filter((row) => !productScope || productRollups.has(row.id))
    .map((row) => {
      const performance = performanceByPharmacy.get(row.id);
      const scopedProduct = productScope ? productRollups.get(row.id) : null;
      const exactLatitude = coordinate(row.latitude, -90, 90);
      const exactLongitude = coordinate(row.longitude, -180, 180);
      const approximate = exactLatitude != null && exactLongitude != null ? null : getApproximateCoordinateFromPostalCode(row.postal_code);
      const latitude = exactLatitude ?? approximate?.latitude ?? null;
      const longitude = exactLongitude ?? approximate?.longitude ?? null;
      const tasks = taskCounts.get(row.id) ?? { open: 0, overdue: 0 };
      const healthStatus = performance?.health_status ?? "insufficient_history";
      return {
        id: row.id,
        pharmacyId: row.pharmacy_id,
        name: row.trade_name || row.legal_name || "Pharmacie",
        city: row.city,
        postalCode: row.postal_code,
        latitude,
        longitude,
        locationPrecision: exactLatitude != null && exactLongitude != null ? "exact" : approximate ? "department" : "missing",
        territoryId: row.territory_id,
        territoryName: row.territory_name,
        agentUserId: row.current_agent_user_id,
        agentName: row.agent_name,
        groupName: row.pharmacy_group_name,
        commercialStatus: row.commercial_status,
        commercialStatusLabel: labels.commercialStatus[row.commercial_status as keyof typeof labels.commercialStatus] ?? presentationLabel(row.commercial_status),
        priorityLevel: row.priority_level,
        priorityLevelLabel: labels.priorityLevel[row.priority_level as keyof typeof labels.priorityLevel] ?? presentationLabel(row.priority_level),
        potentialLevel: row.potential_level,
        potentialLevelLabel: labels.potentialLevel[row.potential_level as keyof typeof labels.potentialLevel] ?? presentationLabel(row.potential_level),
        healthStatus,
        healthStatusLabel: presentationLabel(healthStatus),
        priorityScore: performance?.priority_score ?? 0,
        recommendation: performance?.recommendation ?? "Aucune recommandation calculée pour le moment.",
        revenueHt: scopedProduct?.revenueHt ?? numberValue(performance?.revenue_ht),
        implantations: scopedProduct?.implantations ?? numberValue(performance?.implantations),
        reorders: scopedProduct?.reorders ?? numberValue(performance?.reorders),
        distributionRate: performance?.distribution_rate == null ? null : numberValue(performance.distribution_rate),
        strategicDistributionRate: performance?.strategic_distribution_rate == null ? null : numberValue(performance.strategic_distribution_rate),
        missionsCompleted: numberValue(performance?.missions_completed),
        animationsCompleted: numberValue(performance?.animations_completed),
        trainingsCompleted: numberValue(performance?.trainings_completed),
        sellOutUnits: numberValue(performance?.sell_out_units),
        openAlerts: tasks.open,
        overdueAlerts: tasks.overdue,
        nextBestAction: nextActions.get(row.id) ?? null,
      } satisfies PerformanceMapPharmacy;
    });

  const segmentFiltersActive = Boolean(groupId || productScope || status || potential || priority || search);
  const objectiveComparable = !segmentFiltersActive && !(territoryId && agentId);
  const objectiveScope = agentId ? "agent" : territoryId ? "territory" : "brand";
  const objective = objectiveComparable ? findObjective(objectives, objectiveScope, territoryId, agentId) : null;
  const orderingPharmacies = pharmacies.filter((pharmacy) => pharmacy.revenueHt > 0);
  const metrics = {
    revenueHt: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.revenueHt, 0),
    objectiveAttainment: objective?.attainment_percent ?? null,
    objectiveComparable,
    activePharmacies: pharmacies.filter((pharmacy) => !["dormant", "insufficient_history"].includes(pharmacy.healthStatus)).length,
    implantations: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.implantations, 0),
    reorderRate: orderingPharmacies.length ? (orderingPharmacies.filter((pharmacy) => pharmacy.reorders > 0).length / orderingPharmacies.length) * 100 : null,
    atRiskAccounts: pharmacies.filter((pharmacy) => pharmacy.healthStatus === "at_risk").length,
  };

  const territoryObjectiveComparable = !segmentFiltersActive && !agentId;
  const performanceTerritories = territories.map((territory) => {
    const territoryPharmacies = pharmacies.filter((pharmacy) => pharmacy.territoryId === territory.id);
    const territoryObjective = territoryObjectiveComparable && (!territoryId || territoryId === territory.id)
      ? findObjective(objectives, "territory", territory.id, null)
      : null;
    const departmentCodes = [...new Set([...(territory.department_codes ?? []), territory.department_code].filter((code): code is string => Boolean(code)))];
    return {
      id: territory.id,
      name: territory.name,
      departmentCodes,
      objectiveAttainment: territoryObjective?.attainment_percent ?? null,
      objectiveMetricLabel: territoryObjective ? formatPerformanceMetric(territoryObjective.metric_key) : null,
      revenueHt: territoryPharmacies.reduce((sum, pharmacy) => sum + pharmacy.revenueHt, 0),
      pharmacyCount: territoryPharmacies.length,
      activePharmacies: territoryPharmacies.filter((pharmacy) => !["dormant", "insufficient_history"].includes(pharmacy.healthStatus)).length,
      atRiskAccounts: territoryPharmacies.filter((pharmacy) => pharmacy.healthStatus === "at_risk").length,
      openAlerts: territoryPharmacies.reduce((sum, pharmacy) => sum + pharmacy.openAlerts, 0),
    };
  });

  const dataset: PerformanceMapDataset = {
    brandId: brand.id,
    brandName: brand.name,
    from,
    to,
    lastUpdatedAt: lastUpdatedData?.updated_at ?? null,
    productScopeLabel,
    metrics,
    pharmacies,
    territories: performanceTerritories,
  };

  const agentOptions = (membershipsData ?? []).map((membership) => {
    const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
    const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
    return { value: membership.user_id, label: profile?.full_name ?? "Commercial" };
  }).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const families = [...new Set(products.map((product) => product.product_family).filter((family): family is string => Boolean(family)))].sort((a, b) => a.localeCompare(b, "fr"));
  const options: PerformanceMapFilterOptions = {
    territories: territories.map((territory) => ({ value: territory.id, label: territory.name })),
    agents: agentOptions,
    groups: (groupsData ?? []).map((group) => ({ value: group.id, label: group.name })),
    products: products.map((product) => ({ value: `product:${product.id}`, label: product.sku ? `${product.name} · ${product.sku}` : product.name })),
    families: families.map((family) => ({ value: `family:${family}`, label: family })),
    statuses: commercialStatuses.map((value) => ({ value, label: labels.commercialStatus[value] })),
    potentials: potentialLevels.map((value) => ({ value, label: labels.potentialLevel[value] })),
    priorities: priorityLevels.map((value) => ({ value, label: labels.priorityLevel[value] })),
  };
  const filters: PerformanceMapFilters = { territory: territoryId, agent: agentId, group: groupId, product: productScope, status, potential, priority, q: search };

  return (
    <main className="space-y-5">
      <PageHeader
        eyebrow={`Carte de performance · ${brand.name}`}
        title="Où la marque performe, où elle décroche, où agir ?"
        description={`Pilotage national par secteur et pharmacie · ${formatDate(from)} → ${formatDate(to)}${dataset.lastUpdatedAt ? ` · données réseau mises à jour le ${formatDateTime(dataset.lastUpdatedAt)}` : ""}`}
        tone="dark"
      />
      <PerformanceMap dataset={dataset} filters={filters} options={options} />
    </main>
  );
}

function resolveProductIds(scope: string | null, products: ProductRow[]) {
  if (!scope) return [];
  if (scope.startsWith("product:")) {
    const id = scope.slice("product:".length);
    return products.some((product) => product.id === id) ? [id] : [];
  }
  if (scope.startsWith("family:")) {
    const family = scope.slice("family:".length);
    return products.filter((product) => product.product_family === family).map((product) => product.id);
  }
  return [];
}

function resolveProductScopeLabel(scope: string | null, products: ProductRow[]) {
  if (!scope) return null;
  if (scope.startsWith("product:")) return products.find((product) => product.id === scope.slice("product:".length))?.name ?? "Produit";
  if (scope.startsWith("family:")) return scope.slice("family:".length) || "Gamme";
  return null;
}

function findObjective(objectives: ObjectiveRow[], scope: ObjectiveRow["scope_type"], territoryId: string | null, agentId: string | null) {
  const matching = objectives.filter((objective) => objective.scope_type === scope)
    .filter((objective) => scope !== "territory" || objective.territory_id === territoryId)
    .filter((objective) => scope !== "agent" || objective.user_id === agentId)
    .sort((a, b) => b.period_start.localeCompare(a.period_start));
  return matching.find((objective) => objective.metric_key === "revenue_ht") ?? matching[0] ?? null;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value));
}
