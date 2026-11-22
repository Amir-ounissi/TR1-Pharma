import { requireOwner } from "@/lib/auth";
import { updateOrderRequestStatusAction } from "../catalogue-actions";
const labels:{[key:string]:string}={received:"Reçue",verifying:"À vérifier",forwarded:"Transmise",confirmed:"Confirmée",closed:"Clôturée",declined:"Refusée"};

export default async function OrdersPage() {
  const { db } = await requireOwner();
  const [orders,pharmacies,brands,items]=await Promise.all([
    db.from("order_requests").select("id,created_at,status,total_ht,origin,pharmacy_id,brand_id").order("created_at",{ascending:false}).limit(100),
    db.from("pharmacies").select("id,name"),
    db.from("brands").select("id,name"),
    db.from("order_items").select("request_id,product_name,quantity,unit_price_ht,line_total_ht").limit(400),
  ]);
  if(orders.error||pharmacies.error||brands.error||items.error)
    throw new Error("Impossible de charger les demandes.");
  const names=new Map((pharmacies.data||[]).map(x=>[x.id,x.name]));
  const brandNames=new Map((brands.data||[]).map(x=>[x.id,x.name]));
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Demandes et commandes</h1>
      <p className="mt-2 text-sm text-[#69717d]">Les demandes B2B sont à contrôler puis transmettre à la marque concernée. Aucun envoi ni facturation automatique.</p></div>
    <div className="space-y-4">
      {(orders.data||[]).length ? orders.data?.map(r=><article key={r.id} className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-bold">{names.get(r.pharmacy_id)||"Pharmacie"} · {brandNames.get(r.brand_id)||"Marque"}</h2>
            <p className="mt-1 text-xs text-[#69717d]">Demande {r.id.slice(0,8)} · {new Date(r.created_at).toLocaleDateString("fr-FR")} · {r.origin}</p></div>
          <div className="text-right"><p className="text-lg font-bold">{Number(r.total_ht).toFixed(2)} € HT</p>
            <p className="text-xs font-bold text-[#69717d]">{labels[r.status]||r.status}</p></div>
        </div>
        <div className="mt-4 divide-y border-y">
          {(items.data||[]).filter(x=>x.request_id===r.id).map((x,i)=><p key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
            <span>{x.product_name} · {x.quantity} u. × {Number(x.unit_price_ht).toFixed(2)} €</span>
            <strong>{Number(x.line_total_ht).toFixed(2)} € HT</strong>
          </p>)}
        </div>
        <form action={updateOrderRequestStatusAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="request_id" value={r.id}/>
          <select name="status" defaultValue={r.status} className="rounded-lg border p-2 text-sm">
            {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="transmission_confirmed" value="yes"/>Transmission réellement effectuée (si statut « Transmise »)</label>
          <button className="rounded-lg bg-[#142941] px-4 py-2 text-xs font-bold text-white">Enregistrer le statut</button>
        </form>
      </article>):<div className="rounded-xl border bg-white p-6 text-sm text-[#69717d]">Aucune demande reçue. Les nouvelles demandes du catalogue apparaîtront ici après validation.</div>}
    </div>
  </div>;
}
