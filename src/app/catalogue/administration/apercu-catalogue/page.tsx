import Link from "next/link";
import { ArrowLeft, Eye, LockKeyhole, Search, Settings2, ShieldCheck, Store } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth";
import { CataloguePackshot } from "@/components/catalogue/catalogue-packshot";
import { withPharmacyProductVisuals } from "@/lib/catalogue-private-product-visuals";
import { adminPreviewFirstTierLabel,resolveAdminPreviewPricing } from "@/lib/catalogue-admin-preview";
import type { CatalogProduct } from "@/lib/private-catalogue";

export const dynamic = "force-dynamic";

export default async function SoloAgentCataloguePreview({
  searchParams,
}: { searchParams: Promise<{ pharmacie?: string; marque?: string; categorie?: string; q?: string }> }) {
  // Intentionally not the real pharmacy session: this is an authenticated
  // agent-only, strictly read-only rendering of the authorised B2B catalogue.
  const { supabase } = await requirePlatformAdmin();
  const [
    pharmaciesResult,brandsResult,productsResult,accessResult,
    indicativeResult,contractResult,flatResult,
  ] = await Promise.all([
    supabase.from("private_catalog_pharmacies").select("id,name,city").order("name").limit(1000),
    supabase.from("private_catalog_brands").select("id,slug,name,description,logo_url,active").order("name").limit(500),
    supabase.from("private_catalog_products")
      // Never fetch internal product.price_ht into the preview route.
      .select("id,brand_id,sku,ean,name,description,format,category,image_url,vat_rate,min_quantity,quantity_step,active")
      .eq("active",true).order("name").limit(1500),
    supabase.from("private_catalog_access").select("pharmacy_id,brand_id,active,pricing_mode").eq("active",true).limit(1500),
    supabase.from("private_catalog_indicative_tiers").select("product_id,min_quantity,price_min_ht,price_max_ht").limit(5000),
    supabase.from("private_catalog_contract_tiers").select("pharmacy_id,product_id,min_quantity,price_ht").limit(5000),
    supabase.from("private_catalog_prices").select("pharmacy_id,product_id,price_ht").limit(5000),
  ]);
  const error = pharmaciesResult.error ?? brandsResult.error ?? productsResult.error ??
    accessResult.error ?? indicativeResult.error ?? contractResult.error ?? flatResult.error;
  if (error) throw new Error("Prévisualisation privée indisponible : " + error.message);

  const pharmacies = pharmaciesResult.data ?? [];
  const brands = (brandsResult.data ?? []).filter(item=>item.active);
  const products = productsResult.data ?? [];
  const access = accessResult.data ?? [];
  const indicative = indicativeResult.data ?? [];
  const contract = contractResult.data ?? [];
  const flat = flatResult.data ?? [];
  const params = await searchParams;
  const pharmacy = pharmacies.find(p=>p.id===params.pharmacie)??null;
  const permitted = new Map<string,"contractual"|"indicative">();
  if(pharmacy){
    for(const permission of access.filter(a=>a.pharmacy_id===pharmacy.id)){
      permitted.set(permission.brand_id,permission.pricing_mode==="contractual"?"contractual":"indicative");
    }
  } else {
    for(const brand of brands) permitted.set(brand.id,"indicative");
  }
  const accessibleBrands = brands.filter(b=>permitted.has(b.id));
  const brandById = new Map(accessibleBrands.map(b=>[b.id,b]));
  const selectedBrand = accessibleBrands.some(b=>b.slug===params.marque) ? params.marque??"" : "";
  const query = (params.q??"").trim().slice(0,100);
  const selectedCategory = (params.categorie??"").slice(0,120);
  const baseProducts = products.filter(p=>permitted.has(p.brand_id)&&brandById.has(p.brand_id));
  const categories = [...new Set(baseProducts.map(p=>p.category.trim()||"Autres soins"))].sort((a,b)=>a.localeCompare(b,"fr"));
  const category = categories.includes(selectedCategory)?selectedCategory:"";
  const normalizedQuery=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr");

  const visible = baseProducts.filter(p=>{
    const brand=brandById.get(p.brand_id);
    if(!brand) return false;
    if(selectedBrand && brand.slug!==selectedBrand) return false;
    if(category && (p.category.trim()||"Autres soins")!==category) return false;
    if(!normalizedQuery) return true;
    const haystack=[p.name,p.sku,p.ean??"",brand.name,p.format,p.category].join(" ")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr");
    return haystack.includes(normalizedQuery);
  });
  const currentPath="/catalogue/administration/apercu-catalogue";
  const field="h-11 w-full rounded-lg border border-[#dce3e7] bg-white px-3 text-sm text-[#142941] outline-none focus:border-[#b97950]";

  return (
    <div className="-mt-3 space-y-5 pb-8 sm:-mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/catalogue/administration" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#586a79] hover:text-[#142941]">
          <ArrowLeft size={15} aria-hidden="true" /> Mon activité
        </Link>
        <Link href="/catalogue/administration/configuration" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dce3e7] bg-white px-3 text-xs font-extrabold text-[#142941] hover:bg-[#f1f4f4]">
          <Settings2 size={15} aria-hidden="true"/> Gérer le catalogue
        </Link>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#e2e7e8] bg-white px-5 py-5">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em] text-[#a96b45]">
            <Eye size={15} aria-hidden="true"/> Mon catalogue privé
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#142941] sm:text-3xl">Aperçu du catalogue pharmacie</h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#657785]">
            {pharmacy ? "Simulation des marques autorisées et des tarifs visibles pour cette officine." :
              "Vue générale des produits publiés et des paliers indicatifs. Sélectionnez une pharmacie pour vérifier ses accès et ses prix."}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d2dfd4] bg-[#f1f8f2] px-3 py-2 text-[11px] font-bold text-[#316044]">
          <ShieldCheck size={15} aria-hidden="true"/> Aperçu privé en lecture seule
        </span>
      </header>

      <form method="GET" action={currentPath} className="grid gap-3 rounded-xl border border-[#e2e7e8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1.2fr)_minmax(170px,1fr)_minmax(180px,1fr)_minmax(200px,1.3fr)_auto] lg:items-end">
        <label className="block space-y-1.5 text-xs font-bold text-[#586978]">Vue pharmacie
          <select name="pharmacie" defaultValue={pharmacy?.id??""} className={field}>
            <option value="">Générale — prix indicatifs</option>
            {pharmacies.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?" — "+p.city:""}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-xs font-bold text-[#586978]">Marque
          <select name="marque" defaultValue={selectedBrand} className={field}>
            <option value="">Toutes les marques</option>
            {accessibleBrands.map(b=><option key={b.id} value={b.slug}>{b.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-xs font-bold text-[#586978]">Catégorie
          <select name="categorie" defaultValue={category} className={field}>
            <option value="">Toutes les catégories</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-xs font-bold text-[#586978]">Nom, EAN ou référence
          <span className="relative block">
            <Search size={15} aria-hidden="true" className="absolute left-3 top-3.5 text-[#82909b]" />
            <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Rechercher un produit"
              className={field+" pl-9"}/>
          </span>
        </label>
        <button type="submit" className="h-11 rounded-lg bg-[#142941] px-5 text-sm font-black text-white hover:bg-[#284660]">Afficher</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Pharmacie simulée",pharmacy?.name??"Catalogue général",Store],
          ["Marques visibles",String(accessibleBrands.length),LockKeyhole],
          ["Références visibles",String(visible.length)+" / "+baseProducts.length,TagsIcon],
        ].map(([key,value,Icon])=>(
          <div key={String(key)} className="rounded-xl border border-[#e2e7e8] bg-white px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#73818c]">
              <Icon size={15} aria-hidden="true"/>{String(key)}
            </p>
            <p className="mt-1 truncate text-lg font-black text-[#142941]">{String(value)}</p>
          </div>
        ))}
      </div>

      <section aria-label="Produits du catalogue privé" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[#142941]">{selectedBrand ? accessibleBrands.find(b=>b.slug===selectedBrand)?.name : "Produits visibles"}
            <span className="ml-2 text-xs font-semibold text-[#8a969f]">{visible.length} références</span>
          </h2>
          <p className="text-xs text-[#657785]">{pharmacy?"Prix selon l'accès de l'officine":"Prix indicatifs uniquement"}</p>
        </div>
        {visible.length?(
          <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map(p=>{
              const brand=brandById.get(p.brand_id)!;
              const mode=pharmacy ? permitted.get(p.brand_id)??"indicative":"indicative";
              const pricing=resolveAdminPreviewPricing({
                productId:p.id,minimumQuantity:p.min_quantity,pricingMode:mode,
                indicative,
                contractual:pharmacy ? contract.filter(t=>t.pharmacy_id===pharmacy.id):[],
                flat:pharmacy ? flat.filter(t=>t.pharmacy_id===pharmacy.id):[],
              });
              const price=adminPreviewFirstTierLabel(pricing,p.min_quantity,p.quantity_step);
              const product:CatalogProduct = {
                id:p.id,brand_id:p.brand_id,sku:p.sku,ean:p.ean,name:p.name,description:p.description,
                format:p.format,image_url:p.image_url,vat_rate:Number(p.vat_rate??0),
                min_quantity:p.min_quantity,quantity_step:p.quantity_step,pricing,
              };
              const enriched=withPharmacyProductVisuals(product,brand);
              return <article key={p.id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e3e8e9] bg-white shadow-sm">
                <CataloguePackshot src={enriched.image_url} alt={p.name}/>
                <div className="flex flex-1 flex-col gap-2 border-t border-[#f0f2f2] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.13em] text-[#a36b48]">{brand.name}</p>
                  <h3 className="min-h-9 text-sm font-black leading-5 text-[#142941]">{p.name}</h3>
                  <p className="text-xs text-[#637480]">{p.format||p.category||"Format à préciser"}</p>
                  <div className="mt-auto border-t border-[#eef0f0] pt-3">
                    <p className="text-sm font-black text-[#142941]">{price.amount}</p>
                    <p className="mt-1 text-[11px] leading-4 text-[#687b88]">{price.detail}</p>
                    <p className="mt-1 text-[11px] text-[#81909b]">Minimum : {p.min_quantity} u. · Pas : {p.quantity_step} u.</p>
                  </div>
                  <details className="rounded-lg bg-[#f6f8f7] px-3 py-2">
                    <summary className="cursor-pointer text-xs font-extrabold text-[#41576a]">Détails de la référence</summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#607280]">{p.description||"Description à compléter"}</p>
                    <p className="mt-2 break-all text-[11px] text-[#81909b]">Réf. {p.sku}{p.ean?" · EAN "+p.ean:""}</p>
                  </details>
                  <span className="rounded-lg border border-[#d9e3e8] px-3 py-2 text-center text-xs font-bold text-[#547080]">
                    Consultation uniquement — aucune commande
                  </span>
                </div>
              </article>;
            })}
          </div>
        ):(
          <div className="rounded-xl border border-[#e2e7e8] bg-white p-8 text-center">
            <p className="text-sm font-extrabold text-[#142941]">Aucun produit visible avec ces critères.</p>
            <p className="mt-2 text-xs leading-5 text-[#73838f]">{pharmacy?
              "Vérifiez les marques autorisées pour cette pharmacie et les références publiées dans la configuration.":
              "Publiez au moins une référence et une marque depuis la gestion du catalogue privé."}</p>
            <Link href="/catalogue/administration/configuration" className="mt-3 inline-flex rounded-lg bg-[#142941] px-4 py-2.5 text-xs font-bold text-white">Gérer le catalogue</Link>
          </div>
        )}
      </section>
      <p className="rounded-lg bg-[#f0f3f4] px-4 py-3 text-xs leading-5 text-[#637581]">
        Aperçu de consultation, pas une session pharmacie. Le panier, les favoris, les remises collectives, le franco, les frais de port et la soumission de commande ne sont pas simulés ici.
        Pour valider le parcours transactionnel complet, utilisez un compte pharmacie de test autorisé.
      </p>
    </div>
  );
}

function TagsIcon({size,className,...rest}:{size?:number;className?:string;"aria-hidden"?:boolean}){
  return <Store size={size} className={className} {...rest}/>;
}
