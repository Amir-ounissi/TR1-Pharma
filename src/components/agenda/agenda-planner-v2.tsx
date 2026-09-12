"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  Info,
  MapPin,
  Navigation,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import {
  createAgendaBlockAction,
  createFieldVisitAction,
  rescheduleFieldVisitAction,
} from "@/app/(protected)/dashboard/agenda/actions";
import { addCalendarDays, isoToParisLocal } from "@/lib/agenda";
import { uiLabel } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export type AgendaEvent = {
  event_key: string;
  source_kind: string;
  source_id: string;
  event_type: string;
  title: string;
  start_at: string;
  end_at: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  city: string | null;
  brand_ids: string[];
  brand_names: string[];
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  ownership: "mine" | "pharmacy_activity";
  status: string;
  draggable: boolean;
  detail_url: string;
  priority: string;
  metadata: Record<string, unknown>;
};

export type BacklogItem = {
  item_key: string;
  source_kind: string;
  source_id: string;
  title: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  brand_id: string;
  brand_name: string;
  due_at: string | null;
  status: string;
  priority: string;
  detail_url: string;
  metadata: Record<string, unknown>;
};

export type PharmacyOption = {
  id: string;
  label: string;
  city?: string;
  brands: Array<{ relationId: string; brandId: string; brandName: string }>;
};

const planningFilters = [
  { key: "all", label: "Tout" },
  { key: "field_visit", label: "Visites" },
  { key: "mission", label: "Missions" },
  { key: "agenda_block", label: "Créneaux" },
] as const;

const SLOT_MINUTES = 30;
const SLOT_HEIGHT_PX = 56;
const GRID_START_MINUTES = 7 * 60;
const GRID_END_MINUTES = 21 * 60;
const slots = Array.from(
  { length: (GRID_END_MINUTES - GRID_START_MINUTES) / SLOT_MINUTES },
  (_, index) => {
    const totalMinutes = GRID_START_MINUTES + index * SLOT_MINUTES;
    return {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
    };
  },
);

const actionKinds = new Set(["task", "report"]);

type EventPlacement = {
  startIndex: number;
  topOffset: number;
  height: number;
  visibleStart: number;
  visibleEnd: number;
};

type PositionedEvent = {
  event: AgendaEvent;
  placement: EventPlacement;
  lane: number;
  laneCount: number;
};

