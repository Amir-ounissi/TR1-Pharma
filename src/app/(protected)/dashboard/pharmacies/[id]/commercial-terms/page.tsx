import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PharmacyCommercialTerms } from "@/components/pharmacies/pharmacy-commercial-terms";
import { PharmacySectionNav } from "@/components/pharmacies/pharmacy-section-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrandRole } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export default async function PharmacyCommercialTermsPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, brand } = await requireActiveBrandRole(
    ["agent", "tr1_manager", "brand_admin", "super_admin"],
    `/dashboard/pharmacies/${id}`,
  );

  const { data: relation, error } = await supabase
    .from("brand_pharmacies")
    .select("id,pharmacy_id,pharmacies(legal_name,trade_name,city,cip_code)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !relation) notFound();

  const pharmacy = Array.isArray(relation.pharmacies)
    ? relation.pharmacies[0]
    : relation.pharmacies;
  if (!pharmacy) notFound();

  const pharmacyName = pharmacy.trade_name || pharmacy.legal_name || "Pharmacie";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tr1-orange)]">
            Fiche client · {brand.name}
          </p>
          <h1 className="text-2xl font-black text-[var(--tr1-navy)]">{pharmacyName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[pharmacy.city, pharmacy.cip_code ? `CIP ${pharmacy.cip_code}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/pharmacies/${id}`}>
            <ArrowLeft className="size-4" /> Retour à la fiche client
          </Link>
        </Button>
      </div>

      <PharmacySectionNav pharmacyId={id} activeTab="commercial_terms" />

      <Card>
        <CardHeader>
          <CardTitle>Conditions commerciales</CardTitle>
          <CardDescription>
            Statut du lead, remise et UG de cette pharmacie. HubSpot alimente les valeurs par défaut ; un override TR1 reste propre à ce client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PharmacyCommercialTerms
            pharmacyId={relation.pharmacy_id}
            pharmacyName={pharmacyName}
          />
        </CardContent>
      </Card>
    </div>
  );
}
