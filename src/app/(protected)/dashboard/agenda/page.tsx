import {
  AgendaPlanner,
  type BacklogItem,
} from "@/components/agenda/agenda-planner-v2";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { mondayOfWeek, parseCalendarDate, todayInParis } from "@/lib/agenda";
import { loadAgendaRangeAction } from "@/app/(protected)/dashboard/agenda/actions";

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
  const range = await loadAgendaRangeAction(date, view);
  const { supabase } = await requireCompletedOnboarding();
  const { data: backlog, error: backlogError } = await supabase.rpc("get_my_unplanned_agenda_items", {
    brand_filter: null,
  });
  if (backlogError) throw new Error(backlogError.message);

  return (
    <AgendaPlanner
      date={date}
      today={today}
      view={view}
      events={range.events}
      backlog={(backlog ?? []) as BacklogItem[]}
      brands={contexts.map(({ id, name }) => ({ id, name }))}
      canCreateVisit={contexts.some((context) => context.role === "agent")}
    />
  );
}
