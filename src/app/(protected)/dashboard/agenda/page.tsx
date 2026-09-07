import { AgendaPlanner, type AgendaEvent, type BacklogItem, type PharmacyOption } from "@/components/agenda/agenda-planner";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { addCalendarDays, mondayOfWeek, parseCalendarDate, todayInParis } from "@/lib/agenda";

export default async function AgendaPage({ searchParams }:{ searchParams:Promise<{date?:string;view?:string}> }) {
  const params = await searchParams;
  const requested = params.date ?? todayInParis();
  const safeDate = parseCalendarDate(requested) ? requested : todayInParis();
  const view = params.view === "week" ? "week" : "day";
  const date = view === "week" ? mondayOfWeek(safeDate) : safeDate;
  const end = view === "week" ? addCalendarDays(date, 6) : date;
  const [{ supabase }, contexts] = await Promise.all([requireCompletedOnboarding(), getBrandContexts()]);
  const brandIds = contexts.map((context) => context.id);
  const facilitatorOnly = contexts.length > 0 && contexts.every((context) => context.role === "facilitator");
  const [{ data: agenda, error: agendaError }, { data: backlog, error: backlogError }, { data: relations }] = await Promise.all([
    supabase.rpc("get_my_field_agenda", { start_date: date, end_date: end, brand_filter: null }),
    supabase.rpc("get_my_unplanned_agenda_items", { brand_filter: null }),
    brandIds.length ? supabase.from("brand_pharmacies").select("id,brand_id,pharmacy_id,brands(name),pharmacies(trade_name,legal_name,city)").in("brand_id", brandIds).is("archived_at", null) : Promise.resolve({ data: [] }),
  ]);
  if (agendaError) throw new Error(agendaError.message);
  if (backlogError) throw new Error(backlogError.message);

  const grouped = new Map<string, PharmacyOption>();
  for (const relation of relations ?? []) {
    const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
    const brand = Array.isArray(relation.brands) ? relation.brands[0] : relation.brands;
    if (!grouped.has(relation.pharmacy_id)) grouped.set(relation.pharmacy_id, { id: relation.pharmacy_id, label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie", city: pharmacy?.city ?? undefined, brands: [] });
    grouped.get(relation.pharmacy_id)?.brands.push({ relationId: relation.id, brandId: relation.brand_id, brandName: brand?.name || "Marque" });
  }

  const pharmacyUrl = (pharmacyId: string | null, eventBrandIds: string[], visitId?: string) => {
    if (!pharmacyId) return null;
    const option = grouped.get(pharmacyId);
    if (!option) return null;
    const relation = option.brands.find((item) => eventBrandIds.includes(item.brandId)) ?? option.brands[0];
    if (!relation) return null;
    return `/dashboard/pharmacies/open/${relation.relationId}${visitId ? `?visit=${visitId}` : ""}`;
  };

  const agendaEvents = ((agenda ?? []) as AgendaEvent[]).map((event) => {
    if (facilitatorOnly && event.source_kind === "mission") {
      return { ...event, detail_url: `/dashboard/field/missions/${event.source_id}` };
    }
    const direct = pharmacyUrl(
      event.pharmacy_id,
      event.brand_ids,
      event.source_kind === "field_visit" ? event.source_id : undefined,
    );
    return direct ? { ...event, detail_url: direct } : event;
  });

  const backlogItems = ((backlog ?? []) as BacklogItem[]).map((item) => {
    if (facilitatorOnly && item.source_kind === "mission") {
      return { ...item, detail_url: `/dashboard/field/missions/${item.source_id}` };
    }
    const direct = pharmacyUrl(item.pharmacy_id, [item.brand_id]);
    return direct ? { ...item, detail_url: direct } : item;
  });

  return <AgendaPlanner date={date} view={view} events={agendaEvents} backlog={backlogItems} brands={contexts.map(({ id, name }) => ({ id, name }))} pharmacies={[...grouped.values()]} canCreateVisit={contexts.some((context) => context.role === "agent")} />;
}
