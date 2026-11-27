import type {Metadata} from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  ClipboardList,
  Headset,
  Leaf,
  PackageCheck,
  Sparkles,
  Store,
} from "lucide-react";
import {createServerSupabase} from "@/lib/supabase/server";
import {submitBrandInterest} from "./actions";

export const metadata:Metadata={
  title:"Catalogue professionnel des marques | TR1 PHARMA",
  description:"Découvrez la sélection de marques présentées par TR1 PHARMA et demandez une étude de référencement pour votre officine.",
};

type Brand={id:string;name:string;slug:string;description:string|null};

const profiles:Record<string,{segment:string;icon:"beauty"|"nutrition"|"wellness";focus:string}> = {
  "beauty-of-joseon":{
    segment:"K-beauty · Soins du visage",
    icon:"beauty",
    focus:"Soins coréens et routines visage",
  },
  biodance:{
    segment:"K-beauty · Masques & soins",
    icon:"beauty",
    focus:"Soins coréens et masques visage",
  },
  "dr-althea":{
    segment:"K-beauty · Dermocosmétique",
    icon:"beauty",
    focus:"Soins dermocosmétiques coréens",
  },
  medicube:{
    segment:"K-beauty · Soin de la peau",
    icon:"beauty",
    focus:"Soins de la peau et dermocosmétique",
  },
  bloomster:{
    segment:"Micronutrition · Champignons",
    icon:"nutrition",
    focus:"Compléments autour des champignons et de la micronutrition",
  },
  vitalora:{
    segment:"Micronutrition · Compléments",
    icon:"nutrition",
    focus:"Micronutrition et compléments alimentaires",
  },
  noto:{
    segment:"Bien-être · Capillaire",
    icon:"wellness",
    focus:"Gammes bien-être et capillaires",
  },
  "vk-swiss":{
    segment:"Compléments alimentaires",
    icon:"nutrition",
    focus:"Compléments à base de plantes et de ghee suisse",
  },
};

function BrandIcon({kind}:{kind:"beauty"|"nutrition"|"wellness"}){
  if(kind==="beauty")return <Sparkles size={21} strokeWidth={1.8}/>;
  if(kind==="wellness")return <Leaf size={21} strokeWidth={1.8}/>;
  return <PackageCheck size={21} strokeWidth={1.8}/>;
}

