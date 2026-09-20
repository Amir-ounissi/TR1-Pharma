import { AgentVisitCloseoutQueue, type AgentPendingCloseoutVisit } from "@/components/agent/agent-visit-closeout-queue";
import { addCalendarDays } from "@/lib/agenda";
import { requireActiveBrand } from "@/lib/auth";
import { parisBusinessDate } from "@/lib/business-date";

type FieldAgendaEvent = {
  source_kind: string;
  source_id: string;
  title: string;
  start_at: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  city: string | null;
  ownership: string;
  status: string;
  detail_url: string;
};

export default async function AgentCloseoutsPage() {
  const { supabase, brand } = await requireActiveBrand();
  const today = parisBusinessDate();
  const lookbackStart = addCalendarDays(today, -30);
  const now = new Date();

  const { data, error } = await supabase.rpc("get_my_field_agenda", {
    start_date: lookbackStart,
    end_date: today,
    brand_filter: brand.id,
  });

  if (error) throw new Error(error.message);

  const pendingCloseouts: AgentPendingCloseoutVisit[] = ((data ?? []) as FieldAgendaEvent[])
    .filter(
      (event) => event.ownership === "mine"
        && event.source_kind === "field_visit"
        && Boolean(event.pharmacy_id)
        && !["completed", "cancelled"].includes(event.status)
        && new Date(event.start_at).getTime() <= now.getTime(),
    )
    .sort((left, right) => new Date(right.start_at).getTime() - new Date(left.start_at).getTime())
    .map((event) => ({
      id: event.source_id,
      pharmacyName: event.pharmacy_name || event.title,
      city: event.city,
      startAt: event.start_at,
      href: event.detail_url || `/dashboard/visits/${event.source_id}`,
    }));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <header>
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
          Suivi terrain
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--tr1-navy)]">Visites à clôturer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La visite la plus récente passe en premier, pour saisir le compte rendu tant que les détails sont encore frais.
        </p>
      </header>

      <AgentVisitCloseoutQueue visits={pendingCloseouts} />
    </main>
  );
}
