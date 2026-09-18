import Link from "next/link";
import { ArrowLeft, Camera, History } from "lucide-react";
import { notFound } from "next/navigation";
import { PriceObservationForm } from "@/components/pharmacies/price-observation-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ visit?: string }>;

type ObservationRow = {
  id: string;
  field_visit_id: string | null;
  product_id: string;
  observed_ean: string | null;
  observed_price_ttc: number | string;
  price_type: string;
  bundle_quantity: number | null;
  unit_price_ttc: number | string;
  capture_method: string;
  confidence: number | string | null;
  notes: string | null;
  observed_at: string;
  products:
    | { name: string; sku: string | null; ean: string | null; retail_price_ttc: number | string | null }
    | Array<{ name: string; sku: string | null; ean: string | null; retail_price_ttc: number | string | null }>
    | null;
};

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
}

function methodLabel(value: string) {
  if (value === "photo") return "Photo terrain";
  if (value === "manual") return "Saisie manuelle";
  if (value === "import") return "Import";
  return value;
}

function priceTypeLabel(value: string) {
  if (value === "regular") return "Normal";
  if (value === "promotion") return "Promo";
  if (value === "bundle") return "Lot";
  return "Autre";
}

export default async function PharmacyPricesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [{ supabase, brand }, contexts] = await Promise.all([
    requireActiveBrand(),
    getBrandContexts(),
  ]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const canCapture = ["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role);

  const { data: relation, error: relationError } = await supabase
    .from("brand_pharmacies")
    .select("id,pharmacy_id,pharmacies(trade_name,legal_name,city)")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .is("archived_at", null)
    .maybeSingle();
  if (relationError) throw relationError;
  if (!relation) notFound();

  const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
  const pharmacyName = pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie";

  const [{ data: products, error: productsError }, { data: observations, error: observationsError }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,sku,ean,retail_price_ttc")
      .eq("brand_id", brand.id)
      .eq("is_active", true)
      .is("discontinued_at", null)
      .order("name"),
    supabase
      .from("pharmacy_price_observations")
      .select("id,field_visit_id,product_id,observed_ean,observed_price_ttc,price_type,bundle_quantity,unit_price_ttc,capture_method,confidence,notes,observed_at,products(name,sku,ean,retail_price_ttc)")
      .eq("brand_pharmacy_id", id)
      .eq("brand_id", brand.id)
      .is("archived_at", null)
      .order("observed_at", { ascending: false })
      .limit(100),
  ]);
  if (productsError) throw productsError;
  if (observationsError) throw observationsError;

  let linkedVisitId: string | null = null;
  if (query.visit) {
    const { data: visitLink } = await supabase
      .from("field_visit_brands")
      .select("visit_id")
      .eq("visit_id", query.visit)
      .eq("brand_pharmacy_id", id)
      .maybeSingle();
    linkedVisitId = visitLink?.visit_id ?? null;
  }

  const observationRows = (observations ?? []) as ObservationRow[];
  const observationIds = observationRows.map((row) => row.id);
  const { data: evidenceRows } = observationIds.length
    ? await supabase
        .from("pharmacy_price_observation_attachments")
        .select("id,observation_id,object_path")
        .in("observation_id", observationIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const firstEvidenceByObservation = new Map<string, { id: string; object_path: string }>();
  for (const evidence of evidenceRows ?? []) {
    if (!firstEvidenceByObservation.has(evidence.observation_id)) {
      firstEvidenceByObservation.set(evidence.observation_id, evidence);
    }
  }

  const signedEvidence = new Map<string, string>();
  for (const [observationId, evidence] of firstEvidenceByObservation) {
    const { data } = await supabase.storage.from("price-evidence").createSignedUrl(evidence.object_path, 600);
    if (data?.signedUrl) signedEvidence.set(observationId, data.signedUrl);
  }

  const productOptions = (products ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    ean: product.ean,
    retailPriceTtc: product.retail_price_ttc,
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-20">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/dashboard/pharmacies/${id}`}>
          <ArrowLeft className="size-4" />
          Retour pharmacie
        </Link>
      </Button>

      <header className="rounded-2xl bg-[var(--tr1-navy)] p-5 text-white shadow-sm sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-orange-300">Data terrain · Prix</p>
        <h1 className="mt-1 text-2xl font-black">{pharmacyName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Chaque prix reste une observation datée avec sa provenance et, lorsqu’elle existe, sa photo preuve.
        </p>
      </header>

      {canCapture ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="size-5" /> Relever un prix</CardTitle>
            <CardDescription>
              Photographiez le produit et l’étiquette, puis validez le produit et le prix observé avant enregistrement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriceObservationForm
              brandPharmacyId={id}
              visitId={linkedVisitId}
              products={productOptions}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="size-5" /> Historique des prix observés</CardTitle>
          <CardDescription>
            Comparaison au prix catalogue de référence de {brand.name}, sans supposer que l’observation est permanente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {observationRows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun prix observé pour cette pharmacie.
            </p>
          ) : observationRows.map((row) => {
            const product = Array.isArray(row.products) ? row.products[0] : row.products;
            const reference = product?.retail_price_ttc == null ? null : Number(product.retail_price_ttc);
            const unitPrice = Number(row.unit_price_ttc);
            const deltaPct = reference && reference > 0 ? ((unitPrice - reference) / reference) * 100 : null;
            return (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--tr1-navy)]">{product?.name || "Produit"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(row.observed_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                      {" · "}{methodLabel(row.capture_method)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{money(row.unit_price_ttc)}</p>
                    <p className="text-xs text-muted-foreground">
                      Réf. {money(reference)}
                      {deltaPct === null ? "" : ` · ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)} %`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{priceTypeLabel(row.price_type)}</Badge>
                  {row.bundle_quantity ? <Badge variant="secondary">Lot de {row.bundle_quantity}</Badge> : null}
                  {row.confidence !== null ? <Badge variant="secondary">Confiance {Math.round(Number(row.confidence) * 100)} %</Badge> : null}
                  {signedEvidence.get(row.id) ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={signedEvidence.get(row.id)} target="_blank" rel="noreferrer">Voir la preuve</a>
                    </Button>
                  ) : null}
                </div>
                {row.notes ? <p className="mt-3 text-sm text-muted-foreground">{row.notes}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
