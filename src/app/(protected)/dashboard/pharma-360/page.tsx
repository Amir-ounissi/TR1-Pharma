import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ux/page-header";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";

type SearchParams = Promise<{ q?: string }>;

type PharmacyDirectoryRow = {
  id: string;
  trade_name: string | null;
  legal_name: string | null;
  city: string | null;
};

function pharmacyName(row: PharmacyDirectoryRow) {
  return row.trade_name || row.legal_name || "Pharmacie";
}

export default async function Pharma360IndexPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const search = (query.q ?? "").trim().toLocaleLowerCase("fr-FR");
  const [{ supabase, brand }, contexts] = await Promise.all([requireActiveBrand(), getBrandContexts()]);
  const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
  if (!["tr1_manager", "brand_admin", "brand_user", "super_admin"].includes(role)) notFound();

  const { data, error } = await supabase
    .from("brand_pharmacy_directory")
    .select("id,trade_name,legal_name,city")
    .eq("brand_id", brand.id)
    .order("trade_name", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw error;

  const pharmacies = ((data ?? []) as PharmacyDirectoryRow[]).filter((row) => {
    if (!search) return true;
    return [row.trade_name, row.legal_name, row.city]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("fr-FR").includes(search));
  });

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow={`Pharma 360 · ${brand.name}`}
        title="Une pharmacie, toutes les dimensions utiles à la décision"
        description="Business, assortiment, terrain, Trade Marketing, sell-out et opportunités dans une fiche consolidée."
        tone="dark"
      />

      <form className="flex max-w-2xl gap-2" action="/dashboard/pharma-360">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={query.q ?? ""} placeholder="Rechercher une pharmacie ou une ville" className="pl-9" />
        </div>
        <Button type="submit">Rechercher</Button>
      </form>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{pharmacies.length} pharmacie(s) affichée(s)</p>
        {search ? <Button asChild variant="ghost" size="sm"><Link href="/dashboard/pharma-360">Effacer la recherche</Link></Button> : null}
      </div>

      {pharmacies.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pharmacies.map((pharmacy) => (
            <Card key={pharmacy.id} className="transition-colors hover:bg-muted/20">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Building2 className="size-4" /></div>
                  <div className="min-w-0"><CardTitle className="truncate text-base">{pharmacyName(pharmacy)}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{pharmacy.city || "Ville non renseignée"}</p></div>
                </div>
              </CardHeader>
              <CardContent><Button asChild variant="outline" className="w-full"><Link href={`/dashboard/pharma-360/${pharmacy.id}`}>Ouvrir la vue 360</Link></Button></CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucune pharmacie ne correspond à cette recherche.</CardContent></Card>
      )}
    </main>
  );
}
