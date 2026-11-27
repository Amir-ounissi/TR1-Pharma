import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft,ArrowRight,BookOpen,ClipboardList,Headset,Layers3,ShieldCheck} from "lucide-react";
import {loadPharmacyBrandDirectory} from "@/lib/pharmacy-brands";
import {loadPharmacyImplantationOffers,implantationEuro} from "@/lib/implantation-offers";
import {requestSpecificImplantationOfferAction} from "../offre-actions";
import {requestBrandIntroductionAction} from "../actions";

function segment(slug:string){
  if(["beauty-of-joseon","biodance","dr-althea","medicube"].includes(slug))return "K-beauty · Soins & dermocosmétique";
  if(["bloomster","vitalora"].includes(slug))return "Micronutrition · Compléments";
  if(slug==="noto")return "Bien-être · Capillaire";
  if(slug==="vk-swiss")return "Compléments alimentaires";
  return "Sélection officinale";
}

export default async function BrandImplantationDetails({params}:{
  params:Promise<{slug:string}>
}){
  const {slug}=await params;
  const [{brands},offers]=await Promise.all([
    loadPharmacyBrandDirectory(),
    loadPharmacyImplantationOffers(),
  ]);
  const brand=brands.find(b=>b.slug===slug&&b.status!=="implanted");
  if(!brand)notFound();

  const list=offers.filter(o=>o.brand_id===brand.brand_id&&o.verification_status==="verified");

  return <div className="space-y-7 pb-14">
    <nav aria-label="Fil d'Ariane" className="text-xs text-[#71808a]">
      <Link href="/catalogue" className="hover:underline">Espace officine</Link>
      <span className="mx-2">/</span>
      <Link href="/catalogue/decouvrir" className="hover:underline">Découvrir des marques</Link>
      <span className="mx-2">/</span><span className="font-bold text-[#142941]">{brand.name}</span>
    </nav>

    <header className="rounded-2xl bg-[#142941] px-6 py-8 text-white sm:px-9 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#efbf91]">{segment(brand.slug)}</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Développer {brand.name} dans votre officine</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#dbe4eb]">{brand.description||"Découvrez cette marque avec votre interlocuteur commercial TR1."}</p>
      <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold">
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2"><ClipboardList size={15}/>Étude de référencement</span>
        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2"><Headset size={15}/>Accompagnement TR1</span>
      </div>
    </header>

    <Link href="/catalogue/decouvrir" className="inline-flex items-center gap-2 text-sm font-semibold text-[#245c78] hover:underline"><ArrowLeft size={16}/>Toutes les marques</Link>

    <section className="rounded-2xl border border-[#dce5e8] bg-white p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f5] text-[#31556b]"><Layers3 size={21}/></div>
        <div>
          <h2 className="text-xl font-extrabold text-[#142941]">Conditions d'implantation</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687b88]">Les propositions affichées ci-dessous sont limitées aux offres publiées et validées par la marque. Si aucune offre n'est affichée, TR1 peut étudier votre projet et solliciter les conditions professionnelles adaptées à votre officine.</p>
        </div>
      </div>

      {list.length>0
        ?<div className="mt-6 grid gap-4 lg:grid-cols-2">
          {list.map(o=>{
            const metrics=[
              {label:"Références distinctes minimum",value:o.min_distinct_references!==null?String(o.min_distinct_references):null},
              {label:"Unités payées par référence",value:o.min_units_per_reference!==null?String(o.min_units_per_reference):null},
              {label:"Unités offertes par référence",value:o.free_units_per_reference>0?String(o.free_units_per_reference):null},
              {label:"Minimum total d'unités payées",value:o.min_total_paid_units!==null?String(o.min_total_paid_units):null},
              {label:"Minimum de commande HT",value:o.min_order_ht!==null?implantationEuro(o.min_order_ht):null},
              {label:"Prix du pack HT",value:o.fixed_pack_ht!==null?implantationEuro(o.fixed_pack_ht):null},
            ].filter((metric):metric is {label:string;value:string}=>metric.value!==null);
            return <article key={o.id} className="flex flex-col rounded-xl border border-[#dce5e8] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#a76538]">{o.offer_kind==="fixed_pack"?"Pack de démarrage":o.offer_kind==="quantity_tier"?"Palier de commande":"Sélection libre"}</p>
                  <h3 className="mt-2 text-lg font-extrabold text-[#142941]">{o.title}</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#edf5f0] px-2.5 py-1 text-[10px] font-bold text-[#2b6847]"><ShieldCheck size={13}/>Validée</span>
              </div>
              {o.summary?<p className="mt-3 text-sm leading-6 text-[#687986]">{o.summary}</p>:null}
              {metrics.length>0?<dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[#f5f8f9] p-4">
                {metrics.map(metric=><div key={metric.label}><dt className="text-[11px] text-[#7d8b95]">{metric.label}</dt><dd className="mt-1 text-sm font-extrabold text-[#142941]">{metric.value}</dd></div>)}
              </dl>:null}
              {o.discount_pct!==null&&Number(o.discount_pct)>0?<p className="mt-3 text-sm font-bold text-[#2d596f]">Remise : {o.discount_pct} %</p>:null}
              {o.lines.length>0?<div className="mt-4">
                <h4 className="text-sm font-bold text-[#142941]">Composition de l'offre</h4>
                <div className="mt-2 divide-y rounded-lg border border-[#e4e9eb]">
                  {o.lines.map((line,i)=><p key={i} className="flex flex-wrap justify-between gap-3 px-3 py-2.5 text-xs text-[#526878]">
                    <span>{line.product_name}{line.format?" · "+line.format:""}</span><strong>{line.paid_units} payée(s) + {line.free_units} offerte(s)</strong>
                  </p>)}
                </div>
              </div>:null}
              {[
                ["Conditions et exclusions",o.offer_conditions],
                ["Mise en avant / PLV",o.plv_commitment],
                ["Formation / animation",o.training_commitment],
                ["Transport / franco",o.shipping_terms],
              ].filter(([,value])=>!!value).length>0?<div className="mt-4 space-y-2 border-t border-[#edf0f1] pt-4">
                {[
                  ["Conditions et exclusions",o.offer_conditions],
                  ["Mise en avant / PLV",o.plv_commitment],
                  ["Formation / animation",o.training_commitment],
                  ["Transport / franco",o.shipping_terms],
                ].filter(([,value])=>!!value).map(([label,value])=><p key={String(label)} className="text-xs leading-5 text-[#667884]"><strong className="text-[#395a71]">{label} :</strong> {value}</p>)}
              </div>:null}
              {o.valid_until?<p className="mt-3 text-[11px] font-semibold text-[#6d7d87]">Offre valable jusqu'au {new Date(o.valid_until).toLocaleDateString("fr-FR")}</p>:null}
              <form action={requestSpecificImplantationOfferAction} className="mt-auto space-y-2 border-t border-[#edf0f1] pt-4">
                <input name="offer_id" type="hidden" value={o.id}/>
                <label className="block text-xs font-semibold text-[#5e7482]">Question ou précision <span className="font-normal">(facultatif)</span>
                  <input name="note" maxLength={800} className="mt-1 w-full rounded-lg border border-[#d6dfe3] p-3 text-sm" placeholder="Votre question sur cette offre"/>
                </label>
                <button className="w-full rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Demander cette offre à TR1</button>
              </form>
            </article>;
          })}
        </div>
        :<div className="mt-6 grid gap-5 rounded-xl bg-[#f5f8f9] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div>
            <h3 className="text-lg font-extrabold text-[#142941]">Recevoir une proposition d'implantation</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687b88]">Décrivez votre projet. TR1 étudie avec vous l'assortiment, le nombre de références et les conditions professionnelles, puis sollicite la marque pour obtenir sa proposition applicable.</p>
            <p className="mt-3 text-xs leading-5 text-[#75848d]">Aucun tarif, minimum de commande ou avantage commercial n'est affiché sans validation fournisseur.</p>
          </div>
          <form action={requestBrandIntroductionAction} className="w-full space-y-3 sm:max-w-sm">
            <input name="brand_id" type="hidden" value={brand.brand_id}/>
            <label className="block text-xs font-semibold text-[#5e7482]">Votre projet <span className="font-normal">(facultatif)</span>
              <textarea name="note" rows={3} maxLength={800} className="mt-1 w-full rounded-lg border border-[#d6dfe3] p-3 text-sm" placeholder="Ex. : première implantation, extension de gamme, rendez-vous de présentation…"/>
            </label>
            <button className="w-full rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Demander une étude à TR1 <ArrowRight size={15} className="ml-1 inline"/></button>
          </form>
        </div>}
    </section>

    {brand.showroom_available&&brand.real_access?<Link href={"/catalogue/althesia?marque="+brand.slug} className="inline-flex items-center gap-2 rounded-lg border border-[#d5e0e5] bg-white px-5 py-3 text-sm font-semibold text-[#214e6d]"><BookOpen size={17}/>Consulter les fiches documentaires fournisseur</Link>:null}

    <section className="rounded-xl border border-[#e2e8ea] bg-[#f7f9f9] p-5">
      <p className="text-sm font-extrabold text-[#142941]">Votre relation commerciale avec TR1</p>
      <p className="mt-2 text-sm leading-6 text-[#687b88]">TR1 est votre interlocuteur commercial et assure le suivi terrain. La marque concernée reste responsable de la confirmation finale, de la facturation et de la logistique des produits.</p>
    </section>
  </div>;
}
