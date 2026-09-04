import { Building2, CircleAlert, MapPin, Plus, RotateCcw, Search, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { PharmacyListWithPanel } from "@/components/pharmacies/pharmacy-list-with-panel";
import { MapFilters } from "@/components/network-map/map-filters";
import { NetworkMap } from "@/components/network-map/network-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CompactPageHeader } from "@/components/ux/compact-page-header";
import { EmptyState } from "@/components/ux/empty-state";
import { InlineError } from "@/components/ux/inline-error";
import { MetricStrip } from "@/components/ux/metric-strip";
import { Toolbar, ToolbarMeta, ToolbarRow } from "@/components/ux/toolbar";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { loadPharmacySummaryAction } from "@/app/(protected)/dashboard/pharmacies/actions";
import { loadNetworkMapData, type NetworkMapRoleScope, type NetworkMapView } from "@/lib/network-map";
import { activityStatuses, commercialStatuses, labels, potentialLevels, priorityLevels } from "@/lib/reference-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PharmaciesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, brand } = await requireActiveBrand();
  const contexts = await getBrandContexts();
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const roleScope: NetworkMapRoleScope = role === "agent" ? "agent" : "manager";
  const view: NetworkMapView = params.view === "map" ? "map" : "list";
  const urlParams = toUrlSearchParams(params);
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
  let mapDataset = null;
  let mapErrorMessage: string | null = null;

  if (view === "map") {
    try {
      mapDataset = await loadNetworkMapData({
        supabase,
        brandId: brand.id,
        roleScope,
        roleKey: role,
        search: params,
      });
    } catch (error) {
      mapErrorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
    }
  }

  const hasActiveFilters = ["q", "status", "activity", "priority", "potential", "city", "postalCode", "agent", "territory", "group", "sort", "direction", "page"]
    .some((key) => typeof params[key] === "string" && params[key] !== "" && params[key] !== "all" && !(key === "sort" && params[key] === "trade_name") && !(key === "direction" && params[key] === "asc") && !(key === "page" && params[key] === "1"));

  return (
    <div className={view === "map" ? "flex min-h-[calc(100vh-8.5rem)] flex-col gap-3 overflow-hidden" : "space-y-3"}>
      {view === "list" ? (
        <CompactPageHeader
          eyebrow={`Réseau officinal / ${brand.name}`}
          title="Pharmacies"
          description="Le portefeuille, les affectations et les priorités commerciales se lisent ici en une seule vue dense."
          actions={role !== "agent" ? (
            <Button asChild className="h-9 rounded-md bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]">
              <Link href="/dashboard/pharmacies/new">
                <Plus className="size-4" />
                Ajouter une pharmacie
              </Link>
            </Button>
          ) : undefined}
        />
      ) : null}

      <MapFilters basePath="/dashboard/pharmacies" mode={mapDataset?.mode ?? "network"} params={urlParams} period={mapDataset?.period ?? "30d"} roleScope={roleScope} view={view} />

      {view === "list" ? (
        <MetricStrip
          items={[
            { icon: Building2, label: role === "agent" ? "Mon portefeuille" : "Portefeuille total", value: count ?? 0, detail: "Pharmacies référencées" },
            { icon: CircleAlert, label: "Priorités", value: strategicCount, detail: "Sur cette page", accent: true },
            role === "agent" ? { icon: CircleAlert, label: "À relancer", value: rows.filter((row) => row.activity_status === "at_risk" || row.activity_status === "dormant").length, detail: "Sur cette page" } : { icon: UserRound, label: "Sans agent", value: unassignedCount, detail: "Affectation à compléter" },
            { icon: MapPin, label: "Villes couvertes", value: cityCount, detail: "Sur cette page" },
          ]}
        />
      ) : null}

      {view === "map" && mapDataset ? (
        <div className="min-h-0 flex-1">
          <NetworkMap dataset={mapDataset} />
        </div>
      ) : null}

      {view === "map" && mapErrorMessage ? (
        <InlineError
          title="La vue cartographique ne s’est pas chargée correctement."
          description="La liste pharmacies reste disponible pendant que nous corrigeons le chargement local."
          secondaryAction={
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/pharmacies?view=list">Revenir à la liste</Link>
            </Button>
          }
        />
      ) : null}

      {view === "list" ? <>
      <Toolbar>
        <ToolbarRow className="justify-between">
          <ToolbarMeta>{count ?? 0} résultat(s)</ToolbarMeta>
          {hasActiveFilters ? (
            <Button asChild size="sm" variant="ghost" className="h-8 px-2.5 text-[var(--tr1-navy)]">
              <Link href="/dashboard/pharmacies?view=list">
                <RotateCcw className="size-3.5" />
                Réinitialiser
              </Link>
            </Button>
          ) : null}
        </ToolbarRow>
        <form className="mt-2 flex flex-col gap-2.5 lg:flex-row lg:flex-nowrap lg:items-center">
            <div className="relative lg:min-w-0 lg:flex-1">
              <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
              <Input name="q" defaultValue={search} className="h-9 rounded-md bg-white/90 pl-9 text-sm" placeholder="Rechercher une pharmacie, une ville, un CIP…" />
            </div>
            <Select name="status" defaultValue={typeof params.status === "string" ? params.status : "all"}><SelectTrigger className="h-9 w-full rounded-md bg-white/90 lg:w-[11rem] lg:min-w-[11rem]"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem>{commercialStatuses.map((status) => <SelectItem key={status} value={status}>{labels.commercialStatus[status]}</SelectItem>)}</SelectContent></Select>
            <Select name="activity" defaultValue={typeof params.activity === "string" ? params.activity : "all"}><SelectTrigger className="h-9 w-full rounded-md bg-white/90 lg:w-[11rem] lg:min-w-[11rem]"><SelectValue placeholder="Activité" /></SelectTrigger><SelectContent><SelectItem value="all">Toute activité</SelectItem>{activityStatuses.map((status) => <SelectItem key={status} value={status}>{labels.activityStatus[status]}</SelectItem>)}</SelectContent></Select>
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="h-9 rounded-md border-[var(--tr1-line-strong)] bg-white/80 px-3 text-sm text-[var(--tr1-navy)] lg:w-[8.25rem] lg:min-w-[8.25rem]">
                  <SlidersHorizontal className="size-3.5" />
                  Filtres +
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full max-w-xl border-l border-[var(--tr1-line)] bg-[var(--tr1-ivory)] px-5">
                <SheetHeader>
                  <SheetTitle className="text-left text-lg font-semibold text-[var(--tr1-navy)]">Filtres avancés</SheetTitle>
                </SheetHeader>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Input name="city" defaultValue={typeof params.city === "string" ? params.city : ""} className="h-10 rounded-md bg-white text-sm" placeholder="Ville" />
                  <Input name="postalCode" defaultValue={typeof params.postalCode === "string" ? params.postalCode : ""} className="h-10 rounded-md bg-white text-sm" placeholder="Code postal" />
                  <Select name="priority" defaultValue={typeof params.priority === "string" ? params.priority : "all"}><SelectTrigger className="h-10 w-full rounded-md bg-white"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Toute priorité</SelectItem>{priorityLevels.map((value) => <SelectItem key={value} value={value}>{labels.priorityLevel[value]}</SelectItem>)}</SelectContent></Select>
                  <Select name="potential" defaultValue={typeof params.potential === "string" ? params.potential : "all"}><SelectTrigger className="h-10 w-full rounded-md bg-white"><SelectValue placeholder="Potentiel" /></SelectTrigger><SelectContent><SelectItem value="all">Tout potentiel</SelectItem>{potentialLevels.map((value) => <SelectItem key={value} value={value}>{labels.potentialLevel[value]}</SelectItem>)}</SelectContent></Select>
                  <Input name="agent" defaultValue={typeof params.agent === "string" ? params.agent : ""} className="h-10 rounded-md bg-white text-sm" placeholder="Agent" />
                  <Input name="territory" defaultValue={typeof params.territory === "string" ? params.territory : ""} className="h-10 rounded-md bg-white text-sm" placeholder="Territoire" />
                  <Input name="group" defaultValue={typeof params.group === "string" ? params.group : ""} className="h-10 rounded-md bg-white text-sm sm:col-span-2" placeholder="Groupement" />
                  <Select name="sort" defaultValue={sort}><SelectTrigger className="h-10 w-full rounded-md bg-white"><SelectValue placeholder="Trier par" /></SelectTrigger><SelectContent><SelectItem value="trade_name">Nom</SelectItem><SelectItem value="city">Ville</SelectItem><SelectItem value="commercial_status">Statut</SelectItem><SelectItem value="priority_level">Priorité</SelectItem><SelectItem value="potential_level">Potentiel</SelectItem></SelectContent></Select>
                  <Select name="direction" defaultValue={descending ? "desc" : "asc"}><SelectTrigger className="h-10 w-full rounded-md bg-white sm:col-span-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asc">Tri croissant</SelectItem><SelectItem value="desc">Tri décroissant</SelectItem></SelectContent></Select>
                </div>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <Button asChild type="button" variant="ghost" className="h-9 px-0 text-[var(--tr1-navy)] hover:bg-transparent hover:text-[var(--tr1-orange)]">
                    <Link href="/dashboard/pharmacies?view=list">Réinitialiser</Link>
                  </Button>
                  <Button type="submit" className="h-9 rounded-md bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]">
                    Appliquer
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Button type="submit" className="h-9 rounded-md bg-[var(--tr1-navy)] px-3 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)] lg:min-w-[6.5rem]">
              Appliquer
            </Button>
          </form>
      </Toolbar>

      {error ? (
        <InlineError
          title="Impossible de charger le référentiel."
          description="Réessayez dans un instant ou revenez aux filtres par défaut."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/pharmacies?view=list">Réessayer</Link>
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          tone={hasActiveFilters ? "no_results" : "first_use"}
          title={hasActiveFilters ? "Aucune pharmacie ne correspond à ces filtres." : "Aucune pharmacie ajoutée."}
          description={
            hasActiveFilters
              ? "Essayez d’élargir votre recherche ou de réinitialiser les filtres."
              : role === "agent" ? "Votre portefeuille ne comporte pas encore de pharmacie accessible." : "Commencez par ajouter une première pharmacie pour construire le portefeuille."
          }
          action={
            hasActiveFilters ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/pharmacies?view=list">
                  <RotateCcw className="size-3.5" />
                  Réinitialiser les filtres
                </Link>
              </Button>
            ) : role !== "agent" ? (
              <Button asChild size="sm" className="h-9 bg-[var(--tr1-navy)] px-3.5 text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]">
                <Link href="/dashboard/pharmacies/new">
                  <Plus className="size-3.5" />
                  Ajouter une pharmacie
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PharmacyListWithPanel rows={rows} loadSummaryAction={loadPharmacySummaryAction} />
      )}

      {rows.length > 0 ? (
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-md" disabled={page <= 1}>
              <Link href={buildPageHref(urlParams, Math.max(1, page - 1))}>Précédent</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-md" disabled={page >= totalPages}>
              <Link href={buildPageHref(urlParams, Math.min(totalPages, page + 1))}>Suivant</Link>
            </Button>
          </div>
        </div>
      ) : null}
      </> : null}
    </div>
  );
}

function toUrlSearchParams(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length) {
      next.set(key, value);
    }
  }
  return next;
}

function buildPageHref(current: URLSearchParams, page: number) {
  const next = new URLSearchParams(current.toString());
  next.set("page", String(page));
  return `?${next.toString()}`;
}
