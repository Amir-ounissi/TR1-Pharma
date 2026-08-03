import { Building2, CircleAlert, MapPin, Plus, Search, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveBrand } from "@/lib/auth";
import { activityStatuses, commercialStatuses, labels, potentialLevels, priorityLevels } from "@/lib/reference-data";
import { cn } from "@/lib/utils";

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
  const strategicCount = rows.filter((row) => row.priority_level === "strategic").length;
  const unassignedCount = rows.filter((row) => !row.agent_name).length;
  const cityCount = new Set(rows.map((row) => row.city).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-[var(--tr1-line-strong)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="tr1-da-eyebrow mb-2">Réseau officinal / {brand.name}</p>
          <h1 className="tr1-da-title">Pharmacies</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pilotez le portefeuille, les affectations et les priorités commerciales depuis une vue commune.
          </p>
        </div>
        <Button asChild className="h-10 rounded-md bg-[var(--tr1-navy)] px-4 font-mono text-[0.66rem] uppercase tracking-[0.08em] hover:bg-[var(--tr1-navy-soft)]">
          <Link href="/dashboard/pharmacies/new"><Plus className="size-4" />Ajouter une pharmacie</Link>
        </Button>
      </header>

      <section aria-label="Synthèse du portefeuille" className="grid gap-px overflow-hidden rounded-[0.45rem] border border-[var(--tr1-line-strong)] bg-[var(--tr1-line-strong)] sm:grid-cols-2 xl:grid-cols-4">
        <DirectoryMetric icon={Building2} label="Portefeuille total" value={count ?? 0} detail="Pharmacies référencées" />
        <DirectoryMetric icon={CircleAlert} label="Priorité stratégique" value={strategicCount} detail="Sur cette page" accent />
        <DirectoryMetric icon={UserRound} label="Sans agent" value={unassignedCount} detail="Affectation à compléter" />
        <DirectoryMetric icon={MapPin} label="Villes couvertes" value={cityCount} detail="Sur cette page" />
      </section>

      <Card className="tr1-da-panel gap-0 py-0">
        <div className="flex items-center justify-between border-b border-[var(--tr1-line)] px-4 py-3">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-3.5 text-[var(--tr1-orange)]" /><span className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em]">Filtres du portefeuille</span></div>
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground">{count ?? 0} résultat(s)</span>
        </div>
        <CardContent className="p-4">
          <form className="grid gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input name="q" defaultValue={search} className="rounded-md bg-white/35 pl-9 font-mono text-xs" placeholder="Nom, ville, CIP, SIRET…" />
            </div>
            <Select name="status" defaultValue={typeof params.status === "string" ? params.status : "all"}><SelectTrigger className="w-full rounded-md"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{commercialStatuses.map((status) => <SelectItem key={status} value={status}>{labels.commercialStatus[status]}</SelectItem>)}</SelectContent></Select>
            <Select name="activity" defaultValue={typeof params.activity === "string" ? params.activity : "all"}><SelectTrigger className="w-full rounded-md"><SelectValue placeholder="Activité" /></SelectTrigger><SelectContent><SelectItem value="all">Toute activité</SelectItem>{activityStatuses.map((status) => <SelectItem key={status} value={status}>{labels.activityStatus[status]}</SelectItem>)}</SelectContent></Select>
            <Input name="city" defaultValue={typeof params.city === "string" ? params.city : ""} className="rounded-md bg-white/35 font-mono text-xs" placeholder="Ville" />
            <Input name="postalCode" defaultValue={typeof params.postalCode === "string" ? params.postalCode : ""} className="rounded-md bg-white/35 font-mono text-xs" placeholder="Code postal" />
            <Select name="priority" defaultValue={typeof params.priority === "string" ? params.priority : "all"}><SelectTrigger className="w-full rounded-md"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Toute priorité</SelectItem>{priorityLevels.map((value) => <SelectItem key={value} value={value}>{labels.priorityLevel[value]}</SelectItem>)}</SelectContent></Select>
            <Select name="potential" defaultValue={typeof params.potential === "string" ? params.potential : "all"}><SelectTrigger className="w-full rounded-md"><SelectValue placeholder="Potentiel" /></SelectTrigger><SelectContent><SelectItem value="all">Tout potentiel</SelectItem>{potentialLevels.map((value) => <SelectItem key={value} value={value}>{labels.potentialLevel[value]}</SelectItem>)}</SelectContent></Select>
            <Input name="agent" defaultValue={typeof params.agent === "string" ? params.agent : ""} className="rounded-md bg-white/35 font-mono text-xs" placeholder="Agent" />
            <Input name="territory" defaultValue={typeof params.territory === "string" ? params.territory : ""} className="rounded-md bg-white/35 font-mono text-xs" placeholder="Territoire" />
            <Input name="group" defaultValue={typeof params.group === "string" ? params.group : ""} className="rounded-md bg-white/35 font-mono text-xs" placeholder="Groupement" />
            <Select name="sort" defaultValue={sort}><SelectTrigger className="w-full rounded-md"><SelectValue placeholder="Trier par" /></SelectTrigger><SelectContent><SelectItem value="trade_name">Nom</SelectItem><SelectItem value="city">Ville</SelectItem><SelectItem value="commercial_status">Statut</SelectItem><SelectItem value="priority_level">Priorité</SelectItem><SelectItem value="potential_level">Potentiel</SelectItem></SelectContent></Select>
            <Select name="direction" defaultValue={descending ? "desc" : "asc"}><SelectTrigger className="w-full rounded-md"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Croissant</SelectItem><SelectItem value="desc">Décroissant</SelectItem></SelectContent></Select>
            <Button type="submit" variant="outline" className="rounded-md border-[var(--tr1-navy)] bg-[var(--tr1-navy)] font-mono text-[0.65rem] uppercase tracking-[0.08em] text-white hover:bg-[var(--tr1-navy-soft)] hover:text-white"><SlidersHorizontal className="size-3.5" />Appliquer</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="tr1-da-panel gap-0 py-0">
        <CardContent className="p-0">
          {error ? <p className="p-6 text-destructive">Impossible de charger le référentiel.</p> : rows.length === 0 ? <div className="p-12 text-center text-muted-foreground">Aucune pharmacie ne correspond à ces critères.</div> : (
            <Table className="text-[0.78rem]">
              <TableHeader className="bg-[var(--tr1-navy)] text-white">
                <TableRow className="border-white/10 hover:bg-[var(--tr1-navy)]"><TableHead className="h-11 px-4 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Pharmacie</TableHead><TableHead className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Localisation</TableHead><TableHead className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Statut</TableHead><TableHead className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Priorité</TableHead><TableHead className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Potentiel</TableHead><TableHead className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Agent</TableHead><TableHead className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white">Territoire</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow className="border-[var(--tr1-line)] hover:bg-white/50" key={row.id}>
                    <TableCell className="px-4 py-3"><Link href={`/dashboard/pharmacies/${row.id}`} className="font-mono text-[0.76rem] font-black uppercase tracking-[-0.02em] hover:text-[var(--tr1-orange)]">{row.trade_name || row.legal_name}</Link><p className="mt-1 text-[0.68rem] text-muted-foreground">{row.pharmacy_group_name || "Indépendante"}</p></TableCell>
                    <TableCell>{row.city || "—"}<p className="text-[0.68rem] text-muted-foreground">{row.postal_code}</p></TableCell>
                    <TableCell><Badge variant="outline" className="h-5 rounded-[0.25rem] border-[var(--tr1-line-strong)] bg-transparent font-mono text-[0.58rem] uppercase">{labels.commercialStatus[row.commercial_status as keyof typeof labels.commercialStatus]}</Badge></TableCell>
                    <TableCell><span className={cn("inline-flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase", row.priority_level === "strategic" && "text-[var(--tr1-orange)]")}><span className={cn("size-1.5 rounded-full bg-[var(--tr1-blue)]", row.priority_level === "strategic" && "bg-[var(--tr1-orange)]")} />{labels.priorityLevel[row.priority_level as keyof typeof labels.priorityLevel]}</span></TableCell>
                    <TableCell>{labels.potentialLevel[row.potential_level as keyof typeof labels.potentialLevel]}</TableCell>
                    <TableCell>{row.agent_name || <span className="text-[var(--tr1-orange)]">Non affecté</span>}</TableCell>
                    <TableCell>{row.territory_name || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.08em]"><span>Page {page} / {totalPages}</span><div className="flex gap-2"><Button asChild variant="outline" size="sm" className="rounded-md" disabled={page <= 1}><Link href={`?page=${Math.max(1, page - 1)}&q=${encodeURIComponent(search)}`}>Précédent</Link></Button><Button asChild variant="outline" size="sm" className="rounded-md" disabled={page >= totalPages}><Link href={`?page=${Math.min(totalPages, page + 1)}&q=${encodeURIComponent(search)}`}>Suivant</Link></Button></div></div>
    </div>
  );
}

function DirectoryMetric({ icon: Icon, label, value, detail, accent = false }: { icon: typeof Building2; label: string; value: number; detail: string; accent?: boolean }) {
  return (
    <article className="bg-[var(--card)] px-4 py-4">
      <div className="mb-4 flex items-center gap-2 font-mono text-[0.58rem] font-bold uppercase tracking-[0.11em] text-muted-foreground"><Icon className={cn("size-3.5 text-[var(--tr1-navy)]", accent && "text-[var(--tr1-orange)]")} />{label}</div>
      <p className={cn("font-mono text-3xl font-black tracking-[-0.08em] text-[var(--tr1-navy)]", accent && "text-[var(--tr1-orange)]")}>{value}</p>
      <p className="mt-1 text-[0.68rem] text-muted-foreground">{detail}</p>
    </article>
  );
}
