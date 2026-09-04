import { CalendarPlus, ClipboardPlus, MapPin, ShoppingCart } from "lucide-react";
import { AgentDayExperience, type AgentNextVisit, type AgentTodayData } from "@/components/agent/agent-day-experience";
import { DashboardTracker } from "@/components/agent/dashboard-tracker";
import { TerrainActivityFeed, type TerrainImpact } from "@/components/agent/terrain-activity-feed";
import { TerrainMomentum } from "@/components/agent/terrain-momentum";
import { Button } from "@/components/ui/button";
import { QuickActions } from "@/components/ux/quick-actions";
import { buildGoogleMapsUrl, buildWazeUrl } from "@/lib/agent-experience";
import { requireActiveBrand } from "@/lib/auth";
import { parisBusinessDate } from "@/lib/business-date";
import type { CommercialHealthRow } from "@/lib/commercial-health";
import { buildTerrainPulse } from "@/lib/terrain-engagement";

export default async function AgentPage() {
  const { supabase, brand, profile, userId } = await requireActiveBrand();
  const today = parisBusinessDate();
  const [{ data: agenda }, { data: nextVisit }, { data: opportunities }, { data: recentImpact }] = await Promise.all([
    supabase.rpc("get_agent_today", { target_brand_id: brand.id, target_date: today }),
    supabase.rpc("get_next_agent_visit", { target_brand_id: brand.id }),
    supabase.rpc("get_agent_reorder_opportunities", { target_brand_id: brand.id, result_limit: 5 }),
    supabase.from("mission_impact").select("mission_id,mission_title,mission_date,mission_type,sell_out_units,first_order_after_at,days_to_first_order_after,observation_maturity").eq("brand_id", brand.id).eq("assigned_user_id", userId).order("mission_date", { ascending: false }).limit(3),
  ]);
  const day = (agenda ?? { tasks: [], missions: [], reports: [], follow_ups: [] }) as AgentTodayData;
  const visit = nextVisit as AgentNextVisit | null;
  const navigation = visit ? { latitude: visit.latitude, longitude: visit.longitude, address_line_1: visit.address } : null;
  const firstName = profile.full_name.split(" ")[0];
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date());
  const pulse = buildTerrainPulse(day);

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <DashboardTracker />
      <TerrainMomentum firstName={firstName} dayLabel={dayLabel} brandName={brand.name} pulse={pulse} hasNextVisit={Boolean(visit)} action={visit ? <Button asChild className="bg-[var(--tr1-orange)] text-white hover:bg-[#d65d05]"><a href="#next-visit-card">Voir ma prochaine visite</a></Button> : undefined} />
      <QuickActions className="hidden sm:grid" actions={[
        { href: "/dashboard/orders/new", label: "Créer une commande", description: "Saisir une commande terrain", icon: ShoppingCart },
        { href: "/dashboard/tasks", label: "Planifier une relance", description: "Créer une prochaine action", icon: CalendarPlus },
        { href: "/dashboard/pharmacies", label: "Ouvrir une pharmacie", description: "Consulter le référentiel", icon: MapPin },
        { href: "/dashboard/reports", label: "Saisir un compte rendu", description: "Finaliser une visite", icon: ClipboardPlus },
      ]} />
      <TerrainActivityFeed impacts={(recentImpact ?? []) as TerrainImpact[]} />
      <AgentDayExperience
        brandId={brand.id}
        userId={userId}
        day={day}
        visit={visit}
        opportunities={(opportunities ?? []) as CommercialHealthRow[]}
        wazeUrl={navigation ? buildWazeUrl(navigation) : ""}
        mapsUrl={navigation ? buildGoogleMapsUrl(navigation) : ""}
      />
    </main>
  );
}
