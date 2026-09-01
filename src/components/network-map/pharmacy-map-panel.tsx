"use client";

import { useMemo, useState } from "react";
import { Clock3, MoveRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NetworkMapPharmacy } from "@/lib/network-map";

export function PharmacyMapPanel({ pharmacy }: { pharmacy: NetworkMapPharmacy | null }) {
  const [tab, setTab] = useState<"situation" | "why" | "next" | "history">("situation");
  const metrics = useMemo(
    () => [
      { label: "CA période", value: "—" },
      { label: "Potentiel", value: pharmacy?.potentialLevelLabel ?? "—" },
      { label: "Dernière interaction", value: pharmacy?.lastInteractionAt ? new Date(pharmacy.lastInteractionAt).toLocaleDateString("fr-FR") : "—" },
      { label: "Dernier réassort", value: (pharmacy?.signals.reordersInPeriod ?? 0) > 0 ? "Observé" : "—" },
      { label: "Segment", value: pharmacy?.commercialStatusLabel ?? "—" },
      { label: "Panier moyen", value: "—" },
    ],
    [pharmacy],
  );

  const tabs = [
    { key: "situation" as const, label: "Situation" },
    { key: "why" as const, label: "Pourquoi agir" },
    { key: "next" as const, label: "Prochaine action" },
    { key: "history" as const, label: "Historique" },
  ];

  if (!pharmacy) {
    return (
      <Card className="tr1-da-panel h-full overflow-hidden py-0">
        <CardHeader className="border-b border-[var(--tr1-line)] px-3 py-3">
          <CardTitle className="text-sm">Fiche pharmacie</CardTitle>
        </CardHeader>
        <CardContent className="px-3 py-4 text-sm text-muted-foreground">
          Sélectionnez une pharmacie sur la carte pour voir sa situation, le pourquoi agir et la prochaine action.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="tr1-da-panel flex h-full min-h-0 flex-col overflow-hidden py-0">
      <CardHeader className="space-y-2 border-b border-[var(--tr1-line)] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="tr1-da-eyebrow mb-1">Pharmacie</p>
            <CardTitle className="text-base">{pharmacy.name}</CardTitle>
            <p className="text-[0.78rem] text-muted-foreground">
              {pharmacy.city || "Ville non renseignée"}{pharmacy.postalCode ? ` · ${pharmacy.postalCode}` : ""}
            </p>
          </div>
          <Badge className="rounded-[0.35rem] border-[var(--tr1-line-strong)] bg-white/75 text-[var(--tr1-navy)]" variant="outline">
            {pharmacy.commercialStatusLabel}
          </Badge>
        </div>
        {pharmacy.priorityLevel === "strategic" ? (
          <div className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--tr1-orange)]">★ Compte stratégique</div>
        ) : null}
      </CardHeader>
      <CardContent className="min-h-0 space-y-3 overflow-y-auto px-3 py-3 text-sm">
        <div className="grid grid-cols-2 gap-1.5">
          {tabs.map((item) => (
            <button
              className={`rounded-[0.45rem] border px-2.5 py-1.5 font-mono text-[0.54rem] font-bold uppercase tracking-[0.08em] ${
                tab === item.key
                  ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
                  : "border-[var(--tr1-line-strong)] bg-white/75 text-[var(--tr1-navy)]"
              }`}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "situation" ? (
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {metrics.map((item) => (
                <div className="rounded-[0.55rem] border border-[var(--tr1-line)] bg-white/62 px-2.5 py-2.5" key={item.label}>
                  <p className="font-mono text-[0.52rem] font-black uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-[0.74rem] font-medium text-[var(--tr1-navy)]">{item.value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "why" ? (
          <section className="space-y-2">
            <div className="rounded-[0.6rem] border border-[var(--tr1-line)] bg-white/72 px-2.5 py-2.5">
              <p className="font-mono text-[0.58rem] font-black uppercase tracking-[0.12em] text-muted-foreground">Pourquoi agir</p>
              <p className="mt-1.5 text-[0.78rem] leading-5 text-[var(--tr1-navy)]">{pharmacy.presentationReason}</p>
            </div>
            <div className="rounded-[0.6rem] border border-[var(--tr1-line)] bg-white/72 px-2.5 py-2.5">
              <p className="font-mono text-[0.58rem] font-black uppercase tracking-[0.12em] text-muted-foreground">Responsable</p>
              <p className="mt-1.5 text-[0.78rem] text-[var(--tr1-navy)]">{pharmacy.agentName || "Non affecté"}</p>
            </div>
          </section>
        ) : null}

        {tab === "next" ? (
          <section className="space-y-2">
            <div className="flex items-center gap-2.5 rounded-[0.7rem] border border-[var(--tr1-line)] bg-white/78 px-2.5 py-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-[var(--tr1-orange)]/12 text-[var(--tr1-orange)]">
                <Clock3 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.56rem] font-black uppercase tracking-[0.12em] text-muted-foreground">Prochaine action</p>
                <p className="truncate text-[0.78rem] font-semibold text-[var(--tr1-navy)]">
                  {pharmacy.nextActionType || "Aucune prochaine action"}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  {pharmacy.nextActionAt ? new Date(pharmacy.nextActionAt).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="space-y-2">
            <HistoryRow label="Interactions observées" value={String(pharmacy.signals.interactionsInPeriod)} />
            <HistoryRow label="Missions terrain" value={String(pharmacy.signals.missionsInPeriod)} />
            <HistoryRow label="Animations / formations" value={String(pharmacy.signals.animationsInPeriod + pharmacy.signals.trainingsInPeriod)} />
          </section>
        ) : null}

        <Button asChild className="w-full rounded-[0.45rem] bg-[var(--tr1-navy)] hover:bg-[var(--tr1-navy-soft)]">
          <Link href={`/dashboard/pharmacies/${pharmacy.id}`}>
            Ouvrir la fiche pharmacie
            <MoveRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[0.55rem] border border-[var(--tr1-line)] bg-white/68 px-2.5 py-2.5">
      <span className="text-[0.76rem] text-[var(--tr1-navy)]">{label}</span>
      <span className="font-mono text-[0.7rem] font-black uppercase tracking-[0.06em] text-muted-foreground">{value}</span>
    </div>
  );
}
