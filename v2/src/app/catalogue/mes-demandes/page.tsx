import Link from "next/link";
import { requirePharmacy } from "@/lib/auth";
export default async function MyRequests({ searchParams }: { searchParams: Promise<{ envoye?:string }> }) {
  const { db, user } = await requirePharmacy();
  const { envoye } = await searchParams;
  const memberships = await db.from("pharmacy_memberships")
    .select("pharmacy_id").eq("user_id", user.id).eq("active", true);
  if (memberships.error) throw new Error("Accès pharmacie indisponible.");
  const ids=(memberships.data??[]).map(x=>x.pharmacy_id);
  const { data, error } = ids.length ? await db.from("order_requests")
    .select("id,created_at,total_ht,status,brand_id").in("pharmacy_id",ids)
    .order("created_at",{ascending:false}).limit(50) : {data:[],error:null};
  if (error) throw new Error("Impossible de charger les demandes.");
  return <div className="space-y-6">
    <Link href="/catalogue" className="text-sm font-semibold underline">← Retour au catalogue</Link>
    <h1 className="text-3xl font-bold">Mes demandes de commande</h1><p className="text-sm text-[#69717d]">TR1 transmet vos demandes aux marques. Pour une question, un litige, une formation ou un rendez-vous, utilisez <Link href="/catalogue/contact" className="font-bold underline">Mon interlocuteur TR1</Link>.</p>
    {envoye==="1"?<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Demande enregistrée. Elle doit encore être confirmée.</p>:null}
    <section className="rounded-xl border bg-white">
      {data?.length ? data.map(x=><div key={x.id} className="flex justify-between gap-3 border-b p-5">
        <div><strong>Demande {x.id.slice(0,8)}</strong><p className="mt-1 text-xs text-[#69717d]">{new Date(x.created_at).toLocaleDateString("fr-FR")}</p></div>
        <div className="text-right"><strong>{Number(x.total_ht).toFixed(2)} € HT</strong><p className="text-sm text-[#69717d]">{({received:"Reçue",verifying:"À vérifier",forwarded:"Transmise au laboratoire",confirmed:"Confirmée",closed:"Clôturée",declined:"Refusée"} as Record<string,string>)[x.status]??x.status}</p></div>
      </div>):<p className="p-6 text-sm text-[#69717d]">Aucune demande enregistrée.</p>}
    </section>
  </div>;
}
