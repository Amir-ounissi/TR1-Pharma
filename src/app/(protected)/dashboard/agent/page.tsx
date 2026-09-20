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

export default async function AgentPage() {
  const [saas, session] = await Promise.all([
    requireActiveBrandCapability("agent_day"),
    requireActiveBrand(),
  ]);
  const { supabase, brand, profile, userId } = session;

  const today = parisBusinessDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const planningHorizon = addCalendarDays(today, 90);
  const now = new Date();

  const [
    { data: agenda },
    { data: nextVisit },
    multibrandFieldAgendaResult,
    upcomingFieldAgendaResult,
    activeFieldAgendaResult,
    stockAlerts,
    multibrandDayResult,
    monthOverviewResult,
    monthObjectivesResult,
    monthOrdersResult,
    personalTargetResult,
  ] = await Promise.all([
    supabase.rpc("get_agent_today", { target_brand_id: brand.id, target_date: today }),
    supabase.rpc("get_next_agent_visit", { target_brand_id: brand.id }),
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: today,
      brand_filter: brand.id,
    }),
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: planningHorizon,
      brand_filter: brand.id,
    }),
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: today,
      brand_filter: brand.id,
    }),
    saas.capabilities.has("sell_out")
      ? loadStockAlerts(supabase, brand.id, userId)
      : Promise.resolve([]),
    supabase.rpc("get_agent_today_multibrand", {
      target_date: today,
      brand_filter: brand.id,
    }),
    supabase.rpc("get_performance_overview", {
      target_brand_id: brand.id,
      target_period_start: monthStart,
      target_period_end: today,
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase.rpc("get_objective_progress", {
      target_brand_id: brand.id,
      target_filter_start: monthStart,
      target_filter_end: today,
      target_scope_type: "agent",
      target_territory_id: null,
      target_agent_id: userId,
    }),
    supabase
      .from("performance_order_facts")
      .select("order_id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("agent_user_id_at_order", userId)
      .gte("order_date", `${monthStart}T00:00:00.000Z`)
      .lt("order_date", `${nextIsoDate(today)}T00:00:00.000Z`),
    supabase
      .from("agent_personal_monthly_targets")
      .select("revenue_target_ht")
      .eq("brand_id", brand.id)
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .maybeSingle(),
  ]);

  if (multibrandFieldAgendaResult.error) throw new Error(multibrandFieldAgendaResult.error.message);
  if (upcomingFieldAgendaResult.error) throw new Error(upcomingFieldAgendaResult.error.message);
  if (activeFieldAgendaResult.error) throw new Error(activeFieldAgendaResult.error.message);
  if (multibrandDayResult.error) throw new Error(multibrandDayResult.error.message);
  if (monthOverviewResult.error) throw new Error(monthOverviewResult.error.message);
  if (monthObjectivesResult.error) throw new Error(monthObjectivesResult.error.message);
  if (monthOrdersResult.error) throw new Error(monthOrdersResult.error.message);
  if (personalTargetResult.error) throw new Error(personalTargetResult.error.message);

  const day = (agenda ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentTodayData;
  const visit = nextVisit as AgentNextVisit | null;
  const multibrandDay = (multibrandDayResult.data ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentMultibrandDay;
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
        objective: primaryVisitContext?.objective || primaryFieldVisit.title || "Visite terrain",
        href: `/dashboard/visits/${primaryFieldVisit.source_id}`,
        ctaLabel: primaryFieldVisit.status.toLowerCase() === "in_progress"
          ? "Reprendre la visite"
          : Date.parse(primaryFieldVisit.start_at) <= now.getTime()
            ? "Clôturer la visite"
            : "Préparer la visite",
      }
    : visit
      ? {
          name: visit.name,
          address: visit.address,
          scheduledAt: visit.scheduled_at,
          objective: visit.objective,
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

  const activeFieldVisits = ((activeFieldAgendaResult.data ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && event.source_kind === "field_visit" && Boolean(event.pharmacy_id),
  );
  const pendingVisitCount = activeFieldVisits.filter(
    (event) => !["completed", "cancelled"].includes(event.status)
      && new Date(event.start_at).getTime() <= now.getTime(),
  ).length;

  const monthSummary = (monthOverviewResult.data ?? {}) as Record<string, number | null>;
  const revenueObjective = ((monthObjectivesResult.data ?? []) as ObjectiveProgressRow[]).find(
    (objective) => objective.metric_key === "revenue_ht",
  );
  const personalMonthTarget = personalTargetResult.data?.revenue_target_ht == null
    ? null
    : Number(personalTargetResult.data.revenue_target_ht);
  const monthRevenue = Number(monthSummary.booked_revenue_ht ?? revenueObjective?.realized_value ?? 0);
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
