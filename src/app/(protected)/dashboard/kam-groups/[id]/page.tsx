import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{ from?: string; to?: string }>;

type GroupRow = {
  group_id: string;
  group_name: string;
  group_type: string;
  headquarters_city: string | null;
  park_pharmacies: number;
  portfolio_pharmacies: number;
  customer_pharmacies: number;
  non_customer_pharmacies: number;
  penetration_rate: number;
  high_potential_remaining: number;
  revenue_ht: number;
  avg_distribution_rate: number;
  strategic_distribution_rate: number;
  at_risk_customers: number;
};

type PharmacyRow = {
  pharmacy_id: string;
  brand_pharmacy_id: string | null;
  pharmacy_name: string;
  postal_code: string | null;
  city: string | null;
  in_portfolio: boolean;
  is_customer: boolean;
  commercial_status: string | null;
  activity_status: string | null;
  priority_level: string | null;
  potential_level: string | null;
  potential_score: number | null;
  territory_name: string | null;
  agent_name: string | null;
  health_status: string | null;
  priority_score: number | null;
  recommendation: string | null;
  revenue_ht: number;
  orders_count: number;
  reorders: number;
  distribution_rate: number | null;
  strategic_distribution_rate: number | null;
};

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}

export default async function KamGroupDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const today = new Date();
  const from = validDate(query.from, `${today.getUTCFullYear()}-01-01`);
  const to = validDate(query.to, inputDate(today));
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();

  const [{ data: overview, error: overviewError }, { data: pharmacies, error: pharmaciesError }] = await Promise.all([
    supabase.rpc("get_kam_group_overview", { target_brand_id: brand.id, target_period_start: from, target_period_end: to }),
    supabase.rpc("get_kam_group_pharmacies", { target_brand_id: brand.id, target_group_id: id, target_period_start: from, target_period_end: to }),
  ]);
  if (overviewError) throw overviewError;
  if (pharmaciesError) throw pharmaciesError;

  const group = ((overview ?? []) as GroupRow[]).find((row) => row.group_id === id);
  if (!group) notFound();
  const rows = (pharmacies ?? []) as PharmacyRow[];

  return (
    <main className="space-y-6">
      <div><Button asChild size="sm" variant="outline"><Link href={`/dashboard/kam-groups?from=${from}&to=${to}`}>← Tous les groupements</Link></Button></div>
      <PageHeader
        eyebrow={`KAM · ${brand.name}`}
        title={group.group_name}
        description={`${presentationLabel(group.group_type)}${group.headquarters_city ? ` · siège ${group.headquarters_city}` : ""}. Lecture du parc, de la pénétration et des opportunités officine par officine.`}
        tone="dark"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Parc</p><p className="mt-2 text-2xl font-semibold">{formatCompactNumber(group.park_pharmacies)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Clientes</p><p className="mt-2 text-2xl font-semibold">{formatCompactNumber(group.customer_pharmacies)}</p><p className="text-xs text-muted-foreground">{formatCompactPercent(group.penetration_rate)} du parc</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">À conquérir</p><p className="mt-2 text-2xl font-semibold">{formatCompactNumber(group.non_customer_pharmacies)}</p><p className="text-xs text-muted-foreground">{group.high_potential_remaining} fort potentiel identifié</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">CA période</p><p className="mt-2 text-2xl font-semibold">{formatCompactCurrency(group.revenue_ht)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">DN moyenne</p><p className="mt-2 text-2xl font-semibold">{formatCompactPercent(group.avg_distribution_rate)}</p><p className="text-xs text-muted-foreground">Stratégique {formatCompactPercent(group.strategic_distribution_rate)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Clientes à risque</p><p className="mt-2 text-2xl font-semibold">{formatCompactNumber(group.at_risk_customers)}</p></CardContent></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Parc officinal</CardTitle>
          <CardDescription>Les officines hors portefeuille sont visibles comme potentiel de conquête, sans exposer de données commerciales d’autres marques.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>Statut</TableHead><TableHead>Potentiel</TableHead><TableHead>Territoire / agent</TableHead><TableHead>CA</TableHead><TableHead>DN</TableHead><TableHead>Priorité</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.pharmacy_id}>
                  <TableCell>
                    {row.brand_pharmacy_id ? <Link className="font-semibold hover:underline" href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`}>{row.pharmacy_name}</Link> : <p className="font-semibold">{row.pharmacy_name}</p>}
                    <p className="text-xs text-muted-foreground">{[row.postal_code, row.city].filter(Boolean).join(" · ") || "Localisation non renseignée"}</p>
                  </TableCell>
                  <TableCell>{row.is_customer ? <Badge>Cliente</Badge> : row.in_portfolio ? <Badge variant="secondary">Prospect portefeuille</Badge> : <Badge variant="outline">Hors portefeuille</Badge>}{row.health_status ? <p className="mt-1 text-xs text-muted-foreground">{presentationLabel(row.health_status)}</p> : null}</TableCell>
                  <TableCell>{row.potential_level ? presentationLabel(row.potential_level) : "Non qualifié"}{row.potential_score !== null ? <p className="text-xs text-muted-foreground">Score {formatCompactNumber(row.potential_score)}/100</p> : null}</TableCell>
                  <TableCell>{row.territory_name ?? "Non affectée"}<p className="text-xs text-muted-foreground">{row.agent_name ?? "Aucun commercial"}</p></TableCell>
                  <TableCell>{formatCompactCurrency(row.revenue_ht)}<p className="text-xs text-muted-foreground">{row.orders_count} commande(s) · {row.reorders} réassort(s)</p></TableCell>
                  <TableCell>{row.distribution_rate === null ? "—" : formatCompactPercent(row.distribution_rate)}{row.strategic_distribution_rate !== null ? <p className="text-xs text-muted-foreground">Strat. {formatCompactPercent(row.strategic_distribution_rate)}</p> : null}</TableCell>
                  <TableCell>{row.priority_score !== null ? <strong>{row.priority_score}/100</strong> : "—"}{row.recommendation ? <p className="mt-1 max-w-64 text-xs text-muted-foreground">{row.recommendation}</p> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
