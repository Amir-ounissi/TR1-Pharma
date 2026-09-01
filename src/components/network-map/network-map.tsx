"use client";

import { useMemo, useState } from "react";
import { Building2, Route, ScanSearch, ShoppingCart, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FranceMap } from "@/components/network-map/france-map";
import { MapBottomStats } from "@/components/network-map/map-bottom-stats";
import { MapDisplayControls, type MapDisplayState } from "@/components/network-map/map-display-controls";
import { MapLegend } from "@/components/network-map/map-legend";
import { NetworkMapLayout } from "@/components/network-map/network-map-layout";
import { PharmacyMapPanel } from "@/components/network-map/pharmacy-map-panel";
import type { NetworkMapDataset } from "@/lib/network-map";

export function NetworkMap({ dataset }: { dataset: NetworkMapDataset }) {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(dataset.pharmacies[0]?.id ?? null);
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="grid grid-cols-5 gap-px overflow-hidden rounded-[0.45rem] border border-[var(--tr1-line-strong)] bg-[var(--tr1-line-strong)]">
        <Metric detail="Périmètre autorisé" icon={Building2} label="Pharmacies visibles" value={dataset.summary.visiblePharmacies} />
        <Metric detail="Couverture active" icon={UserRound} label="Acteurs terrain" value={dataset.summary.activeActors} />
        <Metric detail="Interactions + missions" icon={Route} label="Actions période" value={dataset.summary.actionsInPeriod} />
        <Metric detail="Comptes à suivre" icon={ScanSearch} label="Comptes à traiter" value={dataset.summary.accountsToTreat} />
        <Metric detail="Signaux observés" icon={ShoppingCart} label="Réassorts observés" value={dataset.summary.reordersObserved} />
      </section>

      <Card className="tr1-da-panel flex min-h-0 flex-1 flex-col overflow-hidden py-0">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3">
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