export function AgendaPlanner({
  date,
  today,
  view,
  events,
  backlog,
  brands,
  pharmacies,
  canCreateVisit,
}: {
  date: string;
  today: string;
  view: "day" | "week";
  events: AgendaEvent[];
  backlog: BacklogItem[];
  brands: Array<{ id: string; name: string }>;
  pharmacies: PharmacyOption[];
  canCreateVisit: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof planningFilters)[number]["key"]>("all");
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitStart, setVisitStart] = useState(`${date}T09:00`);
  const [moveFeedback, setMoveFeedback] = useState<{
    visitId: string;
    previousLocal: string;
    message: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const days = useMemo(
    () => Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => addCalendarDays(date, index)),
    [date, view],
  );

  const timedEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.ownership === "mine" &&
          !actionKinds.has(event.source_kind) &&
          (filter === "all" || event.source_kind === filter),
      ),
    [events, filter],
  );

  const actionEvents = useMemo(
    () => events.filter((event) => event.ownership === "mine" && actionKinds.has(event.source_kind)),
    [events],
  );

  const contextEvents = useMemo(
    () => events.filter((event) => event.ownership === "pharmacy_activity"),
    [events],
  );

  const dayPlanning = timedEvents.filter((event) => localDay(event.start_at) === date);
  const dayVisits = dayPlanning.filter((event) => event.source_kind === "field_visit");
  const dayActions = actionEvents.filter((event) => localDay(event.start_at) === date);
  const dayContext = contextEvents.filter((event) => localDay(event.start_at) === date);

  const navigate = (next: string) => router.push(`/dashboard/agenda?date=${next}&view=${view}`);
  const setView = (nextView: "day" | "week") =>
    router.push(`/dashboard/agenda?date=${date}&view=${nextView}`);

  const openVisit = (startAt: string) => {
    setVisitStart(startAt);
    setVisitOpen(true);
  };

  const dropVisit = (drag: React.DragEvent, day: string, hour: number, minute: number) => {
    drag.preventDefault();
    const visitId = drag.dataTransfer.getData("text/field-visit");
    const previousLocal = drag.dataTransfer.getData("text/field-visit-start");
    if (!visitId) return;
    const nextLocal = slotLocal(day, hour, minute);

    startTransition(async () => {
      try {
        await rescheduleFieldVisitAction(visitId, nextLocal);
        setMoveFeedback({
          visitId,
          previousLocal,
          message: `Visite déplacée à ${formatSlot(hour, minute)}`,
        });
        router.refresh();
        window.setTimeout(() => setMoveFeedback(null), 6000);
      } catch {
        setMoveFeedback({ visitId: "", previousLocal: "", message: "Impossible de déplacer la visite." });
      }
    });
  };

  const undoMove = () => {
    if (!moveFeedback?.visitId || !moveFeedback.previousLocal) return;
    startTransition(async () => {
      await rescheduleFieldVisitAction(moveFeedback.visitId, moveFeedback.previousLocal);
      setMoveFeedback(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">
            Agenda terrain
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--tr1-navy)]">Planifier votre terrain</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            L&apos;Agenda répond à une question simple : quand et où allez-vous agir ? Les tâches restent à faire,
            les animations restent des informations, seuls les vrais rendez-vous occupent votre temps.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCreateVisit ? (
            <Button onClick={() => openVisit(`${date}T09:00`)} disabled={!pharmacies.length}>
              <Plus className="size-4" />
              Planifier une visite
            </Button>
          ) : null}
          <BlockSheet defaultDate={date} />
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--tr1-line)] bg-white/85 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--tr1-line)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button size="sm" variant={date === today ? "secondary" : "outline"} onClick={() => navigate(today)}>
              Aujourd&apos;hui
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={view === "week" ? "Semaine précédente" : "Jour précédent"}
              onClick={() => navigate(addCalendarDays(date, view === "week" ? -7 : -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={view === "week" ? "Semaine suivante" : "Jour suivant"}
              onClick={() => navigate(addCalendarDays(date, view === "week" ? 7 : 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="order-first flex min-w-0 items-center gap-2 sm:order-none">
            <CalendarDays className="size-4 shrink-0 text-[var(--tr1-orange)]" />
            <strong className="truncate text-sm text-[var(--tr1-navy)]">
              {view === "week"
                ? `Semaine du ${formatDate(date, { day: "numeric", month: "long" })}`
                : formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <Input
              aria-label="Choisir une date"
              className="h-9 w-[9.8rem]"
              type="date"
              value={date}
              onChange={(event) => navigate(event.target.value)}
            />
            <div className="flex rounded-lg bg-muted p-1">
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  view === "day" ? "bg-white text-[var(--tr1-navy)] shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("day")}
              >
                Jour
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  view === "week" ? "bg-white text-[var(--tr1-navy)] shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("week")}
              >
                Semaine
              </button>
            </div>
          </div>
        </div>

        {view === "day" ? (
          <div className="grid divide-y border-b border-[var(--tr1-line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <SummaryItem value={dayVisits.length} label={dayVisits.length > 1 ? "visites prévues" : "visite prévue"} />
            <SummaryItem value={dayActions.length} label="actions à faire" emphasis={dayActions.length > 0} />
            <SummaryItem value={dayContext.length} label="infos terrain" info />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 p-3">
          {planningFilters.map((item) => (
            <button
              key={item.key}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                filter === item.key
                  ? "border-[var(--tr1-navy)] bg-[var(--tr1-navy)] text-white"
                  : "border-[var(--tr1-line)] bg-white text-muted-foreground hover:border-slate-400 hover:text-foreground",
              )}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
          {brands.length ? (
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              {brands.slice(0, 3).map((brand) => (
                <Badge variant="outline" key={brand.id}>{brand.name}</Badge>
              ))}
              {brands.length > 3 ? `+${brands.length - 3}` : null}
            </span>
          ) : null}
        </div>
      </section>

      {view === "day" ? (
        <ContextStrip events={dayContext} planning={dayPlanning} />
      ) : (
        <WeeklyContext events={contextEvents} days={days} />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 overflow-hidden rounded-2xl border border-[var(--tr1-line)] bg-white/85 shadow-sm">
          {view === "day" ? (
            <>
              <div className="md:hidden">
                <MobileDayTimeline date={date} events={dayPlanning} contextEvents={dayContext} onAddVisit={canCreateVisit ? openVisit : undefined} />
              </div>
              <div className="hidden md:block">
                <DesktopTimeline
                  days={days}
                  events={timedEvents}
                  contextEvents={contextEvents}
                  view="day"
                  canCreateVisit={canCreateVisit}
                  onDrop={dropVisit}
                  onAddVisit={openVisit}
                />
              </div>
            </>
          ) : (
            <>
              <div className="md:hidden">
                <MobileWeekTimeline days={days} events={timedEvents} contextEvents={contextEvents} onAddVisit={canCreateVisit ? openVisit : undefined} />
              </div>
              <div className="hidden overflow-x-auto md:block">
                <DesktopTimeline
                  days={days}
                  events={timedEvents}
                  contextEvents={contextEvents}
                  view="week"
                  canCreateVisit={canCreateVisit}
                  onDrop={dropVisit}
                  onAddVisit={openVisit}
                />
              </div>
            </>
          )}
        </main>

        <ActionPanel date={date} actions={dayActions} backlog={backlog} />
      </div>

      {visitOpen ? (
        <VisitSheet
          pharmacies={pharmacies}
          open={visitOpen}
          onOpenChange={setVisitOpen}
          defaultStart={visitStart}
        />
      ) : null}

      {moveFeedback ? (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-[var(--tr1-navy)] px-4 py-3 text-sm text-white shadow-xl">
          <span>{moveFeedback.message}</span>
          {moveFeedback.visitId && moveFeedback.previousLocal ? (
            <button className="inline-flex items-center gap-1 font-bold text-white underline underline-offset-4" onClick={undoMove}>
              <RotateCcw className="size-3.5" />
              Annuler
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryItem({ value, label, emphasis = false, info = false }: { value: number; label: string; emphasis?: boolean; info?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={cn(
        "grid size-9 place-items-center rounded-xl text-sm font-black",
        emphasis ? "bg-orange-50 text-[var(--tr1-orange)]" : info ? "bg-slate-100 text-slate-700" : "bg-[var(--tr1-navy)]/5 text-[var(--tr1-navy)]",
      )}>
        {value}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function ContextStrip({ events, planning }: { events: AgendaEvent[]; planning: AgendaEvent[] }) {
  const plannedPharmacyIds = new Set(planning.map((event) => event.pharmacy_id).filter(Boolean));
  return (
    <section className="rounded-2xl border border-[var(--tr1-line)] bg-slate-50/80 p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg bg-white shadow-sm">
          <Info className="size-4 text-[var(--tr1-orange)]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--tr1-navy)]">À savoir aujourd&apos;hui</h2>
          <p className="text-xs text-muted-foreground">Informations terrain — elles ne bloquent aucun créneau.</p>
        </div>
      </div>
      {events.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {events.map((event) => {
            const onRoute = !!event.pharmacy_id && plannedPharmacyIds.has(event.pharmacy_id);
            return (
              <Link href={event.detail_url || "#"} key={event.event_key} className="min-w-[16rem] flex-1 rounded-xl border border-[var(--tr1-line)] bg-white p-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tr1-orange)]">{contextLabel(event)}</p>
                    <strong className="mt-0.5 line-clamp-1 block text-sm text-[var(--tr1-navy)]">{event.pharmacy_name || event.title}</strong>
                  </div>
                  {onRoute ? <Badge variant="secondary">Dans votre tournée</Badge> : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{eventTimeRange(event)}{event.assigned_user_name ? ` · ${event.assigned_user_name}` : ""}</p>
                {event.brand_names.length ? <p className="mt-1 line-clamp-1 text-xs font-medium">{event.brand_names.join(" · ")}</p> : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-white/60 px-4 py-3 text-xs text-muted-foreground">Aucune animation ou activité signalée dans vos pharmacies aujourd&apos;hui.</div>
      )}
    </section>
  );
}

function WeeklyContext({ events, days }: { events: AgendaEvent[]; days: string[] }) {
  const weekly = events.filter((event) => days.includes(localDay(event.start_at)));
  if (!weekly.length) return null;
  return (
    <section className="rounded-2xl border border-[var(--tr1-line)] bg-slate-50/80 p-3">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-[var(--tr1-orange)]" />
        <h2 className="text-sm font-bold text-[var(--tr1-navy)]">Informations terrain de la semaine</h2>
        <Badge variant="secondary">{weekly.length}</Badge>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {weekly.map((event) => (
          <Link href={event.detail_url || "#"} key={event.event_key} className="min-w-[15rem] rounded-lg border bg-white px-3 py-2 text-xs hover:border-slate-300">
            <strong>{event.pharmacy_name || event.title}</strong>
            <p className="mt-1 text-muted-foreground">{formatDate(localDay(event.start_at), { weekday: "short", day: "numeric" })} · {eventTimeRange(event)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DesktopTimeline({
  days,
  events,
  contextEvents,
  view,
  canCreateVisit,
  onDrop,
  onAddVisit,
}: {
  days: string[];
  events: AgendaEvent[];
  contextEvents: AgendaEvent[];
  view: "day" | "week";
  canCreateVisit: boolean;
  onDrop: (event: React.DragEvent, day: string, hour: number, minute: number) => void;
  onAddVisit: (startAt: string) => void;
}) {
  const positionedByDay = new Map(days.map((day) => [day, layoutDayEvents(events, day)]));

  return (
    <div
      className={cn(
        "relative grid",
        view === "week"
          ? "min-w-[66rem] grid-cols-[4.25rem_repeat(7,minmax(8.5rem,1fr))]"
          : "grid-cols-[4.5rem_minmax(0,1fr)]",
      )}
      style={{ gridTemplateRows: `auto repeat(${slots.length}, ${SLOT_HEIGHT_PX}px)` }}
    >
      <div className="border-b bg-slate-50/70" style={{ gridColumn: 1, gridRow: 1 }} />
      {days.map((day, dayIndex) => (
        <div
          className="border-b border-l bg-slate-50/70 px-2 py-3 text-center"
          key={day}
          style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
        >
          <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">{formatDate(day, { weekday: "short" })}</p>
          <p className="text-sm font-black text-[var(--tr1-navy)]">{formatDate(day, { day: "numeric", month: "short" })}</p>
        </div>
      ))}

      {slots.map((slot, slotIndex) => (
        <div
          className={cn(
            "border-t px-2 text-right font-mono text-[0.62rem] text-muted-foreground",
            slot.minute === 0 ? "pt-2" : "pt-1",
          )}
          key={`time-${slot.hour}-${slot.minute}`}
          style={{ gridColumn: 1, gridRow: slotIndex + 2 }}
        >
          {formatSlot(slot.hour, slot.minute)}
        </div>
      ))}

      {days.flatMap((day, dayIndex) =>
        slots.map((slot, slotIndex) => {
          const occupied = events.some((event) => eventOverlapsSlot(event, day, slot.hour, slot.minute));
          return (
            <div
              className={cn(
                "group relative border-l border-t transition hover:bg-slate-50/70",
                slot.minute === 30 && "border-t-dashed",
              )}
              key={`${day}-${slot.hour}-${slot.minute}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, day, slot.hour, slot.minute)}
              style={{ gridColumn: dayIndex + 2, gridRow: slotIndex + 2 }}
            >
              {!occupied && canCreateVisit ? (
                <button
                  type="button"
                  onClick={() => onAddVisit(slotLocal(day, slot.hour, slot.minute))}
                  className="absolute inset-1 flex items-center justify-center rounded-lg border border-dashed border-transparent text-[0.68rem] font-semibold text-transparent transition hover:border-[var(--tr1-orange)]/35 hover:bg-orange-50/55 hover:text-[var(--tr1-orange)] focus-visible:border-[var(--tr1-orange)]/50 focus-visible:text-[var(--tr1-orange)]"
                  aria-label={`Ajouter une visite le ${day} à ${formatSlot(slot.hour, slot.minute)}`}
                >
                  <Plus className="mr-1 size-3" /> Ajouter une visite
                </button>
              ) : null}
            </div>
          );
        }),
      )}

      {days.flatMap((day, dayIndex) =>
        (positionedByDay.get(day) ?? []).map(({ event, placement, lane, laneCount }) => {
          const width = laneCount > 1 ? `calc(${100 / laneCount}% - 3px)` : undefined;
          const marginLeft = laneCount > 1 ? `${(lane * 100) / laneCount}%` : undefined;
          return (
            <div
              key={event.event_key}
              className="z-10 min-w-0 px-1"
              style={{
                gridColumn: dayIndex + 2,
                gridRow: placement.startIndex + 2,
                alignSelf: "start",
                height: `${placement.height}px`,
                marginTop: `${placement.topOffset}px`,
                width,
                marginLeft,
              }}
            >
              <EventCard
                event={event}
                relatedContext={relatedContext(event, contextEvents)}
                fillHeight
              />
            </div>
          );
        }),
      )}
    </div>
  );
}

function MobileDayTimeline({ date, events, contextEvents, onAddVisit }: { date: string; events: AgendaEvent[]; contextEvents: AgendaEvent[]; onAddVisit?: (startAt: string) => void }) {
  const sorted = [...events].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Planning</p>
          <p className="text-sm font-black text-[var(--tr1-navy)]">{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {onAddVisit ? <Button size="sm" variant="outline" onClick={() => onAddVisit(`${date}T09:00`)}><Plus className="size-3.5" /> Visite</Button> : null}
      </div>
      {sorted.length ? (
        <div className="space-y-1">
          {sorted.map((event) => (
            <div key={event.event_key} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
              <div className="pt-3 text-right font-mono text-xs font-bold text-muted-foreground">{eventTime(event.start_at)}</div>
              <EventCard event={event} relatedContext={relatedContext(event, contextEvents)} />
            </div>
          ))}
        </div>
      ) : <EmptyPlanning onAddVisit={onAddVisit ? () => onAddVisit(`${date}T09:00`) : undefined} />}
    </div>
  );
}

function MobileWeekTimeline({ days, events, contextEvents, onAddVisit }: { days: string[]; events: AgendaEvent[]; contextEvents: AgendaEvent[]; onAddVisit?: (startAt: string) => void }) {
  return (
    <div className="space-y-1 p-3">
      {days.map((day) => {
        const dayEvents = events.filter((event) => localDay(event.start_at) === day).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
        return (
          <section className="py-2" key={day}>
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-sm text-[var(--tr1-navy)]">{formatDate(day, { weekday: "long", day: "numeric", month: "short" })}</strong>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{dayEvents.length || "—"}</span>
                {onAddVisit ? <button className="text-xs font-bold text-[var(--tr1-orange)]" onClick={() => onAddVisit(`${day}T09:00`)}>+ Visite</button> : null}
              </div>
            </div>
            {dayEvents.length ? (
              <div className="space-y-2">{dayEvents.map((event) => <EventCard event={event} relatedContext={relatedContext(event, contextEvents)} key={event.event_key} />)}</div>
            ) : <div className="h-8 rounded-lg border border-dashed bg-slate-50/60" />}
          </section>
        );
      })}
    </div>
  );
}

function EventCard({ event, relatedContext, fillHeight = false }: { event: AgendaEvent; relatedContext: AgendaEvent[]; fillHeight?: boolean }) {
  const router = useRouter();
  const [rescheduleAt, setRescheduleAt] = useState(isoToParisLocal(event.start_at).slice(0, 16));
  const [saving, startSaving] = useTransition();
  const duration = eventDurationMinutes(event);
  const compact = fillHeight && duration <= 30;
  const showTime = !fillHeight || duration >= 45;
  const showCity = !fillHeight || duration >= 60;
  const showContext = !fillHeight || duration >= 90;
  const tone = event.source_kind === "field_visit"
    ? "border-l-[var(--tr1-orange)] bg-orange-50/95"
    : event.source_kind === "mission"
      ? "border-l-blue-500 bg-blue-50/95"
      : "border-l-slate-400 bg-slate-50/95";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          draggable={event.draggable}
          onDragStart={(drag) => {
            if (!event.draggable) return;
            drag.dataTransfer.setData("text/field-visit", event.source_id);
            drag.dataTransfer.setData("text/field-visit-start", isoToParisLocal(event.start_at).slice(0, 16));
          }}
          className={cn(
            "w-full rounded-xl border border-[var(--tr1-line)] border-l-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]",
            fillHeight ? "h-full min-h-0 overflow-hidden p-2" : "mb-1 p-2.5",
            tone,
            event.draggable && "cursor-grab active:cursor-grabbing",
          )}
        >
          <div className="flex h-full items-start gap-2 overflow-hidden">
            {event.draggable ? <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" /> : null}
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <strong className={cn("text-sm text-[var(--tr1-navy)]", compact ? "line-clamp-1" : "line-clamp-2")}>{event.pharmacy_name || event.title}</strong>
                {duration > 0 ? <Badge variant="outline" className="shrink-0">{formatDuration(duration)}</Badge> : null}
              </div>
              {showTime ? <p className="mt-1 text-xs text-muted-foreground"><Clock3 className="mr-1 inline size-3" />{eventTimeRange(event)}</p> : null}
              {showCity && event.city ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground"><MapPin className="mr-1 inline size-3" />{event.city}</p> : null}
              {showContext && relatedContext.length ? <div className="mt-2"><Badge variant="outline"><Sparkles className="mr-1 size-3" />{relatedContext.length === 1 ? "Animation / activité aujourd’hui" : `${relatedContext.length} infos terrain`}</Badge></div> : null}
            </div>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>{event.pharmacy_name || event.title}</SheetTitle></SheetHeader>
        <div className="space-y-5 p-4">
          <div className="rounded-xl border bg-slate-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{eventKindLabel(event)}</p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2"><Clock3 className="size-4 text-muted-foreground" />{eventTimeRange(event)}</p>
              {event.city ? <p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" />{event.city}</p> : null}
              {event.brand_names.length ? <p className="flex items-center gap-2"><Target className="size-4 text-muted-foreground" />{event.brand_names.join(" · ")}</p> : null}
            </div>
          </div>

          {event.source_kind === "field_visit" ? (
            <div className="rounded-xl border p-3">
              <Label className="mb-1.5">Replanifier</Label>
              <div className="flex gap-2">
                <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => startSaving(async () => {
                    await rescheduleFieldVisitAction(event.source_id, rescheduleAt);
                    router.refresh();
                  })}
                >
                  {saving ? "…" : "OK"}
                </Button>
              </div>
            </div>
          ) : null}

          {relatedContext.length ? (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">À savoir dans cette pharmacie</h3>
              <div className="space-y-2">
                {relatedContext.map((context) => (
                  <div key={context.event_key} className="rounded-xl border border-orange-100 bg-orange-50/60 p-3">
                    <p className="text-xs font-bold text-[var(--tr1-orange)]">{contextLabel(context)}</p>
                    <p className="mt-1 text-sm font-semibold">{context.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{eventTimeRange(context)}{context.assigned_user_name ? ` · ${context.assigned_user_name}` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            {event.detail_url ? <Button asChild><Link href={event.detail_url}>{event.source_kind === "field_visit" ? "Ouvrir la visite" : "Ouvrir le détail"}</Link></Button> : null}
            {event.pharmacy_name ? <Button variant="outline" asChild><a href={mapsUrl(event)} target="_blank" rel="noreferrer"><Navigation className="size-4" />Itinéraire</a></Button> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActionPanel({ date, actions, backlog }: { date: string; actions: AgendaEvent[]; backlog: BacklogItem[] }) {
  const actionKeys = new Set(actions.map((item) => `${item.source_kind}:${item.source_id}`));
  const remainingBacklog = backlog.filter((item) => !actionKeys.has(`${item.source_kind}:${item.source_id}`));
  return (
    <aside className="h-fit rounded-2xl border border-[var(--tr1-line)] bg-white/85 p-3 shadow-sm xl:sticky xl:top-4">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-[var(--tr1-navy)]">À faire / à planifier</h2>
          <Badge variant="secondary">{actions.length + remainingBacklog.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Les actions ne bloquent plus artificiellement votre calendrier.</p>
      </div>

      {actions.length ? (
        <div className="mb-4 space-y-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{formatDate(date, { weekday: "long", day: "numeric" })}</p>
          {actions.map((item) => (
            <Link href={item.detail_url || "#"} key={item.event_key} className="block rounded-xl border border-[var(--tr1-line)] bg-white p-3 text-sm transition hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <strong className="line-clamp-2 text-[var(--tr1-navy)]">{item.title}</strong>
                <Badge variant="outline">{item.source_kind === "report" ? "CR" : "Tâche"}</Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{[item.pharmacy_name, item.brand_names.join(" · ")].filter(Boolean).join(" · ")}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {remainingBacklog.slice(0, 8).map((item) => (
          <Link href={item.detail_url || "#"} className="block rounded-xl border border-[var(--tr1-line)] bg-white p-3 text-sm transition hover:border-slate-300 hover:shadow-sm" key={item.item_key}>
            <div className="flex items-start justify-between gap-2">
              <strong className="line-clamp-2 text-[var(--tr1-navy)]">{item.title}</strong>
              <Badge variant={item.status === "overdue" ? "destructive" : "secondary"}>{uiLabel(item.status)}</Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{[item.pharmacy_name, item.brand_name].filter(Boolean).join(" · ")}</p>
          </Link>
        ))}
        {!actions.length && !remainingBacklog.length ? (
          <div className="rounded-xl border border-dashed bg-slate-50/60 p-5 text-center">
            <Sparkles className="mx-auto size-4 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">Rien à traiter pour le moment.</p>
          </div>
        ) : null}
        {remainingBacklog.length > 8 ? <p className="pt-1 text-center text-xs text-muted-foreground">+ {remainingBacklog.length - 8} autres actions</p> : null}
      </div>
    </aside>
  );
}

function EmptyPlanning({ onAddVisit }: { onAddVisit?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50/60 p-8 text-center">
      <CalendarDays className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-semibold text-[var(--tr1-navy)]">Journée disponible</p>
      <p className="mt-1 text-xs text-muted-foreground">Aucune contrainte horaire planifiée.</p>
      {onAddVisit ? <Button size="sm" className="mt-3" onClick={onAddVisit}><Plus className="size-3.5" />Planifier une visite</Button> : null}
    </div>
  );
}

function VisitSheet({ pharmacies, open, onOpenChange, defaultStart }: { pharmacies: PharmacyOption[]; open: boolean; onOpenChange: (open: boolean) => void; defaultStart: string }) {
  const router = useRouter();
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [feedback, setFeedback] = useState<{ error?: string }>({});
  const [pending, startSubmit] = useTransition();

  const selected = pharmacies.find((item) => item.id === pharmacyId) ?? pharmacies[0];
  const filtered = pharmacies.filter((item) => `${item.label} ${item.city ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 60);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setStartAt(defaultStart);
      setFeedback({});
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Planifier une visite</SheetTitle></SheetHeader>
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            startSubmit(async () => {
              const result = await createFieldVisitAction({}, new FormData(form));
              if (result?.error) {
                setFeedback({ error: result.error });
                return;
              }
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          {feedback.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{feedback.error}</p> : null}
          <input type="hidden" name="pharmacyId" value={selected?.id ?? ""} />
          <input type="hidden" name="title" value={`Visite · ${selected?.label ?? "Pharmacie"}`} />

          <Field label="Pharmacie">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, ville…" />
            </div>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border p-1">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setPharmacyId(item.id); setSearch(""); }}
                  className={cn("w-full rounded-md px-3 py-2 text-left text-sm transition", selected?.id === item.id ? "bg-[var(--tr1-navy)] text-white" : "hover:bg-slate-50")}
                >
                  <span className="font-semibold">{item.label}</span>{item.city ? <span className={cn("ml-1 text-xs", selected?.id === item.id ? "text-white/70" : "text-muted-foreground")}>· {item.city}</span> : null}
                </button>
              ))}
              {!filtered.length ? <p className="p-3 text-center text-xs text-muted-foreground">Aucune pharmacie trouvée.</p> : null}
            </div>
          </Field>

          <Field label="Marques concernées">
            <div className="space-y-2 rounded-lg border p-3" key={selected?.id}>
              {selected?.brands.map((brand, index) => (
                <label className="flex items-center gap-2 text-sm" key={brand.relationId}>
                  <input type="checkbox" name="brandPharmacyId" value={brand.relationId} defaultChecked={index === 0} />
                  {brand.brandName}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select className="h-10 w-full rounded-md border bg-background px-3" name="visitKind" defaultValue="client_visit">
                <option value="client_visit">Visite client</option>
                <option value="prospecting">Prospection</option>
                <option value="relationship">Relation</option>
                <option value="training">Formation</option>
                <option value="other">Autre</option>
              </select>
            </Field>
            <Field label="Durée">
              <select className="h-10 w-full rounded-md border bg-background px-3" name="duration" defaultValue="60">
                <option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option><option value="180">3 h</option><option value="240">4 h</option><option value="480">Journée</option>
              </select>
            </Field>
          </div>

          <Field label="Début">
            <Input type="datetime-local" name="startAt" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
          </Field>

          <Field label="Objectif">
            <Textarea name="objective" placeholder="Ce que vous voulez obtenir pendant la visite" />
          </Field>

          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Ajouter une note</summary>
            <Textarea className="mt-3" name="notes" />
          </details>

          <Button disabled={pending || !selected} className="w-full">{pending ? "Planification…" : "Planifier la visite"}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function BlockSheet({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState(createAgendaBlockAction, {} as { error?: string; success?: string });
  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="outline">Bloquer un créneau</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Bloquer un créneau</SheetTitle></SheetHeader>
        <form action={action} className="space-y-4 p-4">
          <Feedback state={state} />
          <Field label="Type">
            <select name="blockType" className="h-10 w-full rounded-md border bg-background px-3">
              <option value="unavailable">Indisponible</option><option value="travel">Trajet</option><option value="meeting">Réunion</option><option value="break">Pause</option><option value="personal">Personnel</option><option value="other">Autre</option>
            </select>
          </Field>
          <Field label="Titre"><Input name="title" required /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début"><Input type="datetime-local" name="startAt" defaultValue={`${defaultDate}T12:00`} required /></Field>
            <Field label="Fin"><Input type="datetime-local" name="endAt" defaultValue={`${defaultDate}T13:00`} required /></Field>
          </div>
          <Button disabled={pending} className="w-full">{pending ? "Création…" : "Bloquer ce créneau"}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5">{label}</Label>{children}</div>;
}

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return state.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : state.success ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p> : null;
}

function relatedContext(event: AgendaEvent, contextEvents: AgendaEvent[]) {
  if (!event.pharmacy_id) return [];
  const day = localDay(event.start_at);
  return contextEvents.filter((context) => context.pharmacy_id === event.pharmacy_id && localDay(context.start_at) === day);
}

function localDay(value: string) { return isoToParisLocal(value).slice(0, 10); }
function eventTime(value: string) { return isoToParisLocal(value).slice(11, 16); }
function eventTimeRange(event: AgendaEvent) { return `${eventTime(event.start_at)}–${eventTime(event.end_at)}`; }
function slotLocal(day: string, hour: number, minute: number) { return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`; }
function formatSlot(hour: number, minute: number) { return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`; }

function minutesSinceMidnight(value: string) {
  const local = isoToParisLocal(value);
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

function eventPlacement(event: AgendaEvent): EventPlacement | null {
  const rawStart = minutesSinceMidnight(event.start_at);
  const rawEnd = rawStart + eventDurationMinutes(event);
  const visibleStart = Math.max(rawStart, GRID_START_MINUTES);
  const visibleEnd = Math.min(rawEnd, GRID_END_MINUTES);
  if (visibleEnd <= visibleStart) return null;

  const fromGridStart = visibleStart - GRID_START_MINUTES;
  const startIndex = Math.floor(fromGridStart / SLOT_MINUTES);
  const minuteOffset = fromGridStart % SLOT_MINUTES;
  const topOffset = (minuteOffset / SLOT_MINUTES) * SLOT_HEIGHT_PX + 4;
  const visibleDuration = visibleEnd - visibleStart;
  const height = Math.max(24, (visibleDuration / SLOT_MINUTES) * SLOT_HEIGHT_PX - 8);

  return { startIndex, topOffset, height, visibleStart, visibleEnd };
}

function eventOverlapsSlot(event: AgendaEvent, day: string, hour: number, minute: number) {
  if (localDay(event.start_at) !== day) return false;
  const placement = eventPlacement(event);
  if (!placement) return false;
  const slotStart = hour * 60 + minute;
  const slotEnd = slotStart + SLOT_MINUTES;
  return placement.visibleStart < slotEnd && placement.visibleEnd > slotStart;
}

function layoutDayEvents(events: AgendaEvent[], day: string): PositionedEvent[] {
  const candidates = events
    .filter((event) => localDay(event.start_at) === day)
    .map((event) => ({ event, placement: eventPlacement(event) }))
    .filter((item): item is { event: AgendaEvent; placement: EventPlacement } => item.placement !== null)
    .sort((a, b) => a.placement.visibleStart - b.placement.visibleStart || a.placement.visibleEnd - b.placement.visibleEnd);

  if (!candidates.length) return [];

  const groups: Array<typeof candidates> = [];
  let current: typeof candidates = [];
  let groupEnd = -1;

  for (const candidate of candidates) {
    if (current.length && candidate.placement.visibleStart >= groupEnd) {
      groups.push(current);
      current = [];
      groupEnd = -1;
    }
    current.push(candidate);
    groupEnd = Math.max(groupEnd, candidate.placement.visibleEnd);
  }
  if (current.length) groups.push(current);

  return groups.flatMap((group) => {
    const laneEnds: number[] = [];
    const laidOut = group.map((candidate) => {
      let lane = laneEnds.findIndex((end) => end <= candidate.placement.visibleStart);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = candidate.placement.visibleEnd;
      return { ...candidate, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return laidOut.map((item) => ({ ...item, laneCount }));
  });
}

function eventDurationMinutes(event: AgendaEvent) {
  const duration = Math.round((Date.parse(event.end_at) - Date.parse(event.start_at)) / 60000);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

function contextLabel(event: AgendaEvent) { return event.source_kind === "mission" ? "Animation / mission" : "Activité en pharmacie"; }
function eventKindLabel(event: AgendaEvent) {
  if (event.source_kind === "field_visit") return "Visite terrain";
  if (event.source_kind === "mission") return "Mission";
  if (event.source_kind === "agenda_block") return "Créneau bloqué";
  return uiLabel(event.event_type || event.source_kind);
}
function mapsUrl(event: AgendaEvent) {
  const query = [event.pharmacy_name, event.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function formatDate(day: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", options);
}
