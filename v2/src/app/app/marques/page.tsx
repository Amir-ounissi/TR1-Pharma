import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createBrandAction, setBrandActiveAction } from "../actions";
export default async function BrandsPage() {
  const { db } = await requireOwner();
  const { data, error } = await db.from("brands").select("id,name,slug,active").order("name");
  if (error) throw new Error("Impossible de charger les marques.");
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Mes marques</h1>
      <p className="mt-2 text-sm text-[#69717d]">Une seule fiche par marque, avec ses produits et ses pharmacies.</p>
      <Link href="/app/produits" className="mt-3 inline-block font-semibold underline">Gérer les références produits</Link></div>
    <form action={createBrandAction} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-3">
      <input name="name" required minLength={2} placeholder="Nom de la marque" className="rounded-lg border p-3"/>
      <input name="slug" required pattern="[a-z0-9-]+" placeholder="identifiant-url" className="rounded-lg border p-3"/>
      <button className="rounded-lg bg-[#142941] px-4 py-3 font-semibold text-white">Créer la marque</button>
    </form>
    <div className="overflow-hidden rounded-xl border bg-white">
      {(data ?? []).length ? data?.map(x=><div key={x.id} className="flex justify-between border-b px-5 py-4">
        <strong>{x.name}</strong><form action={setBrandActiveAction} className="flex items-center gap-3">
          <input type="hidden" name="brand_id" value={x.id}/>
          <input type="hidden" name="active" value={x.active ? "false" : "true"}/>
          <span className="text-sm text-[#69717d]">{x.active ? "Active" : "Brouillon"}</span>
          <button className="rounded-lg border px-3 py-2 text-xs font-semibold">{x.active ? "Masquer" : "Publier"}</button>
        </form>
      </div>) : <p className="p-6 text-sm text-[#69717d]">Aucune marque créée.</p>}
    </div>
  </div>;
}
