import Link from "next/link";
import { ArrowUpRight, Building2, ShieldCheck } from "lucide-react";
import { getCatalogueBrands, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { disconnectPharmacyCatalogue } from "@/app/catalogue/actions";

export default async function PrivateCatalogueHome() {
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const brands = await getCatalogueBrands(pharmacy.id, admin);
  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#ea7015]">Catalogue multimarques · Accès vérifié</p>
          <h1 className="max-w-2xl text-4xl font-black tracking-[-.045em] sm:text-5xl">Les marques sélectionnées pour votre pharmacie.</h1>
          <div className="flex items-center gap-2 text-sm text-[#69717d]"><Building2 size={16} aria-hidden="true" /> {pharmacy.name}{pharmacy.city ? " · " + pharmacy.city : ""}</div>
        </div>
        <form action={disconnectPharmacyCatalogue}>
          <button className="rounded-md border border-[#0e1d31]/20 px-3 py-2 text-xs font-bold hover:bg-white">Se déconnecter</button>
        </form>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-[#0e1d31]/10 bg-white px-5 py-4">
        <ShieldCheck className="mt-1 shrink-0 text-[#4f7a58]" size={20} aria-hidden="true" />
        <p className="text-sm leading-6 text-[#515d6b]">Ces catalogues et conditions sont réservés à votre officine. Les demandes transmises seront vérifiées par TR1 PHARMA avant confirmation par les laboratoires.</p>
      </div>
      <section aria-labelledby="catalogue-brands" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="catalogue-brands" className="text-2xl font-extrabold">Vos laboratoires</h2>
          <span className="text-sm text-[#69717d]">{brands.length} marque{brands.length > 1 ? "s" : ""} accessible{brands.length > 1 ? "s" : ""}</span>
        </div>
        {brands.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <Link key={brand.id} href={"/catalogue/marques/" + brand.slug} className="group flex min-h-64 flex-col justify-between rounded-xl border border-[#0e1d31]/10 bg-white p-6 transition hover:border-[#ea7015] hover:shadow-lg">
                <div>
                  <div className="mb-6 flex size-14 items-center justify-center rounded-lg bg-[#0e1d31] text-xl font-black text-white">{brand.name.slice(0, 2).toUpperCase()}</div>
                  <h3 className="text-2xl font-black tracking-tight">{brand.name}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#69717d]">{brand.description || "Découvrir les références et conditions commerciales de cette marque."}</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold group-hover:text-[#ea7015]">Voir les produits <ArrowUpRight size={16} aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#0e1d31]/20 bg-white p-9">
            <h3 className="text-lg font-bold">Votre sélection est en préparation.</h3>
            <p className="mt-2 text-sm text-[#69717d]">TR1 PHARMA doit encore activer les marques autorisées pour votre pharmacie.</p>
          </div>
        )}
      </section>
    </div>
  );
}
