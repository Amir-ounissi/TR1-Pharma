"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Info, Layers3, MoveRight, Route, ScanSearch, ShoppingCart, UserRound, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FranceMap } from "@/components/network-map/france-map";
import { MapBottomStats } from "@/components/network-map/map-bottom-stats";
import { MapDisplayControls, type MapDisplayState } from "@/components/network-map/map-display-controls";
import { MapLegend } from "@/components/network-map/map-legend";
import { NetworkMapLayout } from "@/components/network-map/network-map-layout";
import { PharmacyMapPanel } from "@/components/network-map/pharmacy-map-panel";
import type { NetworkMapDataset, NetworkMapPharmacy } from "@/lib/network-map";

export function NetworkMap({ dataset }: { dataset: NetworkMapDataset }) {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [selectedActorKey, setSelectedActorKey] = useState<string | null>(null);
  const [controls, setControls] = useState<MapDisplayState>({
    showActors: true,
    showPharmacies: true,
    showConnections: true,
    showInfluenceZones: false,
  });
  const selectedPharmacy = useMemo(
    () => dataset.pharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null,
    [dataset.pharmacies, selectedPharmacyId],
  );
  const hasPharmacies = dataset.pharmacies.length > 0;
  const activePharmacies = dataset.pharmacies.filter((pharmacy) => pharmacy.commercialStatus === "active" || pharmacy.commercialStatus === "implanted").length;
  const activeAnimations = dataset.pharmacies.filter((pharmacy) => pharmacy.signals.animationsInPeriod > 0).length;
  const coverageLabel = dataset.summary.activeActors > 0 ? `${dataset.summary.activeActors} acteurs` : "—";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 md:gap-3">
      <section className="hidden grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--tr1-line-strong)] bg-[var(--tr1-line-strong)] md:grid md:grid-cols-5">
        <Metric detail="Périmètre autorisé" icon={Building2} label="Pharmacies visibles" value={dataset.summary.visiblePharmacies} />
        <Metric detail="Couverture active" icon={UserRound} label="Acteurs terrain" value={dataset.summary.activeActors} />
        <Metric detail="Interactions + missions" icon={Route} label="Actions période" value={dataset.summary.actionsInPeriod} />
        <Metric detail="Comptes à suivre" icon={ScanSearch} label="Comptes à traiter" value={dataset.summary.accountsToTreat} />
        <Metric detail="Signaux observés" icon={ShoppingCart} label="Réassorts observés" value={dataset.summary.reordersObserved} />
      </section>

      <div className="relative flex items-center gap-2 xl:hidden">
        <details className="group relative flex-1">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-[var(--tr1-line-strong)] bg-white/80 font-mono text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--tr1-navy)] [&::-webkit-details-marker]:hidden">
            <Info className="size-3.5" />
            Légende
          </summary>
          <div className="absolute left-0 top-12 z-40 w-[min(19rem,calc(100vw-2rem))] shadow-xl">
            <MapLegend />
          </div>
        </details>
        <details className="group relative flex-1">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-[var(--tr1-line-strong)] bg-white/80 font-mono text-[0.62rem] font-black uppercase tracking-[0.08em] text-[var(--tr1-navy)] [&::-webkit-details-marker]:hidden">
            <Layers3 className="size-3.5" />
            Calques
          </summary>
          <div className="absolute right-0 top-12 z-40 w-[min(19rem,calc(100vw-2rem))] shadow-xl">
            <MapDisplayControls
              controls={controls}
              onToggle={(key) => setControls((current) => ({ ...current, [key]: !current[key] }))}
            />
          </div>
        </details>
      </div>

      <Card className="tr1-da-panel flex min-h-0 flex-1 flex-col overflow-visible rounded-2xl border-0 bg-transparent py-0 shadow-none md:overflow-hidden md:border md:bg-[var(--card)] md:shadow-sm">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-0 md:px-3 md:py-3">
          <NetworkMapLayout
            bottom={
              <MapBottomStats
                activeAnimations={activeAnimations}
                activePharmacies={activePharmacies}
                coverageLabel={coverageLabel}
                priorityCount={dataset.summary.accountsToTreat}
              />
            }
            center={
              hasPharmacies ? (
                <FranceMap
                  actors={dataset.actors}
                  controls={controls}
                  onSelectActor={setSelectedActorKey}
                  onSelectPharmacy={setSelectedPharmacyId}
                  pharmacies={dataset.pharmacies}
                  roleScope={dataset.roleScope}
                  selectedActorKey={selectedActorKey}
                  selectedPharmacyId={selectedPharmacyId}
                />
              ) : (
                <div className="flex h-full min-h-[26rem] items-center justify-center rounded-[0.95rem] border border-[var(--tr1-line-strong)] bg-[#fdf8f1] p-8 text-center">
                  <div className="max-w-md space-y-3">
                    <p className="tr1-da-eyebrow">Carte du réseau</p>
                    <h3 className="text-xl font-semibold">Aucune pharmacie visible pour cette vue.</h3>
                    <p className="text-sm text-muted-foreground">
                      Essayez un autre filtre, une autre période, ou revenez à la liste pour vérifier les données disponibles.
                    </p>
                  </div>
                </div>
              )
            }
            left={
              <>
                <MapLegend />
                <MapDisplayControls
                  controls={controls}
                  onToggle={(key) => setControls((current) => ({ ...current, [key]: !current[key] }))}
                />
              </>
            }
            right={<PharmacyMapPanel pharmacy={selectedPharmacy} />}
          />
        </CardContent>
      </Card>

      {selectedPharmacy ? (
        <MobilePharmacySheet pharmacy={selectedPharmacy} onClose={() => setSelectedPharmacyId(null)} />
      ) : null}
    </div>
  );
}

