import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MissionImpactTracker } from "@/components/missions/mission-impact-tracker";
import { requireActiveBrand } from "@/lib/auth";
import { missionEffectivenessLabels, missionMaturityLabels, type MissionEffectivenessStatus, type MissionObservationMaturity } from "@/lib/mission-impact";

const money = (value: number | null | undefined) => value == null ? "—" : `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

type MissionTypeImpactRow = {
  mission_type: string;
  sample_size: number;
  low_sample: boolean;
  average_cost: number | null;
  average_sell_out: number | null;
  average_days_to_order: number | null;
  reorder_rate_60d: number | null;
};

type MissionImpactListRow = {
  mission_id: string;
  mission_date: string;
  mission_title: string;
  observation_maturity: MissionObservationMaturity;
  mission_effectiveness_status: MissionEffectivenessStatus;
  mission_total_cost: number | null;
  revenue_30d_after: number | null;
};

type AssigneeImpactRow = {
  assigned_user_id: string | null;
  full_name: string;
  missions_completed: number;
  completion_rate: number | null;
  average_sell_out: number | null;
  average_contacts: number | null;
  average_cost: number | null;
  orders_observed: number;
  average_days_to_order: number | null;
  reorder_rate_60d: number | null;
  complete_data_rate: number;
};

export default async function MissionPerformancePage({ searchParams }: { searchParams: Promise<{ period?: string; type?: string; territory?: string; assignee?: string; pharmacy?: string }> }) {
  const query = await searchParams;
  const period = [30, 60, 90, 180, 365].includes(Number(query.period)) ? Number(query.period) : 90;
  const missionType = query.type && query.type !== "all" ? query.type : null;
  const territoryId = query.territory && query.territory !== "all" ? query.territory : null;
  const assigneeId = query.assignee && query.assignee !== "all" ? query.assignee : null;
  const pharmacyId = query.pharmacy && query.pharmacy !== "all" ? query.pharmacy : null;
  const { supabase, brand } = await requireActiveBrand();
  const [{ data: dashboard }, { data: rows }, { data: typeRows }, { data: assigneeRows }, { data: territories }, { data: pharmacies }, { data: memberships }] = await Promise.all([
    supabase.rpc("get_mission_impact_dashboard_filtered", { target_brand_id: brand.id, target_period_days: period, target_mission_type: missionType, target_assigned_user_id: assigneeId, target_brand_pharmacy_id: pharmacyId, target_territory_id: territoryId }),
    supabase.rpc("get_mission_impacts", { target_brand_id: brand.id, target_period_days: period, target_mission_type: missionType, target_assigned_user_id: assigneeId, target_brand_pharmacy_id: pharmacyId, target_territory_id: territoryId }),
    supabase.rpc("get_mission_type_impact", { target_brand_id: brand.id, target_period_days: Math.max(period, 180) }),
    supabase.rpc("get_mission_assignee_impact", { target_brand_id: brand.id, target_period_days: Math.max(period, 180) }),
    supabase.from("territories").select("id,name").eq("brand_id", brand.id).is("archived_at", null).order("name"),
    supabase.from("brand_pharmacies").select("id,pharmacies(trade_name,legal_name)").eq("brand_id", brand.id).is("archived_at", null).limit(200),
    supabase.from("memberships").select("user_id,users(user_profiles(full_name))").eq("brand_id", brand.id).eq("status", "active"),
  ]);
  const summary = (dashboard ?? {}) as Record<string, number | null>;

  return <div className="space-y-6">
    <MissionImpactTracker eventName="mission_performance_dashboard_viewed" />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Impact des missions</h1><p className="text-muted-foreground">Résultats observés avant et après intervention, sans attribution causale.</p></div>
      <div className="flex flex-wrap gap-2">{[30, 60, 90, 180, 365].map((days) => <Button key={days} size="sm" variant={period === days ? "default" : "outline"} asChild><Link href={`?period=${days}${missionType ? `&type=${missionType}` : ""}`}>{days} j</Link></Button>)}</div>
    </div>
    <Card><CardHeader><CardTitle>Filtres</CardTitle><CardDescription>Affinez par type, territoire, intervenant ou pharmacie.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-5">
      <input type="hidden" name="period" value={period} />
      <select className="h-10 rounded-md border bg-background px-3" name="type" defaultValue={missionType ?? "all"}><option value="all">Tous les types</option>{["animation","training","commercial_visit","prospecting_visit","merchandising","pharmacy_audit","reactivation","product_launch","stock_check","relationship_visit","other"].map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <select className="h-10 rounded-md border bg-background px-3" name="territory" defaultValue={territoryId ?? "all"}><option value="all">Tous les territoires</option>{territories?.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}</select>
      <select className="h-10 rounded-md border bg-background px-3" name="assignee" defaultValue={assigneeId ?? "all"}><option value="all">Tous les intervenants</option>{memberships?.map((membership) => { const user = Array.isArray(membership.users) ? membership.users[0] : membership.users; const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles; return <option key={membership.user_id} value={membership.user_id}>{profile?.full_name ?? "Utilisateur"}</option>; })}</select>
      <select className="h-10 rounded-md border bg-background px-3" name="pharmacy" defaultValue={pharmacyId ?? "all"}><option value="all">Toutes les pharmacies</option>{pharmacies?.map((relation) => { const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies; return <option key={relation.id} value={relation.id}>{pharmacy?.trade_name || pharmacy?.legal_name}</option>; })}</select>
      <Button type="submit">Appliquer</Button>
    </form></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Missions terminées" value={String(summary.missions_completed ?? 0)} />
      <Metric label="Coût total" value={money(summary.total_cost)} />
      <Metric label="Sell-out déclaré" value={`${summary.sell_out_units ?? 0} unités`} />
      <Metric label="Ratio CA J+60 / coût" value={summary.observed_revenue_cost_ratio == null ? "—" : `${Number(summary.observed_revenue_cost_ratio).toFixed(2)}×`} />
      <Metric label="Commandes sous 30 j" value={summary.order_rate_30d == null ? "Échantillon immature" : `${summary.order_rate_30d} %`} />
      <Metric label="Réassorts sous 60 j" value={summary.reorder_rate_60d == null ? "Échantillon immature" : `${summary.reorder_rate_60d} %`} />
      <Metric label="Sans résultat observable" value={String(summary.without_observable_result ?? 0)} />
      <Metric label="À revoir" value={String(summary.to_review ?? 0)} />
    </div>
    <Card><CardHeader><CardTitle>Comparaison par type</CardTitle><CardDescription>Les groupes de moins de cinq missions sont signalés ; aucune comparaison causale n’est effectuée.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Échantillon</TableHead><TableHead>Coût moyen</TableHead><TableHead>Sell-out moyen</TableHead><TableHead>Délai commande</TableHead><TableHead>Réassort J+60</TableHead></TableRow></TableHeader><TableBody>{((typeRows ?? []) as MissionTypeImpactRow[]).map((row) => <TableRow key={row.mission_type}><TableCell><Link className="underline-offset-4 hover:underline" href={`?period=${period}&type=${row.mission_type}`}>{row.mission_type}</Link></TableCell><TableCell>{row.sample_size} {row.low_sample ? <Badge variant="outline">faible</Badge> : null}</TableCell><TableCell>{money(row.average_cost)}</TableCell><TableCell>{row.average_sell_out ?? "—"}</TableCell><TableCell>{row.average_days_to_order == null ? "—" : `${row.average_days_to_order} j`}</TableCell><TableCell>{row.reorder_rate_60d == null ? "—" : `${row.reorder_rate_60d} %`}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle>Lecture par intervenant</CardTitle><CardDescription>Métriques brutes contextualisées, sans classement automatique sur le chiffre d’affaires.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Intervenant</TableHead><TableHead>Missions</TableHead><TableHead>Complétion</TableHead><TableHead>Sell-out moyen</TableHead><TableHead>Contacts moyens</TableHead><TableHead>Coût moyen</TableHead><TableHead>Commandes</TableHead><TableHead>Réassort J+60</TableHead><TableHead>Qualité complète</TableHead></TableRow></TableHeader><TableBody>{((assigneeRows ?? []) as AssigneeImpactRow[]).map((row) => <TableRow key={row.assigned_user_id ?? "unassigned"}><TableCell>{row.full_name}</TableCell><TableCell>{row.missions_completed}</TableCell><TableCell>{row.completion_rate == null ? "—" : `${row.completion_rate} %`}</TableCell><TableCell>{row.average_sell_out ?? "—"}</TableCell><TableCell>{row.average_contacts ?? "—"}</TableCell><TableCell>{money(row.average_cost)}</TableCell><TableCell>{row.orders_observed}</TableCell><TableCell>{row.reorder_rate_60d == null ? "—" : `${row.reorder_rate_60d} %`}</TableCell><TableCell>{row.complete_data_rate} %</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Card><CardHeader><CardTitle>Missions observées</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Mission</TableHead><TableHead>Maturité</TableHead><TableHead>Statut descriptif</TableHead><TableHead>Coût</TableHead><TableHead>CA J+30</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{((rows ?? []) as MissionImpactListRow[]).map((row) => <TableRow key={row.mission_id}><TableCell>{new Date(row.mission_date).toLocaleDateString("fr-FR")}</TableCell><TableCell>{row.mission_title}</TableCell><TableCell>{missionMaturityLabels[row.observation_maturity]}</TableCell><TableCell><Badge variant="secondary">{missionEffectivenessLabels[row.mission_effectiveness_status]}</Badge></TableCell><TableCell>{money(row.mission_total_cost)}</TableCell><TableCell>{money(row.revenue_30d_after)}</TableCell><TableCell><Button asChild size="sm" variant="outline"><Link href={`/dashboard/missions/${row.mission_id}`}>Analyser</Link></Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{value}</CardContent></Card>;
}
