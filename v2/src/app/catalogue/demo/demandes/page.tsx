import Link from "next/link";
import {requireVitaloraDemo} from "@/lib/vitalora-demo";
export default async function DemoRequests({searchParams}:{searchParams:Promise<{simulee?:string}>}) {
  const {db,pharmacyId,user,brandId}=await requireVitaloraDemo();
  const q=await searchParams;
  if(!pharmacyId)return <section className="rounded-xl border bg-white p-8">
    <h1 className="text-2xl font-bold">Accès test non actif</h1>
    <Link href="/catalogue/demo" className="mt-3 inline-block underline">Retour à la démo</Link>
  </section>;
  const {data,error}=await db.from("demo_requests")
    .select("id,created_at,status,total_ht").eq("user_id",user.id)
    .eq("pharmacy_id",pharmacyId).eq("brand_id",brandId)
    .order("created_at",{ascending:false}).limit(50);
  if(error)throw new Error("Historique des simulations indisponible.");
  const reqs=data??[],ids=reqs.map(x=>x.id);
  const items=ids.length?await db.from("demo_request_items")
    .select("request_id,product_name,quantity,unit_price_ht,total_ht")
    .in("request_id",ids):{data:[],error:null};
  if(items.error)throw new Error("Détail des demandes fictives indisponible.");
  return <div className="space-y-6">
    <Link href="/catalogue/demo" className="text-sm font-semibold underline">← Catalogue Vitalora test</Link>
    <header className="rounded-xl border border-[#e4c89f] bg-[#fff8ec] p-5">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#995219]">Mode simulation</p>
      <h1 className="mt-2 text-3xl font-bold">Demandes fictives Vitalora</h1>
      <p className="mt-2 text-sm">Ces demandes restent exclusivement dans la base de démonstration. Aucune transmission fournisseur.</p>
    </header>
    {q.simulee==="1"?<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
      Demande fictive enregistrée avec succès. Aucun bon de commande réel n'a été créé.</p>:null}
    {reqs.length?reqs.map(r=><section key={r.id} className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">Simulation n° {r.id.slice(0,8).toUpperCase()}</h2>
          <p className="mt-1 text-xs text-[#69717d]">{new Date(r.created_at).toLocaleString("fr-FR")}</p></div>
        <div className="text-right"><p className="text-xl font-extrabold">{Number(r.total_ht).toFixed(2)} € HT</p>
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#995219]">Fictive — non transmise</p></div>
      </div>
      <div className="mt-4 divide-y border-t">
        {(items.data??[]).filter(x=>x.request_id===r.id).map((x,i)=>
          <p key={i} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
            <span>{x.product_name} · {x.quantity} u. × {Number(x.unit_price_ht).toFixed(2)} €</span>
            <strong>{Number(x.total_ht).toFixed(2)} € HT</strong>
          </p>)}
      </div>
    </section>):<p className="rounded-xl border bg-white p-6 text-sm text-[#69717d]">Aucune simulation enregistrée.</p>}
    <Link href="/catalogue/demo/panier" className="inline-block rounded-lg border px-4 py-3 text-sm font-bold">Voir le panier test</Link>
  </div>;
}
