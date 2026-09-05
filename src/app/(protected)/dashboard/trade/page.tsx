import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleDollarSign, Megaphone, Target, TrendingUp } from "lucide-react";
import { saveTradeCampaignFormAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{ from?: string; to?: string }>;

type CampaignRow = {
  campaign_id: string;
  campaign_name: string;
  campaign_code: string | null;
  campaign_type: string;
  campaign_status: string;
  starts_on: string;
  ends_on: string;
  budget_planned_ht: number;
  target_pharmacies: number;
  executed_pharmacies: number;
  coverage_rate: number;
  linked_missions: number;
  completed_missions: number;
  animations_completed: number;
  trainings_completed: number;
  actual_cost_ht: number;
  sell_out_units: number;
  eligible_observations: number;
  baseline_revenue_30d: number;
  post_revenue_30d: number;
  observed_incremental_revenue_ht: number;
  gross_margin_rate: number | null;
  estimated_incremental_margin_ht: number | null;
  observed_roi_percent: number | null;
  roi_reliability: "insufficient" | "partial" | "observed";
};

function inputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}

function reliabilityLabel(value: CampaignRow["roi_reliability"]) {
  if (value === "observed") return "Observation exploitable";
  if (value === "partial") return "Observation partielle";
  return "Données insuffisantes";
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Megaphone; label: string; value: string; detail: string }) {
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

export default async function TradeMarketingPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = new Date();
  const from = validDate(query.from, `${today.getUTCFullYear()}-01-01`);
  const to = validDate(query.to, inputDate(today));
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();
  const canManage = ["tr1_manager", "brand_admin", "super_admin"].includes(role);

  const { data, error } = await supabase.rpc("get_trade_campaign_overview", {
    target_brand_id: brand.id,
    target_period_start: from,
    target_period_end: to,
  });
  if (error) throw error;
  const campaigns = (data ?? []) as CampaignRow[];
  const totals = campaigns.reduce(
    (acc, campaign) => ({
      budget: acc.budget + Number(campaign.budget_planned_ht ?? 0),
      cost: acc.cost + Number(campaign.actual_cost_ht ?? 0),
      targets: acc.targets + Number(campaign.target_pharmacies ?? 0),
      executed: acc.executed + Number(campaign.executed_pharmacies ?? 0),
      sellOut: acc.sellOut + Number(campaign.sell_out_units ?? 0),
    }),
    { budget: 0, cost: 0, targets: 0, executed: 0, sellOut: 0 },
  );
  const coverage = totals.targets ? Math.round((totals.executed / totals.targets) * 1000) / 10 : 0;

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Trade Marketing · ${brand.name}`}
        title="Relier campagnes, terrain, coûts et résultats observés"
        description="Chaque campagne consolide son ciblage, ses animations et formations, les coûts engagés et un ROI uniquement lorsque la qualité d’observation le permet."
        tone="dark"
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Du</span><input className="h-10 w-full rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} /></label>
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Au</span><input className="h-10 w-full rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} /></label>
              <Button className="self-end">Appliquer</Button>
            </form>
          </CardContent>
        </Card>

        {canManage ? (
          <details className="rounded-xl border bg-background p-4 lg:w-[34rem]">
            <summary className="cursor-pointer font-semibold">Nouvelle campagne</summary>
            <form action={saveTradeCampaignFormAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2"><span>Nom</span><input required minLength={2} maxLength={160} className="h-10 w-full rounded-md border bg-background px-3" name="name" placeholder="Activation rentrée" /></label>
              <label className="space-y-1 text-sm"><span>Code</span><input maxLength={64} className="h-10 w-full rounded-md border bg-background px-3" name="code" placeholder="TRADE-2026-01" /></label>
              <label className="space-y-1 text-sm"><span>Type</span><select className="h-10 w-full rounded-md border bg-background px-3" name="campaignType" defaultValue="activation"><option value="activation">Activation</option><option value="launch">Lancement</option><option value="animation">Animation</option><option value="training">Formation</option><option value="merchandising">Merchandising</option><option value="visibility">Visibilité</option><option value="sell_out">Sell-out</option><option value="sampling">Échantillonnage</option><option value="promotion">Promotion</option><option value="other">Autre</option></select></label>
              <input type="hidden" name="status" value="planned" />
              <label className="space-y-1 text-sm"><span>Début</span><input required className="h-10 w-full rounded-md border bg-background px-3" name="startsOn" type="date" defaultValue={from} /></label>
              <label className="space-y-1 text-sm"><span>Fin</span><input required className="h-10 w-full rounded-md border bg-background px-3" name="endsOn" type="date" defaultValue={to} /></label>
              <label className="space-y-1 text-sm"><span>Budget HT</span><input required min="0" step="0.01" className="h-10 w-full rounded-md border bg-background px-3" name="budgetPlannedHt" type="number" defaultValue="0" /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span>Objectif</span><textarea maxLength={2000} className="min-h-20 w-full rounded-md border bg-background p-3" name="objective" placeholder="Objectif business et terrain" /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span>Notes</span><textarea maxLength={5000} className="min-h-16 w-full rounded-md border bg-background p-3" name="notes" /></label>
              <Button className="sm:col-span-2" type="submit">Créer la campagne</Button>
            </form>
          </details>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Megaphone} label="Campagnes" value={formatCompactNumber(campaigns.length)} detail={`${from} → ${to}`} />
        <MetricCard icon={CircleDollarSign} label="Budget / coût" value={formatCompactCurrency(totals.budget)} detail={`${formatCompactCurrency(totals.cost)} de coûts terrain observés`} />
        <MetricCard icon={Target} label="Couverture ciblage" value={formatCompactPercent(coverage)} detail={`${totals.executed} pharmacies exécutées / ${totals.targets} ciblées`} />
        <MetricCard icon={TrendingUp} label="Sell-out terrain" value={formatCompactNumber(totals.sellOut)} detail="Unités déclarées sur missions terminées" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Campagnes</CardTitle>
          <CardDescription>Le ROI est calculé sur marge incrémentale estimée uniquement quand une fenêtre J+30 exploitable existe, sans mission chevauchante.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? <p className="p-8 text-center text-muted-foreground">Aucune campagne sur cette période.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Campagne</TableHead><TableHead>Statut</TableHead><TableHead>Ciblage</TableHead><TableHead>Terrain</TableHead><TableHead>Budget / coût</TableHead><TableHead>Résultat observé</TableHead><TableHead>ROI</TableHead></TableRow></TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.campaign_id}>
                    <TableCell><Link className="font-semibold hover:underline" href={`/dashboard/trade/${campaign.campaign_id}`}>{campaign.campaign_name}</Link><p className="text-xs text-muted-foreground">{campaign.campaign_code ?? presentationLabel(campaign.campaign_type)} · {campaign.starts_on} → {campaign.ends_on}</p></TableCell>
                    <TableCell><Badge variant={campaign.campaign_status === "active" ? "default" : "secondary"}>{presentationLabel(campaign.campaign_status)}</Badge></TableCell>
                    <TableCell>{campaign.executed_pharmacies} / {campaign.target_pharmacies}<p className="text-xs text-muted-foreground">{formatCompactPercent(campaign.coverage_rate)}</p></TableCell>
                    <TableCell>{campaign.completed_missions} terminée(s)<p className="text-xs text-muted-foreground">{campaign.animations_completed} animation(s) · {campaign.trainings_completed} formation(s)</p></TableCell>
                    <TableCell>{formatCompactCurrency(campaign.budget_planned_ht)}<p className="text-xs text-muted-foreground">Coût {formatCompactCurrency(campaign.actual_cost_ht)}</p></TableCell>
                    <TableCell>{formatCompactCurrency(campaign.observed_incremental_revenue_ht)}<p className="text-xs text-muted-foreground">Écart CA J+30 observé · {campaign.eligible_observations} observation(s)</p></TableCell>
                    <TableCell>{campaign.observed_roi_percent === null ? "—" : formatCompactPercent(campaign.observed_roi_percent)}<p className="text-xs text-muted-foreground">{reliabilityLabel(campaign.roi_reliability)}</p></TableCell>
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
