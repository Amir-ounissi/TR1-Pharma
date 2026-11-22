import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createBrandAction, setBrandActiveAction } from "../actions";
export default async function BrandsPage() {
  const { db } = await requireOwner();
  const [b,p]=await Promise.all([
    db.from("brands").select("id,name,slug,active").order("name"),
    db.from("products").select("id,brand_id,published,requires_review"),
  ]);
  if(b.error||p.error)throw new Error("Impossible de charger les marques.");
  const brands=b.data||[],products=p.data||[];
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Mes marques</h1>
      <p className="mt-2 text-sm text-[#69717d]">Gestion des gammes, des conditions et de la visibilité dans le catalogue professionnel.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/app/produits" className="underline">Catalogue produits</Link>
        <Link href="/app/conditions" className="underline">Conditions commerciales</Link>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {brands.map(x=>{
        const items=products.filter(p=>p.brand_id===x.id);
        return <section key={x.id} className="rounded-xl border bg-white p-5">
          <div className="flex justify-between gap-3">
            <div><h2 className="text-xl font-bold">{x.name}</h2><p className="mt-1 text-xs text-[#69717d]">{x.slug}</p></div>
            <span className="self-start text-xs font-semibold text-[#69717d]">{x.active?"Active":"Brouillon"}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <span><strong>{items.length}</strong> références</span>
            <span><strong>{items.filter(p=>p.published).length}</strong> publiées</span>
            <span><strong>{items.filter(p=>p.requires_review).length}</strong> à vérifier</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={"/app/produits?marque="+x.id} className="rounded-lg border px-3 py-2 text-xs font-semibold">Produits</Link>
            <Link href={"/app/conditions?marque="+x.id} className="rounded-lg border px-3 py-2 text-xs font-semibold">Conditions</Link>
            <form action={setBrandActiveAction}>
              <input type="hidden" name="brand_id" value={x.id}/>
              <input type="hidden" name="active" value={x.active?"false":"true"}/>
              <button className="rounded-lg bg-[#142941] px-3 py-2 text-xs font-bold text-white">{x.active?"Désactiver":"Activer la marque"}</button>
            </form>
          </div>
          {!x.active?<p className="mt-4 text-xs text-[#69717d]">Invisible dans le catalogue tant qu'elle est inactive.</p>:null}
        </section>;
      })}
    </div>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Ajouter une marque</h2>
      <form action={createBrandAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <input name="name" required minLength={2} placeholder="Nom de la marque" className="rounded-lg border p-3 text-sm"/>
        <input name="slug" required pattern="[a-z0-9-]+" placeholder="identifiant-url" className="rounded-lg border p-3 text-sm"/>
        <button className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white">Créer la marque en brouillon</button>
      </form>
    </section>
  </div>;
}
