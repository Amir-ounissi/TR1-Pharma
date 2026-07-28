import Link from "next/link";
import { BrandSettingsForm, StatusChangeForm } from "@/components/commercial/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";

type SearchParams = Promise<{ mode?: string }>;
const stages = ["targeted", "qualified", "contacted", "appointment_scheduled", "offer_sent", "pending_order", "implanted", "active", "to_develop", "dormant", "lost"];

export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const { mode = "kanban" } = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 30);
  const since = sinceDate.toISOString();
  const [{ data: rows }, { data: settings }, { count: openTasks }, { count: recentInteractions }] = await Promise.all([
    supabase.from("commercial_pipeline").select("*").eq("brand_id", brand.id).order("trade_name"),
    supabase.from("brand_settings").select("*").eq("brand_id", brand.id).single(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).in("status", ["open", "in_progress"]),
    supabase.from("interactions").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).gte("occurred_at", since).is("archived_at", null),
  ]);
  const pipeline = rows ?? [];
  const counters = stages.map((stage) => ({ stage, count: pipeline.filter((row) => row.commercial_status === stage).length }));
  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold">Pipeline commercial</h1><p className="text-muted-foreground">Pilotage de {brand.name}, sans automatisation de commandes.</p></div><div className="flex gap-2"><Button asChild variant={mode === "kanban" ? "default" : "outline"}><Link href="?mode=kanban">Colonnes</Link></Button><Button asChild variant={mode === "table" ? "default" : "outline"}><Link href="?mode=table">Tableau</Link></Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{counters.filter(({ stage }) => ["targeted", "qualified", "contacted", "appointment_scheduled", "offer_sent", "pending_order"].includes(stage)).map(({ stage, count }) => <Card key={stage}><CardContent className="pt-5"><p className="text-2xl font-semibold">{count}</p><p className="text-sm text-muted-foreground">{stage.replaceAll("_", " ")}</p></CardContent></Card>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[pipeline.filter((row) => row.has_no_next_action).length, "Sans prochaine action"], [openTasks ?? 0, "Tâches ouvertes"], [pipeline.filter((row) => row.is_overdue).length, "Comptes en retard"], [recentInteractions ?? 0, "Interactions sur 30 jours"]].map(([value, label]) => <Card key={label}><CardContent className="pt-5"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</div>
    {mode === "table" ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>Statut</TableHead><TableHead>Priorité</TableHead><TableHead>Agent</TableHead><TableHead>Dernière interaction</TableHead><TableHead>Prochaine action</TableHead></TableRow></TableHeader><TableBody>{pipeline.map((row) => <TableRow key={row.id}><TableCell><Link className="font-medium hover:underline" href={`/dashboard/pharmacies/${row.id}`}>{row.trade_name || row.legal_name}</Link><p className="text-xs text-muted-foreground">{row.city}</p></TableCell><TableCell><Badge variant="secondary">{row.commercial_status}</Badge></TableCell><TableCell>{row.priority_level} · {row.potential_level}</TableCell><TableCell>{row.agent_name || "Non affecté"}</TableCell><TableCell>{row.last_interaction_at ? new Date(row.last_interaction_at).toLocaleDateString("fr-FR") : "—"}</TableCell><TableCell className={row.is_overdue ? "text-destructive" : ""}>{row.has_no_next_action ? "Aucune action" : `${row.next_action_type ?? "Action"} · ${row.next_action_at ? new Date(row.next_action_at).toLocaleDateString("fr-FR") : "sans date"}`}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card> : <div className="flex gap-4 overflow-x-auto pb-4">{stages.map((stage) => <section key={stage} className="w-80 shrink-0"><div className="mb-3 flex items-center justify-between"><h2 className="font-medium">{stage.replaceAll("_", " ")}</h2><Badge>{pipeline.filter((row) => row.commercial_status === stage).length}</Badge></div><div className="space-y-3">{pipeline.filter((row) => row.commercial_status === stage).map((row) => <Card key={row.id}><CardHeader className="pb-2"><CardTitle className="text-base"><Link href={`/dashboard/pharmacies/${row.id}`} className="hover:underline">{row.trade_name || row.legal_name}</Link></CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>{row.city} · {row.agent_name || "Non affecté"}</p><p className={row.is_overdue ? "text-destructive" : "text-muted-foreground"}>{row.has_no_next_action ? "⚠ Sans prochaine action" : `${row.next_action_type} · ${row.next_action_at ? new Date(row.next_action_at).toLocaleDateString("fr-FR") : "sans date"}`}</p><StatusChangeForm brandPharmacyId={row.id} currentStatus={row.commercial_status} compact /></CardContent></Card>)}</div></section>)}</div>}
    {settings ? <Card><CardHeader><CardTitle>Paramètres commerciaux de la marque</CardTitle></CardHeader><CardContent><BrandSettingsForm settings={settings} /></CardContent></Card> : null}
  </div>;
}
