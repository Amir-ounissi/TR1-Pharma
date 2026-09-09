import Link from "next/link";
import { CalendarPlus, ClipboardPlus, MapPin, Megaphone, ShoppingCart } from "lucide-react";
import { AgentDayExperience, type AgentNextVisit, type AgentTodayData } from "@/components/agent/agent-day-experience";
import { DashboardTracker } from "@/components/agent/dashboard-tracker";
import { StockAlertsPanel } from "@/components/agent/stock-alerts-panel";
import { TerrainActivityFeed, type TerrainImpact } from "@/components/agent/terrain-activity-feed";
import { TerrainMomentum } from "@/components/agent/terrain-momentum";
import { OfflineDayPreloader } from "@/components/pwa/offline-day-preloader";
import { QuickActions } from "@/components/ux/quick-actions";
import { buildGoogleMapsUrl, buildWazeUrl } from "@/lib/agent-experience";
import type { AgentScheduledVisit } from "@/lib/agent-visits";
import { requireActiveBrand } from "@/lib/auth";
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
  ownership: string;
  status: string;
};

type RelationRow = {
  id: string;
  brand_id: string;
  pharmacy_id: string;
};

export default async function AgentPage() {
  const [saas, session] = await Promise.all([
    requireActiveBrandCapability("agent_day"),
    requireActiveBrand(),
  ]);
  const { supabase, brand, profile, userId } = session;
  const today = parisBusinessDate();
  const now = new Date();
  const [{ data: agenda }, { data: nextVisit }, recentImpactResult, fieldAgendaResult, stockAlerts] = await Promise.all([
    supabase.rpc("get_agent_today", { target_brand_id: brand.id, target_date: today }),
    supabase.rpc("get_next_agent_visit", { target_brand_id: brand.id }),
    saas.capabilities.has("missions")
      ? supabase.from("mission_impact").select("mission_id,mission_title,mission_date,mission_type,sell_out_units,first_order_after_at,days_to_first_order_after,observation_maturity").eq("brand_id", brand.id).eq("assigned_user_id", userId).order("mission_date", { ascending: false }).limit(3)
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: today,
      brand_filter: brand.id,
    }),
    saas.capabilities.has("sell_out")
      ? loadStockAlerts(supabase, brand.id, userId)
      : Promise.resolve([]),
  ]);

  if (fieldAgendaResult.error) throw new Error(fieldAgendaResult.error.message);

  const day = (agenda ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentTodayData;
  const visit = nextVisit as AgentNextVisit | null;
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
      ? { href: "/dashboard/pharmacies", label: "Ouvrir une pharmacie", description: "Consulter le référentiel", icon: MapPin }
      : null,
    saas.capabilities.has("missions")
      ? { href: "/dashboard/reports", label: "Saisir un compte rendu", description: "Finaliser une visite", icon: ClipboardPlus }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  const fieldVisits = ((fieldAgendaResult.data ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && event.source_kind === "field_visit" && Boolean(event.pharmacy_id),
  );
  const pharmacyIds = [...new Set(fieldVisits.flatMap((event) => event.pharmacy_id ? [event.pharmacy_id] : []))];
  const { data: relations } = pharmacyIds.length
    ? await supabase
        .from("brand_pharmacies")
        .select("id,brand_id,pharmacy_id")
        .eq("brand_id", brand.id)
        .in("pharmacy_id", pharmacyIds)
        .is("archived_at", null)
    : { data: [] as RelationRow[] };

  const scheduledVisits: AgentScheduledVisit[] = fieldVisits.map((event) => {
    const relation = (relations ?? []).find((item) => item.pharmacy_id === event.pharmacy_id);
    return {
      id: event.source_id,
      pharmacyName: event.pharmacy_name || event.title,
      city: event.city,
      startAt: event.start_at,
      endAt: event.end_at || null,
      status: event.status,
      href: relation ? `/dashboard/pharmacies/open/${relation.id}?visit=${event.source_id}` : "/dashboard/agenda",
    };
  });

  const offlineVisits = fieldVisits.flatMap((event) => {
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
    <main className="mx-auto min-w-0 max-w-6xl space-y-5 overflow-x-hidden pb-[calc(2rem+env(safe-area-inset-bottom))]">
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
      <TerrainMomentum
        firstName={firstName}
        dayLabel={dayLabel}
        brandName={brand.name}
        visits={scheduledVisits}
        nowIso={now.toISOString()}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {saas.capabilities.has("core_crm") ? (
          <Link
            href="/dashboard/agenda/new"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.45rem] bg-[var(--tr1-orange)] px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.02em] text-white shadow-sm transition active:translate-y-px sm:w-fit"
          >
            <CalendarPlus className="size-5" aria-hidden="true" />
            Ajouter une visite
          </Link>
        ) : null}
        {saas.capabilities.has("missions") ? (
          <Link
            href="/dashboard/missions/new?mode=animation"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.45rem] border border-[var(--tr1-navy)] bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.02em] text-[var(--tr1-navy)] shadow-sm transition active:translate-y-px sm:w-fit"
          >
            <Megaphone className="size-5" aria-hidden="true" />
            Demander une animation
          </Link>
        ) : null}
      </div>
      {quickActions.length ? <QuickActions className="hidden sm:grid" actions={quickActions} /> : null}
      <StockAlertsPanel alerts={stockAlerts} />
      {saas.capabilities.has("missions") ? <TerrainActivityFeed impacts={(recentImpactResult.data ?? []) as TerrainImpact[]} /> : null}
      <div className="agent-home-focus min-w-0">
        <AgentDayExperience
          brandId={brand.id}
          userId={userId}
          day={day}
          visit={visit}
          opportunities={[]}
          wazeUrl={navigation ? buildWazeUrl(navigation) : ""}
          mapsUrl={navigation ? buildGoogleMapsUrl(navigation) : ""}
        />
      </div>
      <style>{`
        .agent-home-focus section[aria-labelledby="reorder-opportunities-title"] {
          display: none;
        }
        .agent-home-focus section[aria-label="Aujourd’hui"] > :first-child {
          display: none;
        }
        @media (min-width: 1280px) {
          .agent-home-focus section[aria-label="Aujourd’hui"] {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
