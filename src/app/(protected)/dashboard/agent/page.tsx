import Link from "next/link";
import { CalendarPlus, ClipboardPlus, MapPin, ShoppingCart } from "lucide-react";
import { AgentDayExperience, type AgentNextVisit, type AgentTodayData } from "@/components/agent/agent-day-experience";
import {
  AgentMultibrandOverview,
  type AgentMultibrandDay,
  type AgentMultibrandNextVisit,
  type AgentMultibrandVisitSummary,
} from "@/components/agent/agent-multibrand-overview";
import { DashboardTracker } from "@/components/agent/dashboard-tracker";
import { StockAlertsPanel } from "@/components/agent/stock-alerts-panel";
import { TerrainActivityFeed, type TerrainImpact } from "@/components/agent/terrain-activity-feed";
import { OfflineDayPreloader } from "@/components/pwa/offline-day-preloader";
import { buildGoogleMapsUrl, buildWazeUrl } from "@/lib/agent-experience";
import { addCalendarDays } from "@/lib/agenda";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { parisBusinessDate } from "@/lib/business-date";
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

type CapabilityRow = {
  capability_key: string;
  enabled: boolean;
};

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string | string[] }>;
}) {
  const [saas, session, contexts, params] = await Promise.all([
    requireActiveBrandCapability("agent_day"),
    requireActiveBrand(),
    getBrandContexts(),
    searchParams,
  ]);
  const { supabase, brand, profile, userId } = session;
  const agentRoleBrands = contexts.filter((context) => context.role === "agent");
  const agentCapabilityChecks = await Promise.all(
    agentRoleBrands.map(async (context) => {
      const { data, error } = await supabase.rpc("get_my_brand_capabilities", { target_brand_id: context.id });
      if (error) throw error;
      const enabled = ((data ?? []) as CapabilityRow[]).some(
        (row) => row.capability_key === "agent_day" && row.enabled,
      );
      return enabled ? context : null;
    }),
  );
  const agentBrands = agentCapabilityChecks.filter((context): context is NonNullable<typeof context> => context !== null);
  const requestedBrandId = typeof params.brand === "string" ? params.brand : null;
  const selectedBrand = agentBrands.find((context) => context.id === requestedBrandId) ?? null;
  const brandFilter = selectedBrand?.id ?? null;

  const today = parisBusinessDate();
  const planningHorizon = addCalendarDays(today, 90);
  const now = new Date();
  const [
    { data: agenda },
    { data: nextVisit },
    recentImpactResult,
    multibrandFieldAgendaResult,
    upcomingFieldAgendaResult,
    activeFieldAgendaResult,
    stockAlerts,
    multibrandDayResult,
    multibrandNextVisitResult,
  ] = await Promise.all([
    supabase.rpc("get_agent_today", { target_brand_id: brand.id, target_date: today }),
    supabase.rpc("get_next_agent_visit", { target_brand_id: brand.id }),
    saas.capabilities.has("missions")
      ? supabase.from("mission_impact").select("mission_id,mission_title,mission_date,mission_type,sell_out_units,first_order_after_at,days_to_first_order_after,observation_maturity").eq("brand_id", brand.id).eq("assigned_user_id", userId).order("mission_date", { ascending: false }).limit(3)
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: today,
      brand_filter: brandFilter,
    }),
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: planningHorizon,
      brand_filter: brandFilter,
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
      brand_filter: brandFilter,
    }),
    supabase.rpc("get_my_next_field_visit", {
      brand_filter: brandFilter,
    }),
  ]);

  if (multibrandFieldAgendaResult.error) throw new Error(multibrandFieldAgendaResult.error.message);
  if (upcomingFieldAgendaResult.error) throw new Error(upcomingFieldAgendaResult.error.message);
  if (activeFieldAgendaResult.error) throw new Error(activeFieldAgendaResult.error.message);
  if (multibrandDayResult.error) throw new Error(multibrandDayResult.error.message);
  if (multibrandNextVisitResult.error) throw new Error(multibrandNextVisitResult.error.message);

  const day = (agenda ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentTodayData;
  const visit = nextVisit as AgentNextVisit | null;
  const multibrandDay = (multibrandDayResult.data ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentMultibrandDay;
  const multibrandNextVisit = multibrandNextVisitResult.data as AgentMultibrandNextVisit | null;
  const navigation = visit ? { latitude: visit.latitude, longitude: visit.longitude, address_line_1: visit.address } : null;
  const firstName = profile.full_name.split(" ")[0];
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  const quickActions = [
    saas.capabilities.has("orders")
      ? { href: "/dashboard/orders/new", label: "Créer une commande", description: "Saisir une commande terrain", icon: ShoppingCart }
      : null,
    saas.capabilities.has("core_crm")
      ? { href: "/dashboard/tasks", label: "Planifier une relance", description: "Créer une prochaine action", icon: CalendarPlus }
      : null,
    saas.capabilities.has("core_crm")
      ? { href: "/dashboard/pharmacies", label: "Consulter une pharmacie", description: "Retrouver un compte et son suivi", icon: MapPin }
      : null,
    saas.capabilities.has("missions")
      ? { href: "/dashboard/reports", label: "Saisir un compte rendu", description: "Finaliser une visite", icon: ClipboardPlus }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

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
    href: event.detail_url || "/dashboard/agenda",
  }));

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
    href: event.detail_url || `/dashboard/agenda?date=${event.start_at.slice(0, 10)}`,
  }));

  const activeFieldVisits = ((activeFieldAgendaResult.data ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && event.source_kind === "field_visit" && Boolean(event.pharmacy_id),
  );
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

      <AgentMultibrandOverview
        brands={agentBrands}
        selectedBrandId={brandFilter}
        day={multibrandDay}
        nextVisit={multibrandNextVisit}
        visits={overviewVisits}
        plannedVisits={plannedVisits}
        firstName={firstName}
        dayLabel={dayLabel}
        canPlanVisit={saas.capabilities.has("core_crm")}
        canRequestAnimation={saas.capabilities.has("missions")}
      />

      <section className="space-y-4 border-t pt-6" aria-labelledby="active-brand-execution-title">
        <div>
          <h2 id="active-brand-execution-title" className="text-lg font-semibold text-[var(--tr1-navy)]">Actions pour {brand.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ces actions concernent {brand.name}. Pour travailler pour une autre marque, utilisez « Marque active » en haut de l’écran.</p>
          {selectedBrand && selectedBrand.id !== brand.id ? <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-[#8b3c16]">Votre journée affiche {selectedBrand.name} ; les actions ci-dessous concernent {brand.name}.</p> : null}
        </div>
        {quickActions.length ? (
          <nav aria-label={`Actions pour ${brand.name}`} className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="flex min-h-20 items-center gap-3 rounded-xl border bg-white/60 p-4 transition hover:border-[var(--tr1-orange)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)]">
                <action.icon className="size-5 shrink-0 text-[var(--tr1-navy)]" aria-hidden="true" />
                <span><span className="block text-base font-semibold">{action.label}</span><span className="mt-1 block text-sm text-muted-foreground">{action.description}</span></span>
              </Link>
            ))}
          </nav>
        ) : null}
        <StockAlertsPanel alerts={stockAlerts} />
        {saas.capabilities.has("missions") ? <TerrainActivityFeed impacts={(recentImpactResult.data ?? []) as TerrainImpact[]} /> : null}
        <div className="min-w-0">
          <AgentDayExperience
            showDayLists={false}
            showQuickActions={false}
            brandId={brand.id}
            userId={userId}
            day={day}
            visit={visit}
            opportunities={[]}
            wazeUrl={navigation ? buildWazeUrl(navigation) : ""}
            mapsUrl={navigation ? buildGoogleMapsUrl(navigation) : ""}
          />
        </div>
      </section>

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