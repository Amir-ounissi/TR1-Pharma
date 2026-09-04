"use client";

import { ArrowRight, Building2, CalendarClock, History, MessageSquareText, PanelRightClose } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { translateUiMessage } from "@/lib/ui-copy";
import type { PharmacySummary } from "@/lib/pharmacy-summary";

type PharmacyQuickPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: PharmacySummary | null;
  loading?: boolean;
  error?: string | null;
};

export function PharmacyQuickPanel({ open, onOpenChange, summary, loading = false, error = null }: PharmacyQuickPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[27.5rem] gap-0 border-l border-[var(--tr1-line)] bg-[var(--tr1-ivory)] px-0 text-[var(--tr1-navy)]"
      >
        <SheetHeader className="border-b border-[var(--tr1-line)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-mono text-[0.64rem] font-black uppercase tracking-[0.14em] text-[var(--tr1-orange)]">Résumé pharmacie</p>
              <SheetTitle className="text-left text-[1.15rem] font-semibold text-[var(--tr1-navy)]">
                {loading ? "Chargement…" : summary?.pharmacy.name ?? "Pharmacie"}
              </SheetTitle>
              <SheetDescription className="text-left text-[0.84rem] text-muted-foreground">
                {loading ? "Nous récupérons la situation du compte." : summary?.pharmacy.address ?? "Aucune adresse disponible"}
              </SheetDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => onOpenChange(false)}>
              <PanelRightClose className="size-4" />
              <span className="sr-only">Fermer le panneau</span>
            </Button>
          </div>
          {!loading && summary ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-6 rounded-full border-[var(--tr1-line-strong)] bg-white/80 px-2.5 text-[0.67rem] font-medium text-[var(--tr1-navy)]">
                {summary.status.label}
              </Badge>
              <Badge variant="outline" className="h-6 rounded-full border-[var(--tr1-line)] bg-white/80 px-2.5 text-[0.67rem] font-medium text-muted-foreground">
                {summary.status.activityLabel}
              </Badge>
              <span className="text-[0.75rem] text-muted-foreground">
                Responsable : {summary.assignee ?? "Non affecté"}
              </span>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {loading ? <QuickPanelSkeleton /> : null}

          {!loading && error ? (
            <section className="rounded-[0.95rem] border border-[var(--tr1-line)] bg-white/80 px-4 py-4">
              <p className="font-mono text-[0.64rem] font-black uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Détail indisponible</p>
              <p className="mt-2 text-sm text-muted-foreground">{translateUiMessage(error)}</p>
            </section>
          ) : null}

          {!loading && !error && !summary ? (
            <section className="rounded-[0.95rem] border border-[var(--tr1-line)] bg-white/80 px-4 py-4">
              <p className="font-mono text-[0.64rem] font-black uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Aucune donnée</p>
              <p className="mt-2 text-sm text-muted-foreground">Cette pharmacie n’est pas accessible dans votre périmètre actuel.</p>
            </section>
          ) : null}

          {!loading && !error && summary ? (
            <>
              <PanelSection icon={Building2} title="Situation">
                <p className="text-[0.9rem] leading-6 text-[var(--tr1-navy)]">{summary.situation}</p>
              </PanelSection>

              <PanelSection icon={MessageSquareText} title="Pourquoi agir">
                {summary.whyAct.length ? (
                  <ul className="space-y-2">
                    {summary.whyAct.map((reason) => (
                      <li key={reason} className="flex gap-2 text-[0.88rem] leading-6 text-[var(--tr1-navy)]">
                        <span className="mt-[0.48rem] size-1.5 shrink-0 rounded-full bg-[var(--tr1-orange)]" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.88rem] text-muted-foreground">Aucun signal prioritaire à afficher.</p>
                )}
              </PanelSection>

              <PanelSection icon={CalendarClock} title="Prochaine action">
                <div className="space-y-1.5">
                  <p className={cn("text-[0.92rem] font-medium text-[var(--tr1-navy)]", !summary.nextAction.type && "text-muted-foreground")}>
                    {summary.nextAction.label}
                  </p>
                  <p className="text-[0.8rem] text-muted-foreground">{summary.nextAction.date ?? "Aucune date prévue"}</p>
                </div>
              </PanelSection>

              <div className="grid gap-3 sm:grid-cols-1">
                <DataBlock label="Dernière interaction" value={summary.lastInteraction.label} helper={summary.lastInteraction.date ?? "—"} />
                <DataBlock label="Dernier signal commercial" value={summary.lastCommercialSignal.label} helper={summary.lastCommercialSignal.date ?? "—"} detail={summary.lastCommercialSignal.detail} />
              </div>

              <PanelSection icon={History} title="Historique récent">
                {summary.recentEvents.length ? (
                  <div className="space-y-2.5">
                    {summary.recentEvents.map((event, index) => (
                      <div key={`${event.kind}-${event.label}-${index}`} className="rounded-[0.8rem] border border-[var(--tr1-line)] bg-white/85 px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[0.84rem] font-medium leading-5 text-[var(--tr1-navy)]">{event.label}</p>
                          <span className="shrink-0 text-[0.72rem] text-muted-foreground">{event.date ?? "—"}</span>
                        </div>
                        {event.detail ? <p className="mt-1.5 text-[0.76rem] leading-5 text-muted-foreground">{event.detail}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[0.88rem] text-muted-foreground">Aucun historique récent disponible.</p>
                )}
              </PanelSection>
            </>
          ) : null}
        </div>

        {!loading && !error && summary ? (
          <div className="border-t border-[var(--tr1-line)] px-5 py-4">
            <Button asChild className="h-10 w-full rounded-[0.8rem] bg-[var(--tr1-navy)] text-sm font-medium text-white hover:bg-[var(--tr1-navy-soft)]">
              <Link href={`/dashboard/pharmacies/${summary.pharmacy.brandPharmacyId}`}>
                Ouvrir la fiche complète
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PanelSection({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[var(--tr1-line)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[var(--tr1-orange)]" />
        <h3 className="font-mono text-[0.68rem] font-black uppercase tracking-[0.13em] text-[var(--tr1-orange)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DataBlock({ label, value, helper, detail }: { label: string; value: string; helper: string; detail?: string | null }) {
  return (
    <div className="rounded-[0.8rem] border border-[var(--tr1-line)] bg-white/85 px-3.5 py-3.5">
      <p className="font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[0.88rem] font-medium leading-5 text-[var(--tr1-navy)]">{value}</p>
      <p className="mt-1 text-[0.76rem] text-muted-foreground">{helper}</p>
      {detail ? <p className="mt-1 text-[0.76rem] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function QuickPanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2 border-t border-[var(--tr1-line)] pt-4 first:border-t-0 first:pt-0">
          <div className="h-3 w-28 rounded bg-[var(--tr1-line)]" />
          <div className="h-4 w-full rounded bg-[var(--tr1-line)]" />
          <div className="h-4 w-4/5 rounded bg-[var(--tr1-line)]" />
        </div>
      ))}
    </div>
  );
}