export default async function Vitrine({
  searchParams,
}:{
  searchParams:Promise<{marque?:string;envoye?:string;erreur?:string}>
}){
  const db=await createServerSupabase();
  if(!db)throw new Error("Vitrine indisponible.");
  const [{data,error},params]=await Promise.all([
    db.rpc("public_catalogue_data"),
    searchParams,
  ]);
  if(error)throw new Error("Impossible de charger les marques.");
  const brands=((data as {brands?:Brand[]}|null)?.brands??[]);
  const selected=brands.some(b=>b.slug===params.marque)?params.marque:brands[0]?.slug;

  return <main id="contenu" className="mx-auto max-w-[1240px] space-y-12 px-5 py-8 sm:px-8 sm:py-12">
    <header className="relative overflow-hidden rounded-[26px] bg-[#142941] px-6 py-9 text-white shadow-[0_18px_55px_rgba(20,41,65,0.14)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-white/10"/>
      <div aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-44 h-96 w-96 rounded-full border border-white/10"/>
      <div className="relative max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#f0c69e]">
          <Store size={14}/> Catalogue professionnel · Officines
        </p>
        <h1 className="mt-6 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[46px]">
          Des marques à développer en officine. Un interlocuteur terrain.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[#dbe4eb] sm:text-base">
          Découvrez la sélection multimarque présentée par TR1 PHARMA. Identifiez les univers pertinents pour votre point de vente et demandez une étude de référencement adaptée à votre officine.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="#marques" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#efbf91] px-5 py-3 text-sm font-extrabold text-[#142941] transition hover:bg-[#f5d2b1]">
            Explorer les marques <ArrowRight size={16}/>
          </a>
          <a href="#contact" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
            Demander une présentation <ArrowUpRight size={16}/>
          </a>
        </div>
      </div>
      <div className="relative mt-9 grid max-w-3xl grid-cols-2 gap-3 border-t border-white/15 pt-6 sm:grid-cols-3">
        <div><p className="text-2xl font-extrabold tabular-nums">{brands.length}</p><p className="mt-1 text-xs text-white/70">marques présentées</p></div>
        <div><p className="text-2xl font-extrabold">B2B</p><p className="mt-1 text-xs text-white/70">accompagnement officinal</p></div>
        <div className="col-span-2 sm:col-span-1"><p className="text-2xl font-extrabold">TR1</p><p className="mt-1 text-xs text-white/70">interlocuteur commercial</p></div>
      </div>
    </header>

    <section id="marques" className="scroll-mt-28 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#a76538]">Sélection multimarque</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#142941] sm:text-3xl">Les marques présentées par TR1</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667887]">Parcourez les univers de marque. Chaque demande est étudiée avec vous avant la transmission au fournisseur concerné.</p>
        </div>
        <span className="rounded-full border border-[#dce4e8] bg-white px-3 py-2 text-xs font-bold text-[#4f6575]">{brands.length} marques</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {brands.map((brand,index)=>{
          const profile=profiles[brand.slug]??{segment:"Sélection officinale",icon:"wellness" as const,focus:"Marque présentée par TR1 PHARMA"};
          return <article key={brand.id} className="group flex min-h-[250px] flex-col rounded-2xl border border-[#e0e7ea] bg-white p-5 shadow-[0_4px_18px_rgba(20,41,65,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#c5d3da] hover:shadow-[0_14px_34px_rgba(20,41,65,0.09)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f5f5] text-[#31556b]">
                <BrandIcon kind={profile.icon}/>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-[#a0abb2]">{String(index+1).padStart(2,"0")}</span>
            </div>
            <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a76538]">{profile.segment}</p>
            <h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#142941]">{brand.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#667887]">{brand.description||profile.focus}</p>
            <Link
              href={"/vitrine?marque="+encodeURIComponent(brand.slug)+"#contact"}
              className="mt-5 inline-flex items-center justify-between border-t border-[#edf0f1] pt-4 text-sm font-bold text-[#244f68] transition group-hover:text-[#a76538]"
            >
              Demander la présentation <ArrowUpRight size={16}/>
            </Link>
          </article>;
        })}
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <article className="rounded-2xl border border-[#e2e8ea] bg-[#f7f9f9] p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#31556b]"><ClipboardList size={20}/></div>
        <h3 className="mt-4 font-extrabold text-[#142941]">Étude de référencement</h3>
        <p className="mt-2 text-sm leading-6 text-[#667887]">Échange sur votre assortiment, votre positionnement et les gammes que vous souhaitez développer.</p>
      </article>
      <article className="rounded-2xl border border-[#e2e8ea] bg-[#f7f9f9] p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#31556b]"><BriefcaseBusiness size={20}/></div>
        <h3 className="mt-4 font-extrabold text-[#142941]">Proposition commerciale</h3>
        <p className="mt-2 text-sm leading-6 text-[#667887]">Présentation des références et des conditions professionnelles applicables à votre demande, après vérification auprès de la marque.</p>
      </article>
      <article className="rounded-2xl border border-[#e2e8ea] bg-[#f7f9f9] p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#31556b]"><Headset size={20}/></div>
        <h3 className="mt-4 font-extrabold text-[#142941]">Accompagnement terrain</h3>
        <p className="mt-2 text-sm leading-6 text-[#667887]">Un interlocuteur TR1 pour le suivi commercial, la présentation des gammes et vos demandes auprès des marques.</p>
      </article>
    </section>

    <section id="contact" className="scroll-mt-28 overflow-hidden rounded-2xl border border-[#dce5e8] bg-white shadow-[0_8px_30px_rgba(20,41,65,0.05)]">
      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-[#142941] p-6 text-white sm:p-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#efbf91]">Prise de contact officine</p>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">Construisons votre prochaine implantation.</h2>
          <p className="mt-4 text-sm leading-7 text-white/80">Indiquez votre officine et la marque qui vous intéresse. TR1 reprend contact pour qualifier votre besoin et vous présenter les conditions professionnelles disponibles.</p>
          <div className="mt-8 space-y-3 border-t border-white/15 pt-5 text-xs leading-5 text-white/75">
            <p className="flex items-start gap-2"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-[#efbf91]"/>Demande sans engagement et sans commande automatique.</p>
            <p className="flex items-start gap-2"><Headset size={16} className="mt-0.5 shrink-0 text-[#efbf91]"/>TR1 reste votre interlocuteur commercial.</p>
          </div>
        </div>

        <div className="p-6 sm:p-9">
          <h3 className="text-xl font-extrabold text-[#142941]">Recevoir une présentation</h3>
          <p className="mt-2 text-sm leading-6 text-[#697b87]">Complétez les coordonnées professionnelles pour être recontacté.</p>
          {params.envoye&&<p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">Votre demande a bien été enregistrée. TR1 pourra reprendre contact avec vous.</p>}
          {params.erreur&&<p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">La demande n'a pas pu être enregistrée. Vérifiez les informations saisies.</p>}
          {brands.length>0&&<form action={submitBrandInterest} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-[#536a79] sm:col-span-2">
              Marque souhaitée
              <select name="brand_slug" defaultValue={selected} className="min-h-11 rounded-lg border border-[#d8e0e4] bg-white px-3 text-sm font-medium text-[#142941]">
                {brands.map(brand=><option key={brand.id} value={brand.slug}>{brand.name}</option>)}
              </select>
            </label>
            {[
              ["pharmacy_name","Pharmacie","organization"],
              ["city","Ville","address-level2"],
              ["contact_name","Nom du contact","name"],
              ["email","E-mail professionnel","email"],
            ].map(([name,label,auto])=><label key={name} className="grid gap-1.5 text-xs font-bold text-[#536a79]">
              {label}
              <input name={name} type={name==="email"?"email":"text"} autoComplete={auto} minLength={2} maxLength={name==="email"?254:120} required className="min-h-11 rounded-lg border border-[#d8e0e4] px-3 text-sm font-medium text-[#142941] outline-none transition focus:border-[#54768a] focus:ring-2 focus:ring-[#54768a]/10"/>
            </label>)}
            <label className="grid gap-1.5 text-xs font-bold text-[#536a79] sm:col-span-2">
              Votre besoin <span className="font-normal text-[#87949c]">(facultatif)</span>
              <textarea name="note" rows={3} maxLength={1500} placeholder="Ex. : étude d'implantation, assortiment, rendez-vous de présentation…" className="rounded-lg border border-[#d8e0e4] px-3 py-2.5 text-sm font-medium text-[#142941] outline-none transition focus:border-[#54768a] focus:ring-2 focus:ring-[#54768a]/10"/>
            </label>
            <div aria-hidden="true" className="absolute -left-[10000px]"><input name="website" tabIndex={-1} autoComplete="off"/></div>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#142941] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#254660] sm:col-span-2">
              Envoyer ma demande à TR1 <ArrowRight size={16}/>
            </button>
            <p className="text-[11px] leading-5 text-[#7a8992] sm:col-span-2">Vos coordonnées sont utilisées pour traiter votre demande. Consultez notre <Link href="/politique-de-confidentialite" className="font-semibold underline">politique de confidentialité</Link>.</p>
          </form>}
        </div>
      </div>
    </section>

    <section className="rounded-xl border border-[#e2e8ea] bg-[#f7f9f9] p-5 sm:p-6">
      <h2 className="text-sm font-extrabold text-[#142941]">Le rôle de TR1 PHARMA</h2>
      <p className="mt-2 text-sm leading-6 text-[#667887]">TR1 PHARMA intervient comme intermédiaire commercial et interlocuteur terrain. La marque concernée confirme les conditions définitives, la disponibilité, la facturation et la livraison des produits. Aucun prix ni engagement de commande n'est généré par cette demande de présentation.</p>
    </section>
  </main>;
}
