"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  closeFieldVisitAction,
  type VisitCloseoutActionState,
} from "@/app/(protected)/dashboard/visits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type AgentPendingCloseoutVisit = {
  id: string;
  pharmacyName: string;
  city: string | null;
  startAt: string;
  href: string;
};

const emptyState: VisitCloseoutActionState = {};

function visitTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function AgentVisitCloseoutQueue({ visits }: { visits: AgentPendingCloseoutVisit[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(closeFieldVisitAction, emptyState);
  const current = visits[0];

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  if (!current) {
    return (
      <section id="visit-closeouts" className="scroll-mt-24 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-700" />
          <div>
            <h2 className="font-bold text-emerald-950">Visites du jour à jour</h2>
            <p className="mt-1 text-sm text-emerald-900/70">Aucune visite à clôturer.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="visit-closeouts" className="scroll-mt-24 rounded-2xl border border-[var(--tr1-line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
            Fin de visite
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--tr1-navy)]">
            {visits.length} visite{visits.length > 1 ? "s" : ""} à clôturer
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clôture-les ici, une par une, sans retourner dans chaque fiche pharmacie.
          </p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[var(--tr1-orange)]">
          {visits.length} restante{visits.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--tr1-line)] bg-[var(--tr1-ivory)]/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">À clôturer maintenant · {visitTime(current.startAt)}</p>
            <p className="mt-1 text-lg font-bold text-[var(--tr1-navy)]">{current.pharmacyName}</p>
            {current.city ? <p className="text-sm text-muted-foreground">{current.city}</p> : null}
          </div>
          <Link href={current.href} className="text-xs font-semibold text-[var(--tr1-navy)] underline-offset-4 hover:underline">
            Voir la visite
          </Link>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="visitId" value={current.id} />
          <input type="hidden" name="inputMode" value="manual" />

          {state.error ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
          ) : null}
          {state.success ? (
            <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <div>
              <Label className="mb-1.5">Résultat</Label>
              <select name="outcome" defaultValue="no_order" className="min-h-11 w-full rounded-md border bg-background px-3 text-sm">
                <option value="order_taken">Commande prise</option>
                <option value="no_order">Pas de commande</option>
                <option value="follow_up">À relancer</option>
                <option value="information">Information / suivi</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <Label className="mb-1.5">Compte rendu</Label>
              <Textarea
                name="summary"
                required
                rows={4}
                className="min-h-28 text-base sm:text-sm"
                placeholder="Ce qui s’est passé, ce qui a été décidé et la suite à donner…"
              />
            </div>
          </div>

          <details className="rounded-xl border bg-white px-4 py-2">
            <summary className="min-h-11 cursor-pointer touch-manipulation py-2 text-sm font-semibold text-[var(--tr1-navy)]">
              Programmer la suite
            </summary>
            <div className="grid gap-4 pb-3 pt-2 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5">Prochaine visite</Label>
                <Input type="datetime-local" name="nextVisitAt" className="min-h-11" />
              </div>
              <div>
                <Label className="mb-1.5">Objectif</Label>
                <Textarea name="nextObjective" rows={2} className="text-base sm:text-sm" placeholder="Optionnel" />
              </div>
            </div>
          </details>

          <Button disabled={pending} className="min-h-12 w-full sm:w-auto">
            <CheckCircle2 className="size-4" />
            {pending ? "Clôture…" : visits.length > 1 ? "Clôturer et passer à la suivante" : "Clôturer la visite"}
          </Button>
        </form>
      </div>

      {visits.length > 1 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ensuite</p>
          <div className="mt-2 divide-y rounded-xl border">
            {visits.slice(1, 4).map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate"><span className="font-medium">{visit.pharmacyName}</span>{visit.city ? <span className="text-muted-foreground"> · {visit.city}</span> : null}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">{visitTime(visit.startAt)} <ChevronRight className="size-3" /></span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
