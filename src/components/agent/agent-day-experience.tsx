"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarCheck, ClipboardCheck, MapPinned, Navigation, Phone, Play, Square, X } from "lucide-react";
import { trackProductEventAction } from "@/app/(protected)/dashboard/agent/actions";
import { QuickInteraction } from "@/components/agent/quick-interaction";
import { TrackedLink } from "@/components/agent/tracked-link";
import { ReorderFollowupForm } from "@/components/commercial/reorder-followup-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatActionSummary, formatActionTiming, presentationLabel, presentationText } from "@/lib/presentation";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import {
  clearActiveVisit,
  createActiveVisit,
  formatVisitStart,
  loadActiveVisit,
  saveActiveVisit,
  type ActiveVisit,
} from "@/lib/visit-mode";

export type AgentTodayTask = {
  id: string; brand_pharmacy_id: string; title: string; task_type: string; priority: "low" | "normal" | "high" | "urgent";
  due_at: string | null; is_overdue: boolean; pharmacy_name: string; city: string;
};
export type AgentTodayMission = { id: string; brand_pharmacy_id: string; title: string; objective: string; scheduled_start_at: string; priority: string; pharmacy_name: string };
export type AgentTodayReport = { id: string; mission_id: string; title: string; brand_pharmacy_id: string; report_status: string };
export type AgentFollowUp = { brand_pharmacy_id: string; pharmacy_name: string; last_interaction_at: string | null; priority: string };
export type AgentTodayData = { tasks: AgentTodayTask[]; missions: AgentTodayMission[]; reports: AgentTodayReport[]; follow_ups: AgentFollowUp[] };
export type AgentNextVisit = {
  brand_pharmacy_id: string; pharmacy_id: string; name: string; address: string; phone: string | null;
  latitude: number | null; longitude: number | null; status: string; priority: string; potential: string;
  scheduled_at: string | null; objective: string; last_interaction_at: string | null; last_order_at: string | null;
  next_action_type: string | null; next_action_at: string | null; primary_contact: { name: string; phone: string | null } | null;
};

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", includeTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

