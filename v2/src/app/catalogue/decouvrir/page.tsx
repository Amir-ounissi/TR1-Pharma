import Link from "next/link";
import {ArrowRight,Compass,FileText,Info,ShieldAlert} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";
import {requestBrandIntroductionAction} from "./actions";

export default async function PharmacyDiscovery({searchParams}:{searchParams:Promise<{demande?:string,erreur?:string}>}) {
  const {brands}=await loadPharmacyBrandDirectory();
  const params=await searchParams;
  const other=brands.filter(b=>b.status!=="implanted");
  return <div className="space-y-6 pb-12">
    <nav className="text-xs text-[#73818b]" aria-label="Fil d'Ariane"><Link href="/catalogue" className="hover:underline">Espace officine</Link> / Découvrir de nouvelles marques</nav>
    <div className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9">
      <p className="text-xs font-bold uppercase tracking-widest text-[#f3bd8d]">Développement de votre offre</p>
      <h1 className="mt-2 text-3xl font-extrabold">Découvrir de nouvelles marques</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#dde6eb]">Des gammes à découvrir pour compléter votre assortiment, avec des présentations et un accompagnement terrain proposés par TR1.</p>
      <p className="mt-3 text-xs text-[#bfcfd9]">{other.length} marques à découvrir ou à confirmer</p>
    </div>
    {params.demande==="1"?<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Votre intérêt a été enregistré dans le cockpit TR1. Il ne s'agit pas d'une commande.</p>:null}
    {params.erreur?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible d'enregistrer la demande. Vérifiez l'accès ou réessayez.</p>:null}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {other.map(b=><article key={b.brand_id} className="flex flex-col gap-4 rounded-xl border border-[#e0e6e8] bg-white p-6 shadow-[0_3px_12px_rgb(14_29_49/0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef3f5] text-[#284a60]"><Compass size={23}/></div>
          <span className="rounded-md bg-[#f6f2eb] px-2 py-1 text-[11px] font-semibold text-[#8a613c]">
            {b.status==="not_implanted"?"Non implantée":"Implantation à confirmer"}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#152c42]">{b.name}</h2>
          <p className="mt-2 min-h-16 text-sm leading-6 text-[#687a87]">{b.description||"Gamme en cours de présentation."}</p>
          <p className="mt-3 text-xs leading-5 text-[#71808b]">{b.catalogue_note||"Conditions à confirmer avec le fournisseur."}</p>
        </div>
        {b.slug==="noto"?<p className="flex gap-2 rounded-md bg-[#fff5ea] p-3 text-xs text-[#885126]"><ShieldAlert size={16} className="shrink-0"/>Certaines références contenant des cannabinoïdes sont soumises à une vérification juridique et ne sont pas proposées à la vente.</p>:null}
        <div className="mt-auto space-y-3 border-t border-[#edf0f1] pt-4">
          {b.showroom_available && b.demo_access ?
            <Link href={"/catalogue/althesia?marque="+b.slug} className="flex items-center gap-2 text-sm font-semibold text-[#1a5572] hover:underline">
              <FileText size={16}/> Consulter les fiches fournisseur <ArrowRight size={14}/>
            </Link>:
            <p className="flex items-center gap-2 text-xs text-[#7a8992]"><Info size={15}/> Fiches détaillées en préparation</p>}
          {b.interest_status?
            <p className="rounded-lg bg-[#edf5f0] px-4 py-3 text-xs font-semibold text-[#2b6847]">Intérêt enregistré auprès de TR1</p>
            :<form action={requestBrandIntroductionAction} className="space-y-2">
              <input name="brand_id" type="hidden" value={b.brand_id}/>
              <label className="block text-xs font-semibold text-[#5d707e]">Précision facultative
                <input name="note" maxLength={800} placeholder="Ex. recevoir les conditions de référencement"
                  className="mt-1 w-full rounded-lg border border-[#d6dfe3] px-3 py-2.5 text-sm"/>
              </label>
              <button className="w-full rounded-lg bg-[#142941] px-4 py-3 text-sm font-semibold text-white hover:bg-[#26425b]">Demander une présentation</button>
            </form>}
        </div>
      </article>)}
    </div>
    {!other.length?<p className="rounded-xl border bg-white p-8 text-sm text-[#6d7a86]">Toutes les marques de votre sélection sont déjà implantées.</p>:null}
    <p className="text-xs leading-6 text-[#73828c]">Cette sélection correspond au répertoire professionnel TR1. Une demande de présentation est transmise au suivi interne TR1 uniquement, sans achat, engagement, facturation ni message automatique au fournisseur.</p>
  </div>;
}
