import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createPharmacyAction } from "../actions";
export default async function PharmaciesPage() {
  const { db } = await requireOwner();
  const { data, error } = await db.from("pharmacies").select("id,name,city,siret").order("name").limit(200);
  if (error) throw new Error("Impossible de charger les pharmacies.");
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Mes pharmacies</h1>
      <p className="mt-2 text-sm text-[#69717d]">Répertoire officinal unique, partagé entre les marques.</p>
      <Link href="/app/acces" className="mt-3 inline-block font-semibold underline">Gérer les marques autorisées par pharmacie</Link></div>
    <form action={createPharmacyAction} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-4">
      <input name="name" required minLength={2} placeholder="Nom de l'officine" className="rounded-lg border p-3"/>
      <input name="city" placeholder="Ville" className="rounded-lg border p-3"/>
      <input name="siret" pattern="[0-9]{14}" placeholder="SIRET facultatif" className="rounded-lg border p-3"/>
      <button className="rounded-lg bg-[#142941] px-4 py-3 font-semibold text-white">Ajouter l'officine</button>
    </form>
    <div className="overflow-hidden rounded-xl border bg-white">
      {(data ?? []).length ? data?.map(x=><div key={x.id} className="flex justify-between gap-4 border-b px-5 py-4">
        <strong>{x.name}</strong><span className="text-sm text-[#69717d]">{x.city || "Ville non précisée"}</span>
      </div>) : <p className="p-6 text-sm text-[#69717d]">Aucune pharmacie enregistrée.</p>}
    </div>
  </div>;
}
