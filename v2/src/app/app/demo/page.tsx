import Link from "next/link";
import {requireOwner} from "@/lib/auth";
export default async function AdminVitaloraDemo() {
  const {db}=await requireOwner();
  const [products,tierCount,requests,items,access,pharmacies]=await Promise.all([
    db.from("demo_products").select("id,name,sku,demo_price_ht,active,image_url").order("name"),
    db.from("demo_price_tiers").select("product_id",{count:"exact",head:true}),
    db.from("demo_requests").select("id,created_at,user_id,pharmacy_id,total_ht,status").order("created_at",{ascending:false}).limit(50),
    db.from("demo_request_items").select("request_id,product_name,quantity,total_ht").limit(400),
    db.from("demo_catalogue_access").select("pharmacy_id,active,brand_id"),
    db.from("pharmacies").select("id,name,city"),
  ]);
  if([products,tierCount,requests,items,access,pharmacies].some(x=>x.error))
    throw new Error("Cockpit de démonstration indisponible.");
  const reqs=requests.data??[],pharm=new Map((pharmacies.data??[]).map(x=>[x.id,x.name]));
  const active=(access.data??[]).filter(x=>x.active);
  return <div className="space-y-6">
    <header>
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#ad4b08]">Environnement fictif · cloisonné</p>
      <h1 className="mt-2 text-3xl font-bold">Pilote Vitalora — Démonstration</h1>
      <p className="mt-2 text-sm text-[#69717d]">Ce cockpit n'affiche aucune vraie commande et ne transmet rien au fournisseur. Les prix et conditions de test ne sont pas commerciaux.</p>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Références démo",products.data?.length??0],
        ["Paliers fictifs",tierCount.count??0],
        ["Pharmacies tests",active.length],
        ["Demandes simulées",reqs.length],
      ].map(([name,num])=><div key={name} className="rounded-xl border bg-white p-5">
        <p className="text-xs font-semibold text-[#69717d]">{name}</p>
        <p className="mt-3 text-3xl font-extrabold">{num}</p></div>)}
    </div>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Accès à la démonstration</h2>
      {(active.length)?<div className="mt-3 space-y-2">
        {active.map(a=><p key={a.pharmacy_id} className="text-sm">
          <strong>{pharm.get(a.pharmacy_id)??"Pharmacie"}</strong> · Accès démo actif
        </p>)}</div>:<p className="mt-3 text-sm text-[#69717d]">Aucune pharmacie test autorisée.</p>}
      <p className="mt-4 text-xs text-[#69717d]">Le catalogue réel Vitalora reste désactivé. Le rôle propriétaire et les pharmacies ont des sessions différentes.</p>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Demandes de simulation</h2>
      <div className="mt-4 space-y-3">
        {reqs.length?reqs.map(r=><article key={r.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div><h3 className="font-semibold">{pharm.get(r.pharmacy_id)||"Pharmacie"} · {r.id.slice(0,8)}</h3>
              <p className="mt-1 text-xs text-[#69717d]">{new Date(r.created_at).toLocaleString("fr-FR")}</p></div>
            <div className="text-right"><strong>{Number(r.total_ht).toFixed(2)} € HT fictifs</strong>
              <p className="mt-1 text-xs font-bold text-[#ad4b08]">Simulation uniquement</p></div>
          </div>
          <div className="mt-3 divide-y border-t">
            {(items.data??[]).filter(x=>x.request_id===r.id).map((line,i)=>
              <p key={i} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                <span>{line.product_name} · {line.quantity} u.</span><strong>{Number(line.total_ht).toFixed(2)} €</strong>
              </p>)}
          </div>
        </article>):<p className="text-sm text-[#69717d]">Aucune demande fictive enregistrée. Teste depuis la connexion pharmacie.</p>}
      </div>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Produits du pilote</h2>
      <p className="mt-2 text-sm text-[#69717d]">18 références provenant du catalogue historique. Fiches commerciales non validées ; tarifs et simulations totalement fictifs.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(products.data??[]).map(x=><div key={x.id} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="h-16 w-16 shrink-0 rounded-lg bg-[#f8f8f7] p-1">
            {x.image_url?<img src={x.image_url} alt="" className="h-full w-full object-contain"/>:null}
          </div>
          <div><strong className="text-xs">{x.name}</strong>
            <p className="mt-1 text-xs text-[#69717d]">{Number(x.demo_price_ht).toFixed(2)} € HT — fictif</p></div>
        </div>)}
      </div>
      <Link href="/app/qualite?marque=vitalora" className="mt-5 inline-block text-sm font-bold underline">Contrôle qualité des fiches Vitalora réelles</Link>
    </section>
  </div>;
}
