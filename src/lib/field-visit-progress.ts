export type FieldVisitAgendaEvent = {
  event_key: string;
  source_kind: string;
  source_id: string;
  title: string;
  start_at: string;
  end_at: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  city: string | null;
  ownership: string;
  status: string;
  metadata?: { visit_kind?: string } | null;
};

export type FieldVisitCompletion = {
  visit_id: string;
  brand_id: string;
  brand_pharmacy_id: string;
  order_result: "order_taken" | "no_order";
  photo_result: "photo_added" | "not_required";
  note: string;
  next_visit_date: string;
  completed_at: string;
};

export type VisitDayState = "done" | "needs_completion" | "todo";

export function buildVisitDay(
  events: FieldVisitAgendaEvent[],
  completions: FieldVisitCompletion[],
) {
  const unique = new Map<string, FieldVisitAgendaEvent>();
  for (const event of events) {
    if (
      event.source_kind !== "field_visit" ||
      event.ownership !== "mine" ||
      event.status === "cancelled"
    ) {
      continue;
    }
    if (!unique.has(event.source_id)) unique.set(event.source_id, event);
  }

  const visits = [...unique.values()].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  );
  const completionByVisit = new Map(
    completions.map((completion) => [completion.visit_id, completion]),
  );

  const state = (visit: FieldVisitAgendaEvent): VisitDayState => {
    if (completionByVisit.has(visit.source_id)) return "done";
    if (visit.status === "in_progress" || visit.status === "completed") {
      return "needs_completion";
    }
    return "todo";
  };

  const done = visits.filter((visit) => state(visit) === "done").length;
  const needsCompletion = visits.filter(
    (visit) => state(visit) === "needs_completion",
  ).length;
  const todo = visits.filter((visit) => state(visit) === "todo").length;

  return {
    visits,
    completionByVisit,
    state,
    done,
    needsCompletion,
    todo,
    total: visits.length,
  };
}

export function addDaysToCalendarDate(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !Number.isInteger(days)) return value;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
