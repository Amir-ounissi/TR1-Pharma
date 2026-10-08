import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, History, Tag } from "lucide-react";
import { StockObservationForm } from "@/components/pharmacies/stock-observation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

type StockRow = {
  id: string;
  product_id: string;
  stock_shelf: number | null;
  stock_backroom: number | null;
  stock_total: number | null;
  facings: number | null;
  capture_method: string;
  confidence: number | string | null;
  notes: string | null;
  observed_at: string;
  products: { name: string; ean: string | null } | Array<{ name: string; ean: string | null }> | null;
};

function quantity(value: number | null) {
  return value === null ? "—" : String(value);
}

export default async function PharmacyStockPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visit?: string }>;
}) {
  const [{ id }, query, session, contexts] = await Promise.all([
    params, searchParams, requireActiveBrand(), getBrandContexts(),
  ]);
  const { supabase, brand } = session;
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  const canCapture = ["agent", "tr1_manager", "brand_admin", "super_admin"].includes(role);

  const { data: relation, error: relationError } = await supabase.from("brand_pharmacies")
    .select("id,pharmacy_id,pharmacies(trade_name,legal_name,city)")
    .eq("id", id).eq("brand_id", brand.id).is("archived_at", null).maybeSingle();
  if (relationError) throw relationError;
  if (!relation) notFound();
  const pharmacy = Array.isArray(relation.pharmacies) ? relation.pharmacies[0] : relation.pharmacies;
  const pharmacyName = pharmacy?.trade_name || pharmacy?.legal_name || "Pharmacie";

  const [productsResult, observationsResult, visitResult] = await Promise.all([
    supabase.from("products").select("id,name,sku,ean")
      .eq("brand_id", brand.id).eq("is_active", true)
      .is("discontinued_at", null).order("name"),
    supabase.from("pharmacy_stock_observations")
      .select("id,product_id,stock_shelf,stock_backroom,stock_total,facings,capture_method,confidence,notes,observed_at,products(name,ean)")
      .eq("brand_id", brand.id).eq("brand_pharmacy_id", id)
      .order("observed_at", { ascending: false }).limit(100),
    query.visit
      ? supabase.from("field_visit_brands").select("visit_id")
        .eq("visit_id", query.visit).eq("brand_pharmacy_id", id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (observationsResult.error) throw observationsResult.error;
  const rows = (observationsResult.data ?? []) as StockRow[];
  const ids = rows.map((row) => row.id);
  const { data: evidence } = ids.length
    ? await supabase.from("pharmacy_stock_observation_attachments")
      .select("observation_id,object_path").in("observation_id", ids)
      .order("created_at", { ascending: false })
    : { data: [] };

  const photoUrls = new Map<string, string>();
  for (const entry of evidence ?? []) {
    if (photoUrls.has(entry.observation_id)) continue;
    const { data } = await supabase.storage.from("stock-evidence").createSignedUrl(entry.object_path, 600);
    if (data?.signedUrl) photoUrls.set(entry.observation_id, data.signedUrl);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-20">
      <Button asChild size="sm" variant="ghost">
        <Link href={"/dashboard/pharmacies/" + id}><ArrowLeft className="size-4" /> Retour à la pharmacie</Link>
      </Button>
      <header className="rounded-2xl bg-[var(--tr1-navy)] p-5 text-white sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-orange-300">TR1 AI Vision · Stocks</p>
        <h1 className="mt-1 text-2xl font-black">{pharmacyName}</h1>
        <p className="mt-2 text-sm text-white/75">Historique des quantités et facings par référence · {brand.name}</p>
      </header>
      <Button asChild variant="outline" size="sm">
        <Link href={"/dashboard/pharmacies/" + id + "/prices"}><Tag className="size-4" /> Relevés de prix</Link>
      </Button>
      {canCapture ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="size-5" /> Nouveau relevé</CardTitle>
            <CardDescription>
              Photographiez une étiquette, vérifiez les propositions et validez les stocks distincts du facing.
              La saisie manuelle fonctionne même si l'IA est indisponible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StockObservationForm
              brandPharmacyId={id}
              visitId={visitResult.data?.visit_id ?? null}
              products={productsResult.data ?? []}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="size-5" /> Historique par référence</CardTitle>
          <CardDescription>
            Ces relevés ne sont pas des ventes constatées. Le stock total n'est calculé que si les deux stocks sont connus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun relevé produit enregistré pour cette pharmacie.
            </p>
          ) : rows.map((row) => {
            const product = Array.isArray(row.products) ? row.products[0] : row.products;
            return (
              <article key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{product?.name || "Produit"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.observed_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                      {" · "}{row.capture_method === "photo" ? "Photo" : "Manuel"}
                    </p>
                  </div>
                  {photoUrls.get(row.id) ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={photoUrls.get(row.id)} target="_blank" rel="noreferrer">Voir la photo</a>
                    </Button>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-muted-foreground">Rayon</dt><dd className="font-semibold">{quantity(row.stock_shelf)}</dd></div>
                  <div><dt className="text-muted-foreground">Réserve</dt><dd className="font-semibold">{quantity(row.stock_backroom)}</dd></div>
                  <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{quantity(row.stock_total)}</dd></div>
                  <div><dt className="text-muted-foreground">Facings</dt><dd className="font-semibold">{quantity(row.facings)}</dd></div>
                </dl>
                {row.notes ? <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p> : null}
              </article>
            );
          })}
        </CardContent>
      </Card>
    </main>
  );
}
