import type { AgentNextVisit, AgentTodayData } from "@/components/agent/agent-day-experience";
import {
  AgentMultibrandOverview,
  type AgentMultibrandDay,
  type AgentMultibrandVisitSummary,
} from "@/components/agent/agent-multibrand-overview";
import { AgentTodayCockpit } from "@/components/agent/agent-today-cockpit";
import { DashboardTracker } from "@/components/agent/dashboard-tracker";
import { OfflineDayPreloader } from "@/components/pwa/offline-day-preloader";
import { addCalendarDays } from "@/lib/agenda";
import { requireActiveBrand } from "@/lib/auth";
import { nextIsoDate, parisBusinessDate } from "@/lib/business-date";
import { requireActiveBrandCapability } from "@/lib/saas/server";
import { loadStockAlerts } from "@/lib/stock-alerts-server";

type FieldAgendaEvent = {
  event_key: string;
  source_kind: string;
  source_id: string;
  title: string;
  start_at: string;
  end_at: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  city: string | null;
  brand_ids: string[];
  brand_names: string[];
  ownership: string;
  status: string;
  detail_url: string;
};

type RelationRow = {
  id: string;
  brand_id: string;
  pharmacy_id: string;
};

type ObjectiveProgressRow = {
  metric_key: string;
  target_value: number;
  realized_value: number;
};

async function timedQuery<T>(label: string, query: PromiseLike<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await query;
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 250) {
      console.info(JSON.stringify({ event: "agent_query_timing", label, durationMs }));
    }
  }
}

const closedVisitStatuses = new Set(["completed", "cancelled", "canceled", "missed", "no_show"]);

function visitNeedsCloseout(event: FieldAgendaEvent, nowMs: number) {
  const status = event.status.trim().toLowerCase();
  if (closedVisitStatuses.has(status)) return false;
  const endAt = Date.parse(event.end_at);
  return Number.isFinite(endAt) && endAt <= nowMs;
}

function cleanVisitObjective(value: string | null | undefined, pharmacyName: string, fallback = "Suivi commercial") {
  const objective = value?.trim();
  if (!objective) return fallback;

  const normalize = (text: string) => text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

  const normalizedObjective = normalize(objective);
  const normalizedPharmacy = normalize(pharmacyName);
  if (normalizedObjective === normalizedPharmacy) return fallback;

  const visitType = objective.match(/^\s*(VP|RP|RC|VC|F)\s*[-–—:]\s*(.+)$/i);
  if (visitType && normalize(visitType[2]) === normalizedPharmacy) {
    return ({
      VP: "Visite de prospection",
      RP: "Rendez-vous prospect",
      RC: "Rendez-vous client",
      VC: "Visite client",
      F: "Formation",
    } as Record<string, string>)[visitType[1].toUpperCase()] ?? fallback;
  }

  return objective;
}

