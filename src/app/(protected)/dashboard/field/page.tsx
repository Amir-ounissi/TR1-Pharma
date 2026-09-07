import Link from "next/link";
import {
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
  const { data: agenda, error } = await supabase.rpc("get_my_field_agenda", {
    start_date: today,
    end_date: today,
    brand_filter: null,
  });
  if (error) throw new Error(error.message);

  const events = ((agenda ?? []) as FieldAgendaEvent[]).filter(
    (event) => event.ownership === "mine" && Boolean(event.pharmacy_id),
  );
  const pharmacyIds = [...new Set(events.flatMap((event) => event.pharmacy_id ? [event.pharmacy_id] : []))];
  const brandIds = contexts.map((context) => context.id);
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

  const nextEvent =
    events.find((event) => event.status === "in_progress") ??
    events.find((event) => !CLOSED_STATUSES.has(event.status)) ??
    null;

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
