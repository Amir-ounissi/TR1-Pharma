import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ q?:string; status?:string; type?:string }> }) {
  const filters=await searchParams; const {supabase,brand}=await requireActiveBrand();
  let query=supabase.from("missions").select("id,title,mission_type,status,priority,scheduled_start_at,report_due_at,pharmacies(legal_name,trade_name,city)").eq("brand_id",brand.id).is("archived_at",null).order("scheduled_start_at",{ascending:false}).limit(100);
  if(filters.q) query=query.ilike("title",`%${filters.q}%`); if(filters.status) query=query.eq("status",filters.status); if(filters.type) query=query.eq("mission_type",filters.type);
  const {data:missions}=await query;
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Missions terrain</h1><p className="text-muted-foreground">Planning, affectations et rapports de {brand.name}.</p></div><Button asChild><Link href="/dashboard/missions/new">Nouvelle mission</Link></Button></div><Card><CardHeader><CardTitle>Liste et planning</CardTitle></CardHeader><CardContent><form className="mb-4 grid gap-2 sm:grid-cols-3"><Input name="q" placeholder="Rechercher" defaultValue={filters.q}/><Input name="status" placeholder="Statut technique" defaultValue={filters.status}/><Button variant="outline">Filtrer</Button></form><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Mission</TableHead><TableHead>Pharmacie</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{(missions??[]).map((mission)=>{const pharmacy=Array.isArray(mission.pharmacies)?mission.pharmacies[0]:mission.pharmacies;return <TableRow key={mission.id}><TableCell><Link className="font-medium hover:underline" href={`/dashboard/missions/${mission.id}`}>{mission.title}</Link></TableCell><TableCell>{pharmacy?.trade_name||pharmacy?.legal_name}<p className="text-xs text-muted-foreground">{pharmacy?.city}</p></TableCell><TableCell>{mission.scheduled_start_at?new Date(mission.scheduled_start_at).toLocaleString("fr-FR"):"À planifier"}</TableCell><TableCell>{mission.mission_type}</TableCell><TableCell><Badge variant={mission.status==="report_pending"?"destructive":"secondary"}>{mission.status}</Badge></TableCell></TableRow>})}</TableBody></Table></div></CardContent></Card></div>;
}
