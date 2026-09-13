"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Building2, CalendarPlus, ChevronDown, CircleDollarSign, Filter, MapPinned, RotateCcw, Search, Target, TrendingUp, Users } from "lucide-react";
import { FieldVisitCreateForm } from "@/components/agenda/field-visit-create-form";
import { NextBestActionForm } from "@/components/commercial/next-best-action-form";
import { PerformanceSlippyMap } from "@/components/performance-map/performance-map-slippy-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PerformanceMapDataset, PerformanceMapFilterOptions, PerformanceMapFilters, PerformanceMapObjective, PerformanceMapPharmacy, PerformanceMapTerritory } from "@/lib/performance-map";

type TableSort = "priority" | "revenue" | "alerts" | "name";
type ClientFilterKey = "territory" | "agent" | "group" | "status" | "potential" | "priority" | "q";

export function PerformanceMap({ dataset, filters, options }: { dataset: PerformanceMapDataset; filters: PerformanceMapFilters; options: PerformanceMapFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<TableSort>("priority");
  const [localFilters, setLocalFilters] = useState<PerformanceMapFilters>(filters);
  const [dateDraft, setDateDraft] = useState({ from: dataset.from, to: dataset.to });
  const [isRefreshing, startTransition] = useTransition();
  const serverNavigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredSearch = useDeferredValue(localFilters.q.trim().toLocaleLowerCase("fr"));

  const initialTerritory = filters.territory;
  const initialAgent = filters.agent;
  const initialGroup = filters.group;
  const initialProduct = filters.product;
  const initialStatus = filters.status;
  const initialPotential = filters.potential;
  const initialPriority = filters.priority;
  const initialSearch = filters.q;

  useEffect(() => {
    setLocalFilters({
      territory: initialTerritory,
      agent: initialAgent,
      group: initialGroup,
      product: initialProduct,
      status: initialStatus,
      potential: initialPotential,
      priority: initialPriority,
      q: initialSearch,
    });
  }, [initialAgent, initialGroup, initialPotential, initialPriority, initialProduct, initialSearch, initialStatus, initialTerritory]);

  useEffect(() => {
    setDateDraft({ from: dataset.from, to: dataset.to });
  }, [dataset.from, dataset.to]);

  useEffect(() => () => {
    if (serverNavigationTimer.current) clearTimeout(serverNavigationTimer.current);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParam(params, "territory", localFilters.territory);
    setUrlParam(params, "agent", localFilters.agent);
    setUrlParam(params, "group", localFilters.group);
    setUrlParam(params, "status", localFilters.status);
    setUrlParam(params, "potential", localFilters.potential);
    setUrlParam(params, "priority", localFilters.priority);
    setUrlParam(params, "q", localFilters.q.trim() || null);
    const query = params.toString();
    window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
  }, [localFilters.agent, localFilters.group, localFilters.potential, localFilters.priority, localFilters.q, localFilters.status, localFilters.territory, pathname]);

  const visiblePharmacies = useMemo(() => dataset.pharmacies.filter((pharmacy) => {
    if (localFilters.territory && pharmacy.territoryId !== localFilters.territory) return false;
    if (localFilters.agent && pharmacy.agentUserId !== localFilters.agent) return false;
    if (localFilters.group && pharmacy.groupId !== localFilters.group) return false;
    if (localFilters.status && pharmacy.commercialStatus !== localFilters.status) return false;
    if (localFilters.potential && pharmacy.potentialLevel !== localFilters.potential) return false;
    if (localFilters.priority && pharmacy.priorityLevel !== localFilters.priority) return false;
    if (deferredSearch && !pharmacy.searchText.toLocaleLowerCase("fr").includes(deferredSearch)) return false;
    return true;
  }), [dataset.pharmacies, deferredSearch, localFilters.agent, localFilters.group, localFilters.potential, localFilters.priority, localFilters.status, localFilters.territory]);

  const viewDataset = useMemo(() => buildFilteredDataset(dataset, visiblePharmacies, localFilters), [dataset, localFilters, visiblePharmacies]);
  const selectedPharmacy = viewDataset.pharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null;
  const selectedTerritory = viewDataset.territories.find((territory) => territory.id === selectedTerritoryId) ?? null;
  const sortedPharmacies = useMemo(() => {
    const rows = [...viewDataset.pharmacies];
    if (tableSort === "revenue") return rows.sort((a, b) => b.revenueHt - a.revenueHt);
    if (tableSort === "alerts") return rows.sort((a, b) => b.overdueAlerts - a.overdueAlerts || b.openAlerts - a.openAlerts || b.priorityScore - a.priorityScore);
    if (tableSort === "name") return rows.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return rows.sort((a, b) => b.priorityScore - a.priorityScore || b.revenueHt - a.revenueHt);
  }, [tableSort, viewDataset.pharmacies]);

  const updateClientFilter = (name: ClientFilterKey, value: string) => {
    const normalized = name === "q" ? value : value === "all" ? null : value;
    setLocalFilters((current) => ({ ...current, [name]: normalized }));
    if (name === "territory") setSelectedTerritoryId(normalized as string | null);
    if (name !== "q") setSelectedPharmacyId(null);
  };

  const navigateServerFilters = (nextDates: { from: string; to: string }, nextProduct: string | null, delay = 0) => {
    if (serverNavigationTimer.current) clearTimeout(serverNavigationTimer.current);
    serverNavigationTimer.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setUrlParam(params, "from", nextDates.from);
      setUrlParam(params, "to", nextDates.to);
      setUrlParam(params, "product", nextProduct);
      setUrlParam(params, "territory", localFilters.territory);
      setUrlParam(params, "agent", localFilters.agent);
      setUrlParam(params, "group", localFilters.group);
      setUrlParam(params, "status", localFilters.status);
      setUrlParam(params, "potential", localFilters.potential);
      setUrlParam(params, "priority", localFilters.priority);
      setUrlParam(params, "q", localFilters.q.trim() || null);
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    }, delay);
  };

  const updateDate = (name: "from" | "to", value: string) => {
    const nextDates = { ...dateDraft, [name]: value };
    setDateDraft(nextDates);
    if (nextDates.from && nextDates.to) navigateServerFilters(nextDates, localFilters.product, 350);
  };

  const updateProduct = (value: string) => {
    const product = value === "all" ? null : value;
    setLocalFilters((current) => ({ ...current, product }));
    navigateServerFilters(dateDraft, product);
  };

  const resetFilters = () => {
    setLocalFilters({ territory: null, agent: null, group: null, product: null, status: null, potential: null, priority: null, q: "" });
    setSelectedPharmacyId(null);
    setSelectedTerritoryId(null);
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return <div className="space-y-4">
    <section className="grid gap-px overflow-hidden rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--tr1-line-strong)] sm:grid-cols-2 xl:grid-cols-6">
      <Metric icon={CircleDollarSign} label={viewDataset.productScopeLabel ? `CA · ${viewDataset.productScopeLabel}` : "CA facturé HT"} value={formatCurrency(viewDataset.metrics.revenueHt)} detail={`${formatDate(viewDataset.from)} → ${formatDate(viewDataset.to)}`} />
      <Metric icon={Target} label="Atteinte objectif" value={viewDataset.metrics.objectiveComparable ? formatPercent(viewDataset.metrics.objectiveAttainment) : "Non comparable"} detail={viewDataset.metrics.objectiveComparable ? "Objectif du périmètre sélectionné" : "Filtres plus fins que l’objectif défini"} />
      <Metric icon={Building2} label="Pharmacies actives" value={formatNumber(viewDataset.metrics.activePharmacies)} detail="Dans le périmètre affiché" />
      <Metric icon={MapPinned} label="Implantations" value={formatNumber(viewDataset.metrics.implantations)} detail="Sur la période" />
      <Metric icon={TrendingUp} label="Taux de réassort" value={formatPercent(viewDataset.metrics.reorderRate)} detail="Pharmacies commandantes avec ≥1 réassort" />
      <Metric icon={AlertTriangle} label="Comptes à risque" value={formatNumber(viewDataset.metrics.atRiskAccounts)} detail="Signal santé commerciale" accent />
    </section>

    <section className="grid min-h-[42rem] gap-3 xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      <FilterPanel
        dates={dateDraft}
        filters={localFilters}
        isRefreshing={isRefreshing}
        onClientChange={updateClientFilter}
        onDateChange={updateDate}
        onProductChange={updateProduct}
        onReset={resetFilters}
        options={options}
      />
      <PerformanceSlippyMap
        pharmacies={viewDataset.pharmacies}
        territories={viewDataset.territories}
        selectedPharmacyId={selectedPharmacyId}
        selectedTerritoryId={selectedTerritoryId}
        onSelectPharmacy={(id) => { setSelectedPharmacyId(id); setSelectedTerritoryId(null); }}
        onSelectTerritory={(id) => { setSelectedTerritoryId(id); setSelectedPharmacyId(null); }}
      />
      <DetailPanel dataset={viewDataset} pharmacy={selectedPharmacy} territory={selectedTerritory} />
    </section>

    <details className="group overflow-hidden rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--card)]" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div><p className="font-semibold text-[var(--tr1-navy)]">Pharmacies affichées</p><p className="text-xs text-muted-foreground">{viewDataset.pharmacies.length} compte(s) · triable par performance ou priorité</p></div>
        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--tr1-line)]">
        <div className="flex justify-end p-3"><select aria-label="Trier le tableau" className="h-9 rounded-md border border-[var(--tr1-line-strong)] bg-white px-3 text-sm" value={tableSort} onChange={(event) => setTableSort(event.target.value as TableSort)}><option value="priority">Priorité commerciale</option><option value="revenue">CA décroissant</option><option value="alerts">Alertes urgentes</option><option value="name">Nom</option></select></div>
        <div className="max-h-[28rem] overflow-auto"><Table><TableHeader><TableRow><TableHead>Pharmacie</TableHead><TableHead>Secteur / commercial</TableHead><TableHead>CA période</TableHead><TableHead>Réassorts</TableHead><TableHead>Santé</TableHead><TableHead>Objectif pharmacie</TableHead><TableHead>Alertes</TableHead></TableRow></TableHeader><TableBody>
          {sortedPharmacies.map((pharmacy) => <TableRow key={pharmacy.id} className="cursor-pointer" onClick={() => { setSelectedPharmacyId(pharmacy.id); setSelectedTerritoryId(null); }}>
            <TableCell><p className="font-medium">{pharmacy.name}</p><p className="text-xs text-muted-foreground">{[pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" ") || "—"}</p></TableCell>
            <TableCell><p>{pharmacy.territoryName ?? "Sans secteur"}</p><p className="text-xs text-muted-foreground">{pharmacy.agentName ?? "Non affectée"}</p></TableCell>
            <TableCell>{formatCurrency(pharmacy.revenueHt)}</TableCell><TableCell>{formatNumber(pharmacy.reorders)}</TableCell><TableCell>{pharmacy.healthStatusLabel}</TableCell><TableCell><span className="text-muted-foreground">Non défini</span></TableCell>
            <TableCell>{pharmacy.openAlerts ? <span className="font-semibold text-amber-700">{pharmacy.openAlerts}{pharmacy.overdueAlerts ? ` · ${pharmacy.overdueAlerts} en retard` : ""}</span> : "—"}</TableCell>
          </TableRow>)}
        </TableBody></Table></div>
      </div>
    </details>
  </div>;
}

