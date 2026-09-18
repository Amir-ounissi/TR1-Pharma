"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import {
  closeFieldVisitAction,
  type VisitCloseoutActionState,
} from "@/app/(protected)/dashboard/visits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VisitCloseoutPhotoPicker } from "@/components/visits/visit-closeout-photo-picker";

const emptyState: VisitCloseoutActionState = {};

export function VisitCloseoutPanel({
  visitId,
  status,
  closeout,
}: {
  visitId: string;
  status: string;
  closeout: {
    outcome: string;
    summary: string;
    input_mode: string;
    completed_at: string;
    next_visit_id: string | null;
  } | null;
}) {
  const router = useRouter();
  const [closeState, closeAction, closing] = useActionState(closeFieldVisitAction, emptyState);
  const closeFormId = `visit-close-${visitId}`;
  const outcomeId = `visit-outcome-${visitId}`;
  const summaryId = `visit-summary-${visitId}`;
  const nextVisitAtId = `visit-next-at-${visitId}`;
  const nextObjectiveId = `visit-next-objective-${visitId}`;

  useEffect(() => {
    // When evidence upload is incomplete, keep the form and selected photos in
    // place so the user can safely retry the idempotent closeout action.
    if (closeState.success && !closeState.warning) router.refresh();
  }, [closeState.success, closeState.warning, router]);

  if (status === "completed" || closeout) {
    return (
      <section id="visit-execution" className="scroll-mt-24 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
          <div className="min-w-0">
            <h2 className="font-bold text-emerald-950">Visite clôturée</h2>
            {closeout ? (
              <>
                <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-950/80">{closeout.summary}</p>
                <p className="mt-3 text-xs text-emerald-900/60">
                  Saisie via {closeout.input_mode === "assistant" ? "assistant IA" : closeout.input_mode === "dictation" ? "dictée" : "formulaire"}.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (status === "cancelled") {
    return (
      <section id="visit-execution" className="scroll-mt-24 rounded-2xl border bg-muted/40 p-5">
        <h2 className="font-bold text-[var(--tr1-navy)]">Visite annulée</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette visite ne peut plus être clôturée. Planifiez une nouvelle visite si un passage reste nécessaire.
        </p>
      </section>
    );
  }

  if (!["planned", "confirmed", "in_progress"].includes(status)) {
    return (
      <section id="visit-execution" className="scroll-mt-24 rounded-2xl border bg-muted/40 p-5">
        <h2 className="font-bold text-[var(--tr1-navy)]">Visite indisponible</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le statut actuel de cette visite ne permet pas de la clôturer.
        </p>
      </section>
    );
  }

  return (
    <section id="visit-execution" className="scroll-mt-24 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-50">
          <Sparkles className="size-4 text-[var(--tr1-orange)]" />
        </div>
        <div>
          <h2 className="font-bold text-[var(--tr1-navy)]">Clôturer la visite</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saisissez le résultat, le compte rendu et les preuves utiles. Aucun bouton « démarrer » n’est nécessaire.
          </p>
        </div>
      </div>

      <form id={closeFormId} action={closeAction} className="mt-5 space-y-4">
        <input type="hidden" name="visitId" value={visitId} />
        <input type="hidden" name="inputMode" value="manual" />

        {closeState.error ? <Feedback tone="error">{closeState.error}</Feedback> : null}
        {closeState.warning ? <Feedback tone="warning">{closeState.warning}</Feedback> : null}
        {closeState.success ? <Feedback tone="success">{closeState.success}</Feedback> : null}

        <div>
          <Label htmlFor={outcomeId} className="mb-1.5">Résultat</Label>
          <select id={outcomeId} name="outcome" defaultValue="no_order" className="min-h-11 w-full rounded-md border bg-background px-3 text-sm">
            <option value="order_taken">Commande prise</option>
            <option value="no_order">Pas de commande</option>
            <option value="follow_up">À relancer</option>
            <option value="information">Information / suivi</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div>
          <Label htmlFor={summaryId} className="mb-1.5">Notes / compte rendu</Label>
          <Textarea
            id={summaryId}
            name="summary"
            required
            rows={5}
            className="min-h-32 text-base sm:text-sm"
            placeholder="Ex. Référencement validé sur 3 références. Équipe formée. Revoir la pharmacie après les premières sorties."
          />
        </div>

        <VisitCloseoutPhotoPicker key={visitId} disabled={closing} />

        <details className="rounded-xl border px-4 py-3">
          <summary className="min-h-11 cursor-pointer touch-manipulation py-2 text-sm font-semibold text-[var(--tr1-navy)]">
            Planifier la prochaine visite
          </summary>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor={nextVisitAtId} className="mb-1.5">Date et heure</Label>
              <Input id={nextVisitAtId} type="datetime-local" name="nextVisitAt" className="min-h-11" />
            </div>
            <div>
              <Label htmlFor={nextObjectiveId} className="mb-1.5">Objectif de la prochaine visite</Label>
              <Textarea id={nextObjectiveId} name="nextObjective" rows={3} className="text-base sm:text-sm" placeholder="Optionnel" />
            </div>
            <p className="text-xs text-muted-foreground">
              Si une date est renseignée, TR1 crée directement une vraie visite dans l’Agenda.
            </p>
          </div>
        </details>

        <Button disabled={closing} className="hidden min-h-11 sm:inline-flex">
          <CheckCircle2 className="size-4" />
          {closing ? "Clôture…" : closeState.warning ? "Réessayer les preuves" : "Clôturer la visite"}
        </Button>
      </form>

      <MobilePrimaryBar>
        <Button
          type="submit"
          form={closeFormId}
          disabled={closing}
          className="min-h-12 w-full touch-manipulation text-sm"
        >
          <CheckCircle2 className="size-5" />
          {closing ? "Clôture…" : closeState.warning ? "Réessayer les preuves" : "Clôturer la visite"}
        </Button>
      </MobilePrimaryBar>
    </section>
  );
}

function MobilePrimaryBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--tr1-line-strong)] bg-[var(--tr1-ivory)]/96 p-3 shadow-[0_-8px_26px_rgb(14_29_49/0.08)] backdrop-blur-xl sm:hidden">
      {children}
    </div>
  );
}

function Feedback({ children, tone }: { children: React.ReactNode; tone: "error" | "success" | "warning" }) {
  const className = tone === "error"
    ? "rounded-lg bg-red-50 p-3 text-sm text-red-700"
    : tone === "warning"
      ? "rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
      : "rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700";
  return <p className={className}>{children}</p>;
}
