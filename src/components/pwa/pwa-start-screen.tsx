"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadActiveOfflineDaySnapshot, type OfflineDaySnapshot } from "@/lib/offline-day-snapshot";

function formatTime(value: string | null) {
  if (!value) return "Horaire à confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function PwaStartScreen() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<OfflineDaySnapshot | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const isOnline = window.navigator.onLine;
      setSnapshot(loadActiveOfflineDaySnapshot(window.localStorage));
      setOnline(isOnline);
      if (isOnline) router.replace("/dashboard/agent");
    }, 0);

    const onConnectivityChange = () => {
      const isOnline = window.navigator.onLine;
      setOnline(isOnline);
      if (isOnline) {
        router.replace("/dashboard/agent");
      }
    };
    window.addEventListener("online", onConnectivityChange);
    window.addEventListener("offline", onConnectivityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", onConnectivityChange);
      window.removeEventListener("offline", onConnectivityChange);
    };
  }, [router]);

  return (
    <main className="min-h-dvh bg-[#f4f0e7] px-4 py-5 text-[#0b1e32] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-3xl bg-[#0b1e32] p-5 text-white shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.62rem] font-black uppercase tracking-[.16em] text-[#ff9d78]">TR1 instant terrain</p>
              <h1 className="mt-2 text-2xl font-black tracking-[-.045em]">Ma journée, sans attendre.</h1>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
              {online ? "En ligne" : "Hors ligne"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Les dernières données terrain disponibles sur cet appareil s’affichent immédiatement. La version à jour est préchargée en arrière-plan.
          </p>
        </header>

        {snapshot ? (
          <>
            <section className="rounded-3xl border border-[#0b1e32]/10 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-[#c84f24]">{snapshot.brandName}</p>
                  <h2 className="mt-1 text-xl font-black">{snapshot.dayLabel}</h2>
                </div>
                <span className="text-right text-xs leading-5 text-[#667384]">Mise à jour<br />{formatSavedAt(snapshot.savedAt)}</span>
              </div>
            </section>

            {snapshot.nextVisit ? (
              <section className="rounded-3xl border border-[#e2d7c6] bg-[#fffaf0] p-5 shadow-sm">
                <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Prochaine visite</p>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black">{snapshot.nextVisit.name}</h2>
                    <p className="mt-1 text-sm text-[#667384]">{snapshot.nextVisit.address}</p>
                  </div>
                  <strong className="shrink-0 text-sm">{formatTime(snapshot.nextVisit.scheduled_at)}</strong>
                </div>
                <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-medium">
                  {snapshot.nextVisit.objective || "Suivi commercial"}
                </p>
              </section>
            ) : null}

            <section className="rounded-3xl border border-[#0b1e32]/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Tournée disponible</p>
                  <h2 className="mt-1 text-xl font-black">Visites du jour</h2>
                </div>
                <span className="rounded-full bg-[#f1eadf] px-3 py-1 text-xs font-bold">{snapshot.visits.length}</span>
              </div>
              {snapshot.visits.length ? (
                <div className="mt-4 divide-y divide-[#0b1e32]/8">
                  {snapshot.visits.slice(0, 5).map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="font-semibold">{visit.pharmacyName}</p>
                        <p className="mt-0.5 text-xs text-[#667384]">{visit.city || "Ville non renseignée"}</p>
                      </div>
                      <span className="font-mono text-sm font-black">{formatTime(visit.startAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#667384]">Aucune visite enregistrée dans le dernier snapshot.</p>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-3xl border border-[#0b1e32]/10 bg-white p-6 shadow-sm">
            <p className="font-semibold">Première ouverture sur cet appareil</p>
            <p className="mt-2 text-sm leading-6 text-[#667384]">
              Ouvrez Ma journée avec du réseau une première fois. TR1 conservera ensuite localement les informations utiles à votre tournée.
            </p>
          </section>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/dashboard/agent"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0b1e32] px-4 text-sm font-black text-white"
          >
            Ouvrir Ma journée à jour
          </Link>
          <Link
            href="/offline"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#0b1e32]/12 bg-white px-4 text-sm font-semibold"
          >
            Continuer avec les données locales
          </Link>
        </div>
      </div>
    </main>
  );
}
