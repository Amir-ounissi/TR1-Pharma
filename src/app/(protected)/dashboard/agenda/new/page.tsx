import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import {
  FieldVisitCreateForm,
  type VisitPharmacyOption,
} from "@/components/agenda/field-visit-create-form";
import { Button } from "@/components/ui/button";
import { getBrandContexts, requireCompletedOnboarding } from "@/lib/auth";
import { isoToParisLocal } from "@/lib/agenda";

export default async function NewAgendaVisitPage() {
  const [{ supabase }, contexts] = await Promise.all([
    requireCompletedOnboarding(),
    getBrandContexts(),
  ]);

  if (!contexts.some((context) => context.role === "agent")) {
    redirect("/dashboard/agenda");
  }

  const brandIds = contexts.map((context) => context.id);
  const { data: relations, error } = brandIds.length
    ? await supabase
        .from("brand_pharmacies")
        .select(
          "id,brand_id,pharmacy_id,brands(name),pharmacies(trade_name,legal_name,city)",
        )
        .in("brand_id", brandIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (error) throw new Error(error.message);

  const grouped = new Map<string, VisitPharmacyOption>();
  for (const relation of relations ?? []) {
    const pharmacy = Array.isArray(relation.pharmacies)
      ? relation.pharmacies[0]
      : relation.pharmacies;
    const brand = Array.isArray(relation.brands)
      ? relation.brands[0]
      : relation.brands;
    const current = grouped.get(relation.pharmacy_id) ?? {
      id: relation.pharmacy_id,
      label: pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie",
      city: pharmacy?.city ?? undefined,
      brands: [],
    };
    current.brands.push({
      relationId: relation.id,
      brandId: relation.brand_id,
      brandName: brand?.name || "Marque",
    });
    grouped.set(relation.pharmacy_id, current);
  }

  const defaultStart = isoToParisLocal(
    new Date(Date.now() + 60 * 60_000).toISOString(),
  ).slice(0, 16);

  return (
    <main className="mx-auto max-w-2xl space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/agent">
            <ArrowLeft className="size-4" />
            Ma journée
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/agenda">Agenda</Link>
        </Button>
      </div>

      <header>
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">
          Visite terrain
        </p>
        <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[-0.05em] text-[var(--tr1-navy)]">
          Ajouter une visite
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choisissez la pharmacie, le créneau et l’objectif. La visite apparaîtra immédiatement dans votre Agenda.
        </p>
      </header>

      <FieldVisitCreateForm
        pharmacies={[...grouped.values()].sort((left, right) =>
          left.label.localeCompare(right.label, "fr"),
        )}
        defaultStart={defaultStart}
      />
    </main>
  );
}
