import Link from "next/link";
import { ChevronRight, LockKeyhole, ShoppingBag } from "lucide-react";
import { getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { PrivateOrderForm } from "@/components/catalogue/private-order-form";

export default async function PharmacyBrandPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ produit?: string }>;
}) {
  const { slug } = await params;
  const { produit } = await searchParams;
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const { brand, products } = await getCatalogueBrandForPharmacy(pharmacy.id, slug, admin);

  return (
    <div className="space-y-7">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-xs text-[#69717d]">
        <Link href="/catalogue" className="font-semibold hover:text-[#0e1d31]">Catalogue</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="font-bold text-[#0e1d31]">{brand.name}</span>
      </nav>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-[#0e1d31] p-6 text-white sm:p-9">
        <div className="max-w-2xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#ffa460]">Catalogue professionnel · {brand.name}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{brand.name}</h1>
          {brand.description ? <p className="mt-3 max-w-xl text-sm leading-6 text-[#d5dde7]">{brand.description}</p> : null}
          <p className="mt-4 text-xs font-semibold text-[#d5dde7]">{products.length} référence{products.length > 1 ? "s" : ""} disponible{products.length > 1 ? "s" : ""} pour votre officine</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-white/25 px-4 py-3 text-xs font-bold text-[#d5dde7]">
          <LockKeyhole size={16} aria-hidden="true" /> Tarifs professionnels privés
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#ad4b08]">Votre sélection</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#0e1d31]">Choisissez vos produits</h2>
        </div>
        <Link href="/catalogue/mes-demandes" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0e1d31] underline underline-offset-4">
          <ShoppingBag size={16} aria-hidden="true" /> Mes demandes
        </Link>
      </div>
      <div id="produits"><PrivateOrderForm slug={brand.slug} brandName={brand.name} products={products} initialProductId={produit} /></div>
    </div>
  );
}
