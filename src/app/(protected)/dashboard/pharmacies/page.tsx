import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";
import { activityStatuses, commercialStatuses, labels, potentialLevels, priorityLevels } from "@/lib/reference-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PharmaciesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 20;
  let query = supabase.from("brand_pharmacy_directory").select("*", { count: "exact" }).eq("brand_id", brand.id).is("archived_at", null);
  if (search) query = query.ilike("search_text", `%${search}%`);
  for (const [parameter, column] of [["status", "commercial_status"], ["activity", "activity_status"], ["priority", "priority_level"], ["potential", "potential_level"]] as const) {
    const value = params[parameter];
    if (typeof value === "string" && value !== "all") query = query.eq(column, value);
  }
  for (const [parameter, column] of [["city", "city"], ["postalCode", "postal_code"], ["agent", "agent_name"], ["territory", "territory_name"], ["group", "pharmacy_group_name"]] as const) {
    const value = params[parameter];
    if (typeof value === "string" && value.trim()) query = query.ilike(column, `%${value.trim()}%`);
  }
  const sortableColumns = ["trade_name", "city", "commercial_status", "priority_level", "potential_level"] as const;
  const requestedSort = typeof params.sort === "string" ? params.sort : "trade_name";
  const sort = sortableColumns.includes(requestedSort as typeof sortableColumns[number]) ? requestedSort : "trade_name";
  const descending = params.direction === "desc";
  const { data, count, error } = await query.order(sort, { ascending: !descending }).range((page - 1) * pageSize, page * pageSize - 1);
  const rows = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Référentiel officinal</h1><p className="text-muted-foreground">{count ?? 0} relation(s) pour {brand.name}.</p></div><Button asChild><Link href="/dashboard/pharmacies/new"><Plus className="size-4" />Nouvelle pharmacie</Link></Button></div>
    <Card><CardContent className="pt-6"><form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"><div className="relative md:col-span-2"><Search className="text-muted-foreground absolute left-3 top-2.5 size-4" /><Input name="q" defaultValue={search} className="pl-9" placeholder="Nom, ville, CIP, SIRET…" /></div><Select name="status" defaultValue={typeof params.status === "string" ? params.status : "all"}><SelectTrigger className="w-full"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{commercialStatuses.map((status) => <SelectItem key={status} value={status}>{labels.commercialStatus[status]}</SelectItem>)}</SelectContent></Select><Select name="activity" defaultValue={typeof params.activity === "string" ? params.activity : "all"}><SelectTrigger className="w-full"><SelectValue placeholder="Activité" /></SelectTrigger><SelectContent><SelectItem value="all">Toute activité</SelectItem>{activityStatuses.map((status) => <SelectItem key={status} value={status}>{labels.activityStatus[status]}</SelectItem>)}</SelectContent></Select><Input name="city" defaultValue={typeof params.city === "string" ? params.city : ""} placeholder="Ville" /><Input name="postalCode" defaultValue={typeof params.postalCode === "string" ? params.postalCode : ""} placeholder="Code postal" /><Select name="priority" defaultValue={typeof params.priority === "string" ? params.priority : "all"}><SelectTrigger className="w-full"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Toute priorité</SelectItem>{priorityLevels.map((value) => <SelectItem key={value} value={value}>{labels.priorityLevel[value]}</SelectItem>)}</SelectContent></Select><Select name="potential" defaultValue={typeof params.potential === "string" ? params.potential : "all"}><SelectTrigger className="w-full"><SelectValue placeholder="Potentiel" /></SelectTrigger><SelectContent><SelectItem value="all">Tout potentiel</SelectItem>{potentialLevels.map((value) => <SelectItem key={value} value={value}>{labels.potentialLevel[value]}</SelectItem>)}</SelectContent></Select><Input name="agent" defaultValue={typeof params.agent === "string" ? params.agent : ""} placeholder="Agent" /><Input name="territory" defaultValue={typeof params.territory === "string" ? params.territory : ""} placeholder="Territoire" /><Input name="group" defaultValue={typeof params.group === "string" ? params.group : ""} placeholder="Groupement" /><Select name="sort" defaultValue={sort}><SelectTrigger className="w-full"><SelectValue placeholder="Trier par" /></SelectTrigger><SelectContent><SelectItem value="trade_name">Nom</SelectItem><SelectItem value="city">Ville</SelectItem><SelectItem value="commercial_status">Statut</SelectItem><SelectItem value="priority_level">Priorité</SelectItem><SelectItem value="potential_level">Potentiel</SelectItem></SelectContent></Select><Select name="direction" defaultValue={descending ? "desc" : "asc"}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Croissant</SelectItem><SelectItem value="desc">Décroissant</SelectItem></SelectContent></Select><Button type="submit" variant="secondary"><Filter className="size-4" />Filtrer</Button></form></CardContent></Card>
    <Card><CardContent className="p-0">{error ? <p className="p-6 text-destructive">Impossible de charger le référentiel.</p> : rows.length === 0 ? <div className="p-12 text-center text-muted-foreground">Aucune pharmacie ne correspond à ces critères.</div> : <Table><TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>Localisation</TableHead><TableHead>Statut</TableHead><TableHead>Priorité</TableHead><TableHead>Potentiel</TableHead><TableHead>Agent</TableHead><TableHead>Territoire</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><Link href={`/dashboard/pharmacies/${row.id}`} className="font-medium hover:underline">{row.trade_name || row.legal_name}</Link><p className="text-xs text-muted-foreground">{row.pharmacy_group_name || "Indépendante"}</p></TableCell><TableCell>{row.city || "—"}<p className="text-xs text-muted-foreground">{row.postal_code}</p></TableCell><TableCell><Badge variant="secondary">{labels.commercialStatus[row.commercial_status as keyof typeof labels.commercialStatus]}</Badge></TableCell><TableCell>{labels.priorityLevel[row.priority_level as keyof typeof labels.priorityLevel]}</TableCell><TableCell>{labels.potentialLevel[row.potential_level as keyof typeof labels.potentialLevel]}</TableCell><TableCell>{row.agent_name || "Non affecté"}</TableCell><TableCell>{row.territory_name || "—"}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
    <div className="flex items-center justify-between text-sm"><span>Page {page} sur {totalPages}</span><div className="flex gap-2"><Button asChild variant="outline" size="sm" disabled={page <= 1}><Link href={`?page=${Math.max(1, page - 1)}&q=${encodeURIComponent(search)}`}>Précédent</Link></Button><Button asChild variant="outline" size="sm" disabled={page >= totalPages}><Link href={`?page=${Math.min(totalPages, page + 1)}&q=${encodeURIComponent(search)}`}>Suivant</Link></Button></div></div>
  </div>;
}
