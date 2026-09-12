import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  ChevronRight,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { todayInParis } from "@/lib/agenda";
import { uiLabel } from "@/lib/ui-copy";

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
};

type RelationRow = {
  id: string;
  brand_id: string;
  pharmacy_id: string;
};

type OverdueVisit = {
  id: string;
  scheduled_start_at: string;
  scheduled_end_at: string | null;
  title: string;
  status: string;
  pharmacy_id: string;
  pharmacies:
    | {
        trade_name: string | null;
        legal_name: string | null;
        city: string | null;
      }
    | {
        trade_name: string | null;
        legal_name: string | null;
        city: string | null;
      }[]
    | null;
};

type OverdueVisitLink = {
  visit_id: string;
  brand_id: string;
  brand_pharmacy_id: string | null;
  field_visits: OverdueVisit | OverdueVisit[] | null;
};

type OverdueVisitCard = {
  id: string;
  brandPharmacyId: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  pharmacyName: string;
  city: string | null;
};

const CLOSED_STATUSES = new Set([
  "completed",
  "cancelled",
  "rejected",
  "no_show",
  "refunded",
]);

function time(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export default async function FieldPage() {
  const [{ supabase, userId }, contexts] = await Promise.all([
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);

  const facilitatorOnly =
    contexts.length > 0 && contexts.every((context) => context.role === "facilitator");

  if (facilitatorOnly) {
    const { data: missions } = await supabase
      .from("missions")
      .select("id,title,status,mission_type,scheduled_start_at,report_due_at,address_snapshot,proposal_review_status,brands(name),pharmacies(trade_name,legal_name,city)")
      .eq("assigned_user_id", userId)
      .is("archived_at", null)
      .order("scheduled_start_at")
      .limit(30);

    return (
      <div className="mx-auto max-w-3xl space-y-5 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">Terrain</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--tr1-navy)]">Aujourd’hui</h1>
            <p className="mt-1 text-sm text-muted-foreground">Toutes vos marques, animations et rapports dans un seul espace.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/agenda"><CalendarDays className="size-4" />Agenda</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/missions/new"><Plus className="size-4" />Planifier des animations</Link>
            </Button>
          </div>
        </div>

        {(missions ?? []).map((mission) => {
          const brand = Array.isArray(mission.brands) ? mission.brands[0] : mission.brands;
          const pharmacy = Array.isArray(mission.pharmacies) ? mission.pharmacies[0] : mission.pharmacies;
          return (
            <Link href={`/dashboard/field/missions/${mission.id}`} key={mission.id}>
              <Card className="mb-3 transition hover:border-primary">
                <CardHeader className="pb-2">
                  <div className="flex justify-between gap-2">
                    <CardTitle className="text-base">{mission.title}</CardTitle>
                    <Badge variant={mission.status === "report_pending" ? "destructive" : "secondary"}>
                      {uiLabel(mission.proposal_review_status !== "not_applicable" ? mission.proposal_review_status : mission.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  <p>{mission.scheduled_start_at ? new Date(mission.scheduled_start_at).toLocaleString("fr-FR") : "À planifier"}</p>
                  <p className="text-muted-foreground">
                    {pharmacy?.trade_name || pharmacy?.legal_name || String((mission.address_snapshot as Record<string, string> | null)?.city ?? "Pharmacie")} · {pharmacy?.city ?? ""} · {brand?.name ?? "Marque"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {!missions?.length ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground">Aucune animation planifiée pour le moment.</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/dashboard/missions/new"><Plus className="size-4" />Planifier une animation</Link>
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const today = todayInParis();
  const brandIds = contexts.map((context) => context.id);
  const nowIso = new Date().toISOString();
  const [{ data: agenda, error }, overdueResult] = await Promise.all([
    supabase.rpc("get_my_field_agenda", {
      start_date: today,
      end_date: today,
      brand_filter: null,
    }),
    brandIds.length
      ? supabase
          .from("field_visit_brands")
          .select("visit_id,brand_id,brand_pharmacy_id,field_visits!inner(id,status,scheduled_start_at,scheduled_end_at,title,pharmacy_id,owner_user_id,archived_at,pharmacies(trade_name,legal_name,city))")
          .in("brand_id", brandIds)
          .eq("field_visits.owner_user_id", userId)
          .eq("field_visits.status", "in_progress")
          .is("field_visits.archived_at", null)
          .lt("field_visits.scheduled_end_at", nowIso)
          .limit(30)
      : Promise.resolve({ data: [] as OverdueVisitLink[], error: null }),
  ]);
  if (error) throw new Error(error.message);
  if (overdueResult.error) throw new Error(overdueResult.error.message);

  const events = ((agenda ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && Boolean(event.pharmacy_id),
  );
  const pharmacyIds = [...new Set(events.flatMap((event) => event.pharmacy_id ? [event.pharmacy_id] : []))];
  const { data: relations } = pharmacyIds.length && brandIds.length
    ? await supabase
        .from("brand_pharmacies")
        .select("id,brand_id,pharmacy_id")
        .in("pharmacy_id", pharmacyIds)
        .in("brand_id", brandIds)
        .is("archived_at", null)
    : { data: [] as RelationRow[] };

  const relationFor = (event: FieldAgendaEvent) =>
    (relations ?? []).find(
      (relation) =>
        relation.pharmacy_id === event.pharmacy_id &&
        event.brand_ids.includes(relation.brand_id),
    ) ?? (relations ?? []).find((relation) => relation.pharmacy_id === event.pharmacy_id);

  const activeEvents = events.filter(
    (event) => Date.parse(event.end_at) >= Date.parse(nowIso),
  );
  const nextEvent =
    activeEvents.find((event) => event.status === "in_progress") ??
    activeEvents.find((event) => !CLOSED_STATUSES.has(event.status)) ??
    null;

  const overdueVisits = ((overdueResult.data ?? []) as unknown as OverdueVisitLink[])
    .flatMap((link): OverdueVisitCard[] => {
      const visit = Array.isArray(link.field_visits)
        ? link.field_visits[0]
        : link.field_visits;
      if (!visit || !link.brand_pharmacy_id) return [];
      const pharmacy = Array.isArray(visit.pharmacies)
        ? visit.pharmacies[0]
        : visit.pharmacies;
      return [{
        id: visit.id,
        brandPharmacyId: link.brand_pharmacy_id,
        scheduledStartAt: visit.scheduled_start_at,
        scheduledEndAt: visit.scheduled_end_at,
        pharmacyName: pharmacy?.trade_name || pharmacy?.legal_name || visit.title || "Pharmacie",
        city: pharmacy?.city ?? null,
      }];
    })
    .filter(
      (visit, index, all) => all.findIndex((item) => item.id === visit.id) === index,
    )
    .sort(
      (left, right) =>
        Date.parse(right.scheduledEndAt || right.scheduledStartAt) -
        Date.parse(left.scheduledEndAt || left.scheduledStartAt),
    )
    .slice(0, 3);

  const pharmacyHref = (event: FieldAgendaEvent) => {
    const relation = relationFor(event);
    if (!relation) return "/dashboard/pharmacies";
    const visit = event.source_kind === "field_visit" ? `?visit=${event.source_id}` : "";
    return `/dashboard/pharmacies/open/${relation.id}${visit}`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">Terrain</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--tr1-navy)]">Aujourd’hui</h1>
          <p className="mt-1 text-sm text-muted-foreground">Votre journée en pharmacies, sans ressaisie.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/agenda"><CalendarDays className="size-4" />Agenda</Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild size="lg" className="min-h-16 flex-col gap-1">
          <Link href="/dashboard/pharmacies"><Search className="size-5" />Pharmacies</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="min-h-16 flex-col gap-1">
          <Link href="/dashboard/orders/scan"><Camera className="size-5" />Scanner commande</Link>
        </Button>
      </div>

      {overdueVisits.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-900">
                <AlertTriangle className="size-4" />À régulariser
              </p>
              <p className="mt-1 text-sm text-amber-950/80">
                {overdueVisits.length === 1
                  ? "Une visite semble terminée mais n’a pas été clôturée."
                  : "Des visites semblent terminées mais n’ont pas été clôturées."}
              </p>
            </div>
            <Badge variant="outline" className="border-amber-300 bg-white text-amber-900">
              {overdueVisits.length}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {overdueVisits.map((visit) => (
              <Card key={visit.id} className="border-amber-200 bg-white shadow-none">
                <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--tr1-navy)]">{visit.pharmacyName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dateTime(visit.scheduledStartAt)}{visit.city ? ` · ${visit.city}` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/dashboard/pharmacies/open/${visit.brandPharmacyId}?visit=${visit.id}`}>
                      Clôturer la visite
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {nextEvent ? (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {nextEvent.status === "in_progress" ? "En cours" : "Prochaine pharmacie"}
          </p>
          <Link href={pharmacyHref(nextEvent)} className="block">
            <Card className="border-[var(--tr1-orange)] bg-orange-50/50 transition active:scale-[0.99]">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-[var(--tr1-navy)]">{time(nextEvent.start_at)}</span>
                    <Badge variant={nextEvent.status === "in_progress" ? "default" : "secondary"}>{nextEvent.status === "in_progress" ? "En cours" : uiLabel(nextEvent.status)}</Badge>
                  </div>
                  <p className="mt-2 truncate text-lg font-bold">{nextEvent.pharmacy_name || nextEvent.title}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{nextEvent.city || "Pharmacie"}{nextEvent.brand_names.length ? ` · ${nextEvent.brand_names.join(" · ")}` : ""}</p>
                </div>
                <ChevronRight className="size-6 shrink-0 text-[var(--tr1-orange)]" />
              </CardContent>
            </Card>
          </Link>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--tr1-navy)]">Pharmacies prévues</h2>
          <span className="text-sm text-muted-foreground">{events.length}</span>
        </div>
        <div className="space-y-2">
          {events.map((event) => (
            <Link key={event.event_key} href={pharmacyHref(event)} className="block">
              <Card className="transition hover:border-[var(--tr1-orange)] active:scale-[0.99]">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div className="w-12 shrink-0 text-center">
                    <p className="font-mono text-sm font-black text-[var(--tr1-navy)]">{time(event.start_at)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{event.pharmacy_name || event.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{event.city || ""}{event.brand_names.length ? ` · ${event.brand_names.join(" · ")}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{event.source_kind === "field_visit" ? "Visite" : uiLabel(event.source_kind)}</Badge>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
          {!events.length ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-medium">Aucune pharmacie prévue aujourd’hui.</p>
              <p className="mt-1 text-sm text-muted-foreground">Cherchez une pharmacie puis utilisez l’action « Visite » pour l’ajouter en quelques pressions.</p>
              <Button asChild className="mt-4"><Link href="/dashboard/pharmacies"><Search className="size-4" />Chercher une pharmacie</Link></Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
