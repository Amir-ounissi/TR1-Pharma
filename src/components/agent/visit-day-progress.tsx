"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronDown, MapPin, Play, ShoppingCart } from "lucide-react";
import {
  completeFieldVisitAction,
  startFieldVisitAction,
  type VisitActionState,
} from "@/app/(protected)/dashboard/agent/visit-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addDaysToCalendarDate,
  buildVisitDay,
  type FieldVisitAgendaEvent,
  type FieldVisitCompletion,
} from "@/lib/field-visit-progress";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function VisitDayProgress({
  brandId,
  today,
  visits,
  completions,
}: {
  brandId: string;
  today: string;
  visits: FieldVisitAgendaEvent[];
  completions: FieldVisitCompletion[];
}) {
  const day = useMemo(() => buildVisitDay(visits, completions), [visits, completions]);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const progress = day.total ? Math.round((day.done / day.total) * 100) : 0;

  if (!day.total) {
    return (
      <section className="tr1-panel px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="tr1-eyebrow">Exécution terrain</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--tr1-navy)]">Visites du jour</h2>
          </div>
          <span className="rounded-md border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] px-2 py-1 font-mono text-xs font-bold text-[var(--tr1-muted)]">0 / 0</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Aucune visite planifiée aujourd’hui. L’agenda reste la source de vérité pour préparer la journée.</p>
      </section>
    );
  }

  return (
    <section className="tr1-panel overflow-hidden">
      <div className="border-b border-[var(--tr1-line)] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tr1-eyebrow">Exécution terrain</p>
            <div className="mt-1 flex items-baseline gap-2">
              <h2 className="text-lg font-bold text-[var(--tr1-navy)]">Visites du jour</h2>
              <span className="font-mono text-sm font-black text-[var(--tr1-navy)]">{day.done}/{day.total}</span>
            </div>
          </div>
          <Link href="/dashboard/agenda" className="text-xs font-bold text-[var(--tr1-blue)] hover:underline">Voir l’agenda</Link>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-sm bg-[var(--tr1-ivory-deep)]" role="progressbar" aria-label="Visites clôturées aujourd’hui" aria-valuemin={0} aria-valuemax={day.total} aria-valuenow={day.done}>
          <div className="h-full bg-[var(--tr1-success)] transition-[width]" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--tr1-line)] rounded-md border border-[var(--tr1-line)] bg-[var(--tr1-ivory)] py-2 text-center">
          <div><p className="font-mono text-base font-black text-[var(--tr1-success)]">{day.done}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Terminées</p></div>
          <div><p className="font-mono text-base font-black text-[var(--tr1-orange)]">{day.needsCompletion}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">À compléter</p></div>
          <div><p className="font-mono text-base font-black text-[var(--tr1-navy)]">{day.todo}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">À faire</p></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Une visite compte uniquement après réponse commande + photo, note obligatoire et prochaine date de visite.</p>
      </div>

      <div className="divide-y divide-[var(--tr1-line)]">
        {day.visits.map((visit) => {
          const state = day.state(visit);
          const completion = day.completionByVisit.get(visit.source_id);
          const expanded = expandedVisitId === visit.source_id;
          return (
            <div key={visit.source_id} className="px-4 py-3 sm:px-5">
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center">
                <div className="font-mono text-sm font-black text-[var(--tr1-navy)]">{formatTime(visit.start_at)}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-[var(--tr1-navy)]">{visit.pharmacy_name || "Pharmacie"}</p>
                    {state === "done" ? <span className="rounded-sm bg-[#e8f0e9] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tr1-success)]">Terminée</span> : null}
                    {state === "needs_completion" ? <span className="rounded-sm bg-[#fff0e4] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tr1-orange)]">À compléter</span> : null}
                    {state === "todo" ? <span className="rounded-sm bg-[#e9edf3] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tr1-navy-soft)]">À faire</span> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{visit.title}{visit.city ? ` · ${visit.city}` : ""}</p>
                  {completion ? (
                    <p className="mt-1 text-xs text-[var(--tr1-success)]">Prochaine visite : {formatDate(completion.next_visit_date)} · {completion.order_result === "order_taken" ? "commande prise" : "sans commande"}</p>
                  ) : null}
                </div>

                <div className="col-span-2 flex items-center gap-2 pl-[4.25rem] sm:col-span-1 sm:pl-0">
                  {visit.pharmacy_id ? <Button asChild variant="outline" size="sm" className="h-9 px-2.5"><Link href={`/dashboard/pharmacies/${visit.pharmacy_id}`} aria-label={`Ouvrir ${visit.pharmacy_name || "la pharmacie"}`}><MapPin className="h-4 w-4" /></Link></Button> : null}
                  {state === "todo" ? <StartVisitButton brandId={brandId} visitId={visit.source_id} onStarted={() => setExpandedVisitId(visit.source_id)} /> : null}
                  {state === "needs_completion" ? <Button type="button" size="sm" onClick={() => setExpandedVisitId(expanded ? null : visit.source_id)} className="h-9 bg-[var(--tr1-orange)] text-white hover:bg-[#d65d05]">Clôturer <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></Button> : null}
                  {state === "done" ? <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs font-bold text-[var(--tr1-success)]"><Check className="h-4 w-4" /> Conforme</span> : null}
                </div>
              </div>

              {expanded && state === "needs_completion" ? (
                <VisitCompletionForm brandId={brandId} visit={visit} today={today} onDone={() => setExpandedVisitId(null)} />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StartVisitButton({ brandId, visitId, onStarted }: { brandId: string; visitId: string; onStarted: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<VisitActionState, FormData>(startFieldVisitAction, {});

  useEffect(() => {
    if (!state.success) return;
    onStarted();
    router.refresh();
  }, [onStarted, router, state.success]);

  return (
    <form action={action}>
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="visitId" value={visitId} />
      <Button type="submit" size="sm" disabled={pending} className="h-9 bg-[var(--tr1-navy)] text-white hover:bg-[var(--tr1-navy-soft)]">
        <Play className="mr-1 h-3.5 w-3.5" /> {pending ? "…" : "Démarrer"}
      </Button>
      {state.error ? <span className="sr-only" role="alert">{state.error}</span> : null}
    </form>
  );
}

function VisitCompletionForm({ brandId, visit, today, onDone }: { brandId: string; visit: FieldVisitAgendaEvent; today: string; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<VisitActionState, FormData>(completeFieldVisitAction, {});
  const [orderResult, setOrderResult] = useState<"order_taken" | "no_order" | "">("");
  const [photoResult, setPhotoResult] = useState<"photo_added" | "not_required" | "">("");
  const [note, setNote] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState(addDaysToCalendarDate(today, 15));
  const [photoName, setPhotoName] = useState("");

  useEffect(() => {
    if (!state.success) return;
    onDone();
    router.refresh();
  }, [onDone, router, state.success]);

  const ready = Boolean(
    orderResult &&
      photoResult &&
      note.trim().length >= 2 &&
      nextVisitDate &&
      (photoResult !== "photo_added" || photoName),
  );

  return (
    <form action={action} className="mt-4 border-t border-[var(--tr1-line)] pt-4">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="visitId" value={visit.source_id} />
      <input type="hidden" name="orderResult" value={orderResult} />
      <input type="hidden" name="photoResult" value={photoResult} />
      <input type="hidden" name="nextVisitDate" value={nextVisitDate} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="tr1-eyebrow">Checklist de clôture</p>
          <h3 className="mt-1 text-sm font-bold text-[var(--tr1-navy)]">{visit.pharmacy_name || visit.title}</h3>
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--tr1-orange)]">4 étapes</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-xs font-bold text-[var(--tr1-navy)]">1 · Commande ?</legend>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton active={orderResult === "order_taken"} onClick={() => setOrderResult("order_taken")}><ShoppingCart className="h-4 w-4" /> Commande prise</ChoiceButton>
            <ChoiceButton active={orderResult === "no_order"} onClick={() => setOrderResult("no_order")}>Pas de commande</ChoiceButton>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-bold text-[var(--tr1-navy)]">2 · Photo ?</legend>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton active={photoResult === "photo_added"} onClick={() => setPhotoResult("photo_added")}><Camera className="h-4 w-4" /> Ajouter</ChoiceButton>
            <ChoiceButton active={photoResult === "not_required"} onClick={() => { setPhotoResult("not_required"); setPhotoName(""); }}>Non pertinente</ChoiceButton>
          </div>
        </fieldset>
      </div>

      {photoResult === "photo_added" ? (
        <div className="mt-3 rounded-md border border-dashed border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory)] p-3">
          <Label htmlFor={`visit-photo-${visit.source_id}`} className="text-xs font-bold">Preuve photo</Label>
          <input
            id={`visit-photo-${visit.source_id}`}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            required
            onChange={(event) => setPhotoName(event.target.files?.[0]?.name || "")}
            className="mt-2 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[var(--tr1-navy)] file:px-3 file:py-2 file:font-semibold file:text-white"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">{photoName || "Photo appareil ou photothèque · 10 Mo max."}</p>
        </div>
      ) : null}

      <div className="mt-4">
        <Label htmlFor={`visit-note-${visit.source_id}`} className="text-xs font-bold">3 · Note de visite *</Label>
        <Textarea id={`visit-note-${visit.source_id}`} name="note" required minLength={2} maxLength={2000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ce qu’il faut retenir, décision, frein, engagement…" className="mt-2 bg-white" />
      </div>

      <div className="mt-4">
        <Label htmlFor={`next-visit-${visit.source_id}`} className="text-xs font-bold">4 · Date de prochaine visite *</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[7, 15, 30].map((days) => (
            <Button key={days} type="button" variant="outline" size="sm" onClick={() => setNextVisitDate(addDaysToCalendarDate(today, days))} className="h-9 font-mono text-xs">+{days} j</Button>
          ))}
          <input id={`next-visit-${visit.source_id}`} type="date" min={addDaysToCalendarDate(today, 1)} value={nextVisitDate} onChange={(event) => setNextVisitDate(event.target.value)} className="h-9 rounded-md border border-input bg-white px-2 text-sm" />
        </div>
      </div>

      {state.error ? <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-destructive">{state.error}</p> : null}
      {state.success ? <p role="status" className="mt-3 text-xs font-medium text-[var(--tr1-success)]">{state.success}</p> : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--tr1-line)] pt-4">
        <p className="hidden text-[11px] text-muted-foreground sm:block">Pas de validation partielle : la visite n’avance le compteur qu’une fois les 4 étapes complètes.</p>
        <Button type="submit" disabled={pending || !ready} className="ml-auto min-h-11 bg-[var(--tr1-orange)] px-5 text-white hover:bg-[#d65d05] disabled:opacity-40">
          {pending ? "Clôture…" : "Clôturer la visite"}
        </Button>
      </div>
    </form>
  );
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-2 text-center text-xs font-bold transition ${active ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white" : "border-[var(--tr1-line-strong)] bg-white text-[var(--tr1-navy)] hover:bg-[var(--tr1-ivory)]"}`}>
      {active ? <Check className="h-3.5 w-3.5" /> : null}{children}
    </button>
  );
}
