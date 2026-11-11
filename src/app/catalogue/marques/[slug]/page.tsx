import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCatalogueBrandForPharmacy, requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { PrivateOrderForm } from "@/components/catalogue/private-order-form";

export default async function PharmacyBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const { brand, products } = await getCatalogueBrandForPharmacy(pharmacy.id, slug, admin);

  return (
    <div className="space-y-8">
      <Link href="/catalogue" className="inline-flex items-center gap-2 text-sm font-semibold text-[#69717d] hover:text-[#ea7015]"><ChevronLeft size={17} /> Toutes les marques</Link>
      <div className="flex flex-wrap items-start gap-5 rounded-2xl bg-[#0e1d31] p-7 text-white sm:p-9">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-[#ea7015] text-2xl font-black text-[#0e1d31]">{brand.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ffac78]">Marque partenaire · Catalogue privé</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">{brand.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{brand.description || "Découvrez les références réservées aux officines partenaires."}</p>
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold">Produits et demande de réassort</h2>
          <p className="mt-2 text-sm text-[#69717d]">Sélectionnez les quantités souhaitées. Les montants visibles sont les prix d’achat HT applicables à votre pharmacie.</p>
        </div>
        <PrivateOrderForm slug={brand.slug} products={products} />
      </div>
    </div>
  );
}
