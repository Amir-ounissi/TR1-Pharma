import { AgendaPlanner, type AgendaEvent, type PharmacyOption } from "@/components/agenda/agenda-planner";
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
  const brandIds = contexts.map((context) => context.id);
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");
  const [{ data: agenda, error: agendaError }, { data: relations }] = await Promise.all([
    supabase.rpc("get_my_field_agenda", { start_date: date, end_date: end, brand_filter: null }),
    brandIds.length ? supabase.from("brand_pharmacies").select("id,brand_id,pharmacy_id,brands(name),pharmacies(trade_name,legal_name,city)").in("brand_id", brandIds).is("archived_at", null) : Promise.resolve({ data: [] }),
  ]);
  if (agendaError) throw new Error(agendaError.message);

  const grouped = new Map<string, PharmacyOption>();
  for (const relation of relations ?? []) {
    const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
    const brand = Array.isArray(relation.brands) ? relation.brands[0] : relation.brands;
    if (!grouped.has(relation.pharmacy_id)) grouped.set(relation.pharmacy_id, { id: relation.pharmacy_id, label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie", city: pharmacy?.city ?? undefined, brands: [] });
    grouped.get(relation.pharmacy_id)?.brands.push({ relationId: relation.id, brandId: relation.brand_id, brandName: brand?.name || "Marque" });
  }

  const pharmacyUrl = (pharmacyId: string | null, eventBrandIds: string[]) => {
    if (!pharmacyId) return null;
    const option = grouped.get(pharmacyId);
    if (!option) return null;
    const relation = option.brands.find((item) => eventBrandIds.includes(item.brandId)) ?? option.brands[0];
    if (!relation) return null;
    return `/dashboard/pharmacies/open/${relation.relationId}`;
  };

  const agendaEvents = ((agenda ?? []) as AgendaEvent[]).map((event) => {
    if (event.source_kind === "field_visit") {
      return { ...event, detail_url: `/dashboard/visits/${event.source_id}` };
    }
    if (facilitatorOnly && event.source_kind === "mission") {
      return { ...event, detail_url: `/dashboard/field/missions/${event.source_id}` };
    }
    const direct = pharmacyUrl(event.pharmacy_id, event.brand_ids);
    return direct ? { ...event, detail_url: direct } : event;
  });

  return (
    <div className="agenda-page-without-backlog">
      <style>{`
        .agenda-page-without-backlog main + aside {
          display: none !important;
        }
        .agenda-page-without-backlog div:has(> main + aside) {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      `}</style>
      <AgendaPlanner
        date={date}
        today={today}
        view={view}
        events={agendaEvents}
        backlog={[]}
        brands={contexts.map(({ id, name }) => ({ id, name }))}
        pharmacies={[...grouped.values()]}
        canCreateVisit={contexts.some((context) => context.role === "agent")}
      />
    </div>
  );
}