export default async function AgentPage() {
  const [saas, session] = await Promise.all([
    requireActiveBrandCapability("agent_day"),
    requireActiveBrand(),
  ]);
  const { supabase, brand, profile, userId } = session;

  const today = parisBusinessDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const planningHorizon = addCalendarDays(today, 14);
  const now = new Date();

  const [
    { data: nextVisit },
    multibrandFieldAgendaResult,
    upcomingFieldAgendaResult,
    stockAlerts,
    multibrandDayResult,
    monthBookedOrdersResult,
    monthObjectivesResult,
    monthOrdersResult,
    personalTargetResult,
  ] = await Promise.all([
    timedQuery("get_next_agent_visit", supabase.rpc("get_next_agent_visit", { target_brand_id: brand.id })),
    timedQuery("get_my_field_agenda_today", supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: today,
      brand_filter: brand.id,
    })),
    timedQuery("get_my_field_agenda_14d", supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: planningHorizon,
      brand_filter: brand.id,
    })),
    saas.capabilities.has("sell_out")
      ? loadStockAlerts(supabase, brand.id, userId).catch((error) => {
          console.error(
            `[agent] stock alerts unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
          );
          return [];
        })
      : Promise.resolve([]),
    timedQuery("get_agent_today_multibrand", supabase.rpc("get_agent_today_multibrand", {
      target_date: today,
      brand_filter: brand.id,
    })),
    timedQuery("performance_booked_order_facts", supabase
      .from("performance_booked_order_facts")
      .select("net_amount_ht")
      .eq("brand_id", brand.id)
      .eq("agent_user_id_at_order", userId)
      .gte("order_date", `${monthStart}T00:00:00.000Z`)
      .lt("order_date", `${nextIsoDate(today)}T00:00:00.000Z`)),
    timedQuery("get_objective_progress", supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: monthStart,
      target_filter_end: today,
      target_scope_type: "agent",
      target_territory_id: null,
      target_agent_id: userId,
    })),
    timedQuery("performance_order_count", supabase
      .from("performance_order_facts")
      .select("order_id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("agent_user_id_at_order", userId)
      .gte("order_date", `${monthStart}T00:00:00.000Z`)
      .lt("order_date", `${nextIsoDate(today)}T00:00:00.000Z`)),
    timedQuery("agent_personal_monthly_targets", supabase
      .from("agent_personal_monthly_targets")
      .select("revenue_target_ht")
      .eq("brand_id", brand.id)
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .maybeSingle()),
  ]);

  const optionalQueryErrors = [
    ["agenda du jour", multibrandFieldAgendaResult.error],
    ["agenda à venir", upcomingFieldAgendaResult.error],
    ["cockpit multimarque", multibrandDayResult.error],
    ["CA mensuel réservé", monthBookedOrdersResult.error],
    ["objectifs mensuels", monthObjectivesResult.error],
    ["commandes mensuelles", monthOrdersResult.error],
    ["objectif personnel", personalTargetResult.error],
  ] as const;

  for (const [label, error] of optionalQueryErrors) {
    if (error) {
      console.error(`[agent] ${label} unavailable: ${error.message}`);
    }
  }

  const visit = nextVisit as AgentNextVisit | null;
  const multibrandDay = (multibrandDayResult.data ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentMultibrandDay;
  const day: AgentTodayData = {
    tasks: multibrandDay.tasks.map((task) => ({
      id: task.id,
      brand_pharmacy_id: task.brand_pharmacy_id,
      title: task.title,
      task_type: task.task_type,
      priority: task.priority as AgentTodayData["tasks"][number]["priority"],
      due_at: task.due_at,
      is_overdue: task.is_overdue,
      pharmacy_name: task.pharmacy_name,
      city: task.city ?? "",
    })),
    missions: multibrandDay.missions.map((mission) => ({
      id: mission.id,
      brand_pharmacy_id: mission.brand_pharmacy_id,
      title: mission.title,
      objective: mission.objective ?? "",
      scheduled_start_at: mission.scheduled_start_at,
      priority: mission.priority,
      pharmacy_name: mission.pharmacy_name,
    })),
    reports: multibrandDay.reports.map((report) => ({
      id: report.id,
      mission_id: report.mission_id,
      title: report.title,
      brand_pharmacy_id: report.brand_pharmacy_id,
      report_status: report.report_status,
    })),
    follow_ups: multibrandDay.follow_ups.map((followUp) => ({
      brand_pharmacy_id: followUp.brand_pharmacy_id,
      pharmacy_name: followUp.pharmacy_name,
      last_interaction_at: followUp.last_interaction_at,
      priority: followUp.priority,
    })),
  };
  const firstName = profile.full_name.split(" ")[0];
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(now);

  const multibrandFieldVisits = ((multibrandFieldAgendaResult.data ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && event.source_kind === "field_visit" && Boolean(event.pharmacy_id),
  );
  const overviewVisits: AgentMultibrandVisitSummary[] = multibrandFieldVisits.map((event) => ({
    id: event.source_id,
    pharmacyId: event.pharmacy_id as string,
    pharmacyName: event.pharmacy_name || event.title,
    city: event.city,
    startAt: event.start_at,
    endAt: event.end_at || null,
    status: event.status,
    brandNames: event.brand_names ?? [],
    href: `/dashboard/visits/${event.source_id}`,
  }));

  const primaryFieldVisit = [...multibrandFieldVisits]
    .filter((event) => !["completed", "cancelled", "canceled", "missed"].includes(event.status.toLowerCase()))
    .sort((left, right) => {
      const leftInProgress = left.status.toLowerCase() === "in_progress";
      const rightInProgress = right.status.toLowerCase() === "in_progress";
      if (leftInProgress !== rightInProgress) return leftInProgress ? -1 : 1;
      return Date.parse(left.start_at) - Date.parse(right.start_at);
    })[0] ?? null;

  const primaryVisitContext = primaryFieldVisit && visit?.pharmacy_id === primaryFieldVisit.pharmacy_id
    ? visit
    : null;

  const cockpitNextVisit = primaryFieldVisit
    ? {
        name: primaryFieldVisit.pharmacy_name || primaryFieldVisit.title,
        address: primaryVisitContext?.address || primaryFieldVisit.city || "Adresse disponible dans la visite",
        scheduledAt: primaryFieldVisit.start_at,
        objective: cleanVisitObjective(
          primaryVisitContext?.objective || primaryFieldVisit.title,
          primaryFieldVisit.pharmacy_name || primaryFieldVisit.title,
          "Visite terrain",
        ),
        href: `/dashboard/visits/${primaryFieldVisit.source_id}`,
        ctaLabel: primaryFieldVisit.status.toLowerCase() === "in_progress"
          ? "Reprendre la visite"
          : visitNeedsCloseout(primaryFieldVisit, now.getTime())
            ? "Clôturer la visite"
            : "Préparer la visite",
      }
    : visit
      ? {
          name: visit.name,
          address: visit.address,
          scheduledAt: visit.scheduled_at,
          objective: cleanVisitObjective(visit.objective, visit.name),
          href: `/dashboard/pharmacies/${visit.brand_pharmacy_id}`,
          ctaLabel: "Préparer la visite",
        }
      : null;

  const upcomingFieldVisits = ((upcomingFieldAgendaResult.data ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && event.source_kind === "field_visit" && Boolean(event.pharmacy_id),
  );
  const plannedVisits: AgentMultibrandVisitSummary[] = upcomingFieldVisits.map((event) => ({
    id: event.source_id,
    pharmacyId: event.pharmacy_id as string,
    pharmacyName: event.pharmacy_name || event.title,
    city: event.city,
    startAt: event.start_at,
    endAt: event.end_at || null,
    status: event.status,
    brandNames: event.brand_names ?? [],
    href: `/dashboard/visits/${event.source_id}`,
  }));

  const activeFieldVisits = ((multibrandFieldAgendaResult.data ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && event.source_kind === "field_visit" && Boolean(event.pharmacy_id),
  );
  const pendingVisitCount = activeFieldVisits.filter(
    (event) => visitNeedsCloseout(event, now.getTime()),
  ).length;

  const monthBookedRevenue = (monthBookedOrdersResult.data ?? []).reduce(
    (total, order) => total + Number(order.net_amount_ht ?? 0),
    0,
  );
  const revenueObjective = ((monthObjectivesResult.data ?? []) as ObjectiveProgressRow[]).find(
    (objective) => objective.metric_key === "revenue_ht",
  );
  const personalMonthTarget = personalTargetResult.data?.revenue_target_ht == null
    ? null
    : Number(personalTargetResult.data.revenue_target_ht);
  const monthRevenue = monthBookedOrdersResult.error
    ? Number(revenueObjective?.realized_value ?? 0)
    : monthBookedRevenue;
  const monthTarget = revenueObjective
    ? Number(revenueObjective.target_value)
    : personalMonthTarget;
  const monthTargetSource = revenueObjective
    ? "official" as const
    : personalMonthTarget != null
      ? "personal" as const
      : null;
  const monthOrderCount = monthOrdersResult.count ?? 0;

  const pharmacyIds = [...new Set(activeFieldVisits.flatMap((event) => event.pharmacy_id ? [event.pharmacy_id] : []))];
  const { data: relations } = pharmacyIds.length
    ? await supabase
        .from("brand_pharmacies")
        .select("id,brand_id,pharmacy_id")
        .eq("brand_id", brand.id)
        .in("pharmacy_id", pharmacyIds)
        .is("archived_at", null)
    : { data: [] as RelationRow[] };

  const offlineVisits = activeFieldVisits.flatMap((event) => {
    if (!event.pharmacy_id) return [];
    const relation = (relations ?? []).find((item) => item.pharmacy_id === event.pharmacy_id);
    if (!relation) return [];
    return [{
      id: event.source_id,
      brandPharmacyId: relation.id,
      pharmacyId: event.pharmacy_id,
      pharmacyName: event.pharmacy_name || event.title,
      city: event.city,
      startAt: event.start_at,
      endAt: event.end_at || null,
      status: event.status,
    }];
  });

  return (
    <main className="agent-day-home mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-hidden pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <OfflineDayPreloader
        snapshot={{
          version: 1,
          userId,
          brandId: brand.id,
          brandName: brand.name,
          businessDate: today,
          dayLabel,
          savedAt: now.toISOString(),
          day,
          nextVisit: visit,
          visits: offlineVisits,
          stockAlerts,
        }}
      />
      <DashboardTracker />

      <AgentTodayCockpit
        brandId={brand.id}
        brandName={brand.name}
        monthStart={monthStart}
        monthLabel={monthLabel}
        revenue={monthRevenue}
        orderCount={monthOrderCount}
        target={monthTarget}
        targetSource={monthTargetSource}
        pendingVisitCount={pendingVisitCount}
        plannedVisitCount={overviewVisits.length}
        firstName={firstName}
        dayLabel={dayLabel}
        nextVisit={cockpitNextVisit}
      />

      <AgentMultibrandOverview
        day={multibrandDay}
        visits={overviewVisits}
        plannedVisits={plannedVisits}
        canPlanVisit={saas.capabilities.has("core_crm")}
      />

      <style>{`
        .tr1-product-da main.agent-day-home h1,
        .tr1-product-da main.agent-day-home h2 {
          font-family: var(--font-sans);
          text-transform: none;
          letter-spacing: -0.025em;
        }
      `}</style>
    </main>
  );
}
