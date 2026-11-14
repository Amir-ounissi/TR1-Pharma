import Link from "next/link";
import { ChevronRight, LockKeyhole, ShoppingBag } from "lucide-react";
import { getCatalogueBrands, getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { PrivateMultiBrandOrderForm } from "@/components/catalogue/private-multibrand-order-form";
import { withPharmacyProductVisuals } from "@/lib/catalogue-private-product-visuals";
import { getBuyerWorkspace } from "@/lib/catalogue-buyer-workspace";

export default async function PharmacyBrandPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ produit?: string }>;
}) {
  const { slug } = await params;
  const { produit } = await searchParams;
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const workspace = await getBuyerWorkspace(admin);
  const { brand, products } = await getCatalogueBrandForPharmacy(pharmacy.id, slug, admin);
  const accessibleBrands = await getCatalogueBrands(pharmacy.id, admin);
  const otherGroups = await Promise.all(accessibleBrands
    .filter((item) => item.slug !== brand.slug)
    .map(async (item) => ({
      brand: item,
      products: (await getCatalogueBrandForPharmacy(pharmacy.id, item.slug, admin)).products,
    })));
  const orderProducts = [
    ...products.map((product) => withPharmacyProductVisuals(product, brand)),
    ...otherGroups.flatMap(({ brand: item, products: items }) =>
      items.map((product) => withPharmacyProductVisuals(product, item)),
    ),
  ];

  return (
    <div className="space-y-7">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-xs text-[#69717d]">
        <Link href="/catalogue" className="font-semibold hover:text-[#0e1d31]">Catalogue</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="font-bold text-[#0e1d31]">{brand.name}</span>
      </nav>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0e1d31] p-5 text-white sm:p-6">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ffa460]">Réassort professionnel</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{brand.name}</h1>
          {brand.description ? <p className="mt-2 max-w-2xl text-xs leading-5 text-[#d5dde7]">{brand.description}</p> : null}
          <p className="mt-2 text-[11px] font-semibold text-[#d5dde7]">{products.length} référence{products.length > 1 ? "s" : ""} accessible{products.length > 1 ? "s" : ""} · Tarifs et minimums propres à votre officine</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/25 px-3 py-2.5 text-[11px] font-bold text-[#d5dde7]">
          <LockKeyhole size={15} aria-hidden="true" /> Espace pharmacie
        </div>
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#ad4b08]">Commande express</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[#0e1d31] sm:text-2xl">Ajoutez vos références au panier</h2>
          <p className="mt-1 text-xs text-[#69717d]">Les prix et paliers se recalculent automatiquement selon les quantités.</p>
        </div>
        <Link href="/catalogue/mes-demandes" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0e1d31] underline underline-offset-4">
          <ShoppingBag size={16} aria-hidden="true" /> Mes demandes
        </Link>
      </div>
      <div id="produits"><PrivateMultiBrandOrderForm key={brand.slug} products={orderProducts} initialBrandSlug={brand.slug} initialProductId={produit} initialCartLines={workspace.lines} reorderHistory={workspace.recent_requests} /></div>
    </div>
  );
}
