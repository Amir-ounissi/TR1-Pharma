import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPinned,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { parisYearToDate } from "@/lib/business-date";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  territory?: string;
  agent?: string;
  groupType?: string;
  group?: string;
  potential?: string;
  priority?: string;
  product?: string;
}>;

type Summary = {
  revenue_ht: number | null;
  orders_count: number | null;
  average_order_value_ht: number | null;
};

type TerritoryRow = {
  territory_id: string | null;
  territory_name: string;
  territory_type: string | null;
  revenue_ht: number;
  orders_count: number;
  average_order_value_ht: number | null;
};

type ProductRow = {
  product_id: string;
  product_name: string;
  sku: string | null;
  orders_count: number;
  paid_units: number;
  free_units: number;
  revenue_ht: number;
  order_penetration_rate: number | null;
};

type Cockpit = {
  summary?: Summary;
  territories?: TerritoryRow[];
  products?: ProductRow[];
};

type ProductDistributionSummary = {
  products_count: number | null;
  avg_product_distribution_rate: number | null;
};

type ProductDistributionRow = {
  product_id: string;
  distribution_rate: number | null;
};

type ProductDistribution = {
  summary?: ProductDistributionSummary;
  products?: ProductDistributionRow[];
};

type ObjectiveRow = {
  objective_id: string;
  metric_key: string;
  target_value: number;
  realized_value: number;
  attainment_percent: number | null;
  projected_value: number | null;
  period_start?: string;
  period_end?: string;
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

function safeDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

function nullableFilter(value?: string) {
  return value && value !== "all" ? value : null;
}

function qs(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
}

function samePeriodPreviousYear(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  end.setUTCFullYear(end.getUTCFullYear() - 1);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function signedPercent(value: number | null) {
  if (value === null) return "Pas de comparaison N-1";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % vs N-1`;
}

function clampPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function contribution(value: number | null | undefined, total: number | null | undefined) {
  const denominator = Number(total ?? 0);
  if (denominator <= 0) return null;
  return (Number(value ?? 0) / denominator) * 100;
}

export default async function CommercialBusinessPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const defaultPeriod = parisYearToDate();
  const from = safeDate(query.from, defaultPeriod.from);
  const to = safeDate(query.to, defaultPeriod.to);
  const previousPeriod = samePeriodPreviousYear(from, to);
  const territoryId = nullableFilter(query.territory);
  const agentId = nullableFilter(query.agent);
  const groupType = nullableFilter(query.groupType);
  const groupId = nullableFilter(query.group);
  const potential = nullableFilter(query.potential);
  const priority = nullableFilter(query.priority);
  const productId = nullableFilter(query.product);

  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();

  const objectiveCompatible = !groupType && !groupId && !potential && !priority && !productId && !(territoryId && agentId);
  const objectiveScopeType = agentId ? "agent" : territoryId ? "territory" : "brand";

  const [
    { data: cockpitData, error: cockpitError },
    { data: previousCockpitData },
    { data: distributionData, error: distributionError },
    { data: objectiveData, error: objectiveError },
    { data: territories },
    { data: memberships },
    { data: groups },
    { data: products },
  ] = await Promise.all([
    supabase.rpc("get_commercial_performance_cockpit", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: territoryId,
      target_agent_id: agentId,
      target_group_type: groupType,
      target_group_id: groupId,
      target_potential_level: potential,
      target_priority_level: priority,
      target_product_id: productId,
    }),
    supabase.rpc("get_commercial_performance_cockpit", {
      target_brand_id: brand.id,
      target_period_start: previousPeriod.from,
      target_period_end: previousPeriod.to,
      target_territory_id: territoryId,
      target_agent_id: agentId,
      target_group_type: groupType,
      target_group_id: groupId,
      target_potential_level: potential,
      target_priority_level: priority,
      target_product_id: productId,
    }),
    supabase.rpc("get_commercial_performance_distribution", {
      target_brand_id: brand.id,
      target_territory_id: territoryId,
      target_agent_id: agentId,
      target_group_type: groupType,
      target_group_id: groupId,
      target_potential_level: potential,
      target_priority_level: priority,
      target_product_id: productId,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: from,
      target_filter_end: to,
      target_scope_type: objectiveScopeType,
      target_territory_id: territoryId,
      target_agent_id: agentId,
    }),
    supabase
      .from("territories")
      .select("id,name,territory_type,parent_territory_id")
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("memberships")
      .select("user_id,roles!inner(key),users(user_profiles(full_name))")
      .eq("brand_id", brand.id)
      .eq("status", "active")
      .eq("roles.key", "agent"),
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
  const summary = cockpit.summary ?? ({} as Summary);
  const previousCockpit = (previousCockpitData ?? {}) as Cockpit;
  const previousSummary = previousCockpit.summary ?? ({} as Summary);
  const distribution = (distributionData ?? {}) as ProductDistribution;
  const distributionSummary: ProductDistributionSummary = distribution.summary ?? {
    products_count: null,
    avg_product_distribution_rate: null,
  };
  const distributionByProduct = new Map((distribution.products ?? []).map((row) => [row.product_id, row]));
  const objectiveRows = (objectiveData ?? []) as ObjectiveRow[];
  const revenueObjective = objectiveCompatible
    ? objectiveRows.find((objective) => objective.metric_key === "revenue_ht") ?? null
    : null;

  const revenue = Number(summary.revenue_ht ?? 0);
  const orders = Number(summary.orders_count ?? 0);
  const basket = Number(summary.average_order_value_ht ?? 0);
  const previousRevenue = Number(previousSummary.revenue_ht ?? 0);
  const previousOrders = Number(previousSummary.orders_count ?? 0);
  const previousBasket = Number(previousSummary.average_order_value_ht ?? 0);
  const revenueDelta = percentChange(revenue, previousRevenue);
  const ordersDelta = percentChange(orders, previousOrders);
  const basketDelta = percentChange(basket, previousBasket);
  const targetRevenue = revenueObjective ? Number(revenueObjective.target_value) : null;
  const attainment = revenueObjective?.attainment_percent ?? (targetRevenue && targetRevenue > 0 ? (revenue * 100) / targetRevenue : null);
  const remainingRevenue = targetRevenue && targetRevenue > 0 ? Math.max(0, targetRevenue - revenue) : null;

  const agentOptions = (memberships ?? []).map((membership) => {
    const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
    const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
    return { id: membership.user_id, name: profile?.full_name ?? "Délégué" };
  });
  const baseFilters = { from, to, territory: territoryId, agent: agentId, groupType, group: groupId, potential, priority, product: productId };
  const activeFilterCount = [territoryId, agentId, groupType, groupId, potential, priority, productId].filter(Boolean).length;
  const sortedTerritories = [...(cockpit.territories ?? [])].sort((a, b) => Number(b.revenue_ht) - Number(a.revenue_ht));

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Performance · ${brand.name}`}
        title="Résultats commerciaux"
        description="Suivez le CA, l’atteinte des objectifs, le panier moyen et la DN par produit."
        tone="dark"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Période {from} → {to}</Badge>
          {activeFilterCount ? <Badge variant="secondary">{activeFilterCount} filtre(s) actif(s)</Badge> : <Badge variant="secondary">Vue réseau</Badge>}
          <Badge variant="secondary">Comparaison N-1</Badge>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/network?${qs({ from, to, territory: territoryId, agent: agentId })}`}>Voir l’activité terrain</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Filtres</CardTitle>
              <CardDescription>Les résultats se mettent à jour selon la période, le secteur, le délégué, le groupement et le produit.</CardDescription>
            </div>
            {activeFilterCount ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/network/commercial?from=${from}&to=${to}`}>Réinitialiser</Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} />
            <input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} />
            <select className="h-10 rounded-md border bg-background px-3" name="territory" defaultValue={territoryId ?? "all"}>
              <option value="all">Tous les secteurs</option>
              {(territories ?? []).map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="agent" defaultValue={agentId ?? "all"}>
              <option value="all">Tous les délégués</option>
              {agentOptions.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="groupType" defaultValue={groupType ?? "all"}>
              <option value="all">Tous les types de réseau</option>
              {groupTypeOptions.map((value) => <option key={value} value={value}>{presentationLabel(value)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="group" defaultValue={groupId ?? "all"}>
              <option value="all">Tous les groupements</option>
              {(groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="potential" defaultValue={potential ?? "all"}>
              <option value="all">Tous les potentiels</option>
              {potentialOptions.map((value) => <option key={value} value={value}>Potentiel · {presentationLabel(value)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="priority" defaultValue={priority ?? "all"}>
              <option value="all">Toutes les priorités</option>
              {priorityOptions.map((value) => <option key={value} value={value}>Priorité · {presentationLabel(value)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="product" defaultValue={productId ?? "all"}>
              <option value="all">Tous les produits</option>
              {(products ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}
            </select>
            <Button>Afficher</Button>
          </form>
        </CardContent>
      </Card>

      {cockpitError || distributionError ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Certains indicateurs ne sont pas disponibles : {cockpitError?.message ?? distributionError?.message}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs commerciaux">
        <Metric
          icon={TrendingUp}
          label="CA HT"
          value={formatCompactCurrency(summary.revenue_ht)}
          detail={signedPercent(revenueDelta)}
          trend={revenueDelta}
        />
        <Metric
          icon={ShoppingCart}
          label="Commandes"
          value={formatCompactNumber(summary.orders_count)}
          detail={signedPercent(ordersDelta)}
          trend={ordersDelta}
        />
        <Metric
          icon={ReceiptText}
          label="Panier moyen HT"
          value={formatCompactCurrency(summary.average_order_value_ht)}
          detail={signedPercent(basketDelta)}
          trend={basketDelta}
        />
        <Metric
          icon={PackageCheck}
          label="DN moyenne"
          value={formatCompactPercent(distributionSummary.avg_product_distribution_rate)}
          detail={productId ? "DN de la référence sélectionnée" : `Sur ${formatCompactNumber(distributionSummary.products_count)} référence(s)`}
        />
      </section>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Target className="size-4 text-[var(--tr1-orange)]" /> Atteinte de l’objectif CA</CardTitle>
              <CardDescription>Suivi du CA réalisé par rapport à l’objectif de la période.</CardDescription>
            </div>
            {revenueObjective?.projected_value != null ? (
              <Badge variant="secondary">Atterrissage estimé {formatCompactCurrency(revenueObjective.projected_value)}</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {objectiveError ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Aucun objectif CA disponible pour cette période.</p>
          ) : !objectiveCompatible ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              L’objectif CA ne peut pas être comparé avec les filtres sélectionnés. Retirez le filtre produit, groupement, potentiel ou priorité pour retrouver la comparaison à l’objectif.
            </p>
          ) : revenueObjective && targetRevenue ? (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr] lg:items-end">
              <div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">CA réalisé</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">{formatCompactCurrency(revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Objectif CA</p>
                    <p className="mt-1 text-xl font-semibold">{formatCompactCurrency(targetRevenue)}</p>
                  </div>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[var(--tr1-orange)]" style={{ width: `${clampPercent(attainment)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{formatCompactPercent(attainment)} d’atteinte</span>
                  <span className="text-muted-foreground">Reste à réaliser : {formatCompactCurrency(remainingRevenue)}</span>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reste à réaliser</p>
                <p className="mt-2 text-2xl font-bold">{formatCompactCurrency(remainingRevenue)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Pour atteindre l’objectif de la période.</p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Aucun objectif CA n’est renseigné pour cette période. Le CA réalisé reste disponible.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPinned className="size-4 text-[var(--tr1-orange)]" /> Résultats par secteur</CardTitle>
            <CardDescription>CA, poids dans le CA total, commandes et panier moyen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTerritories.length ? sortedTerritories.slice(0, 12).map((row) => {
              const caShare = contribution(row.revenue_ht, summary.revenue_ht);
              return (
                <Link
                  key={row.territory_id ?? row.territory_name}
                  href={row.territory_id ? `/dashboard/network/commercial?${qs({ ...baseFilters, territory: row.territory_id, agent: null })}` : "#"}
                  className="block rounded-xl border p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{row.territory_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{presentationLabel(row.territory_type)} · {formatCompactNumber(row.orders_count)} commandes · panier moyen {formatCompactCurrency(row.average_order_value_ht)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCompactCurrency(row.revenue_ht)}</p>
                      <p className="text-xs text-muted-foreground">{caShare == null ? "—" : `${formatCompactPercent(caShare)} du CA total`}</p>
                    </div>
                  </div>
                </Link>
              );
            }) : <EmptyState text="Aucun CA sur la période sélectionnée." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résultats par produit</CardTitle>
            <CardDescription>CA, poids dans le CA, commandes, DN et quantités par référence.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Poids CA</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead>DN</TableHead>
                  <TableHead>Qté commandée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cockpit.products ?? []).length ? (cockpit.products ?? []).map((row) => {
                  const dn = distributionByProduct.get(row.product_id);
                  const caShare = contribution(row.revenue_ht, summary.revenue_ht);
                  return (
                    <TableRow key={row.product_id}>
                      <TableCell>
                        <Link className="font-medium hover:underline" href={`/dashboard/network/commercial?${qs({ ...baseFilters, product: row.product_id })}`}>{row.product_name}</Link>
                        <p className="text-xs text-muted-foreground">{row.sku ?? "Sans SKU"}</p>
                      </TableCell>
                      <TableCell>{formatCompactCurrency(row.revenue_ht)}</TableCell>
                      <TableCell>{formatCompactPercent(caShare)}</TableCell>
                      <TableCell>{formatCompactNumber(row.orders_count)}</TableCell>
                      <TableCell>{formatCompactPercent(dn?.distribution_rate)}</TableCell>
                      <TableCell>{formatCompactNumber(row.paid_units)}<p className="text-xs text-muted-foreground">+ {formatCompactNumber(row.free_units)} UG</p></TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={6}><EmptyState text="Aucune commande produit sur la période sélectionnée." /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  trend,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
  trend?: number | null;
}) {
  const TrendIcon = trend != null && trend < 0 ? TrendingDown : TrendingUp;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className={`mt-2 flex items-center gap-1 text-xs ${trend == null ? "text-muted-foreground" : trend < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {trend != null ? <TrendIcon className="size-3.5" /> : null}
              {detail}
            </p>
          </div>
          <Icon className="size-5 text-[var(--tr1-orange)]" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="p-4 text-sm text-muted-foreground">{text}</p>;
}
