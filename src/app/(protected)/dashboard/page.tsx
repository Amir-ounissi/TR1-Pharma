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
    const [{ data: brands }, { data: brandPharmacies }, { data: activeMemberships }, { count: leadCount }, { count: pendingAccessCount }, { data: onboardingSessions }] = await Promise.all([
      supabase.from("brands").select("id,is_active,status"),
      supabase.from("brand_pharmacies").select("pharmacy_id,archived_at").is("archived_at", null),
      supabase.from("memberships").select("user_id").eq("status", "active"),
      supabase.from("commercial_leads").select("id", { count: "exact", head: true }),
      supabase.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
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
        <PageHeader eyebrow="Plateforme TR1" title="Administration TR1" description={`Bonjour ${profile.full_name}. Commencez par les dossiers qui demandent une action, puis entrez dans une marque si nécessaire.`} tone="dark" />

        <section className="space-y-3" aria-labelledby="platform-today">
          <SectionHeader id="platform-today" title="À traiter aujourd’hui" description="Uniquement les files existantes et réellement disponibles dans la plateforme." />
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/dashboard/admin/access-requests" className="rounded-[0.85rem] border border-[var(--tr1-line)] bg-white p-5 transition hover:border-[var(--tr1-orange)]/45">
              <p className="text-3xl font-semibold tracking-[-0.04em] tabular-nums">{pendingAccessCount ?? 0}</p>
              <p className="mt-2 font-medium">Demandes d’accès</p>
              <p className="mt-1 text-sm text-muted-foreground">En attente de décision.</p>
            </Link>
            <Link href="/dashboard/admin/onboarding" className="rounded-[0.85rem] border border-[var(--tr1-line)] bg-white p-5 transition hover:border-[var(--tr1-orange)]/45">
              <p className="text-3xl font-semibold tracking-[-0.04em] tabular-nums">{summary.onboardingsInProgress}</p>
              <p className="mt-2 font-medium">Déploiements en cours</p>
              <p className="mt-1 text-sm text-muted-foreground">Onboardings à reprendre ou vérifier.</p>
            </Link>
            <Link href="/dashboard/admin/leads" className="rounded-[0.85rem] border border-[var(--tr1-line)] bg-white p-5 transition hover:border-[var(--tr1-orange)]/45">
              <p className="text-3xl font-semibold tracking-[-0.04em] tabular-nums">{leadCount ?? 0}</p>
              <p className="mt-2 font-medium">Leads TR1</p>
              <p className="mt-1 text-sm text-muted-foreground">Dossiers commerciaux à qualifier.</p>
            </Link>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="État de la plateforme">
          {[
            { label: "Marques actives", value: summary.activeBrands },
            { label: "Marques en préparation", value: summary.preparingBrands },
            { label: "Pharmacies uniques", value: summary.uniquePharmacies },
            { label: "Relations marque/officine", value: summary.brandPharmacyRelations },
            { label: "Utilisateurs actifs", value: summary.uniqueActiveUsers },
          ].map((item) => (
            <Card key={item.label}><CardContent className="pt-5"><p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">{item.value}</p><p className="mt-1 text-sm font-medium">{item.label}</p></CardContent></Card>
          ))}
        </section>
        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Accès rapides</CardTitle>
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
                <div key={sessionItem.id} className="rounded-[0.75rem] border border-[var(--tr1-line)] bg-white p-3.5">
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
                      <Link href={`/dashboard/admin/onboarding?brand=${sessionItem.brandId}`}>Reprendre l’onboarding</Link>
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
  const periodStartDate = new Date(today);
  periodStartDate.setDate(periodStartDate.getDate() - 29);
  const periodStart = periodStartDate.toISOString().slice(0, 10);
  const todayDate = today.toISOString().slice(0, 10);
  const [{ data: contexts }, { data: dashboard }, { data: objectives }, { data: priorities }] = await Promise.all([
    supabase.rpc("get_my_brand_contexts"),
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: periodStart,
      target_period_end: todayDate,
      target_agent_id: null,
      target_territory_id: null,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: periodStart,
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
      <PageHeader eyebrow={`Vue d’ensemble · ${brand.name}`} title="Où en est la marque, et où agir maintenant ?" description="Votre briefing commercial : trajectoire, santé du réseau, écarts majeurs et décisions prioritaires." tone="dark" />

      <section aria-labelledby="objective-title" className="space-y-3">
        <SectionHeader id="objective-title" title="Trajectoire" description="Résultats, objectifs et projection sur les 30 derniers jours." action={<Button asChild variant="outline"><Link href="/dashboard/network/commercial">Analyser la performance <ArrowRight /></Link></Button>} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactCurrency(metrics.booked_revenue_ht)}</p><p className="text-sm font-medium">CA commandé HT</p><p className="text-xs text-muted-foreground">Commandes confirmées</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactCurrency(metrics.revenue_ht)}</p><p className="text-sm font-medium">CA facturé HT</p><p className="text-xs text-muted-foreground">Commandes facturées ou livrées</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactNumber(metrics.implantations)}</p><p className="text-sm font-medium">Implantations</p><p className="text-xs text-muted-foreground">Réalisées ce mois-ci</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-2xl font-semibold">{formatCompactPercent(metrics.first_reorder_rate)}</p><p className="text-sm font-medium">Premier réassort</p><p className="text-xs text-muted-foreground">Base éligible</p></CardContent></Card>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="network-health-title" className="space-y-3">
        <SectionHeader id="network-health-title" title="Santé du réseau" description="Les indicateurs qui montrent si la marque progresse réellement en pharmacie." action={<Button asChild variant="outline"><Link href="/dashboard/pharmacies">Ouvrir le réseau <ArrowRight /></Link></Button>} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pharmacies actives", formatCompactNumber(metrics.active_pharmacies), "Comptes actifs sur la période"],
            ["Premier réassort", formatCompactPercent(metrics.first_reorder_rate), "Transformation après implantation"],
            ["Comptes à risque", formatCompactNumber(metrics.at_risk_accounts), "Comptes qui demandent une action"],
            ["Comptes dormants", formatCompactNumber(metrics.dormant_accounts), "Comptes à réactiver"],
          ].map(([label, value, detail]) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--tr1-navy)] tabular-nums">{value}</p>
                <p className="mt-2 text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="now-title" className="space-y-3">
        <SectionHeader id="now-title" title="Signaux à examiner" description="Les signaux qui expliquent où la trajectoire se dégrade." action={<Button asChild variant="outline"><Link href="/dashboard/network/commercial">Comprendre les écarts <ArrowRight /></Link></Button>} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <Link key={action.label} href={`/dashboard/commercial-health?filter=${action.filter}`} className="rounded-[0.85rem] border border-[var(--tr1-line)] bg-white p-4 transition hover:border-[var(--tr1-orange)]/45 hover:shadow-[0_10px_24px_rgb(14_29_49/0.04)]">
              <div className="flex items-center justify-between"><action.icon className={`size-4 ${action.tone}`} /><strong className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">{action.value}</strong></div>
              <p className="mt-3 text-sm font-medium">{action.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Décisions à prendre</CardTitle><p className="mt-1 text-sm text-muted-foreground">Chaque priorité indique la raison et ouvre l’action suivante.</p></div><Badge variant="secondary">5 priorités max.</Badge></CardHeader>
          <CardContent className="space-y-3">
            {rows.length ? rows.map((row) => (
              <Link key={row.brand_pharmacy_id} href={`/dashboard/pharmacies/${row.brand_pharmacy_id}`} className="flex min-h-16 items-center justify-between gap-4 rounded-[0.75rem] border border-[var(--tr1-line)] bg-white p-3.5 hover:bg-muted/40">
                <div><p className="font-semibold">{row.pharmacy_name}</p><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Pourquoi :</span> {presentationLabel(row.health_status)} · {row.recommendation}</p></div>
                <div className="flex shrink-0 items-center gap-2"><span className="rounded-[0.5rem] bg-[#0f2740] px-3 py-1 text-xs font-semibold text-white tabular-nums">{row.priority_score}</span><ArrowRight className="size-4 text-[var(--tr1-orange)]" /></div>
              </Link>
            )) : <p className="py-8 text-center text-muted-foreground">Aucune urgence commerciale détectée.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Exécution terrain</CardTitle><p className="text-sm text-muted-foreground">Ce qui a réellement été réalisé sur la période.</p></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              ["Animations", formatCompactNumber(metrics.animations_completed)],
              ["Formations", formatCompactNumber(metrics.trainings_completed)],
              ["Missions terminées", formatCompactNumber(metrics.missions_completed)],
              ["Sell-out déclaré", `${formatCompactNumber(metrics.sell_out_units)} unités`],
              ["Assortiment moyen", formatCompactPercent(metrics.avg_distribution_rate)],
              ["Assortiment stratégique", formatCompactPercent(metrics.strategic_distribution_rate)],
            ].map(([label, value]) => <div key={label} className="rounded-[0.7rem] border border-[var(--tr1-line)] bg-muted/25 p-3"><p className="text-lg font-semibold tracking-[-0.02em] tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
          </CardContent>
          <CardContent className="pt-0"><Button asChild className="w-full" variant="outline"><Link href="/dashboard/missions">Piloter l’équipe & le terrain <ArrowRight /></Link></Button></CardContent>
        </Card>
      </section>
    </main>
  );
}
