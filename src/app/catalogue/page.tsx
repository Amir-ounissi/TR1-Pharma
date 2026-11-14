import Link from "next/link";
import { Building2, Clock3, ShoppingBasket } from "lucide-react";
import { getCatalogueBrands, getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { disconnectPharmacyCatalogue } from "@/app/catalogue/actions";
import { PrivateMultiBrandOrderForm } from "@/components/catalogue/private-multibrand-order-form";
import { withPharmacyProductVisuals } from "@/lib/catalogue-private-product-visuals";
import { getCommercialContext } from "@/lib/catalogue-commercial";
import { getBuyerWorkspace } from "@/lib/catalogue-buyer-workspace";

export default async function PrivateCatalogueHome({
  searchParams,
}: { searchParams: Promise<{ reprendre?: string }> }) {
  const { reprendre } = await searchParams;
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const commercialConditions = await getCommercialContext(admin);
  const workspace = await getBuyerWorkspace(admin);
  const { data: favoriteIds, error: favoritesError } = await admin.rpc("catalogue_my_favorites");
  if (favoritesError) throw favoritesError;
  const brands = await getCatalogueBrands(pharmacy.id, admin);
  const groups = await Promise.all(brands.map(async (brand) => {
    const result = await getCatalogueBrandForPharmacy(pharmacy.id, brand.slug, admin);
    return { brand, products: result.products };
  }));
  const orderProducts = groups.flatMap(({ brand, products }) =>
    products.map((product) => withPharmacyProductVisuals(product, brand)),
  );

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

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dce3e5] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ad4b08]">TR1 PHARMA · Approvisionnement</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0e1d31] sm:text-3xl">Mon espace achats</h1>
          <p className="mt-2 text-xs leading-5 text-[#69717d] sm:text-sm">
            Reprenez un réassort ou ajoutez des produits de plusieurs marques dans un panier commun.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="#reassort" className="shop-primary-action inline-flex min-h-11 items-center gap-2 px-3 text-xs font-bold sm:px-4">
            <ShoppingBasket size={17} aria-hidden="true" /> Réassort express
          </Link>
          <Link href="/catalogue/mes-demandes" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#dce3e5] px-3 text-xs font-bold text-[#142941] sm:px-4">
            <Clock3 size={16} aria-hidden="true" /> Mes demandes
          </Link>
        </div>
      </section>

      <PrivateMultiBrandOrderForm key={reprendre ?? "catalogue"} products={orderProducts} commercialConditions={commercialConditions} initialFavoriteIds={(favoriteIds ?? []) as string[]} initialCartLines={workspace.lines} reorderHistory={workspace.recent_requests} initialReorderId={reprendre} />
    </div>
  );
}
