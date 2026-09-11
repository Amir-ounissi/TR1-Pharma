import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, MapPin, Navigation, Target } from "lucide-react";
import { VisitCloseoutPanel } from "@/components/visits/visit-closeout-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCompletedOnboarding } from "@/lib/auth";

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
  const mapsQuery = [pharmacyName, pharmacy?.city].filter(Boolean).join(", ");
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const pharmacyHref = primaryBrandPharmacyId
    ? `/dashboard/pharmacies/${primaryBrandPharmacyId}`
    : "/dashboard/pharmacies";

  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-32 sm:pb-10">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/agenda" className="min-h-11 touch-manipulation">
          <ArrowLeft className="size-4" />
          Retour à l’Agenda
        </Link>
      </Button>

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

      <nav aria-label="Actions rapides de la visite" className="grid grid-cols-2 gap-2 sm:flex">
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

      <VisitCloseoutPanel
        visitId={visit.id}
        status={visit.status}
        closeout={closeoutResult.data}
      />
    </main>
  );
}
