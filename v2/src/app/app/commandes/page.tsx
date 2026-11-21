import { requireOwner } from "@/lib/auth";
export default async function OrdersPage() {
  const { db } = await requireOwner();
  const { data, error } = await db.from("order_requests")
    .select("id,created_at,status,total_ht,origin").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Impossible de charger les demandes.");
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Demandes et commandes</h1>
    <p className="text-sm text-[#69717d]">Les demandes B2B sont à valider avant transmission à la marque concernée. Pas de facturation automatique.</p>
    <div className="rounded-xl border bg-white">
      {(data ?? []).length ? data?.map(r=><div key={r.id} className="flex justify-between gap-3 border-b p-5 text-sm">
        <div><strong>Demande {r.id.slice(0,8)}</strong><p className="text-[#69717d]">{new Date(r.created_at).toLocaleDateString("fr-FR")} · {r.origin}</p></div>
        <div className="text-right"><p className="font-bold">{Number(r.total_ht).toFixed(2)} € HT</p><p className="text-[#69717d]">{r.status}</p></div>
      </div>) : <p className="p-6 text-sm text-[#69717d]">Aucune demande pour le moment.</p>}
    </div>
  </div>;
}
