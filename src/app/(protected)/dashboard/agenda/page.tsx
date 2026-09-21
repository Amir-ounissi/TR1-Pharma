import {
  AgendaPlanner,
  type AgendaEvent,
  type BacklogItem,
} from "@/components/agenda/agenda-planner-v2";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { addCalendarDays, mondayOfWeek, parseCalendarDate, todayInParis } from "@/lib/agenda";

export default async function AgendaPage({ searchParams }:{ searchParams:Promise<{date?:string;view?:string}> }) {
  const [params, { supabase }, contexts] = await Promise.all([
    searchParams,
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);
  const today = todayInParis();
  const requested = params.date ?? today;
  const safeDate = parseCalendarDate(requested) ? requested : today;
  const view = params.view === "week" ? "week" : "day";
  const date = view === "week" ? mondayOfWeek(safeDate) : safeDate;
  const end = view === "week" ? addCalendarDays(date, 6) : date;
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  const [
    { data: agenda, error: agendaError },
    { data: backlog, error: backlogError },
  ] = await Promise.all([
    supabase.rpc("get_my_field_agenda", { start_date: date, end_date: end, brand_filter: null }),
    supabase.rpc("get_my_unplanned_agenda_items", { brand_filter: null }),
  ]);

  if (agendaError) throw new Error(agendaError.message);
  if (backlogError) throw new Error(backlogError.message);

  const agendaEvents = ((agenda ?? []) as AgendaEvent[]).map((event) => {
    if (event.source_kind === "field_visit") {
      return { ...event, detail_url: `/dashboard/visits/${event.source_id}` };
    }
    if (facilitatorOnly && event.source_kind === "mission") {
      return { ...event, detail_url: `/dashboard/field/missions/${event.source_id}` };
    }
    return event;
  });

  return (
    <AgendaPlanner
      date={date}
      today={today}
      view={view}
      events={agendaEvents}
      backlog={(backlog ?? []) as BacklogItem[]}
      brands={contexts.map(({ id, name }) => ({ id, name }))}
      canCreateVisit={contexts.some((context) => context.role === "agent")}
    />
  );
}
