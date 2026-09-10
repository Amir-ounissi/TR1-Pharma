import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  Gauge,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { SectionHeader } from "@/components/ux/section-header";
import { getBrandContexts, requireActiveBrand, type BrandContext } from "@/lib/auth";
import { parisYearToDate } from "@/lib/business-date";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCompactPercent,
  formatPerformanceMetric,
  formatPerformanceValue,
  objectiveTone,
} from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  scope?: string;
  groupType?: string;
  group?: string;
  potential?: string;
  priority?: string;
  product?: string;
}>;

type ObjectiveRow = {
  objective_id: string;
  metric_key: string;
  target_value: number;
  realized_value: number;
  attainment_percent: number | null;
  projected_value: number | null;
  note: string | null;
};

type NetworkRow = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  health_status: string;
  recommendation: string;
  has_next_action: boolean;
  next_action_at: string | null;
  distribution_rate: number;
  strategic_distribution_rate: number | null;
};

type CockpitSummary = {
  revenue_ht: number | null;
  booked_revenue_ht: number | null;
  orders_count: number | null;
  booked_orders_count: number | null;
  ordering_pharmacies: number | null;
  average_order_value_ht: number | null;
  average_skus_per_order: number | null;
  average_paid_units_per_order: number | null;
  paid_units: number | null;
  free_units: number | null;
  initial_orders: number | null;
  reorders: number | null;
  orders_per_ordering_pharmacy: number | null;
  visits_count: number | null;
  visited_pharmacies: number | null;
  visited_and_ordering_pharmacies: number | null;
  visited_account_conversion_rate: number | null;
};

type ProductSalesRow = {
  product_id: string;
  product_name: string;
  sku: string | null;
  orders_count: number;
  ordering_pharmacies: number;
  paid_units: number;
  free_units: number;
  revenue_ht: number;
  order_penetration_rate: number | null;
};

type Cockpit = {
  summary?: CockpitSummary;
  products?: ProductSalesRow[];
};

type DistributionSummary = {
  customer_pharmacies: number | null;
  products_count: number | null;
  avg_product_distribution_rate: number | null;
};

type ProductDistributionRow = {
  product_id: string;
  product_name: string;
  sku: string | null;
  customer_pharmacies: number;
  distributing_pharmacies: number;
  distribution_rate: number | null;
};

type Distribution = {
  summary?: DistributionSummary;
  products?: ProductDistributionRow[];
};

type BrandPerformance = {
  context: BrandContext;
  cockpit: Cockpit;
  distribution: Distribution;
  error: string | null;
};

type CombinedSummary = {
  revenue_ht: number;
  booked_revenue_ht: number;
  orders_count: number;
  booked_orders_count: number;
  ordering_brand_accounts: number;
  average_order_value_ht: number | null;
  average_skus_per_order: number | null;
  average_paid_units_per_order: number | null;
  orders_per_ordering_brand_account: number | null;
  visits_count: number;
  visited_brand_accounts: number;
  visited_and_ordering_brand_accounts: number;
  visited_account_conversion_rate: number | null;
  avg_product_distribution_rate: number | null;
  products_count: number;
};

const groupTypeOptions = [
  "national_group",
  "regional_group",
  "banner",
  "network",
  "wholesaler_distributor",
  "independent",
  "other",
];
const potentialOptions = ["unknown", "low", "medium", "high", "very_high"];
const priorityOptions = ["low", "normal", "high", "strategic"];

function parseDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

function nullableFilter(value?: string) {
  return value && value !== "all" ? value : null;
}

function num(value: number | null | undefined) {
  return Number(value ?? 0);
}

function qs(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
}

function brandSwitchHref(brandId: string, from: string, to: string) {
  const next = `/dashboard/agent/performance?${qs({ from, to })}`;
  return `/auth/activate-brand?${new URLSearchParams({ brandId, next }).toString()}`;
}

function weightedAverage(
  rows: BrandPerformance[],
  value: (row: BrandPerformance) => number | null | undefined,
  weight: (row: BrandPerformance) => number,
) {
  let total = 0;
  let totalWeight = 0;
  rows.forEach((row) => {
    const current = value(row);
    const currentWeight = weight(row);
    if (current == null || currentWeight <= 0) return;
    total += Number(current) * currentWeight;
    totalWeight += currentWeight;
  });
  return totalWeight ? total / totalWeight : null;
}

