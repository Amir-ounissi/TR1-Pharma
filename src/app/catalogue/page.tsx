import Link from "next/link";
import { ArrowRight, Building2, Clock3 } from "lucide-react";
import { getCatalogueBrands, getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { disconnectPharmacyCatalogue } from "@/app/catalogue/actions";
import { PublicProductGrid } from "@/components/catalogue/public-product-grid";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";

export default async function PrivateCatalogueHome() {
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const brands = await getCatalogueBrands(pharmacy.id, admin);
  const groups = await Promise.all(brands.map(async (brand) => {
    const result = await getCatalogueBrandForPharmacy(pharmacy.id, brand.slug, admin);
    return { brand, products: result.products };
  }));
  const privateProducts = groups.flatMap(({ brand, products }) => products.map((product) => ({
    id: product.id,
    brandSlug: brand.slug,
    name: product.name,
    ean: product.ean,
    min_quantity: product.min_quantity,
    vat_rate: product.vat_rate,
    pricing: product.pricing,
  })));

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#69717d]">
          <Building2 size={16} aria-hidden="true" />
          <span>{pharmacy.name}{pharmacy.city ? " · " + pharmacy.city : ""}</span>
          <span className="rounded-full bg-[#eaf1eb] px-2.5 py-1 text-[10px] font-bold text-[#476b55]">Accès professionnel actif</span>
        </div>
        <form action={disconnectPharmacyCatalogue}>
          <button className="text-xs font-semibold text-[#69717d] underline-offset-4 hover:text-[#0e1d31] hover:underline">Se déconnecter</button>
        </form>
      </div>

      <section className="relative overflow-hidden rounded-lg bg-[#0e1d31] px-6 py-8 text-white sm:px-10 sm:py-10 lg:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-15 -top-25 size-100 rounded-full border-[45px] border-white/5" />
        <div className="relative max-w-[660px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[.24em] text-[#ffa460]">
            TR1 PHARMA · Espace pharmacie
          </p>
          <h1 className="mt-4 text-[32px] font-black leading-[1.08] tracking-[-.045em] sm:text-5xl lg:text-[56px]">
            Préparez votre réassort en quelques clics.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#d5dde7] sm:text-base">
            Vos références, tarifs HT et paliers de commande sont réunis au même endroit. Recherchez, ajoutez au panier et transmettez votre demande.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="#produits" className="shop-primary-action inline-flex min-h-12 items-center gap-2 px-5 text-sm">
              Accéder aux produits <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/catalogue/mes-demandes" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/35 px-5 text-sm font-bold text-white transition hover:bg-white/10">
              <Clock3 size={16} aria-hidden="true" /> Mes demandes
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-3 hidden w-60 rotate-[-8deg] rounded-md border border-white/15 bg-white/[.05] p-6 lg:block" aria-hidden="true">
          <Tr1BrandLogo className="h-25 w-full" primaryColor="#fffdf8" accentColor="#ea7015" />
          <div className="mt-4 border-t border-white/20 pt-3 text-center text-[10px] font-bold tracking-[.19em] text-white/75">CATALOGUE PROFESSIONNEL</div>
        </div>
      </section>

      <PublicProductGrid privateProducts={privateProducts} />
    </div>
  );
}