export function AgentDayExperience({
  brandId,
  day,
  visit,
  opportunities,
  wazeUrl,
  mapsUrl,
}: {
  brandId: string;
  day: AgentTodayData;
  visit: AgentNextVisit | null;
  opportunities: CommercialHealthRow[];
  wazeUrl: string;
  mapsUrl: string;
}) {
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [completionMessage, setCompletionMessage] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const overdue = day.tasks.filter((task) => task.is_overdue);

  useEffect(() => {
    const restored = loadActiveVisit(localStorage);
    if (!restored) return;
    if (restored.brandId !== brandId) {
      clearActiveVisit(localStorage);
      return;
    }
    const timer = window.setTimeout(() => setActiveVisit(restored), 0);
    return () => window.clearTimeout(timer);
  }, [brandId]);

  function startVisit() {
    if (!visit) return;
    const started = createActiveVisit({
      brandId,
      brandPharmacyId: visit.brand_pharmacy_id,
      pharmacyId: visit.pharmacy_id,
      pharmacyName: visit.name,
      objective: visit.objective || "Suivi commercial",
      contactName: visit.primary_contact?.name ?? "Contact non renseigné",
      contactPhone: visit.primary_contact?.phone,
      phone: visit.phone,
      wazeUrl,
      mapsUrl,
    });
    saveActiveVisit(localStorage, started);
    setActiveVisit(started);
    setFinishing(false);
    setCompletionMessage(false);
    void trackProductEventAction("interaction_started", visit.pharmacy_id);
  }

  function finishVisit() {
    setFinishing(true);
    window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function abandonVisit() {
    clearActiveVisit(localStorage);
    setActiveVisit(null);
    setFinishing(false);
    setCompletionMessage(false);
  }

  const completeVisit = useCallback(() => {
    clearActiveVisit(localStorage);
    setActiveVisit(null);
    setFinishing(false);
    setCompletionMessage(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const formVisit = activeVisit ?? (visit ? {
    brandPharmacyId: visit.brand_pharmacy_id,
    pharmacyId: visit.pharmacy_id,
    startedAt: undefined,
  } : null);

  return (
    <div className="space-y-6">
      {activeVisit ? (
        <ActiveVisitCard visit={activeVisit} onFinish={finishVisit} onAbandon={abandonVisit} />
      ) : visit ? (
        <NextVisitCard visit={visit} wazeUrl={wazeUrl} mapsUrl={mapsUrl} onStart={startVisit} />
      ) : null}
      {completionMessage ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Visite terminée. Interaction et prochaine action enregistrées.</p> : null}

      {finishing && formVisit && visit ? (
        <div ref={reportRef} className="scroll-mt-24">
          <QuickReportCard
            brandPharmacyId={formVisit.brandPharmacyId}
            pharmacyId={formVisit.pharmacyId}
            commercialStatus={visit.status}
            lastOrderAt={visit.last_order_at}
            visitStartedAt={formVisit.startedAt}
            onSuccess={completeVisit}
            completionMode
          />
        </div>
      ) : null}

      {!activeVisit && opportunities.length ? (
        <section className="space-y-3" aria-labelledby="reorder-opportunities-title">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#2d6f9f]">Priorités commerciales</p><h2 id="reorder-opportunities-title" className="text-xl font-semibold text-[#0f2740]">Opportunités de réassort</h2></div>
            <Badge variant="secondary">{opportunities.length}</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {opportunities.map((opportunity) => (
              <Card key={opportunity.brand_pharmacy_id} data-testid="agent-reorder-opportunity" className="border-[#e3d8c6] bg-[#fffaf0]">
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><Link href={`/dashboard/pharmacies/${opportunity.brand_pharmacy_id}`} className="font-semibold text-[#0f2740] hover:underline">{opportunity.pharmacy_name}</Link><p className="text-sm text-muted-foreground">{presentationLabel(opportunity.health_status)} · {opportunity.expected_reorder_delay_days && opportunity.expected_reorder_delay_days > 0 ? `${opportunity.expected_reorder_delay_days} jours de retard` : opportunity.recommendation}</p></div>
                    <span className="rounded-full bg-[#ee6c3b] px-3 py-1 text-sm font-bold text-white">{opportunity.priority_score}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs"><p className="rounded-lg bg-white p-2"><span className="text-muted-foreground">Dernière commande</span><br />{formatDate(opportunity.last_order_at)}</p><p className="rounded-lg bg-white p-2"><span className="text-muted-foreground">Potentiel</span><br />{presentationLabel(opportunity.potential_level)}</p></div>
                  <ReorderFollowupForm brandPharmacyId={opportunity.brand_pharmacy_id} recommendation={opportunity.recommendation} compact />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`grid gap-4 md:grid-cols-2 xl:grid-cols-4 ${activeVisit ? "opacity-70" : ""}`} aria-label="Aujourd’hui">
        <DayList title="En retard" icon={<AlertTriangle />} count={overdue.length}>
          {overdue.map((task) => {
            const timing = formatActionTiming(task.due_at);
            return <DayLink key={task.id} href={`/dashboard/pharmacies/${task.brand_pharmacy_id}?tab=activity`} title={`${presentationLabel(task.task_type)} — ${presentationText(task.title)}`} detail={`${task.pharmacy_name} · ${timing.label} · ${formatDate(task.due_at, true)}`} />;
          })}
        </DayList>
        <DayList title="Missions du jour" icon={<CalendarCheck />} count={day.missions.length}>
          {day.missions.map((mission) => <DayLink key={mission.id} href={`/dashboard/missions/${mission.id}`} title={presentationText(mission.title)} detail={`${mission.pharmacy_name} · ${formatDate(mission.scheduled_start_at, true)}`} />)}
        </DayList>
        <DayList title="Relances" icon={<ArrowRight />} count={day.follow_ups.length}>
          {day.follow_ups.map((item) => <DayLink key={item.brand_pharmacy_id} href={`/dashboard/pharmacies/${item.brand_pharmacy_id}?tab=activity`} title={item.pharmacy_name} detail="Compte actif sans prochaine action" />)}
        </DayList>
        <DayList title="Rapports à terminer" icon={<ClipboardCheck />} count={day.reports.length}>
          {day.reports.map((report) => <DayLink key={report.id} href={`/dashboard/missions/${report.mission_id}`} title={presentationText(report.title)} detail={presentationLabel(report.report_status)} />)}
        </DayList>
      </section>

      {!activeVisit && visit ? (
        <QuickReportCard brandPharmacyId={visit.brand_pharmacy_id} pharmacyId={visit.pharmacy_id} commercialStatus={visit.status} lastOrderAt={visit.last_order_at} />
      ) : null}
    </div>
  );
}

function NextVisitCard({ visit, wazeUrl, mapsUrl, onStart }: { visit: AgentNextVisit; wazeUrl: string; mapsUrl: string; onStart: () => void }) {
  const timing = formatActionTiming(visit.next_action_at);
  return (
    <Card className="overflow-hidden border-0 bg-[#fffaf0] shadow-[0_18px_50px_-30px_rgba(15,39,64,.5)]" data-testid="next-visit-card">
      <div className="h-1.5 bg-[#ee6c3b]" />
      <CardHeader className="gap-2 px-4 py-4 sm:px-7 sm:py-6">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2d6f9f]">Prochaine visite</p><CardTitle className="mt-1 text-xl text-[#0f2740] sm:text-2xl">{visit.name}</CardTitle></div>
          <Badge className="bg-[#ee6c3b] text-white">{presentationLabel(visit.priority)}</Badge>
        </div>
        <p className="hidden text-sm text-[#526274] sm:block">{visit.address}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-5 sm:px-7 sm:pb-6">
        <div className="grid grid-cols-2 gap-2 text-sm sm:hidden">
          <CompactContext label="Heure" value={formatDate(visit.scheduled_at, true)} />
          <CompactContext label="Contact" value={visit.primary_contact?.name ?? "Non renseigné"} />
          <CompactContext label="Objectif" value={visit.objective || "Suivi commercial"} wide />
          <CompactContext label="Dernière commande" value={formatDate(visit.last_order_at)} />
          <CompactContext label="Prochaine action" value={formatActionSummary(visit.next_action_type, visit.next_action_at)} alert={timing.kind === "overdue"} />
        </div>
        <details className="rounded-xl border bg-white/70 p-3 text-sm sm:hidden">
          <summary className="min-h-6 cursor-pointer font-semibold text-[#2d6f9f]">Voir le contexte</summary>
          <div className="mt-3 grid gap-2"><p><strong>Adresse :</strong> {visit.address}</p><p><strong>Statut :</strong> {presentationLabel(visit.status)}</p><p><strong>Potentiel :</strong> {presentationLabel(visit.potential)}</p><p><strong>Dernière interaction :</strong> {formatDate(visit.last_interaction_at)}</p><p className="text-xs text-muted-foreground">{timing.dateLabel}</p></div>
        </details>
        <div className="hidden gap-3 text-sm sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <Context label="Heure prévue" value={formatDate(visit.scheduled_at, true)} />
          <Context label="Contact principal" value={visit.primary_contact?.name ?? "Non renseigné"} />
          <Context label="Objectif" value={visit.objective || "Suivi commercial"} />
          <Context label="Dernière interaction" value={formatDate(visit.last_interaction_at)} />
          <Context label="Dernière commande" value={formatDate(visit.last_order_at)} />
          <Context label="Prochaine action" value={formatActionSummary(visit.next_action_type, visit.next_action_at)} />
          <Context label="Statut" value={presentationLabel(visit.status)} />
          <Context label="Potentiel" value={presentationLabel(visit.potential)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <TrackedLink href={`/dashboard/pharmacies/${visit.brand_pharmacy_id}`} eventName="pharmacy_opened" pharmacyId={visit.pharmacy_id} className="border bg-white text-[#0f2740]"><ArrowRight /> Fiche</TrackedLink>
          <TrackedLink href={`tel:${visit.primary_contact?.phone || visit.phone || ""}`} eventName="interaction_started" pharmacyId={visit.pharmacy_id} className="border bg-white text-[#0f2740]"><Phone /> Appeler</TrackedLink>
          <TrackedLink href={wazeUrl} eventName="navigation_waze_clicked" pharmacyId={visit.pharmacy_id} external className="bg-[#2d6f9f] text-white"><Navigation /> Waze</TrackedLink>
          <TrackedLink href={mapsUrl} eventName="navigation_maps_clicked" pharmacyId={visit.pharmacy_id} external className="bg-[#2d6f9f] text-white"><MapPinned /> Maps</TrackedLink>
          <Button type="button" onClick={onStart} size="lg" className="col-span-2 min-h-11 bg-[#ee6c3b] text-white hover:bg-[#d85a2d] sm:col-span-1"><Play /> Démarrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveVisitCard({ visit, onFinish, onAbandon }: { visit: ActiveVisit; onFinish: () => void; onAbandon: () => void }) {
  return (
    <Card className="overflow-hidden border-2 border-[#ee6c3b] bg-[#0f2740] text-[#fffaf0]" data-testid="active-visit-card">
      <CardHeader className="px-4 pb-3 pt-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff9b73]">Visite en cours</p><CardTitle className="mt-1 text-2xl">{visit.pharmacyName}</CardTitle><p className="mt-1 text-sm text-[#d7e2eb]">Commencée à {formatVisitStart(visit.startedAt)}</p></div>
          <Button type="button" variant="ghost" size="icon-lg" onClick={onAbandon} className="min-h-11 min-w-11 text-white hover:bg-white/10"><X /><span className="sr-only">Abandonner la visite</span></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-5 sm:px-7">
        <div className="grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-[#9eb0bf]">Objectif</span><br />{visit.objective}</p><p><span className="text-[#9eb0bf]">Contact principal</span><br />{visit.contactName}</p></div>
        <div className="grid grid-cols-3 gap-2">
          <TrackedLink href={`tel:${visit.contactPhone || visit.phone || ""}`} eventName="interaction_started" pharmacyId={visit.pharmacyId} className="bg-white text-[#0f2740]"><Phone /> Appel</TrackedLink>
          <TrackedLink href={visit.wazeUrl} eventName="navigation_waze_clicked" pharmacyId={visit.pharmacyId} external className="bg-[#2d6f9f] text-white"><Navigation /> Waze</TrackedLink>
          <TrackedLink href={visit.mapsUrl} eventName="navigation_maps_clicked" pharmacyId={visit.pharmacyId} external className="bg-[#2d6f9f] text-white"><MapPinned /> Maps</TrackedLink>
        </div>
        <Button type="button" onClick={onFinish} size="lg" className="min-h-12 w-full bg-[#ee6c3b] text-white hover:bg-[#d85a2d]"><Square /> Terminer la visite</Button>
        <button type="button" onClick={onAbandon} className="min-h-11 w-full text-sm text-[#d7e2eb] underline underline-offset-4">Abandonner manuellement</button>
      </CardContent>
    </Card>
  );
}

function QuickReportCard(props: ComponentProps<typeof QuickInteraction> & { completionMode?: boolean }) {
  return (
    <Card className="border-[#d9e0e6]" data-testid={props.completionMode ? "visit-completion-form" : "quick-report-card"}>
      <CardHeader><CardTitle>{props.completionMode ? "Terminer le compte rendu" : "Compte rendu rapide"}</CardTitle><p className="text-sm text-muted-foreground">{props.completionMode ? "La visite est préremplie. Enregistrez le résultat et la prochaine action." : "Les champs utiles seulement. Une suggestion de suite est préparée automatiquement."}</p></CardHeader>
      <CardContent><QuickInteraction {...props} /></CardContent>
    </Card>
  );
}

function Context({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e5dccb] bg-white/70 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#768392]">{label}</p><p className="mt-1 font-medium text-[#0f2740]">{value}</p></div>;
}

function CompactContext({ label, value, wide = false, alert = false }: { label: string; value: string; wide?: boolean; alert?: boolean }) {
  return <div className={`rounded-xl border bg-white/75 p-2.5 ${wide ? "col-span-2" : ""}`}><p className="text-[10px] font-semibold uppercase tracking-wide text-[#768392]">{label}</p><p className={`mt-1 text-sm font-semibold ${alert ? "text-[#b83a22]" : "text-[#0f2740]"}`}>{value}</p></div>;
}

function DayList({ title, icon, count, children }: { title: string; icon: ReactNode; count: number; children: ReactNode }) {
  return <Card className="min-h-44"><CardHeader className="flex-row items-center justify-between"><div className="flex items-center gap-2 text-[#0f2740]">{icon}<CardTitle className="text-base">{title}</CardTitle></div><Badge variant="secondary">{count}</Badge></CardHeader><CardContent className="space-y-2">{count ? children : <p className="text-sm text-muted-foreground">Rien à traiter.</p>}</CardContent></Card>;
}

function DayLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link href={href} className="block min-h-11 rounded-xl border p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></Link>;
}
