import { AlertTriangle, ArrowRight, Building2, CircleDollarSign, Clock3, MoonStar, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CommercialEventTracker } from "@/components/commercial/commercial-event-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { SectionHeader } from "@/components/ux/section-header";
import { requireActiveBrand } from "@/lib/auth";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import { presentationLabel } from "@/lib/presentation";

type DashboardMetrics = {
  period_days: number;
  current_revenue: number;
  previous_revenue: number;
  revenue_change_percent: number | null;
  orders_count: number;
  average_order_value: number;
  active_pharmacies: number;
  reorder_rate: number | null;
  first_reorder_rate: number | null;
  average_days_to_first_reorder: number | null;
  reorder_overdue_count: number;
  first_reorder_count: number;
  at_risk_count: number;
  dormant_count: number;
  without_action_count: number;
  strategic_without_action_count: number;
};

function currency(value: number | null) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

export default async function DashboardPage() {
  const { supabase, brand, profile } = await requireActiveBrand();
  const [{ data: contexts }, { data: dashboard }, { data: priorities }] = await Promise.all([
    supabase.rpc("get_my_brand_contexts"),
    supabase.rpc("get_commercial_dashboard", {
      target_brand_id: brand.id,
      target_period_days: 90,
      target_agent_id: null,
      target_territory_id: null,
      target_commercial_status: null,
    }),
    supabase.rpc("get_commercial_priorities", {
      target_brand_id: brand.id,
      target_filter: null,
      result_limit: 5,
    }),
  ]);
  const role = contexts?.find((context: { brand_id: string }) => context.brand_id === brand.id)?.role_key;
  const manager = role === "tr1_manager" || role === "brand_admin" || role === "brand_user" || role === "super_admin";
  if (!manager) {
    return (
      <div className="space-y-6">
        <header><h1 className="text-2xl font-semibold">Vue d’ensemble</h1><p className="text-muted-foreground">Bonjour {profile.full_name}. Retrouvez vos actions dans votre espace terrain.</p></header>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="flex items-center gap-3 pt-6"><Building2 /><div><p className="text-sm text-muted-foreground">Marque active</p><p className="font-semibold">{brand.name}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 pt-6"><ShieldCheck /><div><p className="text-sm text-muted-foreground">Isolation</p><p className="font-semibold">RLS active</p></div></CardContent></Card>
          <Card><CardContent className="pt-6"><Button asChild className="w-full"><Link href="/dashboard/agent">Ouvrir Ma journée <ArrowRight /></Link></Button></CardContent></Card>
        </div>
      </div>
    );
  }

  const metrics = (dashboard ?? {}) as DashboardMetrics;
  const rows = (priorities ?? []) as CommercialHealthRow[];
  const actions = [
    { label: "Réassorts en retard", value: metrics.reorder_overdue_count ?? 0, filter: "reorder_overdue", icon: Clock3, tone: "text-[#b83a22]" },
    { label: "Premiers réassorts à sécuriser", value: metrics.first_reorder_count ?? 0, filter: "first_reorder", icon: Sparkles, tone: "text-[#ee6c3b]" },
    { label: "Comptes à risque", value: metrics.at_risk_count ?? 0, filter: "at_risk", icon: AlertTriangle, tone: "text-[#b83a22]" },
    { label: "Stratégiques sans action", value: metrics.strategic_without_action_count ?? 0, filter: "strategic", icon: TrendingUp, tone: "text-[#2d6f9f]" },
    { label: "Comptes dormants", value: metrics.dormant_count ?? 0, filter: "dormant", icon: MoonStar, tone: "text-[#6d5c87]" },
  ];
  const kpis = [
    ["CA 90 jours", currency(metrics.current_revenue)],
    ["Évolution", metrics.revenue_change_percent === null || metrics.revenue_change_percent === undefined ? "Données insuffisantes" : `${metrics.revenue_change_percent > 0 ? "+" : ""}${metrics.revenue_change_percent}%`],
    ["Commandes", String(metrics.orders_count ?? 0)],
    ["Pharmacies actives", String(metrics.active_pharmacies ?? 0)],
    ["Taux de réassort", metrics.reorder_rate === null || metrics.reorder_rate === undefined ? "—" : `${metrics.reorder_rate}%`],
    ["Premier réassort", metrics.first_reorder_rate === null || metrics.first_reorder_rate === undefined ? "—" : `${metrics.first_reorder_rate}%`],
    ["Délai moyen 1er réassort", metrics.average_days_to_first_reorder === null || metrics.average_days_to_first_reorder === undefined ? "—" : `${metrics.average_days_to_first_reorder} j`],
    ["Panier moyen", currency(metrics.average_order_value)],
  ];

  return (
    <main className="space-y-6">
      <CommercialEventTracker eventName="manager_commercial_dashboard_viewed" />
      <PageHeader eyebrow={`Pilotage commercial · ${brand.name}`} title="Où agir maintenant ?" description="Priorisez le réassort et le chiffre d’affaires avant de consulter les statistiques." tone="dark" />

      <section aria-labelledby="now-title" className="space-y-3">
        <SectionHeader id="now-title" title="À traiter maintenant" description="Les signaux les plus urgents de votre réseau." action={<Button asChild variant="outline"><Link href="/dashboard/commercial-health">Voir toutes les priorités <ArrowRight /></Link></Button>} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {actions.map((action) => (
            <Link key={action.label} href={`/dashboard/commercial-health?filter=${action.filter}`} className="rounded-[0.45rem] border border-[var(--tr1-line)] bg-card p-4 transition hover:border-[var(--tr1-orange)]/55 hover:bg-white/45">
              <div className="flex items-center justify-between"><action.icon className={`size-4 ${action.tone}`} /><strong className="font-mono text-2xl tracking-[-0.07em]">{action.value}</strong></div>
              <p className="mt-3 font-mono text-[0.64rem] font-bold uppercase tracking-[0.04em]">{action.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Comptes prioritaires</CardTitle><Badge variant="secondary">Score explicable</Badge></CardHeader>
          <CardContent className="space-y-3">
            {rows.length ? rows.map((row) => (
              <Link key={row.brand_pharmacy_id} href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`} className="flex min-h-16 items-center justify-between gap-4 rounded-[0.4rem] border border-[var(--tr1-line)] p-3 hover:bg-white/45">
                <div><p className="font-semibold">{row.pharmacy_name}</p><p className="text-sm text-muted-foreground">{presentationLabel(row.health_status)} · {row.recommendation}</p></div>
                <span className="shrink-0 rounded-[0.25rem] bg-[#0f2740] px-3 py-1 font-mono text-xs font-bold text-white">{row.priority_score}</span>
              </Link>
            )) : <p className="py-8 text-center text-muted-foreground">Aucune urgence commerciale détectée.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="size-5" />Indicateurs compacts</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {kpis.map(([label, value]) => <div key={label} className="rounded-[0.35rem] border border-[var(--tr1-line)] bg-transparent p-3"><p className="font-mono text-lg font-black tracking-[-0.05em]">{value}</p><p className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground">{label}</p></div>)}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
