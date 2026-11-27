import Link from "next/link";
import {ArrowRight,Compass,FileText,Headset,Layers3,PackageCheck,Store} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";
import {requestBrandIntroductionAction} from "./actions";
import {loadPharmacyImplantationOffers} from "@/lib/implantation-offers";

function segment(slug:string){
  if(["beauty-of-joseon","biodance","dr-althea","medicube"].includes(slug))return "K-beauty · Soins & dermocosmétique";
  if(["bloomster","vitalora"].includes(slug))return "Micronutrition · Compléments";
  if(slug==="noto")return "Bien-être · Capillaire";
  if(slug==="vk-swiss")return "Compléments alimentaires";
  return "Sélection officinale";
}

export default async function PharmacyDiscovery({searchParams}:{
  searchParams:Promise<{demande?:string;erreur?:string}>
}){
  const [{brands},offers]=await Promise.all([
    loadPharmacyBrandDirectory(),
    loadPharmacyImplantationOffers(),
  ]);
  const params=await searchParams;
  const other=brands.filter(b=>b.status!=="implanted");
  const verifiedOffers=offers.filter(o=>o.verification_status==="verified");

  return <div className="space-y-7 pb-14">
    <nav className="text-xs text-[#73818b]" aria-label="Fil d'Ariane">
      <Link href="/catalogue" className="hover:underline">Espace officine</Link> / Découvrir de nouvelles marques
    </nav>

    <header className="relative overflow-hidden rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10"/>
      <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-[#efbf91]">Développement de votre assortiment</p>
      <h1 className="relative mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Découvrir de nouvelles marques</h1>
      <p className="relative mt-4 max-w-2xl text-sm leading-7 text-[#dbe4eb]">Explorez les univers de marque présentés par TR1 PHARMA et demandez une étude de référencement adaptée à votre officine.</p>
      <div className="relative mt-7 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold"><Store size={15}/>{other.length} marques à découvrir</span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold"><Headset size={15}/>Un interlocuteur TR1</span>
      </div>
    </header>

    {params.demande==="1"?<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Votre demande a été enregistrée dans le suivi TR1. Aucune commande n'a été créée.</p>:null}
    {params.erreur?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">La demande n'a pas pu être enregistrée. Vérifiez votre accès et réessayez.</p>:null}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {other.map((b,index)=>{
        const brandOffers=verifiedOffers.filter(o=>o.brand_id===b.brand_id);
        return <article key={b.brand_id} className="flex flex-col rounded-xl border border-[#e0e7ea] bg-white p-5 shadow-[0_4px_18px_rgba(20,41,65,0.035)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f5f5] text-[#31556b]"><Compass size={21}/></div>
            <span className="rounded-full bg-[#f3f6f6] px-3 py-1 text-[11px] font-bold text-[#5d7180]">{b.status==="not_implanted"?"Non implantée":"À découvrir"}</span>
          </div>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a76538]">{segment(b.slug)}</p>
          <h2 className="mt-2 text-xl font-extrabold text-[#142941]">{b.name}</h2>
          <p className="mt-2 min-h-14 text-sm leading-6 text-[#687b88]">{b.description||"Marque présentée dans la sélection TR1 PHARMA."}</p>

          <div className="mt-5 rounded-lg border border-[#e4eaec] bg-[#f7f9f9] p-4">
            <p className="flex items-center gap-2 text-xs font-extrabold text-[#24465b]"><Layers3 size={15}/>Référencement officinal</p>
            {brandOffers.length>0
              ?<p className="mt-2 text-sm text-[#637583]">{brandOffers.length} offre(s) d'implantation publiée(s).</p>
              :<p className="mt-2 text-sm leading-6 text-[#637583]">Demandez une étude d'implantation et les conditions professionnelles applicables à votre officine.</p>}
            <Link href={"/catalogue/decouvrir/"+b.slug} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#195671] hover:underline">
              Consulter la présentation <ArrowRight size={15}/>
            </Link>
          </div>

          <div className="mt-auto space-y-3 border-t border-[#edf0f1] pt-4">
            {b.showroom_available&&b.real_access
              ?<Link href={"/catalogue/althesia?marque="+b.slug} className="flex items-center gap-2 text-sm font-semibold text-[#1a5572] hover:underline"><FileText size={16}/>Fiches documentaires fournisseur<ArrowRight size={14}/></Link>
              :null}
            {b.interest_status
              ?<p className="rounded-lg bg-[#edf5f0] px-4 py-3 text-xs font-semibold text-[#2b6847]">Demande déjà enregistrée auprès de TR1</p>
              :<form action={requestBrandIntroductionAction} className="space-y-2">
                <input name="brand_id" type="hidden" value={b.brand_id}/>
                <label className="block text-xs font-semibold text-[#5d707e]">Votre besoin <span className="font-normal">(facultatif)</span>
                  <input name="note" maxLength={800} placeholder="Ex. : rendez-vous de présentation" className="mt-1 w-full rounded-lg border border-[#d6dfe3] px-3 py-2.5 text-sm"/>
                </label>
                <button className="w-full rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white hover:bg-[#26425b]">Demander une étude d'implantation</button>
              </form>}
          </div>
          <span className="sr-only">Marque {index+1} sur {other.length}</span>
        </article>;
      })}
    </div>

    {!other.length?<p className="rounded-xl border bg-white p-8 text-sm text-[#6d7a86]">Toutes les marques de votre sélection sont déjà implantées.</p>:null}

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border bg-white p-5"><PackageCheck size={20} className="text-[#31556b]"/><h2 className="mt-3 font-bold text-[#142941]">Assortiment</h2><p className="mt-2 text-sm leading-6 text-[#687b88]">Étude des références et du positionnement de la gamme dans votre officine.</p></div>
      <div className="rounded-xl border bg-white p-5"><Layers3 size={20} className="text-[#31556b]"/><h2 className="mt-3 font-bold text-[#142941]">Conditions professionnelles</h2><p className="mt-2 text-sm leading-6 text-[#687b88]">Présentation des minimums, paliers, unités gratuites et services lorsque les conditions sont publiées par la marque.</p></div>
      <div className="rounded-xl border bg-white p-5"><Headset size={20} className="text-[#31556b]"/><h2 className="mt-3 font-bold text-[#142941]">Suivi commercial</h2><p className="mt-2 text-sm leading-6 text-[#687b88]">TR1 centralise vos demandes et reste votre interlocuteur terrain. La marque assure la facturation et la logistique.</p></div>
    </section>

    <p className="text-xs leading-6 text-[#73828c]">Une demande de présentation ou d'étude d'implantation n'est pas une commande et ne crée aucun engagement d'achat. Les conditions définitives, la disponibilité, la facturation et la livraison sont confirmées par la marque concernée.</p>
  </div>;
}
