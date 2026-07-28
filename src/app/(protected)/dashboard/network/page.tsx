import Link from "next/link";
import { recalculateActivityAction } from "@/app/(protected)/dashboard/orders/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";
import { formatCurrency } from "@/lib/reference-data";

type SearchParams = Promise<{ segment?: string }>;
export default async function NetworkPage({ searchParams }: { searchParams: SearchParams }) {
  const { segment = "all" } = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const { data: recentHistory } = await supabase.from("brand_pharmacy_activity_history").select("brand_pharmacy_id").eq("brand_id", brand.id).eq("previous_activity_status", "dormant").eq("new_activity_status", "active").gte("calculated_at", recentCutoff.toISOString());
  const reactivatedIds = [...new Set((recentHistory ?? []).map((event) => event.brand_pharmacy_id))];
  let query = supabase.from("order_performance_dashboard").select("*").eq("brand_id", brand.id).order("trade_name");
  if (["never_ordered","active","watch","at_risk","dormant","lost"].includes(segment)) query = query.eq("current_activity_status", segment);
  if (segment === "without_reorder") query = query.eq("implanted_without_reorder", true);
  if (segment === "reorder_due") query = query.eq("reorder_forecast_status", "due");
  if (segment === "reorder_overdue") query = query.eq("reorder_forecast_status", "overdue");
  if (segment === "low_dn") query = query.lt("distribution_rate", 50);
  if (segment === "strategic_incomplete") query = query.lt("strategic_distribution_rate", 100);
  if (segment === "reactivated_recently") query = query.in("brand_pharmacy_id", reactivatedIds.length ? reactivatedIds : ["00000000-0000-0000-0000-000000000000"]);
  const [{ data: rows }, { data: monthOrders }, { data: dashboardRows }] = await Promise.all([
    query,
    supabase.from("orders").select("net_amount_ht,is_initial_order,is_reorder,order_date,order_status").eq("brand_id", brand.id).gte("order_date", monthStart.toISOString()).in("order_status", ["invoiced","partially_delivered","delivered"]),
    supabase.from("order_performance_dashboard").select("*").eq("brand_id", brand.id),
  ]);
  const network = rows ?? [];
  const dashboard = dashboardRows ?? [];
  const month = monthOrders ?? [];
  const metrics = [
    [month.filter((order) => order.is_initial_order).length, "Implantations du mois"],
    [month.filter((order) => order.is_reorder).length, "Réassorts du mois"],
    [formatCurrency(month.reduce((sum, order) => sum + Number(order.net_amount_ht), 0)), "CA HT du mois"],
    [dashboard.filter((row) => row.implanted_without_reorder).length, "Sans premier réassort"],
    [dashboard.filter((row) => row.current_activity_status === "at_risk").length, "Comptes à risque"],
    [dashboard.filter((row) => row.current_activity_status === "dormant").length, "Comptes dormants"],
    [reactivatedIds.length, "Comptes réactivés"],
    [dashboard.filter((row) => row.expected_next_order_at && new Date(row.expected_next_order_at) >= now && new Date(row.expected_next_order_at) <= weekEnd).length, "Réassorts attendus cette semaine"],
    [`${dashboard.length ? (dashboard.reduce((sum, row) => sum + Number(row.distribution_rate), 0) / dashboard.length).toFixed(1) : "0"}%`, "DN moyenne"],
    [formatCurrency(dashboard.length ? dashboard.reduce((sum, row) => sum + Number(row.average_order_value_ht), 0) / dashboard.length : 0), "Panier moyen"],
  ];
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold">Performance réseau</h1><p className="text-muted-foreground">Activité, réassorts estimés et distribution numérique.</p></div><form action={recalculateActivityAction}><Button variant="outline">Recalculer l’activité</Button></form></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([value,label]) => <Card key={label}><CardContent className="pt-5"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</div>
    <Card><CardContent className="pt-6"><form className="flex gap-3"><Select name="segment" defaultValue={segment}><SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tout le réseau</SelectItem><SelectItem value="never_ordered">Jamais commandé</SelectItem><SelectItem value="without_reorder">Implanté sans réassort</SelectItem><SelectItem value="active">Actif</SelectItem><SelectItem value="watch">À surveiller</SelectItem><SelectItem value="at_risk">À risque</SelectItem><SelectItem value="dormant">Dormant</SelectItem><SelectItem value="reactivated_recently">Réactivé récemment</SelectItem><SelectItem value="reorder_due">Réassort attendu</SelectItem><SelectItem value="reorder_overdue">Réassort en retard</SelectItem><SelectItem value="low_dn">DN faible</SelectItem><SelectItem value="strategic_incomplete">DN stratégique incomplète</SelectItem></SelectContent></Select><Button>Filtrer</Button></form></CardContent></Card>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>Activité</TableHead><TableHead>Commandes</TableHead><TableHead>CA HT</TableHead><TableHead>Panier moyen</TableHead><TableHead>Prochain réassort estimé</TableHead><TableHead>DN</TableHead></TableRow></TableHeader><TableBody>{network.map((row) => <TableRow key={row.brand_pharmacy_id}><TableCell><Link href={`/dashboard/pharmacies/${row.brand_pharmacy_id}?tab=performance`} className="font-medium hover:underline">{row.trade_name || row.legal_name}</Link><p className="text-xs text-muted-foreground">{row.city}</p></TableCell><TableCell><Badge variant="secondary">{row.current_activity_status}</Badge></TableCell><TableCell>{row.valid_order_count} · {row.reorder_count} réassort(s)</TableCell><TableCell>{formatCurrency(row.total_revenue_net_ht)}</TableCell><TableCell>{formatCurrency(row.average_order_value_ht)}</TableCell><TableCell>{row.expected_next_order_at ? new Date(row.expected_next_order_at).toLocaleDateString("fr-FR") : "Inconnue"}<p className="text-xs text-muted-foreground">Estimation · {row.reorder_forecast_status}</p></TableCell><TableCell>{Number(row.distribution_rate).toFixed(1)}%<p className="text-xs text-muted-foreground">Stratégique {Number(row.strategic_distribution_rate).toFixed(1)}%</p></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}