function combineBrandPerformance(rows: BrandPerformance[]): CombinedSummary {
  const validRows = rows.filter((row) => !row.error);
  const ordersCount = validRows.reduce((sum, row) => sum + num(row.cockpit.summary?.orders_count), 0);
  const orderingBrandAccounts = validRows.reduce(
    (sum, row) => sum + num(row.cockpit.summary?.ordering_pharmacies),
    0,
  );
  const visitedBrandAccounts = validRows.reduce(
    (sum, row) => sum + num(row.cockpit.summary?.visited_pharmacies),
    0,
  );
  const visitedAndOrderingBrandAccounts = validRows.reduce(
    (sum, row) => sum + num(row.cockpit.summary?.visited_and_ordering_pharmacies),
    0,
  );
  const productsCount = validRows.reduce(
    (sum, row) => sum + num(row.distribution.summary?.products_count),
    0,
  );

  return {
    revenue_ht: validRows.reduce((sum, row) => sum + num(row.cockpit.summary?.revenue_ht), 0),
    booked_revenue_ht: validRows.reduce((sum, row) => sum + num(row.cockpit.summary?.booked_revenue_ht), 0),
    orders_count: ordersCount,
    booked_orders_count: validRows.reduce(
      (sum, row) => sum + num(row.cockpit.summary?.booked_orders_count),
      0,
    ),
    ordering_brand_accounts: orderingBrandAccounts,
    average_order_value_ht:
      ordersCount > 0
        ? validRows.reduce((sum, row) => sum + num(row.cockpit.summary?.revenue_ht), 0) / ordersCount
        : null,
    average_skus_per_order: weightedAverage(
      validRows,
      (row) => row.cockpit.summary?.average_skus_per_order,
      (row) => num(row.cockpit.summary?.orders_count),
    ),
    average_paid_units_per_order: weightedAverage(
      validRows,
      (row) => row.cockpit.summary?.average_paid_units_per_order,
      (row) => num(row.cockpit.summary?.orders_count),
    ),
    orders_per_ordering_brand_account:
      orderingBrandAccounts > 0 ? ordersCount / orderingBrandAccounts : null,
    visits_count: validRows.reduce((sum, row) => sum + num(row.cockpit.summary?.visits_count), 0),
    visited_brand_accounts: visitedBrandAccounts,
    visited_and_ordering_brand_accounts: visitedAndOrderingBrandAccounts,
    visited_account_conversion_rate:
      visitedBrandAccounts > 0 ? (visitedAndOrderingBrandAccounts * 100) / visitedBrandAccounts : null,
    avg_product_distribution_rate: weightedAverage(
      validRows,
      (row) => row.distribution.summary?.avg_product_distribution_rate,
      (row) => num(row.distribution.summary?.products_count),
    ),
    products_count: productsCount,
  };
}

