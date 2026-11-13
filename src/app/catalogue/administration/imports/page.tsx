import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
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
      .select("id,brand_id,sku,name,category,format,image_url,ean,source_ean_raw,price_ht,vat_rate,min_quantity,requires_review,active,source_document,source_row")
      .order("name").limit(1000),
    supabase.from("private_catalog_supplier_tiers")
      .select("product_id,tier_number,quantity_label,unit_price_ht").order("tier_number").limit(5000),
  ]);

  const error = brandsError ?? productsError ?? tiersError;
  if (error) throw error;

  const brandById = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const tiersByProduct = new Map<string, ImportedProduct["tiers"]>();
  for (const tier of tiers ?? []) {
    const list = tiersByProduct.get(tier.product_id) ?? [];
    list.push({ number: tier.tier_number, quantity: tier.quantity_label, price: Number(tier.unit_price_ht) });
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
      format: p.format ?? "",
      imageUrl: p.image_url,
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
  const brandCount = new Set(imported.map((p) => p.brand)).size;
  const pending = imported.filter((p) => p.needsReview).length;
  const totalTiers = imported.reduce((sum, p) => sum + p.tiers.length, 0);

  return (
    <div className="space-y-7">
      <Link href="/catalogue/administration" className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-[#596777] hover:text-[#142941]">
        <ArrowLeft size={16} aria-hidden="true"/> Administration du catalogue
      </Link>

      <section className="relative overflow-hidden rounded-[22px] bg-[#142941] px-6 py-8 text-white sm:px-10 sm:py-11">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 size-96 rounded-full border-[55px] border-white/[.035]"/>
        <div className="relative grid items-end gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.19em] text-[#e9ac80]">
              <LockKeyhole size={14} aria-hidden="true"/> Collection privée · TR1 PHARMA
            </div>
            <h1 className="mt-4 max-w-2xl text-[34px] font-black leading-[1.09] tracking-[-.045em] sm:text-[46px]">
              Des marques à découvrir.<br /><span className="text-[#e3a575]">Une sélection à construire.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#cfdae1]">
              Parcourez les gammes de nos fournisseurs, retrouvez chaque référence et préparez votre catalogue professionnel avant publication.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-center lg:min-w-80 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div><p className="text-3xl font-black tabular-nums sm:text-4xl">{brandCount}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">Marques</p></div>
            <div><p className="text-3xl font-black tabular-nums sm:text-4xl">{imported.length}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">Produits</p></div>
            <div><p className="text-3xl font-black tabular-nums sm:text-4xl">{totalTiers}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">Paliers</p></div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-[#e6e6e1] bg-white px-5 py-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#a86e48]" aria-hidden="true"/>
        <p className="text-xs leading-6 text-[#637180]">
          <strong className="text-[#142941]">Espace interne, non publié.</strong> {pending} fiches demandent une vérification.
          Les tarifs fournisseur, EAN, TVA et colisages sont à valider avant tout affichage dans l’espace pharmacie.
          Les prix internes sont masqués par défaut.
        </p>
      </div>

      <ImportedProductsBrowser products={imported}/>
    </div>
  );
}
