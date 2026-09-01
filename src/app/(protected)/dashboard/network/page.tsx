import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Gauge, Target, TrendingUp } from "lucide-react";
import { archiveObjectiveFormAction } from "@/app/(protected)/dashboard/network/actions";
import { ObjectiveForm } from "@/components/performance/objective-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { missionEffectivenessLabels, missionMaturityLabels, type MissionEffectivenessStatus, type MissionObservationMaturity } from "@/lib/mission-impact";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCompactPercent,
  formatMissionType,
  formatPerformanceMetric,
  formatPerformanceValue,
  objectiveTone,
  performanceViewLabels,
} from "@/lib/performance";
import { presentationLabel } from "@/lib/presentation";

type SearchParams = Promise<{
  view?: string;
  from?: string;
  to?: string;
  territory?: string;
  agent?: string;
  type?: string;
}>;

type ObjectiveRow = {
  objective_id: string;
  scope_type: "brand" | "territory" | "agent";
  territory_id: string | null;
  user_id: string | null;
  metric_key: string;
  period_start: string;
  period_end: string;
  target_value: number;
  realized_value: number;
  attainment_percent: number | null;
  gap_value: number;
  projected_value: number | null;
  note: string | null;
  updated_at: string;
};

type NetworkRow = {
  brand_pharmacy_id: string;
  pharmacy_name: string;
  territory_name: string | null;
  agent_user_id: string | null;
  agent_name: string | null;
  health_status: string;
  priority_score: number;
  recommendation: string;
  has_next_action: boolean;
  next_action_at: string | null;
  revenue_ht: number;
  implantations: number;
  reorders: number;
  distribution_rate: number;
  strategic_distribution_rate: number;
  missions_completed: number;
  animations_completed: number;
  trainings_completed: number;
  sell_out_units: number;
};

type TeamRow = {
  user_id: string;
  full_name: string;
  revenue_ht: number;
  implantations: number;
  reorders: number;
  first_reorder_rate: number;
  active_pharmacies: number;
  at_risk_accounts: number;
  dormant_accounts: number;
  without_next_action_count: number;
  avg_distribution_rate: number;
  strategic_distribution_rate: number;
  missions_completed: number;
  animations_completed: number;
  trainings_completed: number;
  sell_out_units: number;
  participants_count: number;
  complete_data_rate: number;
};

type MissionImpactListRow = {
  mission_id: string;
  mission_date: string;
  mission_title: string;
  mission_type: string;
  observation_maturity: MissionObservationMaturity;
  mission_effectiveness_status: MissionEffectivenessStatus;
  mission_total_cost: number | null;
  revenue_30d_after: number | null;
  assigned_user_id: string | null;
};

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return toDateInput(fallback);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? toDateInput(fallback) : value;
}

function scopeLabel(scope: ObjectiveRow["scope_type"]) {
  if (scope === "brand") return "Marque";
  if (scope === "territory") return "Territoire";
  return "Agent";
}

