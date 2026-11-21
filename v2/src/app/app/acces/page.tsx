import { requireOwner } from "@/lib/auth";
import { authorizeBrandAction, setBrandAccessActiveAction } from "../actions";

export default async function AccessPage() {
  const { db } = await requireOwner();
  const [pharmacies, brands, access] = await Promise.all([
    db.from("pharmacies").select("id,name").order("name"),
    db.from("brands").select("id,name").order("name"),
    db.from("pharmacy_brand_access").select("pharmacy_id,brand_id,active"),
  ]);
  if (pharmacies.error || brands.error || access.error) throw new Error("Impossible de charger les autorisations.");
  const phs=pharmacies.data??[], bs=brands.data??[];
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Accès catalogue B2B</h1>
      <p className="mt-2 text-sm text-[#69717d]">Chaque pharmacie ne consulte que les marques explicitement autorisées.</p></div>
    <form action={authorizeBrandAction} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-3">
      <select name="pharmacy_id" required className="rounded-lg border p-3">
        <option value="">Pharmacie</option>{phs.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
      </select>
      <select name="brand_id" required className="rounded-lg border p-3">
        <option value="">Marque</option>{bs.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
      </select>
      <button disabled={!phs.length || !bs.length} className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Autoriser l'accès</button>
    </form>
    <div className="overflow-hidden rounded-xl border bg-white">
      {(access.data??[]).length ? access.data?.map(x=><div key={x.pharmacy_id+"-"+x.brand_id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><strong>{phs.find(p=>p.id===x.pharmacy_id)?.name||"Pharmacie"}</strong>
          <p className="text-sm text-[#69717d]">{bs.find(b=>b.id===x.brand_id)?.name||"Marque"} · {x.active?"Autorisé":"Suspendu"}</p></div>
        <form action={setBrandAccessActiveAction}>
          <input type="hidden" name="pharmacy_id" value={x.pharmacy_id}/>
          <input type="hidden" name="brand_id" value={x.brand_id}/>
          <input type="hidden" name="active" value={x.active?"false":"true"}/>
          <button className="rounded-lg border px-3 py-2 text-xs font-semibold">{x.active?"Suspendre":"Réactiver"}</button>
        </form>
      </div>) : <p className="p-6 text-sm text-[#69717d]">Aucun accès accordé.</p>}
    </div>
    <p className="text-xs text-[#69717d]">La création d'un utilisateur pharmacie et son rattachement restent une opération administrateur distincte, après vérification professionnelle.</p>
  </div>;
}
