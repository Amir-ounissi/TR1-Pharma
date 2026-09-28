"use client";

import { useEffect, useState } from "react";
import { loadActiveOfflineDaySnapshot, type OfflineDaySnapshot } from "@/lib/offline-day-snapshot";
import { Skeleton } from "@/components/ui/skeleton";

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function AgentFastLoading() {
  const [snapshot, setSnapshot] = useState<OfflineDaySnapshot | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSnapshot(loadActiveOfflineDaySnapshot(window.localStorage));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-6xl space-y-4" aria-label="Chargement de Ma journée" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-36" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-label="Actualisation de Ma journée" aria-busy="true">
      <div className="rounded-2xl border border-[var(--tr1-orange)]/20 bg-[var(--tr1-orange)]/[0.05] px-4 py-3">
        <p className="text-xs font-semibold text-[var(--tr1-orange)]">Dernières données disponibles · actualisation en cours</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--tr1-navy)]">Ma journée</h1>
        <p className="mt-1 text-sm text-muted-foreground">{snapshot.brandName} · {snapshot.visits.length} visite{snapshot.visits.length > 1 ? "s" : ""} enregistrée{snapshot.visits.length > 1 ? "s" : ""}</p>
      </div>

      {snapshot.nextVisit ? (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-[var(--tr1-orange)]">Prochaine visite</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--tr1-navy)]">{snapshot.nextVisit.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{snapshot.nextVisit.address}</p>
            </div>
            <strong className="shrink-0 text-sm">{formatTime(snapshot.nextVisit.scheduled_at)}</strong>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {snapshot.visits.slice(0, 4).map((visit) => (
          <div key={visit.id} className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">{visit.pharmacyName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{visit.city || "Ville non renseignée"} · {formatTime(visit.startAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
