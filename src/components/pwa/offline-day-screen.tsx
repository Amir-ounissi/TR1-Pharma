"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { enqueueOfflineAction, listOfflineActions } from "@/lib/offline-queue";
import { loadActiveOfflineDaySnapshot, type OfflineDayVisit } from "@/lib/offline-day-snapshot";

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return window.navigator.onLine;
}

function getOnlineServerSnapshot() {
  return false;
}

function parisBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTime(value: string | null) {
  if (!value) return "—";
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

function defaultNextActionDate(delayDays = 7) {
  const date = new Date(Date.now() + delayDays * 86_400_000);
  date.setHours(9, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function mergeReportVisits(snapshot: ReturnType<typeof loadActiveOfflineDaySnapshot>): OfflineDayVisit[] {
  if (!snapshot) return [];
  const visits = [...snapshot.visits];
  const next = snapshot.nextVisit;
  if (next && !visits.some((visit) => visit.brandPharmacyId === next.brand_pharmacy_id)) {
    visits.unshift({
      id: `next-${next.brand_pharmacy_id}`,
      brandPharmacyId: next.brand_pharmacy_id,
      pharmacyId: next.pharmacy_id,
      pharmacyName: next.name,
      city: null,
      startAt: next.scheduled_at ?? snapshot.savedAt,
      endAt: null,
      status: next.status,
    });
  }
  return visits;
}

export function OfflineDayScreen() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof loadActiveOfflineDaySnapshot>>(null);
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [outcome, setOutcome] = useState("completed");
  const [note, setNote] = useState("");
  const [noNextAction, setNoNextAction] = useState(false);
  const [noNextReason, setNoNextReason] = useState("");
  const [nextTaskType, setNextTaskType] = useState("follow_up");
  const [nextTaskAt, setNextTaskAt] = useState(() => defaultNextActionDate(7));
  const [pendingCount, setPendingCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSnapshot(loadActiveOfflineDaySnapshot(window.localStorage));
      setPendingCount(listOfflineActions(window.localStorage).length);
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener("tr1:pwa-day-snapshot-updated", refresh);
    window.addEventListener("tr1:offline-queue-updated", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tr1:pwa-day-snapshot-updated", refresh);
      window.removeEventListener("tr1:offline-queue-updated", refresh);
    };
  }, []);

  const reportVisits = useMemo(() => mergeReportVisits(snapshot), [snapshot]);
  const effectiveVisitId = selectedVisitId || reportVisits[0]?.id || "";
  const selectedVisit = reportVisits.find((visit) => visit.id === effectiveVisitId) ?? null;
  const isCurrentDay = snapshot?.businessDate === parisBusinessDate();

  function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !isCurrentDay || !selectedVisit || note.trim().length < 2) return;
    if (noNextAction && noNextReason.trim().length < 10) return;

    enqueueOfflineAction(window.localStorage, {
      kind: "interaction",
      payload: {
        brandPharmacyId: selectedVisit.brandPharmacyId,
        pharmacyId: selectedVisit.pharmacyId,
        interactionType: "visit",
        outcome,
        note: note.trim(),
        noNextAction,
        noNextReason: noNextAction ? noNextReason.trim() : null,
        nextTaskType: noNextAction ? null : nextTaskType,
        nextTaskAt: noNextAction ? null : nextTaskAt,
        visitStartedAt: null,
        occurredAt: new Date().toISOString(),
        durationMinutes: null,
      },
    });

    const count = listOfflineActions(window.localStorage).length;
    setPendingCount(count);
    setNote("");
    setNoNextReason("");
    setMessage(`Compte rendu enregistré sur cet appareil. ${count} action${count > 1 ? "s" : ""} à synchroniser.`);
    window.dispatchEvent(new Event("tr1:offline-queue-updated"));
  }

  if (!snapshot) {
    return (
      <main className="min-h-dvh bg-[#fffdf8] px-4 py-8 text-[#0b1e32] sm:px-6">
        <div className="mx-auto max-w-md rounded-3xl border border-[#0b1e32]/10 bg-white p-6 shadow-sm">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#0b1e32] text-sm font-black text-white">TR1</div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#c84f24]">Mode hors connexion</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-.04em]">Aucune journée préchargée</h1>
          <p className="mt-3 text-sm leading-6 text-[#0b1e32]/65">
            Ouvrez « Ma journée » une fois avec du réseau pour rendre votre tournée disponible sur cet appareil.
          </p>
          <Link href="/dashboard/agent" className="mt-6 block rounded-xl bg-[#0b1e32] px-4 py-3 text-center text-sm font-semibold text-white">
            {isOnline ? "Charger ma journée" : "Réessayer quand le réseau revient"}
          </Link>
        </div>
      </main>
    );
  }

  const overdue = snapshot.day.tasks.filter((task) => task.is_overdue);

  return (
    <main className="min-h-dvh bg-[#f8f3e9] px-4 py-5 text-[#0b1e32] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-3xl bg-[#0b1e32] p-5 text-white shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.62rem] font-black uppercase tracking-[.16em] text-[#ff9d78]">TR1 hors connexion</p>
              <h1 className="mt-2 text-2xl font-black tracking-[-.045em]">Ma journée · {snapshot.brandName}</h1>
              <p className="mt-1 text-sm text-white/65">{snapshot.dayLabel} · sauvegardée le {formatSavedAt(snapshot.savedAt)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOnline ? "bg-emerald-400/20 text-emerald-100" : "bg-amber-400/20 text-amber-100"}`}>
              {isOnline ? "Réseau revenu" : "Hors ligne"}
            </span>
          </div>
          {!isCurrentDay ? (
            <p className="mt-4 rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
              Ce snapshot date d’une autre journée. Il reste consultable, mais aucun nouveau compte rendu ne peut y être ajouté.
            </p>
          ) : null}
          {pendingCount > 0 ? (
            <p className="mt-4 text-sm font-semibold text-white">{pendingCount} compte rendu{pendingCount > 1 ? "s" : ""} en attente de synchronisation.</p>
          ) : null}
          <Link href="/dashboard/agent" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-[#0b1e32]">
            {isOnline ? "Retourner à Ma journée et synchroniser" : "Réessayer"}
          </Link>
        </header>

        {snapshot.nextVisit ? (
          <section className="rounded-3xl border border-[#e3d8c6] bg-[#fffaf0] p-5 shadow-sm">
            <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Prochaine visite</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{snapshot.nextVisit.name}</h2>
                <p className="mt-1 text-sm text-[#526274]">{snapshot.nextVisit.address}</p>
              </div>
              <strong className="shrink-0 text-sm">{formatTime(snapshot.nextVisit.scheduled_at)}</strong>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Context label="Objectif" value={snapshot.nextVisit.objective || "Suivi commercial"} wide />
              <Context label="Contact" value={snapshot.nextVisit.primary_contact?.name ?? "Non renseigné"} />
              <Context label="Téléphone" value={snapshot.nextVisit.primary_contact?.phone ?? snapshot.nextVisit.phone ?? "Non renseigné"} />
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-[#0b1e32]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Tournée préchargée</p>
              <h2 className="mt-1 text-xl font-black">Visites du jour</h2>
            </div>
            <span className="rounded-full bg-[#f1eadf] px-3 py-1 text-xs font-bold">{snapshot.visits.length}</span>
          </div>
          {snapshot.visits.length ? (
            <div className="mt-4 divide-y divide-[#0b1e32]/8">
              {snapshot.visits.map((visit) => (
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
            <p className="mt-4 text-sm text-[#667384]">Aucune visite planifiée enregistrée dans ce snapshot.</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="En retard" value={overdue.length} />
          <Metric label="Missions" value={snapshot.day.missions.length} />
          <Metric label="Relances" value={snapshot.day.follow_ups.length} />
          <Metric label="Rapports" value={snapshot.day.reports.length} />
        </section>

        {snapshot.stockAlerts.length ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-amber-800">Stock à surveiller</p>
            <div className="mt-3 space-y-3">
              {snapshot.stockAlerts.slice(0, 6).map((alert) => (
                <div key={`${alert.brand_pharmacy_id}-${alert.product_name}`} className="rounded-2xl bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold">{alert.pharmacy_name}</p><p className="text-sm text-[#667384]">{alert.product_name}</p></div>
                    <strong className="text-sm text-amber-800">{alert.days_until_rupture} j</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {isCurrentDay && reportVisits.length ? (
          <section className="rounded-3xl border border-[#0b1e32]/10 bg-white p-5 shadow-sm">
            <p className="font-mono text-[0.6rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Compte rendu terrain</p>
            <h2 className="mt-1 text-xl font-black">Enregistrer sans réseau</h2>
            <p className="mt-2 text-sm text-[#667384]">La saisie reste sur cet appareil et ne sera comptabilisée qu’après réception par TR1.</p>
            <form className="mt-5 space-y-4" onSubmit={saveReport}>
              <label className="block space-y-1.5 text-sm font-semibold">
                <span>Pharmacie</span>
                <select value={effectiveVisitId} onChange={(event) => setSelectedVisitId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 font-normal">
                  {reportVisits.map((visit) => <option key={visit.id} value={visit.id}>{visit.pharmacyName}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["completed", "Visite faite"],
                  ["interested", "Intéressé"],
                  ["no_answer", "Absent / sans réponse"],
                  ["not_interested", "Refus"],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setOutcome(value)} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${outcome === value ? "border-[#c84f24] bg-[#fff2eb] text-[#a63f19]" : "bg-white"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <label className="block space-y-1.5 text-sm font-semibold">
                <span>Ce qu’il faut retenir</span>
                <textarea required minLength={2} maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-normal" placeholder="Stock, offre, merchandising, commande…" />
              </label>

              <label className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-semibold">
                <input type="checkbox" checked={noNextAction} onChange={(event) => setNoNextAction(event.target.checked)} />
                Aucune prochaine action
              </label>

              {noNextAction ? (
                <label className="block space-y-1.5 text-sm font-semibold">
                  <span>Pourquoi ?</span>
                  <textarea required minLength={10} rows={2} value={noNextReason} onChange={(event) => setNoNextReason(event.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-normal" />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#f4efe4] p-3">
                  <label className="space-y-1.5 text-sm font-semibold">
                    <span>Prochaine action</span>
                    <select value={nextTaskType} onChange={(event) => setNextTaskType(event.target.value)} className="h-10 w-full rounded-xl border bg-white px-2 font-normal">
                      <option value="follow_up">Relance</option>
                      <option value="call">Appel</option>
                      <option value="visit">Visite</option>
                      <option value="appointment">Rendez-vous</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    <span>Quand</span>
                    <input type="datetime-local" required value={nextTaskAt} onChange={(event) => setNextTaskAt(event.target.value)} className="h-10 w-full rounded-xl border bg-white px-2 font-normal" />
                  </label>
                </div>
              )}

              {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{message}</p> : null}
              <button type="submit" className="min-h-12 w-full rounded-xl bg-[#c84f24] px-4 text-sm font-black text-white">Enregistrer sur cet appareil</button>
            </form>
          </section>
        ) : null}

        <p className="px-2 pb-6 text-center text-xs leading-5 text-[#667384]">
          Seules les données nécessaires à votre journée terrain sont conservées localement. Aucun token de connexion n’est enregistré dans ce snapshot.
        </p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[#0b1e32]/10 bg-white p-4 text-center shadow-sm"><strong className="block text-2xl">{value}</strong><span className="mt-1 block text-xs text-[#667384]">{label}</span></div>;
}

function Context({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-xl bg-white p-3 ${wide ? "col-span-2" : ""}`}><span className="text-xs text-[#667384]">{label}</span><p className="mt-1 font-semibold">{value}</p></div>;
}
