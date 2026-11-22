import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { authorizeBrandAction, setBrandAccessActiveAction } from "../actions";
import { linkPharmacyAccountAction, disablePharmacyAccountAction } from "../catalogue-actions";

export default async function AccessPage({searchParams}:{searchParams:Promise<{compte?:string}>}) {
  const { db } = await requireOwner();
  const qs = await searchParams;
  const [pharmacies, brands, access, members] = await Promise.all([
    db.from("pharmacies").select("id,name").order("name"),
    db.from("brands").select("id,name").order("name"),
    db.from("pharmacy_brand_access").select("pharmacy_id,brand_id,active"),
    db.from("pharmacy_memberships").select("pharmacy_id,user_id,active").order("created_at",{ascending:false}),
  ]);
  if (pharmacies.error || brands.error || access.error || members.error)
    throw new Error("Impossible de charger les autorisations.");
  const phs=pharmacies.data??[], bs=brands.data??[];
  return <div className="space-y-7">
    <div><h1 className="text-3xl font-bold">Accès catalogue B2B</h1>
      <p className="mt-2 text-sm text-[#69717d]">Accès accordés manuellement, pharmacie par pharmacie et marque par marque.</p></div>
    {qs.compte==="lie" ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Compte pharmacie associé et autorisé à se connecter.</p>:null}
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold">1. Relier un compte à une pharmacie</h2>
      <p className="mt-2 text-sm text-[#69717d]">Créer d'abord l'utilisateur et confirmer son email dans <Link href="https://supabase.com/dashboard/project/evkvbjnftffstcqxgard/auth/users" target="_blank" className="font-semibold underline">Supabase Auth V2</Link>, puis associer ici son adresse professionnelle. Aucun compte n'est créé automatiquement.</p>
      <form action={linkPharmacyAccountAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <select name="pharmacy_id" required className="rounded-lg border p-3 text-sm">
          <option value="">Choisir la pharmacie</option>{phs.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
        </select>
        <input name="email" type="email" required placeholder="Email du compte pharmacie" className="rounded-lg border p-3 text-sm"/>
        <button disabled={!phs.length} className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Associer le compte</button>
      </form>
      <div className="mt-5 divide-y rounded-lg border">
        {(members.data??[]).length ? members.data?.map(x=><div key={x.pharmacy_id+x.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <div><strong>{phs.find(p=>p.id===x.pharmacy_id)?.name||"Pharmacie"}</strong>
            <p className="text-xs text-[#69717d]">Compte {x.user_id.slice(0,8)} · {x.active?"Actif":"Suspendu"}</p></div>
          {x.active?<form action={disablePharmacyAccountAction}>
            <input type="hidden" name="pharmacy_id" value={x.pharmacy_id}/>
            <input type="hidden" name="user_id" value={x.user_id}/>
            <button className="rounded-lg border px-3 py-2 text-xs font-semibold">Suspendre cet accès</button>
          </form>:null}
        </div>):<p className="p-4 text-sm text-[#69717d]">Aucun compte lié pour le moment.</p>}
      </div>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold">2. Autoriser les marques</h2>
      <p className="mt-2 text-sm text-[#69717d]">La marque doit être active et ses produits publiés pour apparaître dans le catalogue pharmacie.</p>
      <form action={authorizeBrandAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <select name="pharmacy_id" required className="rounded-lg border p-3 text-sm">
          <option value="">Pharmacie</option>{phs.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
        </select>
        <select name="brand_id" required className="rounded-lg border p-3 text-sm">
          <option value="">Marque</option>{bs.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
        </select>
        <button disabled={!phs.length||!bs.length} className="rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Autoriser la marque</button>
      </form>
      <div className="mt-5 divide-y rounded-lg border">
        {(access.data??[]).length ? access.data?.map(x=><div key={x.pharmacy_id+"-"+x.brand_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div><strong className="text-sm">{phs.find(p=>p.id===x.pharmacy_id)?.name||"Pharmacie"}</strong>
            <p className="text-xs text-[#69717d]">{bs.find(b=>b.id===x.brand_id)?.name||"Marque"} · {x.active?"Autorisé":"Suspendu"}</p></div>
          <form action={setBrandAccessActiveAction}>
            <input type="hidden" name="pharmacy_id" value={x.pharmacy_id}/>
            <input type="hidden" name="brand_id" value={x.brand_id}/>
            <input type="hidden" name="active" value={x.active?"false":"true"}/>
            <button className="rounded-lg border px-3 py-2 text-xs font-semibold">{x.active?"Suspendre":"Réactiver"}</button>
          </form>
        </div>):<p className="p-4 text-sm text-[#69717d]">Aucune marque autorisée.</p>}
      </div>
    </section>
  </div>;
}
