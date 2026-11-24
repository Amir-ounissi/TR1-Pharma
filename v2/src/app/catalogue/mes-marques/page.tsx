import Link from "next/link";
import {Building2, ArrowRight, Package, RefreshCw} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";
import {submitProductRequest} from "../request-actions";

export default async function InstalledBrandsPage({searchParams}:{searchParams:Promise<{marque?:string}>}) {
  const {db,user,brands}=await loadPharmacyBrandDirectory();
  const filters=await searchParams;
  const installed=brands.filter(b=>b.status==="implanted");
  const selected=installed.find(x=>x.brand_id===filters.marque);
  const enabledIds=installed.filter(b=>b.reorder_ready&&b.real_access).map(b=>b.brand_id);
  const [memberResult,productResult]=await Promise.all([
    db.from("pharmacy_memberships").select("pharmacy_id")
      .eq("user_id",user.id).eq("active",true).order("created_at").limit(1),
    enabledIds.length?
      db.from("products").select("id,brand_id,name,sku,ean,format,description,image_url,price_ht,min_qty,qty_step")
        .eq("published",true).in("brand_id",enabledIds).order("name").limit(250):
      Promise.resolve({data:[],error:null}),
  ]);
  if(memberResult.error||productResult.error)throw new Error("Impossible de charger les gammes implantées.");
  const pharmacyId=memberResult.data?.[0]?.pharmacy_id;
  const products=(productResult.data||[]).filter(p=>!selected||p.brand_id===selected.brand_id);
  const brandById=new Map(installed.map(x=>[x.brand_id,x]));
  const ids=products.map(x=>x.id);
  const [individual,common]=await Promise.all([
    ids.length&&pharmacyId?
      db.from("price_rules").select("product_id,min_qty,price_ht")
        .eq("pharmacy_id",pharmacyId).in("product_id",ids):
      Promise.resolve({data:[],error:null}),
    ids.length?
      db.from("product_quantity_tiers").select("product_id,min_qty,price_ht")
        .eq("verified",true).in("product_id",ids):
      Promise.resolve({data:[],error:null}),
  ]);
  if(individual.error||common.error)throw new Error("Tarifs des produits indisponibles.");
  function priceAt(productId:string,qty:number,base:number){
    const negotiated=(individual.data||[]).filter(x=>x.product_id===productId&&x.min_qty<=qty).sort((a,b)=>b.min_qty-a.min_qty)[0];
    if(negotiated)return Number(negotiated.price_ht);
    const general=(common.data||[]).filter(x=>x.product_id===productId&&x.min_qty<=qty).sort((a,b)=>b.min_qty-a.min_qty)[0];
    return Number(general?.price_ht??base);
  }

  return <div className="space-y-6 pb-12">
    <nav className="text-xs text-[#6b7b87]"><Link href="/catalogue" className="hover:underline">Espace officine</Link> / Mes marques implantées</nav>
    <header className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9">
      <p className="text-xs font-bold uppercase tracking-widest text-[#e9bd8c]">Gestion de vos gammes</p>
      <h1 className="mt-2 text-3xl font-extrabold">Mes marques implantées</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dae4ea]">Retrouvez les marques déjà référencées dans votre officine et les produits éligibles au réassort. Une demande est suivie par TR1 en qualité d'intermédiaire.</p>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[#5d7080]">{installed.length} marque(s) implantée(s) dans votre pharmacie</p>
      <Link href="/catalogue/decouvrir" className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-3 text-sm font-semibold text-[#284f67]">
        Découvrir de nouvelles marques <ArrowRight size={15}/>
      </Link>
    </div>
    {installed.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {installed.map(b=><article key={b.brand_id} className="rounded-xl border border-[#dce5e8] bg-white p-5">
        <div className="flex items-start justify-between gap-2">
          <Building2 className="text-[#345c73]" size={23}/>
          <span className="rounded-md bg-[#eaf3ed] px-2 py-1 text-[11px] font-bold text-[#397151]">Implantée</span>
        </div>
        <h2 className="mt-4 text-xl font-bold text-[#142941]">{b.name}</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-[#6c7d89]">{b.description||"Marque suivie par TR1 PHARMA."}</p>
        <p className="mt-3 text-xs font-medium text-[#778791]">{b.reorder_ready?"Réassort disponible sur les références publiées":"Réassort en préparation : catalogue et tarifs en cours de validation"}</p>
        <Link href={"/catalogue/mes-marques?marque="+b.brand_id}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1a526f] hover:underline">
          <Package size={15}/> Voir les références <ArrowRight size={14}/>
        </Link>
      </article>)}
    </div>:<section className="rounded-xl border bg-white p-8">
      <h2 className="text-lg font-bold">Aucune implantation confirmée</h2>
      <p className="mt-2 text-sm text-[#6a7a86]">Contactez TR1 pour mettre à jour les marques déjà présentes dans votre officine.</p>
    </section>}
    {installed.length>0?<section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <div><h2 className="text-xl font-bold">{selected?selected.name:"Produits de vos marques implantées"}</h2>
          <p className="mt-1 text-xs text-[#798792]">{products.length} produit(s) actuellement autorisé(s) et publié(s)</p></div>
        {selected?<Link href="/catalogue/mes-marques" className="text-xs font-semibold underline">Toutes mes marques</Link>:null}
      </div>
      {products.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map(x=><article key={x.id} className="flex flex-col overflow-hidden rounded-xl border bg-white">
          <div className="flex h-40 items-center justify-center bg-[#f7f9f9] p-4">
            {x.image_url?<img src={x.image_url} alt={x.name} className="h-full max-w-full object-contain"/>:
            <Package size={32} className="text-[#9daab2]"/>}
          </div>
          <div className="flex-1 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#677d8e]">{brandById.get(x.brand_id)?.name||"Marque"}</p>
            <h3 className="mt-2 text-lg font-bold">{x.name}</h3>
            <p className="mt-1 text-xs text-[#71818c]">{x.format||x.sku} · EAN {x.ean||"—"}</p>
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#6c7b87]">{x.description||"Fiche en cours de finalisation."}</p>
            <p className="mt-4 text-xl font-extrabold">{priceAt(x.id,x.min_qty,Number(x.price_ht)).toFixed(2)} € <span className="text-xs font-normal">HT / unité au minimum</span></p>
          </div>
          {pharmacyId?<form action={submitProductRequest} className="flex gap-2 border-t bg-[#f8fafb] p-4">
            <input type="hidden" name="pharmacy_id" value={pharmacyId}/>
            <input type="hidden" name="product_id" value={x.id}/>
            <label className="min-w-0 text-xs font-semibold">Unités
              <input name="quantity" type="number" min={x.min_qty} step={x.qty_step}
                defaultValue={x.min_qty} required className="mt-1 w-20 rounded-lg border bg-white p-2.5 text-sm"/>
            </label>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#142941] px-3 py-2.5 text-xs font-semibold text-white"><RefreshCw size={14}/> Demander un réassort</button>
          </form>:null}
        </article>)}
      </div>:<div className="rounded-xl border border-[#e2e8eb] bg-white p-6">
        <h3 className="text-base font-bold text-[#142941]">Réassort non encore disponible</h3>
        <p className="mt-2 text-sm leading-6 text-[#71808c]">Cette marque peut être réellement implantée sans que ses fiches et tarifs soient encore validés dans TR1. Son implantation est conservée ; aucun tarif provisoire ni commande n'est affiché.</p>
      </div>}
      <Link href="/catalogue/mes-demandes" className="inline-block text-sm font-semibold underline">Suivre mes demandes de réassort</Link>
    </section>:null}
    <p className="text-xs leading-5 text-[#7d8992]">TR1 PHARMA agit comme intermédiaire commercial. La disponibilité, la vente, la livraison et la facturation relèvent du fournisseur. Une demande de réassort ne vaut pas confirmation de vente.</p>
  </div>;
}
