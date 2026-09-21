import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck, Building2, CalendarDays, CheckCircle2, MapPin, Navigation, Target } from "lucide-react";
import { VisitAuditPanel, type VisitAuditSnapshot } from "@/components/visits/visit-audit-panel";
import { VisitCloseoutPanel } from "@/components/visits/visit-closeout-panel";
import { VisitOpenedTracker } from "@/components/visits/visit-opened-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCompletedOnboarding } from "@/lib/auth";
import { retryFieldVisitHubSpotSyncAction } from "@/app/(protected)/dashboard/agenda/actions";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "planned") return "Planifiée";
  if (status === "confirmed") return "Confirmée";
  if (status === "in_progress") return "En cours";
  if (status === "completed") return "Clôturée";
  if (status === "cancelled") return "Annulée";
  return status;
}

export default async function FieldVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireCompletedOnboarding();

  const { data: visit, error: visitError } = await supabase
    .from("field_visits")
    .select("id,pharmacy_id,visit_kind,status,title,objective,scheduled_start_at,scheduled_end_at,notes,started_at,completed_at")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (visitError) throw visitError;
  if (!visit) notFound();

  const [pharmacyResult, brandsResult, closeoutResult] = await Promise.all([
    supabase
      .from("pharmacies")
      .select("id,trade_name,legal_name,city")
      .eq("id", visit.pharmacy_id)
      .maybeSingle(),
    supabase
      .from("field_visit_brands")
      .select("brand_id,brand_pharmacy_id,is_primary,brands(name)")
      .eq("visit_id", id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("field_visit_closeouts")
      .select("outcome,summary,input_mode,completed_at,next_visit_id")
      .eq("visit_id", id)
      .maybeSingle(),
  ]);

  if (pharmacyResult.error) throw pharmacyResult.error;
  if (brandsResult.error) throw brandsResult.error;
  if (closeoutResult.error) throw closeoutResult.error;

  const pharmacy = pharmacyResult.data;
  const pharmacyName = pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie";
  const visitBrands = brandsResult.data ?? [];
  const brands = visitBrands.map((row) => {
    const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    return brand?.name || "Marque";
  });
  const primaryBrandPharmacyId = visitBrands[0]?.brand_pharmacy_id ?? null;

  const auditFields = "id,visit_id,brand_id,brand_pharmacy_id,price_displayed,displayed_price_ttc,availability_status,stock_quantity,stock_count_mode,facings,shelf_visibility,plv_present,team_training_status,tester_samples_status,competition_visible,competition_note,notes,recommendations,audited_at";
  const relationIds = visitBrands.map((row) => row.brand_pharmacy_id).filter(Boolean);
  const { data: auditRows, error: auditError } = relationIds.length
    ? await supabase
        .from("field_visit_audits")
        .select(auditFields)
        .in("brand_pharmacy_id", relationIds)
        .order("audited_at", { ascending: false })
        .limit(Math.max(20, relationIds.length * 5))
    : { data: [], error: null };

  if (auditError) throw auditError;

  const auditsByRelation = new Map<string, Array<VisitAuditSnapshot & { visit_id: string }>>();
  for (const raw of auditRows ?? []) {
    const row = raw as VisitAuditSnapshot & { visit_id: string; brand_pharmacy_id: string };
    const current = auditsByRelation.get(row.brand_pharmacy_id) ?? [];
    current.push(row);
    auditsByRelation.set(row.brand_pharmacy_id, current);
  }

  const mapsQuery = [pharmacyName, pharmacy?.city].filter(Boolean).join(", ");
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const pharmacyHref = primaryBrandPharmacyId
    ? `/dashboard/pharmacies/${primaryBrandPharmacyId}`
    : "/dashboard/pharmacies";
  const briefHref = primaryBrandPharmacyId
    ? `/dashboard/pharmacies/${primaryBrandPharmacyId}/brief`
    : null;

  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-32 sm:pb-10">
      <VisitOpenedTracker visitId={visit.id} />
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/agenda" className="min-h-11 touch-manipulation">
          <ArrowLeft className="size-4" />
          Retour à l’Agenda
        </Link>
      </Button>

      <section aria-label="Étapes de la visite" className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--tr1-navy)] text-sm font-bold text-white">1</span>
            <span className="text-xs font-semibold text-muted-foreground">Planification</span>
          </div>
          <h2 className="mt-3 font-semibold text-[var(--tr1-navy)]">Quand et pourquoi j’y vais</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(visit.scheduled_start_at)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{visit.objective || "Objectif à préciser"}</p>
          <Button asChild variant="outline" size="sm" className="mt-4 min-h-11 w-full justify-center">
            <Link href="/dashboard/agenda">
              <CalendarDays className="size-4" />
              Voir / replanifier
            </Link>
          </Button>
        </article>

        <article className="rounded-2xl border border-[var(--tr1-orange)]/30 bg-orange-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--tr1-orange)] text-sm font-bold text-white">2</span>
            <span className="text-xs font-semibold text-[var(--tr1-orange)]">Préparation</span>
          </div>
          <h2 className="mt-3 font-semibold text-[var(--tr1-navy)]">Ce que je dois savoir avant d’entrer</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Dernière visite, commandes, réassort, sell-out, alertes et actions ouvertes.</p>
          {briefHref ? (
            <Button asChild size="sm" className="mt-4 min-h-11 w-full justify-center">
              <Link href={briefHref}>
                <BookOpenCheck className="size-4" />
                Préparer ma visite
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled className="mt-4 min-h-11 w-full justify-center">Brief indisponible</Button>
          )}
        </article>

        <article className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className={`grid size-8 place-items-center rounded-full text-sm font-bold text-white ${visit.status === "completed" || closeoutResult.data ? "bg-emerald-600" : "bg-[var(--tr1-navy)]"}`}>3</span>
            <span className="text-xs font-semibold text-muted-foreground">Clôture</span>
          </div>
          <h2 className="mt-3 font-semibold text-[var(--tr1-navy)]">{visit.status === "completed" || closeoutResult.data ? "Clôture enregistrée" : "Je saisis le résultat en sortant"}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{visit.status === "completed" || closeoutResult.data ? "Le compte rendu et la suite sont enregistrés." : "Résultat, notes, preuves et prochaine action au même endroit."}</p>
          <Button asChild variant={visit.status === "completed" || closeoutResult.data ? "outline" : "default"} size="sm" className="mt-4 min-h-11 w-full justify-center">
            <Link href="#visit-execution">
              <CheckCircle2 className="size-4" />
              {visit.status === "completed" || closeoutResult.data ? "Voir la clôture" : "Clôturer la visite"}
            </Link>
          </Button>
        </article>
      </section>

      <header className="rounded-2xl bg-[var(--tr1-navy)] p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-orange-300">Visite terrain</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{pharmacyName}</h1>
            <p className="mt-1 text-sm text-white/70">{visit.title}</p>
          </div>
          <Badge variant="secondary">{statusLabel(visit.status)}</Badge>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-white/85 sm:grid-cols-3">
          <p className="flex items-center gap-2"><CalendarDays className="size-4 text-orange-300" />{formatDateTime(visit.scheduled_start_at)}</p>
          <p className="flex items-center gap-2"><MapPin className="size-4 text-orange-300" />{pharmacy?.city || "Ville non renseignée"}</p>
          <p className="flex items-center gap-2"><Target className="size-4 text-orange-300" />{brands.join(" · ") || "Marque"}</p>
        </div>
      </header>

      <form action={retryFieldVisitHubSpotSyncAction.bind(null, visit.id)} className="rounded-2xl border border-[var(--tr1-line)] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[var(--tr1-navy)]">HubSpot</p>
            <p className="text-sm text-muted-foreground">Envoyez l’état actuel de cette visite uniquement quand vous le décidez.</p>
          </div>
          <Button type="submit" className="min-h-11 shrink-0">
            Synchroniser avec HubSpot
          </Button>
        </div>
      </form>

      <nav aria-label="Actions rapides de la visite" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {briefHref ? (
          <Link
            href={briefHref}
            className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl bg-[var(--tr1-orange)] px-4 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:opacity-90"
          >
            <BookOpenCheck className="size-4" />
            Préparer ma visite
          </Link>
        ) : null}
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-[var(--tr1-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--tr1-navy)] shadow-sm transition active:scale-[0.98] hover:border-[var(--tr1-orange)]"
        >
          <Navigation className="size-4 text-[var(--tr1-orange)]" />
          Itinéraire
        </a>
        <Link
          href={pharmacyHref}
          className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-[var(--tr1-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--tr1-navy)] shadow-sm transition active:scale-[0.98] hover:border-[var(--tr1-orange)]"
        >
          <Building2 className="size-4 text-[var(--tr1-orange)]" />
          Fiche pharmacie
        </Link>
      </nav>

      {(visit.objective || visit.notes) ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {visit.objective ? (
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Objectif</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{visit.objective}</p>
            </div>
          ) : null}
          {visit.notes ? (
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Préparation</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{visit.notes}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {visitBrands.length ? (
        <section className="space-y-3">
          {visitBrands.map((row) => {
            const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
            const relationAudits = auditsByRelation.get(row.brand_pharmacy_id) ?? [];
            const currentAudit = relationAudits.find((audit) => audit.visit_id === visit.id) ?? null;
            const previousAudit = relationAudits.find((audit) => audit.visit_id !== visit.id) ?? null;
            return (
              <VisitAuditPanel
                key={row.brand_pharmacy_id}
                visitId={visit.id}
                brandPharmacyId={row.brand_pharmacy_id}
                brandName={brand?.name || "Marque"}
                currentAudit={currentAudit}
                previousAudit={previousAudit}
              />
            );
          })}
        </section>
      ) : null}

      <VisitCloseoutPanel
        visitId={visit.id}
        status={visit.status}
        closeout={closeoutResult.data}
        brandPharmacyId={primaryBrandPharmacyId}
      />
    </main>
  );
}
