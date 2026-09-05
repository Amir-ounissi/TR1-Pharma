import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CircleDollarSign, Network, Target } from "lucide-react";
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
  orders_count: number;
  implantations: number;
  reorders: number;
  avg_distribution_rate: number;
  strategic_distribution_rate: number;
  territories_covered: number;
  at_risk_customers: number;
};

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Network; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><span className="text-xs font-medium uppercase tracking-[0.08em]">{label}</span></div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default async function KamGroupsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = new Date();
  const yearStart = `${today.getUTCFullYear()}-01-01`;
  const from = validDate(query.from, yearStart);
  const to = validDate(query.to, inputDate(today));
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();

  const { data, error } = await supabase.rpc("get_kam_group_overview", {
    target_brand_id: brand.id,
    target_period_start: from,
    target_period_end: to,
  });
  if (error) throw error;

  const groups = (data ?? []) as GroupRow[];
  const totals = groups.reduce(
    (acc, group) => ({
      park: acc.park + Number(group.park_pharmacies ?? 0),
      customers: acc.customers + Number(group.customer_pharmacies ?? 0),
      remaining: acc.remaining + Number(group.non_customer_pharmacies ?? 0),
      revenue: acc.revenue + Number(group.revenue_ht ?? 0),
    }),
    { park: 0, customers: 0, remaining: 0, revenue: 0 },
  );
  const weightedPenetration = totals.park ? Math.round((totals.customers / totals.park) * 1000) / 10 : 0;

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`KAM Groupements · ${brand.name}`}
        title="Mesurer la pénétration réseau et le potentiel restant"
        description="Parc officinal, clientes, non-clientes, CA, DN et comptes à risque sont consolidés sans mélanger les données d’autres marques."
        tone="dark"
      />

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1 text-sm"><span className="text-muted-foreground">Du</span><input className="h-10 w-full rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} /></label>
            <label className="space-y-1 text-sm"><span className="text-muted-foreground">Au</span><input className="h-10 w-full rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} /></label>
            <Button className="self-end">Appliquer</Button>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Network} label="Réseaux suivis" value={formatCompactNumber(groups.length)} detail="Groupements avec au moins une pharmacie active" />
        <MetricCard icon={Building2} label="Parc groupements" value={formatCompactNumber(totals.park)} detail={`${formatCompactNumber(totals.customers)} clientes · ${formatCompactNumber(totals.remaining)} à conquérir`} />
        <MetricCard icon={Target} label="Pénétration" value={formatCompactPercent(weightedPenetration)} detail="Clientes / parc officinal connu" />
        <MetricCard icon={CircleDollarSign} label="CA période" value={formatCompactCurrency(totals.revenue)} detail={`${from} → ${to}`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Portefeuille groupements</CardTitle>
          <CardDescription>Classement par CA puis potentiel restant. Une cliente est une pharmacie avec au moins une commande commerciale valide pour la marque.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">Aucun groupement avec pharmacie active dans le référentiel.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Groupement</TableHead><TableHead>Parc</TableHead><TableHead>Clientes</TableHead><TableHead>Pénétration</TableHead><TableHead>Potentiel restant</TableHead><TableHead>CA</TableHead><TableHead>DN</TableHead><TableHead>Risque</TableHead></TableRow></TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.group_id}>
                    <TableCell>
                      <Link className="font-semibold hover:underline" href={`/dashboard/kam-groups/${group.group_id}?from=${from}&to=${to}`}>{group.group_name}</Link>
                      <p className="text-xs text-muted-foreground">{presentationLabel(group.group_type)}{group.headquarters_city ? ` · ${group.headquarters_city}` : ""}</p>
                    </TableCell>
                    <TableCell>{formatCompactNumber(group.park_pharmacies)}</TableCell>
                    <TableCell>{formatCompactNumber(group.customer_pharmacies)} <span className="text-xs text-muted-foreground">({formatCompactNumber(group.portfolio_pharmacies)} en portefeuille)</span></TableCell>
                    <TableCell>{formatCompactPercent(group.penetration_rate)}</TableCell>
                    <TableCell><strong>{formatCompactNumber(group.non_customer_pharmacies)}</strong>{group.high_potential_remaining > 0 ? <p className="text-xs text-muted-foreground">{group.high_potential_remaining} fort potentiel identifié</p> : null}</TableCell>
                    <TableCell>{formatCompactCurrency(group.revenue_ht)}<p className="text-xs text-muted-foreground">{group.orders_count} commande(s)</p></TableCell>
                    <TableCell>{formatCompactPercent(group.avg_distribution_rate)}<p className="text-xs text-muted-foreground">Stratégique {formatCompactPercent(group.strategic_distribution_rate)}</p></TableCell>
                    <TableCell>{group.at_risk_customers > 0 ? <Badge variant="destructive">{group.at_risk_customers} à risque</Badge> : <Badge variant="secondary">Stable</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
