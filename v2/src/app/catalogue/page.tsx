import Link from "next/link";
import { requirePharmacy } from "@/lib/auth";
import { submitProductRequest } from "./request-actions";

export default async function PharmacyCatalogue() {
  const { db, user } = await requirePharmacy();
  const { data: memberships, error: membershipError } = await db.from("pharmacy_memberships")
    .select("pharmacy_id,pharmacies(name,city)").eq("user_id", user.id).eq("active", true).limit(1);
  if (membershipError) throw new Error("Impossible de vérifier votre pharmacie.");
  const membership = memberships?.[0];
  if (!membership) return <section className="rounded-xl border bg-white p-8">
    <h1 className="text-2xl font-bold">Accès en attente</h1>
    <p className="mt-3 text-sm text-[#69717d]">Votre compte doit être rattaché à une pharmacie validée avant de consulter les produits.</p>
  </section>;
  const pharmacyId=membership.pharmacy_id;
  const {data:grants,error:grantError}=await db.from("pharmacy_brand_access")
    .select("brand_id").eq("pharmacy_id",pharmacyId).eq("active",true);
  if(grantError)throw new Error("Autorisations indisponibles.");
  const ids=(grants||[]).map(g=>g.brand_id);
  const [productResult,brandResult]=await Promise.all([
    ids.length?db.from("products").select("id,brand_id,name,sku,ean,description,format,image_url,price_ht,min_qty,qty_step").eq("published",true).in("brand_id",ids).order("name").limit(200):Promise.resolve({data:[],error:null}),
    ids.length?db.from("brands").select("id,name,active").eq("active",true).in("id",ids):Promise.resolve({data:[],error:null}),
  ]);
  if(productResult.error||brandResult.error)throw new Error("Catalogue indisponible.");
  const activeBrands=new Map((brandResult.data||[]).map(b=>[b.id,b.name]));
  const products=(productResult.data||[]).filter(x=>activeBrands.has(x.brand_id));
  const productIds=products.map(p=>p.id);
  const [contractPrices,globalTiers]=await Promise.all([
    productIds.length?db.from("price_rules").select("product_id,min_qty,price_ht").eq("pharmacy_id",pharmacyId).in("product_id",productIds):Promise.resolve({data:[],error:null}),
    productIds.length?db.from("product_quantity_tiers").select("product_id,min_qty,price_ht,verified").in("product_id",productIds).eq("verified",true):Promise.resolve({data:[],error:null}),
  ]);
  if(contractPrices.error||globalTiers.error)throw new Error("Tarifs indisponibles.");
  function priceAt(productId:string,qty:number,base:number) {
    const individual=(contractPrices.data||[]).filter(x=>x.product_id===productId&&x.min_qty<=qty).sort((a,b)=>b.min_qty-a.min_qty);
    if(individual.length)return Number(individual[0].price_ht);
    const published=(globalTiers.data||[]).filter(x=>x.product_id===productId&&x.min_qty<=qty).sort((a,b)=>b.min_qty-a.min_qty);
    return published.length?Number(published[0].price_ht):base;
  }
  return <div className="space-y-7">
    <div><p className="text-xs font-bold uppercase tracking-wider text-[#ad4b08]">Espace réservé · TR1 PHARMA</p>
      <h1 className="mt-2 text-3xl font-bold">Votre catalogue professionnel</h1>
      <p className="mt-2 text-sm text-[#69717d]">Uniquement les marques et les prix autorisés pour votre pharmacie.</p>
      <Link href="/catalogue/mes-demandes" className="mt-3 inline-block text-sm font-bold underline">Mes demandes de réassort</Link>
    </div>
    {products.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map(p=>{
        const unit=priceAt(p.id,p.min_qty,Number(p.price_ht));
        const breaks=(globalTiers.data||[]).filter(x=>x.product_id===p.id).sort((a,b)=>a.min_qty-b.min_qty);
        return <article key={p.id} className="overflow-hidden rounded-xl border bg-white">
          {p.image_url?<div className="flex h-44 items-center justify-center bg-white p-4"><img src={p.image_url} alt={p.name} className="h-full max-w-full object-contain"/></div>:null}
          <div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#ad4b08]">{activeBrands.get(p.brand_id)}</p>
            <h2 className="mt-2 text-lg font-bold">{p.name}</h2>
            <p className="mt-1 text-xs text-[#69717d]">{p.format||p.sku} · EAN {p.ean||"—"}</p>
            {p.description?<p className="mt-3 line-clamp-3 text-sm text-[#69717d]">{p.description}</p>:null}
            <p className="mt-4 text-xl font-bold">{unit.toFixed(2)} € <span className="text-xs font-normal">HT/unité au minimum</span></p>
            {breaks.length?<p className="mt-2 text-xs text-[#69717d]">Paliers : {breaks.map(t=>`${t.min_qty} u. · ${Number(t.price_ht).toFixed(2)} €`).join(" · ")}</p>:null}
          </div>
          <form action={submitProductRequest} className="flex flex-wrap items-end gap-3 border-t bg-[#f7f7f6] p-4">
            <input type="hidden" name="pharmacy_id" value={pharmacyId}/>
            <input type="hidden" name="product_id" value={p.id}/>
            <label className="grid gap-1 text-xs font-bold">Quantité
              <input name="quantity" type="number" min={p.min_qty} step={p.qty_step} defaultValue={p.min_qty} required className="w-24 rounded-lg border bg-white p-2 text-sm"/>
            </label>
            <button className="min-h-10 flex-1 rounded-lg bg-[#142941] px-4 text-xs font-bold text-white">Demander un réassort</button>
          </form>
        </article>;
      })}
    </div>:<p className="rounded-xl border bg-white p-8 text-sm text-[#69717d]">Aucun produit publié pour vos marques autorisées.</p>}
    <p className="text-xs leading-5 text-[#69717d]">Les prix définitifs sont recalculés au moment de la demande selon la quantité et les conditions commerciales de l'officine. Une demande ne vaut pas vente confirmée.</p>
  </div>;
}