function MobilePharmacySheet({ pharmacy, onClose }: { pharmacy: NetworkMapPharmacy; onClose: () => void }) {
  const lastInteraction = pharmacy.lastInteractionAt
    ? new Date(pharmacy.lastInteractionAt).toLocaleDateString("fr-FR")
    : "—";
  const nextAction = pharmacy.nextActionType
    ? `${pharmacy.nextActionType}${pharmacy.nextActionAt ? ` · ${new Date(pharmacy.nextActionAt).toLocaleDateString("fr-FR")}` : ""}`
    : "Aucune action planifiée";

  return (
    <aside className="fixed inset-x-3 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-2xl border border-[var(--tr1-line-strong)] bg-[var(--card)] p-3 shadow-2xl xl:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black text-[var(--tr1-navy)]">{pharmacy.name}</p>
            <span className="shrink-0 rounded-full border border-[var(--tr1-line-strong)] bg-white/75 px-2 py-0.5 font-mono text-[0.52rem] font-black uppercase tracking-[0.06em] text-[var(--tr1-navy)]">
              {pharmacy.commercialStatusLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" · ") || pharmacy.territoryName || "Officine"}
          </p>
        </div>
        <button
          aria-label="Fermer la fiche rapide"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--tr1-line)] bg-white/75 text-muted-foreground"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <QuickDatum label="Potentiel" value={pharmacy.potentialLevelLabel ?? "Inconnu"} />
        <QuickDatum label="Dernière interaction" value={lastInteraction} />
        <div className="col-span-2">
          <QuickDatum label="Prochaine action" value={nextAction} />
        </div>
      </div>

      <Link
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--tr1-navy)] font-mono text-[0.66rem] font-black uppercase tracking-[0.08em] text-white"
        href={`/dashboard/pharmacies/${pharmacy.id}`}
      >
        Ouvrir la fiche
        <MoveRight className="size-4" />
      </Link>
    </aside>
  );
}

function QuickDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--tr1-line)] bg-white/65 px-2.5 py-2">
      <p className="font-mono text-[0.5rem] font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[0.72rem] font-semibold text-[var(--tr1-navy)]">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Building2;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 bg-[var(--card)] px-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-[0.45rem] border border-[var(--tr1-line)] bg-white/75 text-[var(--tr1-orange)]">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[1.35rem] font-black leading-none tracking-[-0.08em] text-[var(--tr1-navy)]">{value}</p>
        <p className="mt-1 truncate font-mono text-[0.5rem] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="truncate text-[0.66rem] text-muted-foreground">{detail}</p>
      </div>
    </article>
  );
}
