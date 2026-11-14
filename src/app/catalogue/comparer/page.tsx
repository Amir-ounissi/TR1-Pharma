import Link from "next/link";
import { ArrowRight, FileSpreadsheet } from "lucide-react";
import { PharmacyPurchaseComparator } from "@/components/catalogue/pharmacy-purchase-comparator";
import { getCatalogueBrands, getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { withPharmacyProductVisuals } from "@/lib/catalogue-private-product-visuals";
import { getCommercialContext } from "@/lib/catalogue-commercial";

export const metadata = {
  title: "Comparer mes achats | Catalogue TR1 PHARMA",
  description: "Comparez les prix d’achat de votre pharmacie avec les conditions du catalogue TR1 PHARMA.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PharmacyPurchaseComparisonPage() {
  const { admin, pharmacy, accessLinkHash } = await requirePharmacyCatalogue();
  const brands = await getCatalogueBrands(pharmacy.id, admin, accessLinkHash);
  const groups = await Promise.all(brands.map(async (brand) => {
    const result = await getCatalogueBrandForPharmacy(pharmacy.id, brand.slug, admin, accessLinkHash);
    return { brand, products: result.products };
  }));
  const products = groups.flatMap(({ brand, products: brandProducts }) =>
    brandProducts.map((product) => withPharmacyProductVisuals(product, brand)),
  );
  const commercialConditions = await getCommercialContext(admin, accessLinkHash);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#ad4b08]">{pharmacy.name}</p>
          <p className="mt-1 text-xs text-[#69717d]">Outil réservé à votre espace professionnel</p>
        </div>
        <Link href="/catalogue" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dce3e8] bg-white px-3 text-xs font-bold text-[#142941] hover:bg-[#f7f8f7]">
          <FileSpreadsheet size={15} aria-hidden="true" /> Mes produits <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <PharmacyPurchaseComparator products={products} quantityGroups={commercialConditions.quantity_groups} />
    </div>
  );
}
