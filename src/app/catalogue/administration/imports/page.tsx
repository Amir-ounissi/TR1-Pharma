import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, LockKeyhole } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth";
import { ImportedProductsBrowser, type ImportedProduct } from "@/components/catalogue/imported-products-browser";

export const dynamic = "force-dynamic";

export default async function ImportedCataloguePage() {
  const { supabase } = await requirePlatformAdmin();

  const [
    { data: brands, error: brandsError },
    { data: products, error: productsError },
    { data: tiers, error: tiersError },
  ] = await Promise.all([
    supabase.from("private_catalog_brands").select("id,name,slug,active").order("name"),
    supabase.from("private_catalog_products")
      .select("id,brand_id,sku,name,category,ean,source_ean_raw,price_ht,vat_rate,min_quantity,requires_review,active,source_document,source_row")
      .order("name").limit(1000),
    supabase.from("private_catalog_supplier_tiers")
      .select("product_id,tier_number,quantity_label,unit_price_ht").order("tier_number").limit(5000),
  ]);
  const error = brandsError ?? productsError ?? tiersError;
  if (error) throw error;

  const brandById = new Map((brands ?? []).map((brand) => [brand.id, brand.name]));
  const tiersByProduct = new Map<string, ImportedProduct["tiers"]>();
  for (const tier of tiers ?? []) {
    const list = tiersByProduct.get(tier.product_id) ?? [];
    list.push({
      number: tier.tier_number,
      quantity: tier.quantity_label,
      price: Number(tier.unit_price_ht),
    });
    tiersByProduct.set(tier.product_id, list);
  }

  const imported: ImportedProduct[] = (products ?? [])
    .filter((p) => p.source_document)
    .map((p) => ({
      id: p.id,
      brand: brandById.get(p.brand_id) ?? "Marque",
      sku: p.sku,
      name: p.name,
      category: p.category ?? "",
      ean: p.ean,
      sourceEAN: p.source_ean_raw,
      priceHT: Number(p.price_ht),
      vatRate: p.vat_rate === null ? null : Number(p.vat_rate),
      minQuantity: p.min_quantity,
      needsReview: p.requires_review,
      active: p.active,
      sourceDocument: p.source_document ?? "",
      sourceRow: p.source_row,
      tiers: tiersByProduct.get(p.id) ?? [],
    }));

  const msCount = imported.filter((p) => p.brand === "MS ONLINE").length;
  const nymCount = imported.filter((p) => p.brand === "Laboratoires NYM").length;
  const reviewCount = imported.filter((p) => p.needsReview).length;
  const pricedTiers = imported.reduce((sum, p) => sum + p.tiers.length, 0);

  return (
    <div className="space-y-7">
      <Link href="/catalogue/administration"
        className="inline-flex items-center gap-2 text-sm font-bold text-[#0e1d31] hover:underline">
        <ArrowLeft size={17} aria-hidden="true" /> Retour à l&apos;administration
      </Link>
      <header className="rounded-lg bg-[#0e1d31] px-6 py-8 text-white sm:px-9 sm:py-10">
        <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#ffac78]">
          <FileSpreadsheet size={16} aria-hidden="true" /> Référencement fournisseur
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Catalogues importés</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
          Retrouvez les références, catégories, EAN et tarifs HT source avant validation.
          Rien dans cet écran n&apos;est accessible aux pharmacies.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#d5dde7]">
          <LockKeyhole size={15} aria-hidden="true" /> Accès super-administrateur TR1 PHARMA uniquement
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["MS ONLINE", msCount],
          ["NYM", nymCount],
          ["Paliers fournisseurs", pricedTiers],
          ["À vérifier", reviewCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#e2e7ec] bg-white p-5">
            <p className="text-xs font-bold text-[#69717d]">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-[#0e1d31]">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[#f0d7c7] bg-[#fff5ec] px-5 py-4 text-xs leading-6 text-[#804316]">
        <strong>Publication désactivée :</strong> les deux marques et toutes leurs références sont
        en brouillon. Les TVA, colisages, EAN litigieux et conditions de distribution doivent
        être validés avant toute mise en vente.
      </div>
      <ImportedProductsBrowser products={imported} />
    </div>
  );
}
