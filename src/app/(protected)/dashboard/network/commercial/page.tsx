import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Boxes, Building2, Gauge, MapPinned, PackageCheck, ReceiptText, ShoppingCart, Target, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
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

type TerritoryRow = {
  territory_id: string | null;
  territory_name: string;
  territory_type: string | null;
  revenue_ht: number;
  orders_count: number;
  ordering_pharmacies: number;
  average_order_value_ht: number | null;
  average_skus_per_order: number | null;
};

type AgentRow = {
  user_id: string | null;
  full_name: string;
  revenue_ht: number;
  orders_count: number;
  ordering_pharmacies: number;
  average_order_value_ht: number | null;
  average_skus_per_order: number | null;
  average_paid_units_per_order: number | null;
};

type ProductRow = {
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

type SegmentRow = {
  group_type: string;
  potential_level: string;
  priority_level: string;
  revenue_ht: number;
  orders_count: number;
  ordering_pharmacies: number;
  average_order_value_ht: number | null;
  average_skus_per_order: number | null;
};

type PharmacyRow = {
  brand_pharmacy_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  city: string | null;
  postal_code: string | null;
  group_name: string | null;
  group_type: string | null;
  potential_level: string | null;
  priority_level: string | null;
  revenue_ht: number;
  orders_count: number;
  average_order_value_ht: number | null;
  average_skus_per_order: number | null;
  paid_units: number;
};

type Cockpit = {
  period_start?: string;
  period_end?: string;
  summary?: Summary;
  territories?: TerritoryRow[];
  agents?: AgentRow[];
  products?: ProductRow[];
  segments?: SegmentRow[];
  pharmacies?: PharmacyRow[];
};

type ProductDistributionSummary = {
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

type ProductDistribution = {
  summary?: ProductDistributionSummary;
  products?: ProductDistributionRow[];
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

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeDate(value: string | undefined, fallback: Date) {
  if (!value) return dateInput(fallback);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? dateInput(fallback) : value;
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

export default async function CommercialPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const from = safeDate(query.from, thirtyDaysAgo);
  const to = safeDate(query.to, today);
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

  const [
    { data: cockpitData, error: cockpitError },
    { data: distributionData, error: distributionError },
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
  const distribution = (distributionData ?? {}) as ProductDistribution;
  const distributionSummary: ProductDistributionSummary = distribution.summary ?? {
    customer_pharmacies: null,
    products_count: null,
    avg_product_distribution_rate: null,
  };
  const distributionByProduct = new Map((distribution.products ?? []).map((row) => [row.product_id, row]));
  const agentOptions = (memberships ?? []).map((membership) => {
    const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
    const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
    return { id: membership.user_id, name: profile?.full_name ?? "Agent" };
  });

  const baseFilters = { from, to, territory: territoryId, agent: agentId, groupType, group: groupId, potential, priority, product: productId };
  const activeFilterCount = [territoryId, agentId, groupType, groupId, potential, priority, productId].filter(Boolean).length;
  const maxTerritoryRevenue = Math.max(0, ...(cockpit.territories ?? []).map((row) => Number(row.revenue_ht ?? 0)));

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Performance · ${brand.name}`}
        title="Cockpit de performance commerciale"
        description="Du national à la pharmacie : chiffre d’affaires, commandes, panier, DN produit, largeur d’assortiment et efficacité commerciale dans une même lecture."
        tone="dark"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Période {from} → {to}</Badge>
          {activeFilterCount ? <Badge variant="secondary">{activeFilterCount} filtre(s) actif(s)</Badge> : <Badge variant="secondary">Vue globale</Badge>}
          {productId ? <Badge variant="secondary">Analyse produit ciblée</Badge> : null}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/network?${qs({ from, to, territory: territoryId, agent: agentId })}`}>Analyse opérationnelle</Link>
          </Button>
          {activeFilterCount ? (
            <Button asChild variant="ghost" size="sm"><Link href={`/dashboard/network/commercial?from=${from}&to=${to}`}>Réinitialiser</Link></Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Périmètre d’analyse</CardTitle>
          <CardDescription>Tous les indicateurs et tableaux ci-dessous se recalculent sur le même périmètre.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} />
            <input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} />
            <select className="h-10 rounded-md border bg-background px-3" name="territory" defaultValue={territoryId ?? "all"}>
              <option value="all">France / tous territoires</option>
              {(territories ?? []).map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="agent" defaultValue={agentId ?? "all"}>
              <option value="all">Tous les commerciaux</option>
              {agentOptions.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
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
            <Button>Appliquer les filtres</Button>
          </form>
        </CardContent>
      </Card>

      {cockpitError || distributionError ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Les indicateurs commerciaux ne peuvent pas tous être calculés : {cockpitError?.message ?? distributionError?.message}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={TrendingUp} label="CA réalisé HT" value={formatCompactCurrency(summary.revenue_ht)} detail={productId ? "CA réalisé du produit filtré" : "Commandes facturées ou livrées"} />
        <Metric icon={ShoppingCart} label="Commandes réalisées" value={formatCompactNumber(summary.orders_count)} detail={`${formatCompactNumber(summary.ordering_pharmacies)} pharmacie(s) commandante(s)`} />
        <Metric icon={ReceiptText} label="Panier moyen" value={formatCompactCurrency(summary.average_order_value_ht)} detail={productId ? "Commandes contenant le produit" : "Valeur moyenne par commande"} />
        <Metric icon={PackageCheck} label="DN produit moyenne" value={formatCompactPercent(distributionSummary.avg_product_distribution_rate)} detail={productId ? "DN du produit sélectionné" : `Moyenne sur ${formatCompactNumber(distributionSummary.products_count)} référence(s)`} />
        <Metric icon={Boxes} label="Références / commande" value={formatCompactNumber(summary.average_skus_per_order)} detail="Nombre moyen de SKU distincts" />
        <Metric icon={Target} label="CA commandé HT" value={formatCompactCurrency(summary.booked_revenue_ht)} detail={`${formatCompactNumber(summary.booked_orders_count)} commande(s) bookée(s)`} />
        <Metric icon={Gauge} label="Unités / commande" value={formatCompactNumber(summary.average_paid_units_per_order)} detail={`${formatCompactNumber(summary.paid_units)} unités payantes sur la période`} />
        <Metric icon={Building2} label="Fréquence de commande" value={summary.orders_per_ordering_pharmacy == null ? "—" : `${formatCompactNumber(summary.orders_per_ordering_pharmacy)}×`} detail="Commandes / pharmacie commandante" />
        <Metric icon={ArrowRight} label="Conversion comptes visités" value={formatCompactPercent(summary.visited_account_conversion_rate)} detail={`${formatCompactNumber(summary.visited_and_ordering_pharmacies)} / ${formatCompactNumber(summary.visited_pharmacies)} pharmacies visitées ont commandé`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Comment se construit la performance ?</CardTitle>
          <CardDescription>Lecture des leviers réels. La conversion mesure une corrélation sur la période, pas une causalité visite → commande. La DN est une photo actuelle du portefeuille client filtré.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <FlowStep label="Couverture" value={`${formatCompactNumber(summary.visited_pharmacies)} comptes`} detail={`${formatCompactNumber(summary.visits_count)} visites`} />
          <FlowStep label="Conversion" value={formatCompactPercent(summary.visited_account_conversion_rate)} detail="visités ayant commandé" />
          <FlowStep label="Fréquence" value={summary.orders_per_ordering_pharmacy == null ? "—" : `${formatCompactNumber(summary.orders_per_ordering_pharmacy)}×`} detail="commandes / client" />
          <FlowStep label="Panier" value={formatCompactCurrency(summary.average_order_value_ht)} detail="par commande" />
          <FlowStep label="Assortiment" value={formatCompactNumber(summary.average_skus_per_order)} detail="SKU / commande" />
          <FlowStep label="DN produit" value={formatCompactPercent(distributionSummary.avg_product_distribution_rate)} detail={`${formatCompactNumber(distributionSummary.customer_pharmacies)} pharmacies clientes`} />
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPinned className="size-4 text-[var(--tr1-orange)]" /> Territoires</CardTitle>
            <CardDescription>Cliquez sur un territoire pour recalculer tout le cockpit sur ce niveau et ses sous-territoires.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(cockpit.territories ?? []).length ? (cockpit.territories ?? []).slice(0, 12).map((row) => (
              <Link key={row.territory_id ?? "none"} href={row.territory_id ? `/dashboard/network/commercial?${qs({ ...baseFilters, territory: row.territory_id, agent: null })}` : "#"} className="block rounded-md border p-3 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-medium">{row.territory_name}</p><p className="text-xs text-muted-foreground">{presentationLabel(row.territory_type)} · {row.orders_count} commandes · panier {formatCompactCurrency(row.average_order_value_ht)}</p></div>
                  <p className="font-semibold">{formatCompactCurrency(row.revenue_ht)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--tr1-orange)]" style={{ width: `${maxTerritoryRevenue ? Math.max(3, Number(row.revenue_ht) / maxTerritoryRevenue * 100) : 0}%` }} /></div>
              </Link>
            )) : <EmptyState text="Aucun CA réalisé sur les territoires de ce périmètre." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-4 text-[var(--tr1-orange)]" /> Efficacité commerciale</CardTitle>
            <CardDescription>Comparer le résultat brut avec la qualité d’exécution : panier, largeur de gamme et productivité.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Commercial</TableHead><TableHead>CA</TableHead><TableHead>Cmd.</TableHead><TableHead>Panier</TableHead><TableHead>SKU/cmd.</TableHead></TableRow></TableHeader>
              <TableBody>
                {(cockpit.agents ?? []).length ? (cockpit.agents ?? []).map((row) => (
                  <TableRow key={row.user_id ?? "none"}>
                    <TableCell>{row.user_id ? <Link className="font-medium hover:underline" href={`/dashboard/network/commercial?${qs({ ...baseFilters, agent: row.user_id })}`}>{row.full_name}</Link> : row.full_name}<p className="text-xs text-muted-foreground">{row.ordering_pharmacies} clients</p></TableCell>
                    <TableCell>{formatCompactCurrency(row.revenue_ht)}</TableCell>
                    <TableCell>{formatCompactNumber(row.orders_count)}</TableCell>
                    <TableCell>{formatCompactCurrency(row.average_order_value_ht)}</TableCell>
                    <TableCell>{formatCompactNumber(row.average_skus_per_order)}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={5}><EmptyState text="Aucune commande réalisée par l’équipe sur ce périmètre." /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Performance produit</CardTitle>
          <CardDescription>La DN mesure la présence actuelle du produit dans les pharmacies clientes du périmètre ; la pénétration mesure la part des commandes de la période contenant ce produit.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>CA réalisé</TableHead><TableHead>Commandes</TableHead><TableHead>DN produit</TableHead><TableHead>Pénétration cmd.</TableHead><TableHead>Unités</TableHead></TableRow></TableHeader>
            <TableBody>
              {(cockpit.products ?? []).length ? (cockpit.products ?? []).map((row) => {
                const dn = distributionByProduct.get(row.product_id);
                return (
                  <TableRow key={row.product_id}>
                    <TableCell><Link className="font-medium hover:underline" href={`/dashboard/network/commercial?${qs({ ...baseFilters, product: row.product_id })}`}>{row.product_name}</Link><p className="text-xs text-muted-foreground">{row.sku ?? "Sans SKU"}</p></TableCell>
                    <TableCell>{formatCompactCurrency(row.revenue_ht)}</TableCell>
                    <TableCell>{formatCompactNumber(row.orders_count)}</TableCell>
                    <TableCell>{formatCompactPercent(dn?.distribution_rate)}<p className="text-xs text-muted-foreground">{formatCompactNumber(dn?.distributing_pharmacies)} / {formatCompactNumber(dn?.customer_pharmacies)} pharmacies</p></TableCell>
                    <TableCell>{formatCompactPercent(row.order_penetration_rate)}</TableCell>
                    <TableCell>{formatCompactNumber(row.paid_units)}<p className="text-xs text-muted-foreground">+ {formatCompactNumber(row.free_units)} UG</p></TableCell>
                  </TableRow>
                );
              }) : <TableRow><TableCell colSpan={6}><EmptyState text="Aucune donnée produit réalisée sur ce périmètre." /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Segments pharmacies</CardTitle><CardDescription>Typologie réseau × potentiel × priorité commerciale.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {(cockpit.segments ?? []).length ? (cockpit.segments ?? []).slice(0, 12).map((row, index) => (
              <div key={`${row.group_type}-${row.potential_level}-${row.priority_level}-${index}`} className="rounded-md border p-3">
                <div className="flex justify-between gap-3"><div><p className="font-medium">{presentationLabel(row.group_type)}</p><p className="text-xs text-muted-foreground">{presentationLabel(row.potential_level)} · {presentationLabel(row.priority_level)}</p></div><p className="font-semibold">{formatCompactCurrency(row.revenue_ht)}</p></div>
                <p className="mt-2 text-xs text-muted-foreground">{row.orders_count} commandes · panier {formatCompactCurrency(row.average_order_value_ht)} · {formatCompactNumber(row.average_skus_per_order)} SKU/cmd.</p>
              </div>
            )) : <EmptyState text="Aucun segment commandant sur ce périmètre." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pharmacies</CardTitle><CardDescription>Zoom local jusqu’au compte. Les 100 premières pharmacies sont classées par CA du périmètre sélectionné.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>CA</TableHead><TableHead>Cmd.</TableHead><TableHead>Panier</TableHead><TableHead>SKU/cmd.</TableHead></TableRow></TableHeader>
              <TableBody>
                {(cockpit.pharmacies ?? []).length ? (cockpit.pharmacies ?? []).map((row) => (
                  <TableRow key={row.brand_pharmacy_id}>
                    <TableCell><Link className="font-medium hover:underline" href={`/dashboard/pharmacies/${row.brand_pharmacy_id}?tab=performance`}>{row.pharmacy_name}</Link><p className="text-xs text-muted-foreground">{[row.postal_code, row.city, row.group_name].filter(Boolean).join(" · ") || "—"}</p></TableCell>
                    <TableCell>{formatCompactCurrency(row.revenue_ht)}</TableCell>
                    <TableCell>{formatCompactNumber(row.orders_count)}</TableCell>
                    <TableCell>{formatCompactCurrency(row.average_order_value_ht)}</TableCell>
                    <TableCell>{formatCompactNumber(row.average_skus_per_order)}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={5}><EmptyState text="Aucune pharmacie commandante sur ce périmètre." /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail: string }) {
  return <Card><CardContent className="pt-5"><Icon className="size-4 text-[var(--tr1-orange)]" /><p className="mt-3 text-2xl font-semibold">{value}</p><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function FlowStep({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-md border p-4"><p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--tr1-orange)]">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="p-4 text-sm text-muted-foreground">{text}</p>;
}
