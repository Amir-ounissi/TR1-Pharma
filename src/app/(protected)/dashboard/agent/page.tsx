import { CalendarPlus, ClipboardPlus, MapPin, ShoppingCart } from "lucide-react";
import { AgentDayExperience, type AgentNextVisit, type AgentTodayData } from "@/components/agent/agent-day-experience";
import { DashboardTracker } from "@/components/agent/dashboard-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ux/page-header";
import { QuickActions } from "@/components/ux/quick-actions";
import { SectionHeader } from "@/components/ux/section-header";
import { buildGoogleMapsUrl, buildWazeUrl } from "@/lib/agent-experience";
import { requireActiveBrand } from "@/lib/auth";
import type { CommercialHealthRow } from "@/lib/commercial-health";

export default async function AgentPage() {
  const { supabase, brand, profile, userId } = await requireActiveBrand();
  const today = new Date().toISOString().slice(0, 10);
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

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <DashboardTracker />
      <PageHeader eyebrow={`${dayLabel} · ${brand.name}`} title={`Bonjour ${firstName},`} description={visit ? "Votre prochaine visite est prête. Le contexte et les actions utiles sont regroupés ici." : "Aucune visite planifiée. Commencez par vos relances prioritaires."} actions={visit ? <Button asChild><a href="#next-visit-card">Démarrer ma prochaine visite</a></Button> : undefined} tone="dark" />
      <QuickActions className="hidden sm:grid" actions={[
        { href: "/dashboard/orders/new", label: "Créer une commande", description: "Saisir une commande terrain", icon: ShoppingCart },
        { href: "/dashboard/tasks", label: "Planifier une relance", description: "Créer une prochaine action", icon: CalendarPlus },
        { href: "/dashboard/pharmacies", label: "Ouvrir une pharmacie", description: "Consulter le référentiel", icon: MapPin },
        { href: "/dashboard/reports", label: "Saisir un compte rendu", description: "Finaliser une visite", icon: ClipboardPlus },
      ]} />
      {(recentImpact ?? []).length ? <section className="space-y-3" aria-labelledby="recent-results">
        <SectionHeader id="recent-results" title="Résultats observés" description="Un retour simple sur vos dernières actions terrain." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{recentImpact?.map((impact) => <Card key={impact.mission_id}><CardContent className="space-y-2 pt-5"><div className="flex items-center justify-between gap-2"><Badge variant="outline">{impact.mission_type}</Badge><span className="text-xs text-muted-foreground">{new Date(impact.mission_date).toLocaleDateString("fr-FR")}</span></div><p className="font-medium">{impact.mission_title}</p><p className="text-sm">{impact.sell_out_units == null ? "Sell-out non renseigné" : `${impact.sell_out_units} unités`}</p><p className="text-sm text-muted-foreground">{impact.first_order_after_at ? `1 commande observée ${impact.days_to_first_order_after} jours après` : impact.observation_maturity === "early" ? "Observation encore provisoire" : "Aucune commande observée"}</p></CardContent></Card>)}</div>
      </section> : null}
      <AgentDayExperience
        brandId={brand.id}
        day={day}
        visit={visit}
        opportunities={(opportunities ?? []) as CommercialHealthRow[]}
        wazeUrl={navigation ? buildWazeUrl(navigation) : ""}
        mapsUrl={navigation ? buildGoogleMapsUrl(navigation) : ""}
      />
    </main>
  );
}