function FilterPanel({
  dates,
  filters,
  options,
  isRefreshing,
  onClientChange,
  onDateChange,
  onProductChange,
  onReset,
}: {
  dates: { from: string; to: string };
  filters: PerformanceMapFilters;
  options: PerformanceMapFilterOptions;
  isRefreshing: boolean;
  onClientChange: (name: ClientFilterKey, value: string) => void;
  onDateChange: (name: "from" | "to", value: string) => void;
  onProductChange: (value: string) => void;
  onReset: () => void;
}) {
  return <details className="group h-fit rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--card)]" open>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2 font-semibold text-[var(--tr1-navy)]"><Filter className="size-4" />Filtres</span><ChevronDown className="size-4 transition group-open:rotate-180" /></summary>
    <form className="space-y-3 border-t border-[var(--tr1-line)] p-3" onSubmit={(event) => event.preventDefault()}>
      <div className="grid grid-cols-2 gap-2"><Field label="Du"><input className={fieldClass} value={dates.from} onChange={(event) => onDateChange("from", event.target.value)} type="date" /></Field><Field label="Au"><input className={fieldClass} value={dates.to} onChange={(event) => onDateChange("to", event.target.value)} type="date" /></Field></div>
      <label className="relative block"><span className="sr-only">Rechercher</span><Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" /><input className={`${fieldClass} pl-9`} value={filters.q} onChange={(event) => onClientChange("q", event.target.value)} placeholder="Pharmacie, ville, CIP…" /></label>
      <SelectField label="Secteur commercial" value={filters.territory} options={options.territories} allLabel="Tous les secteurs" onChange={(value) => onClientChange("territory", value)} />
      <SelectField label="Commercial" value={filters.agent} options={options.agents} allLabel="Toute l’équipe" onChange={(value) => onClientChange("agent", value)} />
      <SelectField label="Groupement" value={filters.group} options={options.groups} allLabel="Tous les groupements" onChange={(value) => onClientChange("group", value)} />
      <label className="block space-y-1"><span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Produit / gamme</span><select className={fieldClass} value={filters.product ?? "all"} onChange={(event) => onProductChange(event.target.value)}><option value="all">Tous les produits</option>{options.families.length ? <optgroup label="Gammes">{options.families.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup> : null}<optgroup label="Produits">{options.products.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup></select></label>
      <SelectField label="Statut pharmacie" value={filters.status} options={options.statuses} allLabel="Tous les statuts" onChange={(value) => onClientChange("status", value)} />
      <SelectField label="Potentiel" value={filters.potential} options={options.potentials} allLabel="Tous les potentiels" onChange={(value) => onClientChange("potential", value)} />
      <SelectField label="Priorité" value={filters.priority} options={options.priorities} allLabel="Toutes les priorités" onChange={(value) => onClientChange("priority", value)} />
      <div className={`rounded-md border px-3 py-2 text-center text-[0.65rem] font-medium ${isRefreshing ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50/60 text-emerald-800"}`}>
        {isRefreshing ? "Mise à jour des données…" : "Filtres appliqués instantanément"}
      </div>
      <Button className="w-full" type="button" variant="ghost" onClick={onReset}><RotateCcw className="size-3.5" />Réinitialiser</Button>
    </form>
  </details>;
}

function SelectField({ label, value, options, allLabel, onChange }: { label: string; value: string | null; options: Array<{ value: string; label: string }>; allLabel: string; onChange: (value: string) => void }) {
  return <label className="block space-y-1"><span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span><select className={fieldClass} value={value ?? "all"} onChange={(event) => onChange(event.target.value)}><option value="all">{allLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1"><span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>{children}</label>; }
const fieldClass = "h-10 w-full rounded-md border border-[var(--tr1-line-strong)] bg-white px-3 text-sm";

function buildFilteredDataset(dataset: PerformanceMapDataset, pharmacies: PerformanceMapPharmacy[], filters: PerformanceMapFilters): PerformanceMapDataset {
  const segmentFiltersActive = Boolean(filters.group || filters.product || filters.status || filters.potential || filters.priority || filters.q.trim());
  const objectiveComparable = !segmentFiltersActive && !(filters.territory && filters.agent);
  const objectiveScope: PerformanceMapObjective["scopeType"] = filters.agent ? "agent" : filters.territory ? "territory" : "brand";
  const objective = objectiveComparable ? findObjective(dataset.objectives, objectiveScope, filters.territory, filters.agent) : null;
  const orderingPharmacies = pharmacies.filter((pharmacy) => pharmacy.revenueHt > 0);
  const metrics = {
    revenueHt: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.revenueHt, 0),
    objectiveAttainment: objective?.attainmentPercent ?? null,
    objectiveComparable,
    activePharmacies: pharmacies.filter((pharmacy) => !["dormant", "insufficient_history"].includes(pharmacy.healthStatus)).length,
    implantations: pharmacies.reduce((sum, pharmacy) => sum + pharmacy.implantations, 0),
    reorderRate: orderingPharmacies.length ? (orderingPharmacies.filter((pharmacy) => pharmacy.reorders > 0).length / orderingPharmacies.length) * 100 : null,
    atRiskAccounts: pharmacies.filter((pharmacy) => pharmacy.healthStatus === "at_risk").length,
  };
  const territoryObjectiveComparable = !segmentFiltersActive && !filters.agent;
  const territories = dataset.territories.map((territory) => {
    const territoryPharmacies = pharmacies.filter((pharmacy) => pharmacy.territoryId === territory.id);
    const objectiveVisible = territoryObjectiveComparable && (!filters.territory || filters.territory === territory.id);
    return {
      ...territory,
      objectiveAttainment: objectiveVisible ? territory.objectiveAttainment : null,
      objectiveMetricLabel: objectiveVisible ? territory.objectiveMetricLabel : null,
      revenueHt: territoryPharmacies.reduce((sum, pharmacy) => sum + pharmacy.revenueHt, 0),
      pharmacyCount: territoryPharmacies.length,
      activePharmacies: territoryPharmacies.filter((pharmacy) => !["dormant", "insufficient_history"].includes(pharmacy.healthStatus)).length,
      atRiskAccounts: territoryPharmacies.filter((pharmacy) => pharmacy.healthStatus === "at_risk").length,
      openAlerts: territoryPharmacies.reduce((sum, pharmacy) => sum + pharmacy.openAlerts, 0),
    };
  });
  return { ...dataset, metrics, pharmacies, territories };
}

function findObjective(objectives: PerformanceMapObjective[], scope: PerformanceMapObjective["scopeType"], territoryId: string | null, agentId: string | null) {
  const matching = objectives.filter((objective) => objective.scopeType === scope)
    .filter((objective) => scope !== "territory" || objective.territoryId === territoryId)
    .filter((objective) => scope !== "agent" || objective.userId === agentId)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  return matching.find((objective) => objective.metricKey === "revenue_ht") ?? matching[0] ?? null;
}

function setUrlParam(params: URLSearchParams, name: string, value: string | null) {
  if (value) params.set(name, value);
  else params.delete(name);
}

function DetailPanel({ dataset, pharmacy, territory }: { dataset: PerformanceMapDataset; pharmacy: PerformanceMapPharmacy | null; territory: PerformanceMapTerritory | null }) {
  const defaultStart = `${shiftDate(dataset.to, 1)}T09:00`;
  if (pharmacy) return <Card className="h-fit max-h-[50rem] overflow-auto"><CardHeader><p className="font-mono text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Pharmacie</p><CardTitle>{pharmacy.name}</CardTitle><p className="text-sm text-muted-foreground">{[pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" ") || "Localisation non renseignée"}</p></CardHeader><CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-2"><Datum label="CA période" value={formatCurrency(pharmacy.revenueHt)} /><Datum label="Réassorts" value={formatNumber(pharmacy.reorders)} /><Datum label="Santé" value={pharmacy.healthStatusLabel} /><Datum label="Priorité" value={pharmacy.priorityLevelLabel} /></div>
    <div className="rounded-lg border border-[var(--tr1-line)] bg-muted/35 p-3"><p className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Atteinte d’objectif pharmacie</p><p className="mt-1 font-semibold text-[var(--tr1-navy)]">Non définie</p><p className="mt-1 text-xs text-muted-foreground">Les objectifs TR1 sont actuellement définis au niveau marque, secteur ou commercial. Aucun score pharmacie n’est extrapolé.</p></div>
    <Datum label="Secteur" value={pharmacy.territoryName ?? "Sans secteur"} /><Datum label="Commercial" value={pharmacy.agentName ?? "Non affectée"} /><Datum label="Groupement" value={pharmacy.groupName ?? "Indépendante / non renseigné"} />
    {pharmacy.openAlerts ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">{pharmacy.openAlerts} action(s) ouverte(s){pharmacy.overdueAlerts ? ` · ${pharmacy.overdueAlerts} en retard` : ""}</p><p className="mt-1 text-xs">Les alertes sont séparées de la couleur d’objectif pour éviter toute confusion.</p></div> : null}
    <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Lecture :</span> {pharmacy.recommendation}</p>
    {pharmacy.nextBestAction ? <NextBestActionForm actionLabel={pharmacy.nextBestAction.label} actionType={pharmacy.nextBestAction.type} brandPharmacyId={pharmacy.id} suggestedDueAt={pharmacy.nextBestAction.dueAt} /> : null}
    <details className="rounded-xl border border-[var(--tr1-line)] bg-background p-3"><summary className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--tr1-navy)]"><CalendarPlus className="size-4" />Planifier une visite</summary><div className="mt-3"><FieldVisitCreateForm defaultBrandId={dataset.brandId} defaultObjective={pharmacy.recommendation} defaultPharmacyId={pharmacy.pharmacyId} defaultStart={defaultStart} pharmacies={[{ id: pharmacy.pharmacyId, label: pharmacy.name, city: pharmacy.city ?? undefined, brands: [{ relationId: pharmacy.id, brandId: dataset.brandId, brandName: dataset.brandName }] }]} /></div></details>
    <Button asChild className="w-full" variant="outline"><Link href={`/dashboard/pharmacies/${pharmacy.id}`}>Ouvrir la fiche pharmacie</Link></Button>
  </CardContent></Card>;
  if (territory) return <Card className="h-fit"><CardHeader><p className="font-mono text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Secteur</p><CardTitle>{territory.name}</CardTitle><p className="text-sm text-muted-foreground">{territory.departmentCodes.length ? `Départements ${territory.departmentCodes.join(", ")}` : "Départements non configurés"}</p></CardHeader><CardContent className="space-y-3"><Datum label="Atteinte objectif" value={formatPercent(territory.objectiveAttainment)} />{territory.objectiveMetricLabel ? <p className="text-xs text-muted-foreground">Objectif lu : {territory.objectiveMetricLabel}</p> : <p className="text-xs text-muted-foreground">Aucun objectif secteur comparable sur la période.</p>}<div className="grid grid-cols-2 gap-2"><Datum label="CA période" value={formatCurrency(territory.revenueHt)} /><Datum label="Pharmacies" value={formatNumber(territory.pharmacyCount)} /><Datum label="Actives" value={formatNumber(territory.activePharmacies)} /><Datum label="À risque" value={formatNumber(territory.atRiskAccounts)} /></div><Datum label="Actions ouvertes" value={formatNumber(territory.openAlerts)} /></CardContent></Card>;
  return <Card className="h-fit"><CardHeader><CardTitle>Lecture du périmètre</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Cliquez un secteur pour lire son objectif et ses résultats, ou une pharmacie pour ouvrir son détail opérationnel.</p><p>Les pharmacies restent volontairement grises : TR1 ne crée pas d’objectif pharmacie lorsque la donnée n’existe pas.</p><p>Les anneaux orange signalent uniquement des actions réellement ouvertes.</p></CardContent></Card>;
}

function Metric({ icon: Icon, label, value, detail, accent = false }: { icon: typeof Users; label: string; value: string; detail: string; accent?: boolean }) { return <article className="flex min-w-0 items-center gap-3 bg-[var(--card)] px-3 py-3"><span className={`grid size-8 shrink-0 place-items-center rounded-md border border-[var(--tr1-line)] bg-white/75 ${accent ? "text-amber-700" : "text-[var(--tr1-orange)]"}`}><Icon className="size-3.5" /></span><div className="min-w-0"><p className="truncate font-mono text-xl font-black tracking-[-0.06em] text-[var(--tr1-navy)]">{value}</p><p className="truncate font-mono text-[0.52rem] font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="truncate text-[0.64rem] text-muted-foreground">{detail}</p></div></article>; }
function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[var(--tr1-line)] bg-white/60 p-2.5"><p className="font-mono text-[0.52rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--tr1-navy)]">{value}</p></div>; }
function formatCurrency(value: number | null) { if (value == null || !Number.isFinite(Number(value))) return "—"; return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value)); }
function formatPercent(value: number | null) { if (value == null || !Number.isFinite(Number(value))) return "—"; return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`; }
function formatNumber(value: number) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00.000Z`)); }
function shiftDate(value: string, days: number) { const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day + days)); return date.toISOString().slice(0, 10); }
