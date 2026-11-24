import Link from "next/link";
import {requireOwner} from "@/lib/auth";
import {saveBrandImplantationAction,updateDirectoryVisibilityAction,updateInterestStatusAction} from "./actions";
import {Building2,ClipboardList,Compass,ShieldCheck} from "lucide-react";

export default async function OwnerBrandInstallations({searchParams}:{
  searchParams:Promise<{pharmacie?:string;enregistre?:string;visibilite?:string;demande?:string}>
}){
  const {db}=await requireOwner();
  const qs=await searchParams;
  const [phResult,brandResult,portfolioResult,directoryResult,interestResult,offerResult]=await Promise.all([
    db.from("pharmacies").select("id,name,city").order("name"),
    db.from("brands").select("id,name,slug").order("name"),
    db.from("pharmacy_brand_relationships").select("pharmacy_id,brand_id,status,source_reference,owner_notes,implanted_at"),
    db.from("brand_discovery_directory").select("brand_id,discoverable,short_description"),
    db.from("brand_referencing_interests").select("id,brand_id,pharmacy_id,offer_id,note,created_at,status").order("created_at",{ascending:false}).limit(100),
    db.from("brand_implantation_offers").select("id,title,brand_id"),
  ]);
  if([phResult,brandResult,portfolioResult,directoryResult,interestResult,offerResult].some(x=>x.error))
    throw new Error("Impossible de charger les implantations et demandes.");
  const pharmacies=phResult.data??[],brands=brandResult.data??[];
  const portfolio=portfolioResult.data??[],directory=directoryResult.data??[],interests=interestResult.data??[],offers=offerResult.data??[];
  const pharmacy=pharmacies.find(p=>p.id===qs.pharmacie)??pharmacies[0];
  const lookup=(brandId:string)=>portfolio.find(p=>p.pharmacy_id===pharmacy?.id&&p.brand_id===brandId);
  const brandName=(id:string)=>brands.find(b=>b.id===id)?.name||"Marque";
  const pharmacyName=(id:string)=>pharmacies.find(p=>p.id===id)?.name||"Pharmacie";
  const implanted=pharmacy?brands.filter(b=>lookup(b.id)?.status==="implanted").length:0;
  return <div className="space-y-7 pb-12">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a65b29]">Pilotage TR1 · Espace propriétaire</p>
      <h1 className="mt-2 text-3xl font-extrabold">Implantations par pharmacie</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6c7c88]">
        Chaque marque est classée indépendamment des accès techniques au catalogue.
        Le statut « implantée » doit être justifié par une commande, un relevé terrain ou une confirmation fiable.
      </p>
    </header>
    <div className="grid gap-3 md:grid-cols-3">
      {[
        ["Marques implantées",implanted,Building2],
        ["Marques proposées",directory.filter(d=>d.discoverable).length,Compass],
        ["Demandes de présentation",interests.filter(i=>i.status==="received").length,ClipboardList],
      ].map(([title,count,Icon])=>{
        const Picture=Icon as typeof Building2;
        return <div key={String(title)} className="rounded-xl border bg-white p-5">
          <Picture size={20} className="text-[#54778b]"/>
          <p className="mt-3 text-xs text-[#6e7f8b]">{String(title)}</p>
          <p className="mt-2 text-3xl font-extrabold">{String(count)}</p>
        </div>;
      })}
    </div>
    {qs.enregistre==="1"||qs.visibilite==="1"||qs.demande==="1"?
      <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Modifications enregistrées.</p>:null}
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">1. Situation d'une officine</h2>
      <form method="GET" action="/app/implantations" className="mt-4 flex flex-wrap gap-2">
        <select name="pharmacie" defaultValue={pharmacy?.id||""}
          className="min-w-56 flex-1 rounded-lg border bg-white p-3 text-sm" required>
          {pharmacies.map(p=><option key={p.id} value={p.id}>{p.name} {p.city?"— "+p.city:""}</option>)}
        </select>
        <button className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-semibold text-white">Afficher</button>
      </form>
      {pharmacy?<div className="mt-5 divide-y">
        {brands.map(b=>{
          const r=lookup(b.id);
          return <form action={saveBrandImplantationAction} key={b.id} className="py-5">
            <input type="hidden" name="pharmacy_id" value={pharmacy.id}/>
            <input type="hidden" name="brand_id" value={b.id}/>
            <div className="grid gap-3 lg:grid-cols-[minmax(145px,1fr)_170px_minmax(180px,1.2fr)_minmax(180px,1.2fr)_auto] lg:items-end">
              <div><strong className="text-sm">{b.name}</strong>
                <p className="mt-1 text-xs text-[#7a8993]">{r?.status==="implanted"?"Déjà implantée":r?.status==="not_implanted"?"Non implantée":"Situation à confirmer"}</p></div>
              <label className="grid gap-1 text-xs font-semibold">Statut
                <select name="status" defaultValue={r?.status??"unconfirmed"} className="rounded-lg border bg-white p-2.5 text-sm">
                  <option value="unconfirmed">À confirmer</option><option value="implanted">Implantée</option>
                  <option value="not_implanted">Non implantée</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold">Preuve d'implantation
                <input name="source_reference" defaultValue={r?.source_reference??""}
                  placeholder="Commande, visite, accord pharmacie…"
                  className="rounded-lg border p-2.5 text-sm"/>
              </label>
              <label className="grid gap-1 text-xs font-semibold">Note interne
                <input name="owner_notes" defaultValue={r?.owner_notes??""} className="rounded-lg border p-2.5 text-sm"
                  placeholder="Informations à vérifier"/>
              </label>
              <button className="rounded-lg border border-[#142941] px-4 py-2.5 text-xs font-bold text-[#142941]">Enregistrer</button>
            </div>
          </form>;
        })}
      </div>:<p className="mt-5 text-sm text-[#778690]">Aucune pharmacie disponible.</p>}
    </section>
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">2. Marques visibles dans « Découvrir »</h2>
      <p className="mt-2 text-sm leading-6 text-[#6e7f8b]">Ce répertoire ne donne pas accès aux prix ni aux produits commerciaux protégés. Désactive les marques que tu ne souhaites pas présenter.</p>
      <div className="mt-5 divide-y">
        {brands.map(b=>{
          const d=directory.find(x=>x.brand_id===b.id);
          return <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><p className="text-sm font-bold">{b.name}</p><p className="mt-1 text-xs text-[#798894]">{d?.discoverable?"Visible dans la découverte":"Masquée"}</p></div>
            {d?<form action={updateDirectoryVisibilityAction}>
              <input type="hidden" name="brand_id" value={b.id}/>
              <input type="hidden" name="discoverable" value={d.discoverable?"false":"true"}/>
              <button className="rounded-lg border px-4 py-2.5 text-xs font-semibold">{d.discoverable?"Masquer":"Rendre visible"}</button>
            </form>:<span className="text-xs text-[#7a8791]">Marque non ajoutée au répertoire</span>}
          </div>;
        })}
      </div>
    </section>
    <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">3. Demandes de référencement reçues</h2>
      <p className="mt-2 text-sm text-[#71808c]">Ces demandes arrivent uniquement dans ton cockpit. Elles ne sont ni des commandes ni des transmissions automatiques aux fournisseurs.</p>
      <div className="mt-5 divide-y">
        {interests.length?interests.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><p className="font-semibold">{pharmacyName(i.pharmacy_id)} · {brandName(i.brand_id)}</p>
            <p className="mt-1 text-xs text-[#72818c]">{new Date(i.created_at).toLocaleString("fr-FR")} · {i.offer_id?"Offre souhaitée : "+(offers.find(o=>o.id===i.offer_id)?.title||"Offre à retrouver")+" · ":""}{i.note||"Aucune précision"}</p></div>
          <form action={updateInterestStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="interest_id" value={i.id}/>
            <select name="status" defaultValue={i.status} className="rounded-lg border bg-white p-2 text-sm">
              <option value="received">Reçue</option><option value="under_review">En cours</option><option value="closed">Clôturée</option>
            </select>
            <button className="rounded-lg border px-3 py-2 text-xs font-bold">Enregistrer</button>
          </form>
        </div>):<p className="py-6 text-sm text-[#71808c]">Aucune demande de référencement pour le moment.</p>}
      </div>
    </section>
    <p className="flex items-start gap-2 text-xs text-[#72808b]"><ShieldCheck size={16} className="shrink-0"/>L'implantation et les droits d'accès sont indépendants : enregistrer « implantée » ne publie pas automatiquement une marque, n'active aucun tarif et ne crée aucune commande.</p>
    <Link href="/app/acces" className="inline-block text-sm font-semibold text-[#1b5677] underline">Gérer séparément les autorisations B2B</Link>
  </div>;
}
