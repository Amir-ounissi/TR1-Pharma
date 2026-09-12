"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarPlus,
  ChevronDown,
  CircleDollarSign,
  Filter,
  MapPinned,
  RotateCcw,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import franceDepartments from "@/data/france-departments-metro.json";
import { FieldVisitCreateForm } from "@/components/agenda/field-visit-create-form";
import { NextBestActionForm } from "@/components/commercial/next-best-action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildProjectionViewport, projectCoordinate, type ProjectionViewport } from "@/lib/network-map";
import type {
  PerformanceMapDataset,
  PerformanceMapFilterOptions,
  PerformanceMapFilters,
  PerformanceMapPharmacy,
  PerformanceMapTerritory,
} from "@/lib/performance-map";

const MAP_WIDTH = 840;
const MAP_HEIGHT = 640;

type GeometryFeature = {
  properties: { code: string; nom: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type TableSort = "priority" | "revenue" | "alerts" | "name";

export function PerformanceMap({
  dataset,
  filters,
  options,
}: {
  dataset: PerformanceMapDataset;
  filters: PerformanceMapFilters;
  options: PerformanceMapFilterOptions;
}) {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<TableSort>("priority");

  const selectedPharmacy = dataset.pharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null;
  const selectedTerritory = dataset.territories.find((territory) => territory.id === selectedTerritoryId) ?? null;
  const sortedPharmacies = useMemo(() => {
    const rows = [...dataset.pharmacies];
    if (tableSort === "revenue") return rows.sort((a, b) => b.revenueHt - a.revenueHt);
    if (tableSort === "alerts") {
      return rows.sort(
        (a, b) => b.overdueAlerts - a.overdueAlerts || b.openAlerts - a.openAlerts || b.priorityScore - a.priorityScore,
      );
    }
    if (tableSort === "name") return rows.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return rows.sort((a, b) => b.priorityScore - a.priorityScore || b.revenueHt - a.revenueHt);
  }, [dataset.pharmacies, tableSort]);

  return (
    <div className="space-y-4">
      <section className="grid gap-px overflow-hidden rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--tr1-line-strong)] sm:grid-cols-2 xl:grid-cols-6">
        <Metric
          icon={CircleDollarSign}
          label={dataset.productScopeLabel ? `CA · ${dataset.productScopeLabel}` : "CA facturé HT"}
          value={formatCurrency(dataset.metrics.revenueHt)}
          detail={`${formatDate(dataset.from)} → ${formatDate(dataset.to)}`}
        />
        <Metric
          icon={Target}
          label="Atteinte objectif"
          value={dataset.metrics.objectiveComparable ? formatPercent(dataset.metrics.objectiveAttainment) : "Non comparable"}
          detail={dataset.metrics.objectiveComparable ? "Objectif du périmètre sélectionné" : "Filtres plus fins que l’objectif défini"}
        />
        <Metric icon={Building2} label="Pharmacies actives" value={formatNumber(dataset.metrics.activePharmacies)} detail="Dans le périmètre affiché" />
        <Metric icon={MapPinned} label="Implantations" value={formatNumber(dataset.metrics.implantations)} detail="Sur la période" />
        <Metric icon={TrendingUp} label="Taux de réassort" value={formatPercent(dataset.metrics.reorderRate)} detail="Pharmacies commandantes avec ≥1 réassort" />
        <Metric icon={AlertTriangle} label="Comptes à risque" value={formatNumber(dataset.metrics.atRiskAccounts)} detail="Signal santé commerciale" accent />
      </section>

      <section className="grid min-h-[42rem] gap-3 xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <FilterPanel from={dataset.from} to={dataset.to} filters={filters} options={options} />
        <PerformanceFranceMap
          pharmacies={dataset.pharmacies}
          territories={dataset.territories}
          selectedPharmacyId={selectedPharmacyId}
          selectedTerritoryId={selectedTerritoryId}
          onSelectPharmacy={(id) => {
            setSelectedPharmacyId(id);
            setSelectedTerritoryId(null);
          }}
          onSelectTerritory={(id) => {
            setSelectedTerritoryId(id);
            setSelectedPharmacyId(null);
          }}
        />
        <DetailPanel dataset={dataset} pharmacy={selectedPharmacy} territory={selectedTerritory} />
      </section>

      <details className="group overflow-hidden rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--card)]" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="font-semibold text-[var(--tr1-navy)]">Pharmacies affichées</p>
            <p className="text-xs text-muted-foreground">{dataset.pharmacies.length} compte(s) · triable par performance ou priorité</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-[var(--tr1-line)]">
          <div className="flex justify-end p-3">
            <select
              aria-label="Trier le tableau"
              className="h-9 rounded-md border border-[var(--tr1-line-strong)] bg-white px-3 text-sm"
              value={tableSort}
              onChange={(event) => setTableSort(event.target.value as TableSort)}
            >
              <option value="priority">Priorité commerciale</option>
              <option value="revenue">CA décroissant</option>
              <option value="alerts">Alertes urgentes</option>
              <option value="name">Nom</option>
            </select>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pharmacie</TableHead>
                  <TableHead>Secteur / commercial</TableHead>
                  <TableHead>CA période</TableHead>
                  <TableHead>Réassorts</TableHead>
                  <TableHead>Santé</TableHead>
                  <TableHead>Objectif pharmacie</TableHead>
                  <TableHead>Alertes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPharmacies.map((pharmacy) => (
                  <TableRow
                    key={pharmacy.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedPharmacyId(pharmacy.id);
                      setSelectedTerritoryId(null);
                    }}
                  >
                    <TableCell>
                      <p className="font-medium">{pharmacy.name}</p>
                      <p className="text-xs text-muted-foreground">{[pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" ") || "—"}</p>
                    </TableCell>
                    <TableCell>
                      <p>{pharmacy.territoryName ?? "Sans secteur"}</p>
                      <p className="text-xs text-muted-foreground">{pharmacy.agentName ?? "Non affectée"}</p>
                    </TableCell>
                    <TableCell>{formatCurrency(pharmacy.revenueHt)}</TableCell>
                    <TableCell>{formatNumber(pharmacy.reorders)}</TableCell>
                    <TableCell>{pharmacy.healthStatusLabel}</TableCell>
                    <TableCell><span className="text-muted-foreground">Non défini</span></TableCell>
                    <TableCell>
                      {pharmacy.openAlerts ? (
                        <span className="font-semibold text-amber-700">
                          {pharmacy.openAlerts}{pharmacy.overdueAlerts ? ` · ${pharmacy.overdueAlerts} en retard` : ""}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </details>
    </div>
  );
}

function FilterPanel({
  from,
  to,
  filters,
  options,
}: {
  from: string;
  to: string;
  filters: PerformanceMapFilters;
  options: PerformanceMapFilterOptions;
}) {
  return (
    <details className="group h-fit rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--card)]" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold text-[var(--tr1-navy)]"><Filter className="size-4" />Filtres</span>
        <ChevronDown className="size-4 transition group-open:rotate-180" />
      </summary>
      <form action="/dashboard/network/performance-map" className="space-y-3 border-t border-[var(--tr1-line)] p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Du"><input className={fieldClass} defaultValue={from} name="from" type="date" /></Field>
          <Field label="Au"><input className={fieldClass} defaultValue={to} name="to" type="date" /></Field>
        </div>
        <label className="relative block">
          <span className="sr-only">Rechercher</span>
          <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
          <input className={`${fieldClass} pl-9`} defaultValue={filters.q} name="q" placeholder="Pharmacie, ville, CIP…" />
        </label>
        <SelectField label="Secteur commercial" name="territory" value={filters.territory} options={options.territories} allLabel="Tous les secteurs" />
        <SelectField label="Commercial" name="agent" value={filters.agent} options={options.agents} allLabel="Toute l’équipe" />
        <SelectField label="Groupement" name="group" value={filters.group} options={options.groups} allLabel="Tous les groupements" />
        <label className="block space-y-1">
          <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Produit / gamme</span>
          <select className={fieldClass} name="product" defaultValue={filters.product ?? "all"}>
            <option value="all">Tous les produits</option>
            {options.families.length ? (
              <optgroup label="Gammes">
                {options.families.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </optgroup>
            ) : null}
            <optgroup label="Produits">
              {options.products.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
          </select>
        </label>
        <SelectField label="Statut pharmacie" name="status" value={filters.status} options={options.statuses} allLabel="Tous les statuts" />
        <SelectField label="Potentiel" name="potential" value={filters.potential} options={options.potentials} allLabel="Tous les potentiels" />
        <SelectField label="Priorité" name="priority" value={filters.priority} options={options.priorities} allLabel="Toutes les priorités" />
        <Button className="w-full" type="submit">Appliquer</Button>
        <Button asChild className="w-full" type="button" variant="ghost">
          <Link href="/dashboard/network/performance-map"><RotateCcw className="size-3.5" />Réinitialiser</Link>
        </Button>
      </form>
    </details>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  allLabel,
}: {
  label: string;
  name: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      <select className={fieldClass} name={name} defaultValue={value ?? "all"}>
        <option value="all">{allLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const fieldClass = "h-10 w-full rounded-md border border-[var(--tr1-line-strong)] bg-white px-3 text-sm";

function PerformanceFranceMap({
  pharmacies,
  territories,
  selectedPharmacyId,
  selectedTerritoryId,
  onSelectPharmacy,
  onSelectTerritory,
}: {
  pharmacies: PerformanceMapPharmacy[];
  territories: PerformanceMapTerritory[];
  selectedPharmacyId: string | null;
  selectedTerritoryId: string | null;
  onSelectPharmacy: (id: string) => void;
  onSelectTerritory: (id: string) => void;
}) {
  const viewport = useMemo(() => buildProjectionViewport([], "manager"), []);
  const territoryByDepartment = useMemo(() => {
    const index = new Map<string, PerformanceMapTerritory>();
    territories.forEach((territory) => territory.departmentCodes.forEach((code) => {
      if (!index.has(code)) index.set(code, territory);
    }));
    return index;
  }, [territories]);
  const paths = useMemo(() => (franceDepartments as { features: GeometryFeature[] }).features.map((feature) => ({
    code: feature.properties.code,
    name: feature.properties.nom,
    d: featureToPath(feature, viewport),
  })), [viewport]);
  const points = useMemo(() => spreadPoints(
    pharmacies
      .filter((pharmacy) => pharmacy.latitude != null && pharmacy.longitude != null)
      .map((pharmacy) => ({
        pharmacy,
        point: projectCoordinate(
          { latitude: pharmacy.latitude!, longitude: pharmacy.longitude! },
          viewport,
          MAP_WIDTH,
          MAP_HEIGHT,
        ),
      })),
  ), [pharmacies, viewport]);

  return (
    <Card className="min-h-[42rem] overflow-hidden py-0">
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--tr1-line)] px-3 py-2 text-[0.66rem] text-muted-foreground">
          <LegendSwatch fill="#dcebe2" label="Secteur ≥ 100 %" />
          <LegendSwatch fill="#f6e7cc" label="Secteur 80–99 %" />
          <LegendSwatch fill="#f1d6d3" label="Secteur < 80 %" />
          <LegendSwatch fill="#eee8df" label="Sans objectif comparable" />
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#8d9297]" />Pharmacie : objectif non défini</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border-2 border-amber-600 bg-transparent" />Action ouverte</span>
        </div>
        <div className="relative min-h-[38rem] flex-1 overflow-hidden bg-[#fdf8f1]">
          <svg
            aria-label="Carte de performance du réseau"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          >
            <g stroke="#d6c8b7" strokeWidth="0.8">
              {paths.map((path) => {
                const territory = territoryByDepartment.get(path.code);
                const selected = territory?.id === selectedTerritoryId;
                return (
                  <path
                    aria-label={territory ? `${path.name} · ${territory.name}` : path.name}
                    className={territory ? "cursor-pointer transition hover:opacity-80" : undefined}
                    d={path.d}
                    fill={territoryFill(territory?.objectiveAttainment ?? null)}
                    key={path.code}
                    onClick={() => territory && onSelectTerritory(territory.id)}
                    stroke={selected ? "#e67929" : "#d6c8b7"}
                    strokeWidth={selected ? 2.4 : 0.8}
                  />
                );
              })}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0">
            {points.map(({ pharmacy, point }) => {
              const selected = pharmacy.id === selectedPharmacyId;
              const hasAlert = pharmacy.openAlerts > 0;
              return (
                <button
                  aria-label={`${pharmacy.name} · ${pharmacy.healthStatusLabel}${hasAlert ? ` · ${pharmacy.openAlerts} action(s) ouverte(s)` : ""}`}
                  className={`pointer-events-auto absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-sm transition hover:scale-125 ${hasAlert ? "size-4 border-2 border-amber-600 bg-[#8d9297]" : "size-3 border border-white bg-[#8d9297]"} ${selected ? "z-20 ring-4 ring-[var(--tr1-orange)]/35 !bg-[var(--tr1-navy)]" : "z-10"}`}
                  key={pharmacy.id}
                  onClick={() => onSelectPharmacy(pharmacy.id)}
                  style={{ left: `${(point.x / MAP_WIDTH) * 100}%`, top: `${(point.y / MAP_HEIGHT) * 100}%` }}
                  title={`${pharmacy.name} — ${pharmacy.healthStatusLabel}`}
                  type="button"
                />
              );
            })}
          </div>
          {!pharmacies.length ? (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-muted-foreground">
              Aucune pharmacie ne correspond aux filtres sélectionnés.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailPanel({
  dataset,
  pharmacy,
  territory,
}: {
  dataset: PerformanceMapDataset;
  pharmacy: PerformanceMapPharmacy | null;
  territory: PerformanceMapTerritory | null;
}) {
  const defaultStart = `${shiftDate(dataset.to, 1)}T09:00`;

  if (pharmacy) {
    return (
      <Card className="h-fit max-h-[50rem] overflow-auto">
        <CardHeader>
          <p className="font-mono text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Pharmacie</p>
          <CardTitle>{pharmacy.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{[pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" ") || "Localisation non renseignée"}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Datum label="CA période" value={formatCurrency(pharmacy.revenueHt)} />
            <Datum label="Réassorts" value={formatNumber(pharmacy.reorders)} />
            <Datum label="Santé" value={pharmacy.healthStatusLabel} />
            <Datum label="Priorité" value={pharmacy.priorityLevelLabel} />
          </div>
          <div className="rounded-lg border border-[var(--tr1-line)] bg-muted/35 p-3">
            <p className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">Atteinte d’objectif pharmacie</p>
            <p className="mt-1 font-semibold text-[var(--tr1-navy)]">Non définie</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les objectifs TR1 sont actuellement définis au niveau marque, secteur ou commercial. Aucun score pharmacie n’est extrapolé.
            </p>
          </div>
          <Datum label="Secteur" value={pharmacy.territoryName ?? "Sans secteur"} />
          <Datum label="Commercial" value={pharmacy.agentName ?? "Non affectée"} />
          <Datum label="Groupement" value={pharmacy.groupName ?? "Indépendante / non renseigné"} />
          {pharmacy.openAlerts ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{pharmacy.openAlerts} action(s) ouverte(s){pharmacy.overdueAlerts ? ` · ${pharmacy.overdueAlerts} en retard` : ""}</p>
              <p className="mt-1 text-xs">Les alertes sont séparées de la couleur d’objectif pour éviter toute confusion.</p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Lecture :</span> {pharmacy.recommendation}</p>
          {pharmacy.nextBestAction ? (
            <NextBestActionForm
              actionLabel={pharmacy.nextBestAction.label}
              actionType={pharmacy.nextBestAction.type}
              brandPharmacyId={pharmacy.id}
              suggestedDueAt={pharmacy.nextBestAction.dueAt}
            />
          ) : null}
          <details className="rounded-xl border border-[var(--tr1-line)] bg-background p-3">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--tr1-navy)]">
              <CalendarPlus className="size-4" />Planifier une visite
            </summary>
            <div className="mt-3">
              <FieldVisitCreateForm
                defaultBrandId={dataset.brandId}
                defaultObjective={pharmacy.recommendation}
                defaultPharmacyId={pharmacy.pharmacyId}
                defaultStart={defaultStart}
                pharmacies={[{
                  id: pharmacy.pharmacyId,
                  label: pharmacy.name,
                  city: pharmacy.city ?? undefined,
                  brands: [{ relationId: pharmacy.id, brandId: dataset.brandId, brandName: dataset.brandName }],
                }]}
              />
            </div>
          </details>
          <Button asChild className="w-full" variant="outline">
            <Link href={`/dashboard/pharmacies/${pharmacy.id}`}>Ouvrir la fiche pharmacie</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (territory) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <p className="font-mono text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Secteur</p>
          <CardTitle>{territory.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {territory.departmentCodes.length ? `Départements ${territory.departmentCodes.join(", ")}` : "Départements non configurés"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Datum label="Atteinte objectif" value={formatPercent(territory.objectiveAttainment)} />
          {territory.objectiveMetricLabel ? (
            <p className="text-xs text-muted-foreground">Objectif lu : {territory.objectiveMetricLabel}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun objectif secteur comparable sur la période.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Datum label="CA période" value={formatCurrency(territory.revenueHt)} />
            <Datum label="Pharmacies" value={formatNumber(territory.pharmacyCount)} />
            <Datum label="Actives" value={formatNumber(territory.activePharmacies)} />
            <Datum label="À risque" value={formatNumber(territory.atRiskAccounts)} />
          </div>
          <Datum label="Actions ouvertes" value={formatNumber(territory.openAlerts)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader><CardTitle>Lecture du périmètre</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Cliquez un secteur pour lire son objectif et ses résultats, ou une pharmacie pour ouvrir son détail opérationnel.</p>
        <p>Les pharmacies restent volontairement grises : TR1 ne crée pas d’objectif pharmacie lorsque la donnée n’existe pas.</p>
        <p>Les anneaux orange signalent uniquement des actions réellement ouvertes.</p>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  accent = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 bg-[var(--card)] px-3 py-3">
      <span className={`grid size-8 shrink-0 place-items-center rounded-md border border-[var(--tr1-line)] bg-white/75 ${accent ? "text-amber-700" : "text-[var(--tr1-orange)]"}`}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-mono text-xl font-black tracking-[-0.06em] text-[var(--tr1-navy)]">{value}</p>
        <p className="truncate font-mono text-[0.52rem] font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <p className="truncate text-[0.64rem] text-muted-foreground">{detail}</p>
      </div>
    </article>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--tr1-line)] bg-white/60 p-2.5">
      <p className="font-mono text-[0.52rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--tr1-navy)]">{value}</p>
    </div>
  );
}

function LegendSwatch({ fill, label }: { fill: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-black/10" style={{ backgroundColor: fill }} />{label}</span>;
}

function territoryFill(value: number | null) {
  if (value == null) return "#eee8df";
  if (value >= 100) return "#dcebe2";
  if (value >= 80) return "#f6e7cc";
  return "#f1d6d3";
}

function formatCurrency(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00.000Z`));
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function spreadPoints(source: Array<{ pharmacy: PerformanceMapPharmacy; point: { x: number; y: number } }>) {
  const groups = new Map<string, typeof source>();
  source.forEach((item) => {
    const key = `${Math.round(item.point.x / 3)}:${Math.round(item.point.y / 3)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  });
  return [...groups.values()].flatMap((group) => {
    if (group.length === 1) return group;
    const ring = Math.min(44, 18 + group.length * 1.5);
    return group.map((item, index) => {
      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
      return { ...item, point: { x: item.point.x + Math.cos(angle) * ring, y: item.point.y + Math.sin(angle) * ring } };
    });
  });
}

function featureToPath(feature: GeometryFeature, viewport: ProjectionViewport) {
  if (feature.geometry.type === "Polygon") return polygonToPath(feature.geometry.coordinates as number[][][], viewport);
  return (feature.geometry.coordinates as number[][][][]).map((polygon) => polygonToPath(polygon, viewport)).join(" ");
}

function polygonToPath(polygon: number[][][], viewport: ProjectionViewport) {
  return polygon.map((ring) => ring.map(([longitude, latitude], index) => {
    const point = projectCoordinate({ longitude, latitude }, viewport, MAP_WIDTH, MAP_HEIGHT);
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ").concat(" Z")).join(" ");
}
