import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicCatalogueClient, type PublicCatalogueData } from "@/components/catalogue/public-catalogue";

export const metadata: Metadata = {
  title: "Catalogue professionnel | TR1 PHARMA",
  description: "Découvrez les marques et références proposées par TR1 PHARMA aux pharmacies. Composez votre sélection et transmettez votre demande.",
  alternates: { canonical: "https://www.tr1pharma.com/vitrine" },
  openGraph: {
    title: "Catalogue professionnel | TR1 PHARMA",
    description: "Découvrez les marques et références proposées aux pharmacies.",
    siteName: "TR1 PHARMA", url: "https://www.tr1pharma.com/vitrine",
    locale: "fr_FR", type: "website",
  },
};

export default async function PublicCataloguePage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const db = await createServerSupabase();
  if (!db) throw new Error("Catalogue TR1 indisponible.");
  const [{ data, error }, query] = await Promise.all([db.rpc("public_catalogue_data"), searchParams]);
  if (error) throw new Error("Impossible de charger le catalogue professionnel.");
  const catalogue = (data ?? { brands: [], products: [] }) as PublicCatalogueData;
  return <main id="contenu" className="mx-auto max-w-7xl px-4 py-7 sm:px-7 sm:py-10"><PublicCatalogueClient data={catalogue} error={query.erreur ?? ""}/></main>;
}