export default async function AgentPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const defaultPeriod = parisYearToDate();
  const from = parseDate(query.from, defaultPeriod.from);
  const to = parseDate(query.to, defaultPeriod.to);
  const groupType = nullableFilter(query.groupType);
  const groupId = nullableFilter(query.group);
  const potential = nullableFilter(query.potential);
  const priority = nullableFilter(query.priority);
  const productId = nullableFilter(query.product);

  const [{ supabase, brand, profile, userId }, contexts] = await Promise.all([
    requireActiveBrand(),
    getBrandContexts(),
  ]);

  const agentContexts = contexts.filter((context) => context.role === "agent");
  const currentContext = contexts.find((context) => context.id === brand.id);
  const performanceContexts =
    agentContexts.length > 0 ? agentContexts : currentContext ? [currentContext] : [];
  const allMode = query.scope === "all" && performanceContexts.length > 1;
  const firstName = profile.full_name.split(" ")[0];

  if (allMode) {
    const brandRows = await Promise.all(
      performanceContexts.map(async (context): Promise<BrandPerformance> => {
        const [{ data: cockpitData, error: cockpitError }, { data: distributionData, error: distributionError }] =
          await Promise.all([
            supabase.rpc("get_commercial_performance_cockpit", {
              target_brand_id: context.id,
              target_period_start: from,
              target_period_end: to,
              target_territory_id: null,
              target_agent_id: userId,
              target_group_type: null,
              target_group_id: null,
              target_potential_level: null,
              target_priority_level: null,
              target_product_id: null,
            }),
            supabase.rpc("get_commercial_performance_distribution", {
              target_brand_id: context.id,
              target_territory_id: null,
              target_agent_id: userId,
              target_group_type: null,
              target_group_id: null,
              target_potential_level: null,
              target_priority_level: null,
              target_product_id: null,
            }),
          ]);

        return {
          context,
          cockpit: (cockpitData ?? {}) as Cockpit,
          distribution: (distributionData ?? {}) as Distribution,
          error: cockpitError?.message ?? distributionError?.message ?? null,
        };
      }),
    );

    const combined = combineBrandPerformance(brandRows);
    const validBrands = brandRows.filter((row) => !row.error);

    return (
      <main className="space-y-6">
        <PageHeader
          eyebrow="Ma performance · Toutes mes marques"
          title={`Ton activité multicarte, ${firstName}`}
          description="Une lecture personnelle consolidée de tes cartes. Chaque marque reste cloisonnée ; TR1 additionne uniquement tes propres résultats pour piloter ton quotidien."
          tone="dark"
        />

        <BrandScopeSwitch
          contexts={performanceContexts}
          activeBrandId={brand.id}
          from={from}
          to={to}
          allMode
        />

        <Card>
          <CardContent className="pt-6">
            <form className="flex flex-wrap gap-3">
              <input type="hidden" name="scope" value="all" />
              <input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} />
              <input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} />
              <Button>Mettre à jour</Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              La vue consolidée additionne tes comptes par marque. Une même pharmacie travaillée pour deux marques compte donc comme deux comptes-marques.
            </p>
          </CardContent>
        </Card>

        {brandRows.some((row) => row.error) ? (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">
              Certaines marques n’ont pas pu être consolidées. Les KPI ci-dessous utilisent uniquement les cartes lisibles.
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={TrendingUp} label="CA réalisé HT" value={formatCompactCurrency(combined.revenue_ht)} detail={`${validBrands.length} marque(s) consolidée(s)`} />
          <MetricCard icon={ShoppingCart} label="Commandes réalisées" value={formatCompactNumber(combined.orders_count)} detail={`${formatCompactNumber(combined.ordering_brand_accounts)} comptes-marques commandants`} />
          <MetricCard icon={ReceiptText} label="Panier moyen" value={formatCompactCurrency(combined.average_order_value_ht)} detail="Pondéré par le nombre de commandes" />
          <MetricCard icon={PackageCheck} label="DN produit moyenne" value={formatCompactPercent(combined.avg_product_distribution_rate)} detail={`Moyenne sur ${formatCompactNumber(combined.products_count)} référence(s)`} />
          <MetricCard icon={Boxes} label="Références / commande" value={formatCompactNumber(combined.average_skus_per_order)} detail="Moyenne pondérée toutes cartes" />
          <MetricCard icon={Gauge} label="Unités / commande" value={formatCompactNumber(combined.average_paid_units_per_order)} detail="Unités payantes moyennes" />
          <MetricCard icon={Building2} label="Fréquence" value={combined.orders_per_ordering_brand_account == null ? "—" : `${formatCompactNumber(combined.orders_per_ordering_brand_account)}×`} detail="Commandes / compte-marque commandant" />
          <MetricCard icon={ArrowRight} label="Conversion comptes visités" value={formatCompactPercent(combined.visited_account_conversion_rate)} detail={`${formatCompactNumber(combined.visited_and_ordering_brand_accounts)} / ${formatCompactNumber(combined.visited_brand_accounts)} comptes-marques visités ont commandé`} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Performance par marque</CardTitle>
            <CardDescription>
              Tu compares tes cartes sans comparer les commerciaux entre eux. Ouvre une marque pour comprendre ses produits, sa DN et ses comptes.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marque</TableHead>
                  <TableHead>CA réalisé</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead>Panier</TableHead>
                  <TableHead>DN moy.</TableHead>
                  <TableHead>SKU/cmd.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandRows.map((row) => {
                  const summary = row.cockpit.summary;
                  const dn = row.distribution.summary;
                  return (
                    <TableRow key={row.context.id}>
                      <TableCell>
                        <Link className="font-medium hover:underline" href={brandSwitchHref(row.context.id, from, to)}>
                          {row.context.name}
                        </Link>
                        {row.error ? <p className="text-xs text-destructive">Données indisponibles</p> : null}
                      </TableCell>
                      <TableCell>{row.error ? "—" : formatCompactCurrency(summary?.revenue_ht)}</TableCell>
                      <TableCell>{row.error ? "—" : formatCompactNumber(summary?.orders_count)}</TableCell>
                      <TableCell>{row.error ? "—" : formatCompactCurrency(summary?.average_order_value_ht)}</TableCell>
                      <TableCell>{row.error ? "—" : formatCompactPercent(dn?.avg_product_distribution_rate)}</TableCell>
                      <TableCell>{row.error ? "—" : formatCompactNumber(summary?.average_skus_per_order)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comment lire cette vue</CardTitle>
            <CardDescription>
              Le consolidé sert à organiser ton activité multicarte. Les objectifs, la santé du portefeuille, les priorités et la DN détaillée restent consultés dans chaque marque afin de ne jamais mélanger leurs données.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="CA commandé HT" value={formatCompactCurrency(combined.booked_revenue_ht)} />
            <Detail label="Commandes bookées" value={formatCompactNumber(combined.booked_orders_count)} />
            <Detail label="Visites" value={formatCompactNumber(combined.visits_count)} />
            <Detail label="Marques lisibles" value={`${validBrands.length} / ${performanceContexts.length}`} />
          </CardContent>
        </Card>
      </main>
    );
  }

  const [
    { data: cockpitData, error: cockpitError },
    { data: distributionData, error: distributionError },
    { data: overview },
    { data: objectives },
    { data: networkRows },
    { data: priorities },
    { data: groups },
    { data: products },
  ] = await Promise.all([
    supabase.rpc("get_commercial_performance_cockpit", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: null,
      target_agent_id: userId,
      target_group_type: groupType,
      target_group_id: groupId,
      target_potential_level: potential,
      target_priority_level: priority,
      target_product_id: productId,
    }),
    supabase.rpc("get_commercial_performance_distribution", {
      target_brand_id: brand.id,
      target_territory_id: null,
      target_agent_id: userId,
      target_group_type: groupType,
      target_group_id: groupId,
      target_potential_level: potential,
      target_priority_level: priority,
      target_product_id: productId,
    }),
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: from,
      target_filter_end: to,
      target_scope_type: null,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_performance_network", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_commercial_priorities", {
      target_brand_id: brand.id,
      target_filter: null,
      result_limit: 5,
    }),
    supabase
      .from("pharmacy_groups")
      .select("id,name,group_type")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("products")
      .select("id,name,sku")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  const cockpit = (cockpitData ?? {}) as Cockpit;
  const summary = cockpit.summary ?? ({} as CockpitSummary);
  const distribution = (distributionData ?? {}) as Distribution;
  const distributionSummary: DistributionSummary = distribution.summary ?? {
    customer_pharmacies: null,
    products_count: null,
    avg_product_distribution_rate: null,
  };
  const legacySummary = (overview ?? {}) as Record<string, number | null>;
  const objectiveRows = (objectives ?? []) as ObjectiveRow[];
  const topObjectives = objectiveRows
    .filter((objective) => ["revenue_ht", "implantations", "reorders", "first_reorder_rate"].includes(objective.metric_key))
    .slice(0, 4);
  const portfolio = (networkRows ?? []) as NetworkRow[];
  const salesByProduct = new Map((cockpit.products ?? []).map((row) => [row.product_id, row]));
  const activeFilterCount = [groupType, groupId, potential, priority, productId].filter(Boolean).length;
  const baseFilters = { from, to, groupType, group: groupId, potential, priority, product: productId };

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Ma performance · ${brand.name}`}
        title={`Où en es-tu, ${firstName} ?`}
        description="Tes résultats, ta DN produit, ton rythme de commande et les comptes à travailler. Une lecture personnelle de ce que tu peux réellement piloter sur le terrain."
        tone="dark"
      />

      <BrandScopeSwitch
        contexts={performanceContexts}
        activeBrandId={brand.id}
        from={from}
        to={to}
        allMode={false}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mon périmètre d’analyse</CardTitle>
          <CardDescription>
            Les KPI commerciaux et la performance produit se recalculent avec les mêmes filtres. Ton portefeuille santé reste une photo globale de la marque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} />
            <input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} />
            <select className="h-10 rounded-md border bg-background px-3" name="groupType" defaultValue={groupType ?? "all"}>
              <option value="all">Toutes typologies</option>
              {groupTypeOptions.map((value) => <option key={value} value={value}>{presentationLabel(value)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="group" defaultValue={groupId ?? "all"}>
              <option value="all">Tous les groupements</option>
              {(groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="potential" defaultValue={potential ?? "all"}>
              <option value="all">Tous potentiels</option>
              {potentialOptions.map((value) => <option key={value} value={value}>Potentiel · {presentationLabel(value)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="priority" defaultValue={priority ?? "all"}>
              <option value="all">Toutes priorités</option>
              {priorityOptions.map((value) => <option key={value} value={value}>Priorité · {presentationLabel(value)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="product" defaultValue={productId ?? "all"}>
              <option value="all">Tous les produits</option>
              {(products ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}
            </select>
            <Button>Appliquer</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">Période {from} → {to}</Badge>
            {activeFilterCount ? <Badge variant="secondary">{activeFilterCount} filtre(s) actif(s)</Badge> : <Badge variant="secondary">Tout mon portefeuille</Badge>}
            {activeFilterCount ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/agent/performance?${qs({ from, to })}`}>Réinitialiser</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {cockpitError || distributionError ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Les nouveaux indicateurs Performance ne peuvent pas tous être calculés : {cockpitError?.message ?? distributionError?.message}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={TrendingUp} label="CA réalisé HT" value={formatCompactCurrency(summary.revenue_ht)} detail={productId ? "CA réalisé du produit filtré" : "Commandes facturées ou livrées"} />
        <MetricCard icon={ShoppingCart} label="Commandes réalisées" value={formatCompactNumber(summary.orders_count)} detail={`${formatCompactNumber(summary.ordering_pharmacies)} pharmacie(s) commandante(s)`} />
        <MetricCard icon={ReceiptText} label="Panier moyen" value={formatCompactCurrency(summary.average_order_value_ht)} detail={productId ? "Panier complet des commandes contenant le produit" : "Valeur moyenne par commande"} />
        <MetricCard icon={PackageCheck} label="DN produit moyenne" value={formatCompactPercent(distributionSummary.avg_product_distribution_rate)} detail={productId ? "DN du produit sélectionné" : `Moyenne sur ${formatCompactNumber(distributionSummary.products_count)} référence(s)`} />
        <MetricCard icon={Boxes} label="Références / commande" value={formatCompactNumber(summary.average_skus_per_order)} detail="Nombre moyen de SKU distincts" />
        <MetricCard icon={Gauge} label="Unités / commande" value={formatCompactNumber(summary.average_paid_units_per_order)} detail={`${formatCompactNumber(summary.paid_units)} unités payantes`} />
        <MetricCard icon={Building2} label="Fréquence de commande" value={summary.orders_per_ordering_pharmacy == null ? "—" : `${formatCompactNumber(summary.orders_per_ordering_pharmacy)}×`} detail="Commandes / pharmacie commandante" />
        <MetricCard icon={ArrowRight} label="Conversion comptes visités" value={formatCompactPercent(summary.visited_account_conversion_rate)} detail={`${formatCompactNumber(summary.visited_and_ordering_pharmacies)} / ${formatCompactNumber(summary.visited_pharmacies)} pharmacies visitées ont commandé`} />
        <MetricCard icon={Target} label="CA commandé HT" value={formatCompactCurrency(summary.booked_revenue_ht)} detail={`${formatCompactNumber(summary.booked_orders_count)} commande(s) bookée(s)`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Mes leviers de performance</CardTitle>
          <CardDescription>
            Une lecture terrain : couverture → conversion → fréquence → panier → diffusion produit. La conversion est une corrélation sur la période, pas une preuve de causalité visite → commande.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FlowStep label="Couverture" value={`${formatCompactNumber(summary.visited_pharmacies)} comptes`} detail={`${formatCompactNumber(summary.visits_count)} visites`} />
          <FlowStep label="Conversion" value={formatCompactPercent(summary.visited_account_conversion_rate)} detail="visités ayant commandé" />
          <FlowStep label="Fréquence" value={summary.orders_per_ordering_pharmacy == null ? "—" : `${formatCompactNumber(summary.orders_per_ordering_pharmacy)}×`} detail="commandes / client" />
          <FlowStep label="Panier" value={formatCompactCurrency(summary.average_order_value_ht)} detail="par commande" />
          <FlowStep label="DN produit" value={formatCompactPercent(distributionSummary.avg_product_distribution_rate)} detail="diffusion moyenne de la gamme" />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeader id="where-i-stand" title="Mes objectifs" description="La marque fixe le cap ; cette vue te montre l’écart entre objectif, réalisé et projection." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topObjectives.length ? topObjectives.map((objective) => (
            <Card key={objective.objective_id}>
              <CardContent className="pt-5">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--tr1-orange)]">{formatPerformanceMetric(objective.metric_key)}</p>
                <p className={`mt-3 text-2xl font-semibold ${objectiveTone(objective.attainment_percent)}`}>
                  {objective.attainment_percent == null ? "—" : `${objective.attainment_percent.toFixed(1)} %`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPerformanceValue(objective.metric_key, objective.realized_value)} / {formatPerformanceValue(objective.metric_key, objective.target_value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Projection {objective.projected_value == null ? "—" : formatPerformanceValue(objective.metric_key, objective.projected_value)}
                </p>
              </CardContent>
            </Card>
          )) : (
            <>
              <MetricCard icon={TrendingUp} label="Implantations" value={formatCompactNumber(legacySummary.implantations)} detail="Sur la période" />
              <MetricCard icon={Gauge} label="Premier réassort" value={formatCompactPercent(legacySummary.first_reorder_rate)} detail="Lecture éligible" />
              <MetricCard icon={ArrowRight} label="Réassorts" value={formatCompactNumber(legacySummary.reorders)} detail="Rythme terrain" />
              <MetricCard icon={Target} label="CA commandé HT" value={formatCompactCurrency(summary.booked_revenue_ht)} detail="Commandes confirmées" />
            </>
          )}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Ma performance produit</CardTitle>
          <CardDescription>
            DN = pharmacies clientes distribuant la référence / pharmacies clientes de ton périmètre. La pénétration commande mesure, elle, la part de tes commandes de la période contenant le produit.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>DN</TableHead>
                <TableHead>Distribution</TableHead>
                <TableHead>CA réalisé</TableHead>
                <TableHead>Cmd.</TableHead>
                <TableHead>Pénétration cmd.</TableHead>
                <TableHead>Unités</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(distribution.products ?? []).length ? (distribution.products ?? []).map((row) => {
                const sales = salesByProduct.get(row.product_id);
                return (
                  <TableRow key={row.product_id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/dashboard/agent/performance?${qs({ ...baseFilters, product: row.product_id })}`}>
                        {row.product_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.sku ?? "Sans SKU"}</p>
                    </TableCell>
                    <TableCell className="font-medium">{formatCompactPercent(row.distribution_rate)}</TableCell>
                    <TableCell>{formatCompactNumber(row.distributing_pharmacies)} / {formatCompactNumber(row.customer_pharmacies)}</TableCell>
                    <TableCell>{formatCompactCurrency(sales?.revenue_ht)}</TableCell>
                    <TableCell>{formatCompactNumber(sales?.orders_count)}</TableCell>
                    <TableCell>{formatCompactPercent(sales?.order_penetration_rate)}</TableCell>
                    <TableCell>
                      {formatCompactNumber(sales?.paid_units)}
                      <p className="text-xs text-muted-foreground">+ {formatCompactNumber(sales?.free_units)} UG</p>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7}>
                    <p className="p-4 text-sm text-muted-foreground">Aucune donnée de distribution produit sur ce périmètre.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mon activité terrain</CardTitle>
            <CardDescription>
              Les missions et le sell-out restent séparés des KPI de commande pour ne pas mélanger exécution terrain et résultat commercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Detail label="Implantations" value={formatCompactNumber(legacySummary.implantations)} />
            <Detail label="Réassorts" value={formatCompactNumber(legacySummary.reorders)} />
            <Detail label="Missions réalisées" value={formatCompactNumber(legacySummary.missions_completed)} />
            <Detail label="Animations" value={formatCompactNumber(legacySummary.animations_completed)} />
            <Detail label="Sell-out animation" value={`${formatCompactNumber(legacySummary.sell_out_units)} unités`} />
            <Detail label="Moy. unités / animation" value={legacySummary.average_units_per_animation == null ? "—" : `${formatCompactNumber(legacySummary.average_units_per_animation)} unités`} />
            <Detail label="Formations" value={formatCompactNumber(legacySummary.trainings_completed)} />
            <Detail label="Participants formés" value={formatCompactNumber(legacySummary.participants_count)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Santé de mon portefeuille</CardTitle>
            <CardDescription>
              Photo actuelle de l’ensemble de ton portefeuille {brand.name}, indépendamment des filtres de commandes appliqués plus haut.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Detail label="Pharmacies actives" value={formatCompactNumber(legacySummary.active_pharmacies)} />
            <Detail label="À risque" value={formatCompactNumber(legacySummary.at_risk_accounts)} />
            <Detail label="Dormantes" value={formatCompactNumber(legacySummary.dormant_accounts)} />
            <Detail label="Sans prochaine action" value={formatCompactNumber(legacySummary.without_next_action_count)} />
            <Detail label="Couverture gamme moyenne" value={formatCompactPercent(legacySummary.avg_distribution_rate)} />
            <Detail label="Couverture gamme stratégique" value={formatCompactPercent(legacySummary.strategic_distribution_rate)} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader id="where-to-act" title="Où agir maintenant" description="Des priorités opérationnelles sur tes comptes, sans classement entre commerciaux." />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader><CardTitle>Comptes à traiter</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(priorities ?? []).length ? (priorities ?? []).map((row: Record<string, unknown>) => (
                <Link
                  key={String(row.brand_pharmacy_id)}
                  href={`/dashboard/pharmacies/${String(row.brand_pharmacy_id)}`}
                  className="flex items-center justify-between gap-4 rounded-[0.4rem] border border-[var(--tr1-line)] p-3 hover:bg-white/45"
                >
                  <div>
                    <p className="font-semibold">{String(row.pharmacy_name)}</p>
                    <p className="text-sm text-muted-foreground">{presentationLabel(String(row.health_status))} · {String(row.recommendation)}</p>
                  </div>
                  <Badge variant="secondary">{String(row.priority_score)}</Badge>
                </Link>
              )) : <p className="text-sm text-muted-foreground">Aucune priorité remontée pour le moment.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comptes suivis</CardTitle>
              <CardDescription>
                La couverture gamme d’une pharmacie n’est pas sa DN : elle mesure la part de la gamme implantée dans ce compte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {portfolio.slice(0, 6).map((row) => (
                <Link key={row.brand_pharmacy_id} href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`} className="block rounded-[0.4rem] border border-[var(--tr1-line)] p-3 hover:bg-white/45">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{row.pharmacy_name}</p>
                    <Badge variant="outline">{presentationLabel(row.health_status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{row.recommendation}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Couverture gamme {formatCompactPercent(row.distribution_rate)} · Strat. {formatCompactPercent(row.strategic_distribution_rate)} · {row.has_next_action ? "Suivi planifié" : "Aucune prochaine action"}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function BrandScopeSwitch({
  contexts,
  activeBrandId,
  from,
  to,
  allMode,
}: {
  contexts: BrandContext[];
  activeBrandId: string;
  from: string;
  to: string;
  allMode: boolean;
}) {
  if (!contexts.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {contexts.length > 1 ? (
        <Button asChild size="sm" variant={allMode ? "default" : "outline"}>
          <Link href={`/dashboard/agent/performance?${qs({ scope: "all", from, to })}`}>Toutes mes marques</Link>
        </Button>
      ) : null}
      {contexts.map((context) => (
        <Button
          asChild
          size="sm"
          variant={!allMode && context.id === activeBrandId ? "default" : "outline"}
          key={context.id}
        >
          <Link href={brandSwitchHref(context.id, from, to)}>{context.name}</Link>
        </Button>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className="size-4 text-[var(--tr1-orange)]" />
        <p className="mt-3 text-2xl font-semibold">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function FlowStep({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--tr1-orange)]">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
