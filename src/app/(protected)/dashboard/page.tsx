import { AlertTriangle, ArrowRight, Building2, Clock3, MoonStar, ShieldCheck, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommercialEventTracker } from "@/components/commercial/commercial-event-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { SectionHeader } from "@/components/ux/section-header";
import { getOptionalActiveBrand, isPlatformAdmin } from "@/lib/auth";
import { mapRecentPlatformOnboardings, summarizePlatformDashboard } from "@/lib/platform-admin";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import { formatCompactCurrency, formatCompactNumber, formatCompactPercent, formatPerformanceMetric, formatPerformanceValue } from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type DashboardMetrics = Record<string, number | null>;
type ObjectiveRow = { metric_key: string; target_value: number; realized_value: number; attainment_percent: number | null; projected_value: number | null };

export default async function DashboardPage() {
  const [session, platformAdmin] = await Promise.all([getOptionalActiveBrand(), isPlatformAdmin()]);

  if (!session.brand) {
    if (!platformAdmin) redirect("/select-brand");

    const { supabase, profile } = session;
    const [{ data: brands }, { data: brandPharmacies }, { data: activeMemberships }, { count: leadCount }, { data: onboardingSessions }] = await Promise.all([
      supabase.from("brands").select("id,is_active,status"),
      supabase.from("brand_pharmacies").select("pharmacy_id,archived_at").is("archived_at", null),
      supabase.from("memberships").select("user_id").eq("status", "active"),
      supabase.from("commercial_leads").select("id", { count: "exact", head: true }),
      supabase
        .from("brand_onboarding_sessions")
        .select("id,brand_id,status,created_at,current_step,step_statuses,brands(name)")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const summary = summarizePlatformDashboard({
      brands: brands ?? [],
      brandPharmacies: brandPharmacies ?? [],
      activeMemberships: activeMemberships ?? [],
      onboardingSessions: (onboardingSessions ?? []).map((sessionItem) => ({
        id: sessionItem.id,
        brand_id: sessionItem.brand_id,
        brand_name: (Array.isArray(sessionItem.brands) ? sessionItem.brands[0] : sessionItem.brands)?.name ?? "Marque",
        status: sessionItem.status,
        created_at: sessionItem.created_at,
        current_step: sessionItem.current_step,
        step_statuses: sessionItem.step_statuses as Record<string, string> | null,
      })),
    });
    const recentOnboardingSessions = mapRecentPlatformOnboardings(
      (onboardingSessions ?? []).map((sessionItem) => ({
        id: sessionItem.id,
        brand_id: sessionItem.brand_id,
        brand_name: (Array.isArray(sessionItem.brands) ? sessionItem.brands[0] : sessionItem.brands)?.name ?? "Marque",
        status: sessionItem.status,
        created_at: sessionItem.created_at,
        current_step: sessionItem.current_step,
        step_statuses: sessionItem.step_statuses as Record<string, string> | null,
      })),
    );

    return (
      <main className="space-y-6">
        <PageHeader eyebrow="Pilotage TR1" title="Vue globale multi-marques" description={`Bonjour ${profile.full_name}. Cette vue centralise l’activité TR1 avant d’entrer dans une marque.`} tone="dark" />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Marques actives", value: summary.activeBrands },
            { label: "Marques en préparation", value: summary.preparingBrands },
            { label: "Pharmacies uniques", value: summary.uniquePharmacies },
            { label: "Relations marque/officine", value: summary.brandPharmacyRelations },
            { label: "Utilisateurs uniques actifs", value: summary.uniqueActiveUsers },
            { label: "Onboardings en cours", value: summary.onboardingsInProgress },
            { label: "Leads TR1", value: leadCount ?? 0 },
          ].map((item) => (
            <Card key={item.label}><CardContent className="pt-5"><p className="font-mono text-2xl font-black tracking-[-0.05em]">{item.value}</p><p className="mt-1 text-sm font-medium">{item.label}</p></CardContent></Card>
          ))}
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Actions globales</CardTitle>
              <Badge variant="secondary">TR1</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button asChild><Link href="/dashboard/admin/onboarding">Créer ou activer une marque <ArrowRight /></Link></Button>
              <Button asChild variant="outline"><Link href="/dashboard/admin/users">Piloter les accès globaux <ArrowRight /></Link></Button>
              <Button asChild variant="outline"><Link href="/dashboard/admin/leads">Suivre les leads TR1 <ArrowRight /></Link></Button>
              <Button asChild variant="outline"><Link href="/select-brand">Entrer dans une marque <ArrowRight /></Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Déploiements récents</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {recentOnboardingSessions.length ? recentOnboardingSessions.map((sessionItem) => (
                <div key={sessionItem.id} className="rounded-[0.4rem] border border-[var(--tr1-line)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{sessionItem.brandName}</p>
                      <p className="text-xs text-muted-foreground">
                        {sessionItem.statusLabel} · étape {sessionItem.currentStep} · checklist {sessionItem.checklistProgress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(sessionItem.createdAt))}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/admin/onboarding?brandId=${sessionItem.brandId}`}>Reprendre l’onboarding</Link>
                    </Button>
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">Aucun onboarding récent.</p>}
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const { supabase, brand, profile } = session;
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayDate = today.toISOString().slice(0, 10);
  const [{ data: contexts }, { data: dashboard }, { data: objectives }, { data: priorities }] = await Promise.all([
    supabase.rpc("get_my_brand_contexts"),
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: monthStart,
      target_period_end: todayDate,
      target_agent_id: null,
      target_territory_id: null,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: monthStart,
      target_filter_end: todayDate,
      target_scope_type: "brand",
      target_territory_id: null,
      target_agent_id: null,
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
  const topObjectives = ((objectives ?? []) as ObjectiveRow[])
    .filter((objective) => ["revenue_ht", "implantations", "first_reorder_rate"].includes(objective.metric_key))
    .slice(0, 3);
  const rows = (priorities ?? []) as CommercialHealthRow[];
  const actions = [
    { label: "Sans prochaine action", value: metrics.without_next_action_count ?? 0, filter: "without_action", icon: Clock3, tone: "text-[#b83a22]" },
    { label: "Comptes à risque", value: metrics.at_risk_accounts ?? 0, filter: "at_risk", icon: AlertTriangle, tone: "text-[#b83a22]" },
    { label: "Stratégiques sans action", value: metrics.strategic_without_action_count ?? 0, filter: "strategic", icon: TrendingUp, tone: "text-[#2d6f9f]" },
    { label: "Comptes dormants", value: metrics.dormant_accounts ?? 0, filter: "dormant", icon: MoonStar, tone: "text-[#6d5c87]" },
  ];

  return (
    <main className="space-y-6">
      <CommercialEventTracker eventName="manager_commercial_dashboard_viewed" />
      <PageHeader eyebrow={`Pilotage commercial · ${brand.name}`} title="Je constate, je comprends, j’agis" description="Le dashboard reste orienté décision: objectifs clés, alertes prioritaires, activité terrain et comptes à traiter." tone="dark" />

      <section aria-labelledby="objective-title" className="space-y-3">
        <SectionHeader id="objective-title" title="Objectifs principaux" description="Objectif, réalisé, atteinte et projection du mois." action={<Button asChild variant="outline"><Link href="/dashboard/network?view=overview">Ouvrir Performance <ArrowRight /></Link></Button>} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topObjectives.length ? topObjectives.map((objective) => (
            <Card key={objective.metric_key}>
              <CardContent className="pt-5">
                <Target className="size-4 text-[var(--tr1-orange)]" />
                <p className="mt-3 text-2xl font-semibold">{objective.attainment_percent == null ? "—" : `${objective.attainment_percent.toFixed(1)} %`}</p>
                <p className="text-sm font-medium">{formatPerformanceMetric(objective.metric_key)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPerformanceValue(objective.metric_key, objective.realized_value)} / {formatPerformanceValue(objective.metric_key, objective.target_value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Projection {objective.projected_value == null ? "—" : formatPerformanceValue(objective.metric_key, objective.projected_value)}
                </p>
              </CardContent>
            </Card>
          )) : (
            <>
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactCurrency(metrics.revenue_ht)}</p><p className="text-sm font-medium">CA HT</p><p className="text-xs text-muted-foreground">Objectif non défini</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactNumber(metrics.implantations)}</p><p className="text-sm font-medium">Implantations</p><p className="text-xs text-muted-foreground">Réalisées ce mois-ci</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactPercent(metrics.first_reorder_rate)}</p><p className="text-sm font-medium">Premier réassort</p><p className="text-xs text-muted-foreground">Base éligible</p></CardContent></Card>
            </>
          )}
        </div>
      </section>

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
          <CardHeader><CardTitle>Activité terrain</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              ["Animations", formatCompactNumber(metrics.animations_completed)],
              ["Formations", formatCompactNumber(metrics.trainings_completed)],
              ["Missions terminées", formatCompactNumber(metrics.missions_completed)],
              ["Sell-out déclaré", `${formatCompactNumber(metrics.sell_out_units)} unités`],
              ["DN moyenne", formatCompactPercent(metrics.avg_distribution_rate)],
              ["DN stratégique", formatCompactPercent(metrics.strategic_distribution_rate)],
            ].map(([label, value]) => <div key={label} className="rounded-[0.35rem] border border-[var(--tr1-line)] bg-transparent p-3"><p className="font-mono text-lg font-black tracking-[-0.05em]">{value}</p><p className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground">{label}</p></div>)}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
