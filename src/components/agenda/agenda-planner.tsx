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
  { key: "task", label: "Tâches" },
  { key: "agenda_block", label: "Créneaux" },
] as const;

const hours = Array.from({ length: 12 }, (_, index) => index + 8);

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
  const [filter, setFilter] =
    useState<(typeof planningFilters)[number]["key"]>("all");
  const [moveFeedback, setMoveFeedback] = useState<{
    visitId: string;
    previousLocal: string;
    message: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const days = useMemo(
    () =>
      Array.from({ length: view === "week" ? 7 : 1 }, (_, index) =>
        addCalendarDays(date, index),
      ),
    [date, view],
  );

  const planningEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.ownership === "mine" &&
          (filter === "all" || event.source_kind === filter),
      ),
    [events, filter],
  );

  const contextEvents = useMemo(
    () => events.filter((event) => event.ownership === "pharmacy_activity"),
    [events],
  );

  const dayPlanning = planningEvents.filter(
    (event) => localDay(event.start_at) === date,
  );
  const dayVisits = dayPlanning.filter(
    (event) => event.source_kind === "field_visit",
  );
  const dayContext = contextEvents.filter(
    (event) => localDay(event.start_at) === date,
  );
  const priorityVisits = dayVisits.filter((event) => isPriority(event.priority));

  const navigate = (next: string) =>
    router.push(`/dashboard/agenda?date=${next}&view=${view}`);

  const setView = (nextView: "day" | "week") =>
    router.push(`/dashboard/agenda?date=${date}&view=${nextView}`);

  const dropVisit = (drag: React.DragEvent, day: string, hour: number) => {
    drag.preventDefault();
    const visitId = drag.dataTransfer.getData("text/field-visit");
    const previousLocal = drag.dataTransfer.getData("text/field-visit-start");
    if (!visitId) return;
    const nextLocal = `${day}T${String(hour).padStart(2, "0")}:00`;

    startTransition(async () => {
      try {
        await rescheduleFieldVisitAction(visitId, nextLocal);
        setMoveFeedback({
          visitId,
          previousLocal,
          message: `Visite déplacée à ${String(hour).padStart(2, "0")}:00`,
        });
        router.refresh();
        window.setTimeout(() => setMoveFeedback(null), 6000);
      } catch {
        setMoveFeedback({
          visitId: "",
          previousLocal: "",
          message: "Impossible de déplacer la visite.",
        });
      }
    });
  };

  const undoMove = () => {
    if (!moveFeedback?.visitId || !moveFeedback.previousLocal) return;
    startTransition(async () => {
      await rescheduleFieldVisitAction(
        moveFeedback.visitId,
        moveFeedback.previousLocal,
      );
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
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--tr1-navy)]">
            Votre journée, sans friction
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Vos rendez-vous occupent le planning. Les animations et activités en
            pharmacie restent des informations terrain, sans bloquer votre temps.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCreateVisit ? (
            <VisitSheet pharmacies={pharmacies} defaultDate={date} />
          ) : null}
          <BlockSheet defaultDate={date} />
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--tr1-line)] bg-white/85 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--tr1-line)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={date === today ? "secondary" : "outline"}
              onClick={() => navigate(today)}
            >
              Aujourd&apos;hui
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={view === "week" ? "Semaine précédente" : "Jour précédent"}
              onClick={() =>
                navigate(addCalendarDays(date, view === "week" ? -7 : -1))
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={view === "week" ? "Semaine suivante" : "Jour suivant"}
              onClick={() =>
                navigate(addCalendarDays(date, view === "week" ? 7 : 1))
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="order-first flex min-w-0 items-center gap-2 sm:order-none">
            <CalendarDays className="size-4 shrink-0 text-[var(--tr1-orange)]" />
            <strong className="truncate text-sm text-[var(--tr1-navy)]">
              {view === "week"
                ? `Semaine du ${formatDate(date, { day: "numeric", month: "long" })}`
                : formatDate(date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
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
                  view === "day"
                    ? "bg-white text-[var(--tr1-navy)] shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setView("day")}
              >
                Jour
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  view === "week"
                    ? "bg-white text-[var(--tr1-navy)] shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
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
            <SummaryItem
              value={dayVisits.length}
              label={dayVisits.length > 1 ? "visites prévues" : "visite prévue"}
            />
            <SummaryItem
              value={priorityVisits.length}
              label="prioritaires"
              emphasis={priorityVisits.length > 0}
            />
            <SummaryItem
              value={dayContext.length}
              label="infos terrain"
              info
            />
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
                <Badge variant="outline" key={brand.id}>
                  {brand.name}
                </Badge>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <main className="min-w-0 overflow-hidden rounded-2xl border border-[var(--tr1-line)] bg-white/85 shadow-sm">
          {view === "day" ? (
            <>
              <div className="md:hidden">
                <MobileDayTimeline
                  date={date}
                  events={dayPlanning}
                  contextEvents={dayContext}
                />
              </div>
              <div className="hidden md:block">
                <DesktopTimeline
                  days={days}
                  events={planningEvents}
                  contextEvents={contextEvents}
                  view="day"
                  onDrop={dropVisit}
                />
              </div>
            </>
          ) : (
            <>
              <div className="md:hidden">
                <MobileWeekTimeline
                  days={days}
                  events={planningEvents}
                  contextEvents={contextEvents}
                />
              </div>
              <div className="hidden overflow-x-auto md:block">
                <DesktopTimeline
                  days={days}
                  events={planningEvents}
                  contextEvents={contextEvents}
                  view="week"
                  onDrop={dropVisit}
                />
              </div>
            </>
          )}
        </main>

        <BacklogPanel backlog={backlog} />
      </div>

      {moveFeedback ? (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-[var(--tr1-navy)] px-4 py-3 text-sm text-white shadow-xl">
          <span>{moveFeedback.message}</span>
          {moveFeedback.visitId && moveFeedback.previousLocal ? (
            <button
              className="inline-flex items-center gap-1 font-bold text-white underline underline-offset-4"
              onClick={undoMove}
            >
              <RotateCcw className="size-3.5" />
              Annuler
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryItem({
  value,
  label,
  emphasis = false,
  info = false,
}: {
  value: number;
  label: string;
  emphasis?: boolean;
  info?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={cn(
          "grid size-9 place-items-center rounded-xl text-sm font-black",
          emphasis
            ? "bg-orange-50 text-[var(--tr1-orange)]"
            : info
              ? "bg-slate-100 text-slate-700"
              : "bg-[var(--tr1-navy)]/5 text-[var(--tr1-navy)]",
        )}
      >
        {value}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function ContextStrip({
  events,
  planning,
}: {
  events: AgendaEvent[];
  planning: AgendaEvent[];
}) {
  const plannedPharmacyIds = new Set(
    planning.map((event) => event.pharmacy_id).filter(Boolean),
  );

  return (
    <section className="rounded-2xl border border-[var(--tr1-line)] bg-slate-50/80 p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg bg-white shadow-sm">
          <Info className="size-4 text-[var(--tr1-orange)]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--tr1-navy)]">
            À savoir aujourd&apos;hui
          </h2>
          <p className="text-xs text-muted-foreground">
            Informations terrain — elles ne bloquent aucun créneau.
          </p>
        </div>
      </div>

      {events.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {events.map((event) => {
            const onRoute =
              !!event.pharmacy_id && plannedPharmacyIds.has(event.pharmacy_id);
            return (
              <Link
                href={event.detail_url}
                key={event.event_key}
                className="min-w-[16rem] flex-1 rounded-xl border border-[var(--tr1-line)] bg-white p-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--tr1-orange)]">
                      {contextLabel(event)}
                    </p>
                    <strong className="mt-0.5 line-clamp-1 block text-sm text-[var(--tr1-navy)]">
                      {event.pharmacy_name || event.title}
                    </strong>
                  </div>
                  {onRoute ? (
                    <Badge variant="secondary">Dans votre tournée</Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {eventTimeRange(event)}
                  {event.assigned_user_name
                    ? ` · ${event.assigned_user_name}`
                    : ""}
                </p>
                {event.brand_names.length ? (
                  <p className="mt-1 line-clamp-1 text-xs font-medium">
                    {event.brand_names.join(" · ")}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-white/60 px-4 py-3 text-xs text-muted-foreground">
          Aucune animation ou activité signalée dans vos pharmacies aujourd&apos;hui.
        </div>
      )}
    </section>
  );
}

function WeeklyContext({
  events,
  days,
}: {
  events: AgendaEvent[];
  days: string[];
}) {
  const weekly = events.filter((event) => days.includes(localDay(event.start_at)));
  if (!weekly.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--tr1-line)] bg-slate-50/80 p-3">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-[var(--tr1-orange)]" />
        <h2 className="text-sm font-bold text-[var(--tr1-navy)]">
          Informations terrain de la semaine
        </h2>
        <Badge variant="secondary">{weekly.length}</Badge>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {weekly.map((event) => (
          <Link
            href={event.detail_url}
            key={event.event_key}
            className="min-w-[15rem] rounded-lg border bg-white px-3 py-2 text-xs hover:border-slate-300"
          >
            <strong>{event.pharmacy_name || event.title}</strong>
            <p className="mt-1 text-muted-foreground">
              {formatDate(localDay(event.start_at), {
                weekday: "short",
                day: "numeric",
              })}{" "}
              · {eventTimeRange(event)}
            </p>
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
  onDrop,
}: {
  days: string[];
  events: AgendaEvent[];
  contextEvents: AgendaEvent[];
  view: "day" | "week";
  onDrop: (event: React.DragEvent, day: string, hour: number) => void;
}) {
  return (
    <div
      className={cn(
        "grid",
        view === "week"
          ? "min-w-[62rem] grid-cols-[4rem_repeat(7,minmax(8rem,1fr))]"
          : "grid-cols-[4.25rem_minmax(0,1fr)]",
      )}
    >
      <div className="border-b bg-slate-50/70" />
      {days.map((day) => (
        <div
          className="border-b border-l bg-slate-50/70 px-2 py-3 text-center"
          key={day}
        >
          <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">
            {formatDate(day, { weekday: "short" })}
          </p>
          <p className="text-sm font-black text-[var(--tr1-navy)]">
            {formatDate(day, { day: "numeric", month: "short" })}
          </p>
        </div>
      ))}

      {hours.map((hour) => (
        <TimelineRow
          key={hour}
          hour={hour}
          days={days}
          events={events}
          contextEvents={contextEvents}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}

function TimelineRow({
  hour,
  days,
  events,
  contextEvents,
  onDrop,
}: {
  hour: number;
  days: string[];
  events: AgendaEvent[];
  contextEvents: AgendaEvent[];
  onDrop: (event: React.DragEvent, day: string, hour: number) => void;
}) {
  const hourToken = `${String(hour).padStart(2, "0")}:`;

  return (
    <>
      <div className="border-t px-2 py-3 text-right font-mono text-[0.65rem] text-muted-foreground">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((day) => {
        const items = events.filter((event) =>
          isoToParisLocal(event.start_at).startsWith(`${day}T${hourToken}`),
        );

        return (
          <div
            className="group min-h-20 border-l border-t p-1.5 transition hover:bg-slate-50/60"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, day, hour)}
            key={day}
          >
            {items.map((item) => (
              <EventCard
                event={item}
                relatedContext={relatedContext(item, contextEvents)}
                key={item.event_key}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function MobileDayTimeline({
  date,
  events,
  contextEvents,
}: {
  date: string;
  events: AgendaEvent[];
  contextEvents: AgendaEvent[];
}) {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
  );

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Planning
          </p>
          <p className="text-sm font-black text-[var(--tr1-navy)]">
            {formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Badge variant="secondary">{sorted.length}</Badge>
      </div>

      {sorted.length ? (
        <div className="space-y-1">
          {sorted.map((event) => (
            <div
              key={event.event_key}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2"
            >
              <div className="pt-3 text-right font-mono text-xs font-bold text-muted-foreground">
                {eventTime(event.start_at)}
              </div>
              <EventCard
                event={event}
                relatedContext={relatedContext(event, contextEvents)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyPlanning />
      )}
    </div>
  );
}

function MobileWeekTimeline({
  days,
  events,
  contextEvents,
}: {
  days: string[];
  events: AgendaEvent[];
  contextEvents: AgendaEvent[];
}) {
  return (
    <div className="space-y-1 p-3">
      {days.map((day) => {
        const dayEvents = events
          .filter((event) => localDay(event.start_at) === day)
          .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));

        return (
          <section className="py-2" key={day}>
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-sm text-[var(--tr1-navy)]">
                {formatDate(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </strong>
              <span className="text-xs text-muted-foreground">
                {dayEvents.length || "—"}
              </span>
            </div>
            {dayEvents.length ? (
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <EventCard
                    event={event}
                    relatedContext={relatedContext(event, contextEvents)}
                    key={event.event_key}
                  />
                ))}
              </div>
            ) : (
              <div className="h-8 rounded-lg border border-dashed bg-slate-50/60" />
            )}
          </section>
        );
      })}
    </div>
  );
}

function EventCard({
  event,
  relatedContext,
}: {
  event: AgendaEvent;
  relatedContext: AgendaEvent[];
}) {
  const tone =
    event.source_kind === "field_visit"
      ? "border-l-[var(--tr1-orange)] bg-orange-50/55"
      : event.source_kind === "mission"
        ? "border-l-blue-500 bg-blue-50/55"
        : event.source_kind === "agenda_block"
          ? "border-l-slate-400 bg-slate-50"
          : "border-l-emerald-500 bg-emerald-50/55";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          draggable={event.draggable}
          onDragStart={(drag) => {
            if (!event.draggable) return;
            drag.dataTransfer.setData("text/field-visit", event.source_id);
            drag.dataTransfer.setData(
              "text/field-visit-start",
              isoToParisLocal(event.start_at).slice(0, 16),
            );
          }}
          className={cn(
            "mb-1 w-full rounded-xl border border-[var(--tr1-line)] border-l-4 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)]",
            tone,
            event.draggable && "cursor-grab active:cursor-grabbing",
          )}
        >
          <div className="flex items-start gap-2">
            {event.draggable ? (
              <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <strong className="line-clamp-2 text-sm text-[var(--tr1-navy)]">
                  {event.pharmacy_name || event.title}
                </strong>
                {isPriority(event.priority) ? (
                  <Badge variant="secondary" className="shrink-0">
                    Prioritaire
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <Clock3 className="mr-1 inline size-3" />
                {eventTimeRange(event)}
                {event.pharmacy_name && event.title !== event.pharmacy_name
                  ? ` · ${event.title}`
                  : ""}
              </p>
              {event.city ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  <MapPin className="mr-1 inline size-3" />
                  {event.city}
                </p>
              ) : null}
              {relatedContext.length ? (
                <div className="mt-2">
                  <Badge variant="outline">
                    <Sparkles className="mr-1 size-3" />
                    {relatedContext.length === 1
                      ? "Animation / activité aujourd’hui"
                      : `${relatedContext.length} infos terrain`}
                  </Badge>
                </div>
              ) : null}
            </div>
          </div>
        </button>
      </SheetTrigger>

      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{event.pharmacy_name || event.title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 p-4">
          <div className="rounded-xl border bg-slate-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {eventKindLabel(event)}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Clock3 className="size-4 text-muted-foreground" />
                {eventTimeRange(event)}
              </p>
              {event.city ? (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  {event.city}
                </p>
              ) : null}
              {event.brand_names.length ? (
                <p className="flex items-center gap-2">
                  <Target className="size-4 text-muted-foreground" />
                  {event.brand_names.join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          {relatedContext.length ? (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                À savoir dans cette pharmacie
              </h3>
              <div className="space-y-2">
                {relatedContext.map((context) => (
                  <div
                    key={context.event_key}
                    className="rounded-xl border border-orange-100 bg-orange-50/60 p-3"
                  >
                    <p className="text-xs font-bold text-[var(--tr1-orange)]">
                      {contextLabel(context)}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {context.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventTimeRange(context)}
                      {context.assigned_user_name
                        ? ` · ${context.assigned_user_name}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            {event.detail_url ? (
              <Button asChild>
                <Link href={event.detail_url}>
                  {event.source_kind === "field_visit"
                    ? "Ouvrir la visite"
                    : "Ouvrir le détail"}
                </Link>
              </Button>
            ) : null}
            {event.pharmacy_name ? (
              <Button variant="outline" asChild>
                <a
                  href={mapsUrl(event)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="size-4" />
                  Itinéraire
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BacklogPanel({ backlog }: { backlog: BacklogItem[] }) {
  return (
    <aside className="h-fit rounded-2xl border border-[var(--tr1-line)] bg-white/85 p-3 shadow-sm xl:sticky xl:top-4">
      <div className="mb-3">
        <h2 className="font-bold text-[var(--tr1-navy)]">À planifier</h2>
        <p className="text-xs text-muted-foreground">
          Retards et actions qui demandent votre attention.
        </p>
      </div>
      <div className="space-y-2">
        {backlog.slice(0, 8).map((item) => (
          <Link
            href={item.detail_url}
            className="block rounded-xl border border-[var(--tr1-line)] bg-white p-3 text-sm transition hover:border-slate-300 hover:shadow-sm"
            key={item.item_key}
          >
            <div className="flex items-start justify-between gap-2">
              <strong className="line-clamp-2 text-[var(--tr1-navy)]">
                {item.title}
              </strong>
              <Badge
                variant={item.status === "overdue" ? "destructive" : "secondary"}
              >
                {uiLabel(item.status)}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {[item.pharmacy_name, item.brand_name].filter(Boolean).join(" · ")}
            </p>
          </Link>
        ))}
        {!backlog.length ? (
          <div className="rounded-xl border border-dashed bg-slate-50/60 p-5 text-center">
            <Sparkles className="mx-auto size-4 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              Rien à planifier pour le moment.
            </p>
          </div>
        ) : null}
        {backlog.length > 8 ? (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            + {backlog.length - 8} autres actions
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function EmptyPlanning() {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50/60 p-8 text-center">
      <CalendarDays className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-semibold text-[var(--tr1-navy)]">
        Journée disponible
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Aucune contrainte horaire planifiée.
      </p>
    </div>
  );
}

function VisitSheet({
  pharmacies,
  defaultDate,
}: {
  pharmacies: PharmacyOption[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(
    createFieldVisitAction,
    {} as { error?: string; success?: string },
  );
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id ?? "");
  const selected = pharmacies.find((item) => item.id === pharmacyId);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Planifier une visite
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Planifier une visite</SheetTitle>
        </SheetHeader>
        <form action={action} className="space-y-4 p-4">
          <Feedback state={state} />
          <Field label="Pharmacie">
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              name="pharmacyId"
              value={pharmacyId}
              onChange={(event) => setPharmacyId(event.target.value)}
            >
              {pharmacies.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                  {item.city ? ` · ${item.city}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Marques concernées">
            <div className="space-y-2 rounded-lg border p-3">
              {selected?.brands.map((brand) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={brand.relationId}
                >
                  <input
                    type="checkbox"
                    name="brandPharmacyId"
                    value={brand.relationId}
                  />
                  {brand.brandName}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                name="visitKind"
              >
                <option value="client_visit">Visite client</option>
                <option value="prospecting">Prospection</option>
                <option value="relationship">Relation</option>
                <option value="training">Formation</option>
                <option value="other">Autre</option>
              </select>
            </Field>
            <Field label="Durée">
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                name="duration"
                defaultValue="60"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
                <option value="120">2 h</option>
              </select>
            </Field>
          </div>

          <Field label="Début">
            <Input
              type="datetime-local"
              name="startAt"
              defaultValue={`${defaultDate}T09:00`}
              required
            />
          </Field>

          <Field label="Titre">
            <Input
              name="title"
              placeholder="Ex. Suivi référencement"
              required
            />
          </Field>

          <Field label="Objectif">
            <Textarea
              name="objective"
              placeholder="Ce que vous voulez obtenir pendant la visite"
            />
          </Field>

          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              Ajouter une note
            </summary>
            <Textarea className="mt-3" name="notes" />
          </details>

          <Button disabled={pending} className="w-full">
            {pending ? "Planification…" : "Planifier la visite"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function BlockSheet({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState(
    createAgendaBlockAction,
    {} as { error?: string; success?: string },
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Bloquer un créneau</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Bloquer un créneau</SheetTitle>
        </SheetHeader>
        <form action={action} className="space-y-4 p-4">
          <Feedback state={state} />
          <Field label="Type">
            <select
              name="blockType"
              className="h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="unavailable">Indisponible</option>
              <option value="travel">Trajet</option>
              <option value="meeting">Réunion</option>
              <option value="break">Pause</option>
              <option value="personal">Personnel</option>
              <option value="other">Autre</option>
            </select>
          </Field>
          <Field label="Titre">
            <Input name="title" required />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début">
              <Input
                type="datetime-local"
                name="startAt"
                defaultValue={`${defaultDate}T12:00`}
                required
              />
            </Field>
            <Field label="Fin">
              <Input
                type="datetime-local"
                name="endAt"
                defaultValue={`${defaultDate}T13:00`}
                required
              />
            </Field>
          </div>
          <Button disabled={pending} className="w-full">
            {pending ? "Création…" : "Bloquer ce créneau"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      {children}
    </div>
  );
}

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return state.error ? (
    <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {state.error}
    </p>
  ) : state.success ? (
    <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
      {state.success}
    </p>
  ) : null;
}

function relatedContext(event: AgendaEvent, contextEvents: AgendaEvent[]) {
  if (!event.pharmacy_id) return [];
  const day = localDay(event.start_at);
  return contextEvents.filter(
    (context) =>
      context.pharmacy_id === event.pharmacy_id &&
      localDay(context.start_at) === day,
  );
}

function localDay(value: string) {
  return isoToParisLocal(value).slice(0, 10);
}

function eventTime(value: string) {
  return isoToParisLocal(value).slice(11, 16);
}

function eventTimeRange(event: AgendaEvent) {
  return `${eventTime(event.start_at)}–${eventTime(event.end_at)}`;
}

function isPriority(priority: string) {
  return ["high", "urgent", "critical", "priority", "prioritaire"].includes(
    priority?.toLowerCase(),
  );
}

function contextLabel(event: AgendaEvent) {
  if (event.source_kind === "mission") return "Animation / mission";
  return "Activité en pharmacie";
}

function eventKindLabel(event: AgendaEvent) {
  if (event.source_kind === "field_visit") return "Visite terrain";
  if (event.source_kind === "mission") return "Mission";
  if (event.source_kind === "agenda_block") return "Créneau bloqué";
  if (event.source_kind === "task") return "Tâche";
  return uiLabel(event.event_type || event.source_kind);
}

function mapsUrl(event: AgendaEvent) {
  const query = [event.pharmacy_name, event.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatDate(
  day: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", options);
}
