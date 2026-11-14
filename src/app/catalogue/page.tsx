import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, Clock3, LockKeyhole, Package, ShoppingBag, Tag } from "lucide-react";
import Image from "next/image";
import { getCatalogueBrands, getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { tierForQuantity, indicativeRange, euroHT } from "@/lib/private-catalogue-format";
import { disconnectPharmacyCatalogue } from "@/app/catalogue/actions";
import { PublicProductGrid } from "@/components/catalogue/public-product-grid";

export default async function PrivateCatalogueHome() {
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const brands = await getCatalogueBrands(pharmacy.id, admin);
  const groups = await Promise.all(brands.map(async (brand) => {
    const result = await getCatalogueBrandForPharmacy(pharmacy.id, brand.slug, admin);
    return { brand, products: result.products };
  }));
  const productCount = groups.reduce((count, group) => count + group.products.length, 0);

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#69717d]">
          <Building2 size={16} aria-hidden="true" />
          <span>{pharmacy.name}{pharmacy.city ? " · " + pharmacy.city : ""}</span>
        </div>
        <form action={disconnectPharmacyCatalogue}>
          <button className="text-xs font-semibold text-[#69717d] underline-offset-4 hover:text-[#0e1d31] hover:underline">Se déconnecter</button>
        </form>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-[#0e1d31] px-6 py-8 text-white sm:px-10 sm:py-11">
        <div className="max-w-2xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#ffa460]">Votre catalogue professionnel</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Vos produits, vos conditions.</h1>
          <p className="mt-4 text-sm leading-7 text-[#d5dde7]">Consultez vos tarifs professionnels indicatifs HT et les paliers fournisseurs disponibles. Toute demande est confirmée sur devis avant validation définitive.</p>
        </div>
        <Link href="/catalogue/mes-demandes" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-4 text-sm font-bold text-white hover:bg-white/10">
          <Clock3 size={17} aria-hidden="true" /> Mes demandes <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      {productCount > 0 ? (
        <section aria-labelledby="accessible-brands" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="accessible-brands" className="text-2xl font-black tracking-tight text-[#0e1d31]">Laboratoires</h2>
          <span className="text-xs font-semibold text-[#69717d]">{brands.length} marque{brands.length > 1 ? "s" : ""} · {productCount} référence{productCount > 1 ? "s" : ""}</span>
        </div>
        {brands.length ? (
          <div className="flex flex-wrap gap-3">
            {groups.map(({ brand, products }) => (
              <Link key={brand.id} href={"/catalogue/marques/" + brand.slug}
                className="group flex min-w-52 flex-1 items-center justify-between gap-4 rounded-md border border-[#e2e7ec] bg-white px-5 py-4 transition hover:border-[#dce3ea] hover:shadow-sm">
                <div>
                  <p className="text-base font-black text-[#0e1d31]">{brand.name}</p>
                  <p className="mt-1 text-xs text-[#69717d]">{products.length} produit{products.length > 1 ? "s" : ""}</p>
                </div>
                <ChevronRight size={18} aria-hidden="true" className="text-[#69717d] transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[#dce3ea] bg-white p-8">
            <p className="font-extrabold text-[#0e1d31]">Votre catalogue est en cours d&apos;activation.</p>
            <p className="mt-2 text-sm text-[#69717d]">Votre interlocuteur commercial vous informera dès que vos marques seront disponibles.</p>
          </div>
        )}
        </section>
      ) : (
        <section aria-labelledby="catalogue-reference" className="space-y-5">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#ad4b08]">Catalogue de référence TR1 PHARMA</p>
            <h2 id="catalogue-reference" className="text-2xl font-black tracking-tight text-[#0e1d31]">Les fiches produits disponibles</h2>
            <p className="max-w-3xl text-sm leading-6 text-[#69717d]">Retrouvez les fiches Beauty of Joseon, Dr. Althea et Biodance, avec leurs visuels, informations produit et codes-barres. Les tarifs professionnels s'affichent dès l'activation de votre sélection.</p>
          </div>
          <PublicProductGrid />
        </section>
      )}

      {productCount > 0 ? (
        <section aria-labelledby="available-products" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#ad4b08]">Sélection réservée à votre officine</p>
              <h2 id="available-products" className="mt-1 text-2xl font-black tracking-tight text-[#0e1d31]">Vos produits</h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e2e7ec] bg-white px-3 py-1.5 text-xs font-bold text-[#515d6b]"><LockKeyhole size={14} aria-hidden="true" /> Conditions privées</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {groups.flatMap(({ brand, products }) => products.map((product) => {
              const displayPrice = product.pricing.mode === "contractual"
                ? (() => {
                  const tier = tierForQuantity(product.pricing.tiers, product.min_quantity);
                  return tier ? euroHT(tier.price_ht) : "Prix sur demande";
                })()
                : indicativeRange(tierForQuantity(product.pricing.tiers, product.min_quantity));
              return (
                <article key={product.id} className="shop-card flex min-w-0 flex-col overflow-hidden">
                  <div className="flex h-36 items-center justify-center bg-[#f4f0e7] sm:h-52">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name} width={440} height={440} unoptimized className="h-full w-full object-contain p-4" />
                    ) : <Package className="text-[#b4b8b7]" size={44} strokeWidth={1.2} aria-hidden="true" />}
                  </div>
                  <div className="flex flex-1 flex-col p-3.5 sm:p-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#ad4b08]">{brand.name}</p>
                    <h3 className="mt-1.5 text-base font-black leading-6 text-[#0e1d31] sm:text-lg">{product.name}</h3>
                    <p className="mt-1 text-xs text-[#69717d]">Réf. {product.sku}</p>
                    <div className="mt-auto pt-4">
                      <p className="text-[11px] font-semibold text-[#69717d]">
                        {product.pricing.mode === "contractual" ? "Votre prix HT / unité" : "Tarif indicatif HT / unité"}
                      </p>
                      <p className="mt-1 text-lg font-black text-[#0e1d31]">{displayPrice}</p>
                      <Link href={"/catalogue/marques/" + brand.slug + "?produit=" + product.id + "#produits"}
                        className="shop-primary-action mt-3 flex min-h-10 items-center justify-center gap-2 px-3 text-xs sm:text-sm">
                        Ajouter au panier <ShoppingBag size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            }))}
          </div>
        </section>
      ) : null}

      {productCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#e2e7ec] bg-white p-4 text-xs text-[#69717d]">
          <Tag size={18} className="shrink-0 text-[#515d6b]" aria-hidden="true" />
          Les tarifs affichés sont les conditions autorisées pour votre officine. Les demandes de devis et commandes sont soumises à confirmation.
        </div>
      ) : null}
    </div>
  );
}