export default async function NetworkPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const view = ["overview", "network", "missions", "team"].includes(query.view ?? "") ? (query.view as keyof typeof performanceViewLabels) : "overview";
  const from = parseDate(query.from, monthStart);
  const to = parseDate(query.to, today);
  const territoryId = query.territory && query.territory !== "all" ? query.territory : null;
  const agentId = query.agent && query.agent !== "all" ? query.agent : null;
  const missionType = query.type && query.type !== "all" ? query.type : null;
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const canManageObjectives = ["tr1_manager", "brand_admin", "super_admin"].includes(role);
  const canReadTeam = ["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role);
  if (!canReadTeam) notFound();

  const [
    { data: overview },
    { data: objectives },
    { data: networkRows },
    { data: teamRows },
    { data: priorities },
    { data: missionSummary },
    { data: missionRows },
    { data: territories },
    { data: memberships },
  ] = await Promise.all([
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: territoryId,
      target_agent_id: agentId,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: from,
      target_filter_end: to,
      target_scope_type: null,
      target_territory_id: territoryId,
      target_agent_id: agentId,
    }),
    supabase.rpc("get_performance_network", {
      target_brand_id: brand.id,
      target_period_start: from,
      target_period_end: to,
      target_territory_id: territoryId,
      target_agent_id: agentId,
    }),
    canReadTeam
      ? supabase.rpc("get_performance_team", {
          target_brand_id: brand.id,
          target_period_start: from,
          target_period_end: to,
          target_territory_id: territoryId,
        })
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_commercial_priorities", {
      target_brand_id: brand.id,
      target_filter: null,
      result_limit: 6,
    }),
    supabase.rpc("get_mission_impact_dashboard_filtered", {
      target_brand_id: brand.id,
      target_period_days: Math.max(30, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1),
      target_mission_type: missionType,
      target_assigned_user_id: agentId,
      target_brand_pharmacy_id: null,
      target_territory_id: territoryId,
    }),
    supabase.rpc("get_mission_impacts", {
      target_brand_id: brand.id,
      target_period_days: Math.max(30, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1),
      target_mission_type: missionType,
      target_assigned_user_id: agentId,
      target_brand_pharmacy_id: null,
      target_territory_id: territoryId,
    }),
    supabase.from("territories").select("id,name").eq("brand_id", brand.id).is("archived_at", null).order("name"),
    supabase
      .from("memberships")
      .select("user_id,roles!inner(key),users(user_profiles(full_name))")
      .eq("brand_id", brand.id)
      .eq("status", "active")
      .eq("roles.key", "agent"),
  ]);

  const objectiveRows = (objectives ?? []) as ObjectiveRow[];
  const topObjectives = objectiveRows
    .filter((objective) => ["revenue_ht", "implantations", "first_reorder_rate", "reorders"].includes(objective.metric_key))
    .slice(0, 4);
  const summary = (overview ?? {}) as Record<string, number | null>;
  const agentOptions = (memberships ?? []).map((membership) => {
    const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
    const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
    return { id: membership.user_id, name: profile?.full_name ?? "Agent" };
  });

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Performance · ${brand.name}`}
        title="Où en sommes-nous et où agir maintenant ?"
        description="Objectif, activité terrain, résultat observé et prochaine action sont enfin lus dans la même continuité."
        tone="dark"
      />

      <nav className="flex flex-wrap gap-2" aria-label="Lectures performance">
        {Object.entries(performanceViewLabels).map(([key, label]) => (
          <Button key={key} asChild size="sm" variant={view === key ? "default" : "outline"}>
            <Link href={`/dashboard/network?view=${key}&from=${from}&to=${to}${territoryId ? `&territory=${territoryId}` : ""}${agentId ? `&agent=${agentId}` : ""}`}>
              {label}
            </Link>
          </Button>
        ))}
      </nav>

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-5 xl:grid-cols-6">
            <input type="hidden" name="view" value={view} />
            <input className="h-10 rounded-md border bg-background px-3" name="from" type="date" defaultValue={from} />
            <input className="h-10 rounded-md border bg-background px-3" name="to" type="date" defaultValue={to} />
            <select className="h-10 rounded-md border bg-background px-3" name="territory" defaultValue={territoryId ?? "all"}>
              <option value="all">Tous les territoires</option>
              {territories?.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3" name="agent" defaultValue={agentId ?? "all"}>
              <option value="all">Toute l’équipe</option>
              {agentOptions.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
            {view === "missions" ? (
              <select className="h-10 rounded-md border bg-background px-3" name="type" defaultValue={missionType ?? "all"}>
                <option value="all">Tous types de mission</option>
                {["animation", "training", "commercial_visit", "prospecting_visit", "merchandising", "pharmacy_audit", "reactivation", "product_launch", "stock_check", "relationship_visit", "other"].map((type) => (
                  <option key={type} value={type}>{formatMissionType(type)}</option>
                ))}
              </select>
            ) : null}
            <Button>Appliquer</Button>
          </form>
        </CardContent>
      </Card>

      {view === "overview" ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Target} label="CA HT" value={formatCompactCurrency(summary.revenue_ht)} detail="Sur la période filtrée" />
            <MetricCard icon={TrendingUp} label="Implantations" value={formatCompactNumber(summary.implantations)} detail="Commandes initiales validées" />
            <MetricCard icon={Gauge} label="Premier réassort" value={formatCompactPercent(summary.first_reorder_rate)} detail="Base éligible uniquement" />
            <MetricCard icon={ArrowRight} label="Pharmacies actives" value={formatCompactNumber(summary.active_pharmacies)} detail="Portefeuille vivant" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Objectifs principaux</CardTitle>
                <CardDescription>Chaque objectif garde sa période propre, son historique et son calcul d’atteinte.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topObjectives.length ? topObjectives.map((objective) => (
                  <div key={objective.objective_id} className="rounded-[0.45rem] border border-[var(--tr1-line)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--tr1-orange)]">
                          {scopeLabel(objective.scope_type)} · {formatPerformanceMetric(objective.metric_key)}
                        </p>
                        <p className={`mt-2 text-2xl font-semibold ${objectiveTone(objective.attainment_percent)}`}>
                          {objective.attainment_percent == null ? "—" : `${objective.attainment_percent.toFixed(1)} %`}
                        </p>
                      </div>
                      {canManageObjectives ? (
                        <form action={archiveObjectiveFormAction}>
                          <input type="hidden" name="objectiveId" value={objective.objective_id} />
                          <Button size="sm" variant="ghost">Archiver</Button>
                        </form>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                      <Detail label="Objectif" value={formatPerformanceValue(objective.metric_key, objective.target_value)} />
                      <Detail label="Réalisé" value={formatPerformanceValue(objective.metric_key, objective.realized_value)} />
                      <Detail label="Écart" value={formatPerformanceValue(objective.metric_key, objective.gap_value)} />
                      <Detail label="Projection" value={objective.projected_value == null ? "—" : formatPerformanceValue(objective.metric_key, objective.projected_value)} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(objective.period_start))}
                      {" → "}
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(objective.period_end))}
                    </p>
                    {objective.note ? <p className="mt-2 text-sm text-muted-foreground">{objective.note}</p> : null}
                  </div>
                )) : <p className="text-sm text-muted-foreground">Aucun objectif correspondant à ce périmètre.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activité terrain</CardTitle>
                <CardDescription>Ce qui a été réellement exécuté pendant la période.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Detail label="Missions terminées" value={formatCompactNumber(summary.missions_completed)} />
                <Detail label="Animations" value={formatCompactNumber(summary.animations_completed)} />
                <Detail label="Formations" value={formatCompactNumber(summary.trainings_completed)} />
                <Detail label="Sell-out déclaré" value={`${formatCompactNumber(summary.sell_out_units)} unités`} />
                <Detail label="DN moyenne" value={formatCompactPercent(summary.avg_distribution_rate)} />
                <Detail label="DN stratégique" value={formatCompactPercent(summary.strategic_distribution_rate)} />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>À traiter maintenant</CardTitle>
                <CardDescription>Réutilisation directe du moteur de priorité existant.</CardDescription>
              </CardHeader>
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
                    <span className="rounded-[0.25rem] bg-[var(--tr1-navy)] px-3 py-1 font-mono text-xs font-bold text-white">{String(row.priority_score)}</span>
                  </Link>
                )) : <p className="text-sm text-muted-foreground">Aucune priorité critique détectée.</p>}
              </CardContent>
            </Card>

            {canManageObjectives ? (
              <Card>
                <CardHeader>
                  <CardTitle>Nouveau jalon</CardTitle>
                  <CardDescription>Définissez un objectif marque, territoire ou agent sans recréer de KPI parallèle.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ObjectiveForm periodStart={from} periodEnd={to} territories={territories ?? []} agents={agentOptions} />
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      ) : null}

      {view === "network" ? (
        <Card>
          <CardHeader>
            <CardTitle>Réseau / Pharmacies</CardTitle>
            <CardDescription>Où le résultat se construit, où ça ralentit et où agir immédiatement.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pharmacie</TableHead>
                  <TableHead>Santé</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Implant.</TableHead>
                  <TableHead>Réassorts</TableHead>
                  <TableHead>DN</TableHead>
                  <TableHead>Terrain</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((networkRows ?? []) as NetworkRow[]).map((row) => (
                  <TableRow key={row.brand_pharmacy_id}>
                    <TableCell>
                      <Link href={`/dashboard/pharmacies/${row.brand_pharmacy_id}?tab=performance`} className="font-medium hover:underline">{row.pharmacy_name}</Link>
                      <p className="text-xs text-muted-foreground">{row.territory_name || "Sans territoire"} · {row.agent_name || "Non affectée"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{presentationLabel(row.health_status)}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">Score {row.priority_score}</p>
                    </TableCell>
                    <TableCell>{formatCompactCurrency(row.revenue_ht)}</TableCell>
                    <TableCell>{row.implantations}</TableCell>
                    <TableCell>{row.reorders}</TableCell>
                    <TableCell>
                      {formatCompactPercent(row.distribution_rate)}
                      <p className="text-xs text-muted-foreground">Strat. {formatCompactPercent(row.strategic_distribution_rate)}</p>
                    </TableCell>
                    <TableCell>
                      {row.missions_completed} mission(s)
                      <p className="text-xs text-muted-foreground">
                        {row.animations_completed} animation(s) · {row.sell_out_units ?? 0} unités
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{row.recommendation}</p>
                      <p className="text-xs text-muted-foreground">{row.has_next_action ? "Suivi déjà planifié" : "Aucune prochaine action"}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {view === "missions" ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Target} label="Missions terminées" value={formatCompactNumber((missionSummary as Record<string, number | null>)?.missions_completed)} detail="Période filtrée" />
            <MetricCard icon={TrendingUp} label="Sell-out déclaré" value={`${formatCompactNumber((missionSummary as Record<string, number | null>)?.sell_out_units)} unités`} detail="Animations renseignées" />
            <MetricCard icon={Gauge} label="Réassort J+60" value={formatCompactPercent((missionSummary as Record<string, number | null>)?.reorder_rate_60d)} detail="Observation mature" />
            <MetricCard icon={ArrowRight} label="CA observé / coût" value={(missionSummary as Record<string, number | null>)?.observed_revenue_cost_ratio == null ? "—" : `${Number((missionSummary as Record<string, number | null>).observed_revenue_cost_ratio).toFixed(2)}×`} detail="Sans causalité attribuée" />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Missions observées</CardTitle>
              <CardDescription>Lecture harmonisée des impacts terrain, sans statuts techniques bruts ni raccourci causal.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mission</TableHead>
                    <TableHead>Maturité</TableHead>
                    <TableHead>Lecture</TableHead>
                    <TableHead>Coût</TableHead>
                    <TableHead>CA observé J+30</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((missionRows ?? []) as MissionImpactListRow[]).map((row) => (
                    <TableRow key={row.mission_id}>
                      <TableCell>{new Date(row.mission_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell>
                        <p className="font-medium">{row.mission_title}</p>
                        <p className="text-xs text-muted-foreground">{formatMissionType(row.mission_type)}</p>
                      </TableCell>
                      <TableCell>{missionMaturityLabels[row.observation_maturity]}</TableCell>
                      <TableCell><Badge variant="secondary">{missionEffectivenessLabels[row.mission_effectiveness_status]}</Badge></TableCell>
                      <TableCell>{formatCompactCurrency(row.mission_total_cost)}</TableCell>
                      <TableCell>{formatCompactCurrency(row.revenue_30d_after)}</TableCell>
                      <TableCell><Button asChild size="sm" variant="outline"><Link href={`/dashboard/missions/${row.mission_id}`}>Analyser</Link></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {view === "team" ? (
        <Card>
          <CardHeader>
            <CardTitle>Performance équipe</CardTitle>
            <CardDescription>Comparer sans classer brutalement, pour comprendre qui a besoin d’aide et sur quel levier agir.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Implant.</TableHead>
                  <TableHead>Réassorts</TableHead>
                  <TableHead>1er réassort</TableHead>
                  <TableHead>Portefeuille</TableHead>
                  <TableHead>Missions</TableHead>
                  <TableHead>Qualité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((teamRows ?? []) as TeamRow[]).map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <Link href={`/dashboard/network?view=overview&from=${from}&to=${to}&agent=${row.user_id}${territoryId ? `&territory=${territoryId}` : ""}`} className="font-medium hover:underline">
                        {row.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.active_pharmacies} actives · {row.at_risk_accounts} à risque</p>
                    </TableCell>
                    <TableCell>{formatCompactCurrency(row.revenue_ht)}</TableCell>
                    <TableCell>{row.implantations}</TableCell>
                    <TableCell>{row.reorders}</TableCell>
                    <TableCell>{formatCompactPercent(row.first_reorder_rate)}</TableCell>
                    <TableCell>
                      {row.without_next_action_count} sans action
                      <p className="text-xs text-muted-foreground">Dormants {row.dormant_accounts}</p>
                    </TableCell>
                    <TableCell>
                      {row.missions_completed} mission(s)
                      <p className="text-xs text-muted-foreground">{row.animations_completed} animations · {row.trainings_completed} formations</p>
                    </TableCell>
                    <TableCell>
                      {formatCompactPercent(row.complete_data_rate)}
                      <p className="text-xs text-muted-foreground">DN strat. {formatCompactPercent(row.strategic_distribution_rate)}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </main>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
