import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Compass,
  Headset,
  Layers3,
  Leaf,
  PackageCheck,
  Sparkles,
  Store,
  Target,
} from "lucide-react";
import {createServerSupabase} from "@/lib/supabase/server";
import {submitBrandInterest} from "./actions";
import {BrandMultiSelect} from "./brand-multi-select";
import {BrandHero,BrandLogo} from "./brand-visuals";

export const metadata:Metadata={
  title:"Catalogue marques & implantations officinales | TR1 PHARMA",
  description:"Explorez une sélection de marques à développer en pharmacie. TR1 PHARMA vous accompagne dans vos projets de référencement et d'implantation.",
};

type Brand={id:string;name:string;slug:string;description:string|null};

const profiles:Record<string,{segment:string;focus:string;letter:string;tone:string;kind:"beauty"|"nutrition"|"wellness"}>={
  "beauty-of-joseon":{
    segment:"K-beauty · Soins du visage",
    focus:"Soins coréens et routines visage",
    letter:"B",
    tone:"from-[#ead8cf] via-[#f4e9e2] to-[#f7f3ed]",
    kind:"beauty",
  },
  biodance:{
    segment:"K-beauty · Masques & soins",
    focus:"Soins coréens et masques pour le visage",
    letter:"BIO",
    tone:"from-[#d9e5e5] via-[#e9f0ee] to-[#f7f5f0]",
    kind:"beauty",
  },
  "dr-althea":{
    segment:"K-beauty · Dermocosmétique",
    focus:"Soins dermocosmétiques coréens",
    letter:"A",
    tone:"from-[#e6dce9] via-[#f0e9f0] to-[#f8f4f5]",
    kind:"beauty",
  },
  medicube:{
    segment:"K-beauty · Skin care",
    focus:"Soins de la peau et dermocosmétique",
    letter:"M",
    tone:"from-[#d7e0e8] via-[#e9eef1] to-[#f7f6f2]",
    kind:"beauty",
  },
  cosrx:{
    segment:"K-beauty · Soins du visage",
    focus:"Soins coréens du visage : nettoyage, hydratation et soins ciblés",
    letter:"C",
    tone:"from-[#efe7d6] via-[#f7f2e8] to-[#faf8f3]",
    kind:"beauty",
  },
  bloomster:{
    segment:"Micronutrition · Champignons",
    focus:"Compléments autour des champignons et de la micronutrition",
    letter:"BL",
    tone:"from-[#dce5d9] via-[#edf1e9] to-[#f8f5ed]",
    kind:"nutrition",
  },
  vitalora:{
    segment:"Micronutrition · Compléments",
    focus:"Micronutrition et compléments alimentaires",
    letter:"V",
    tone:"from-[#e3e5d3] via-[#f0f0e6] to-[#f8f5ed]",
    kind:"nutrition",
  },
  noto:{
    segment:"Bien-être · Capillaire",
    focus:"Gammes de bien-être et capillaires",
    letter:"N",
    tone:"from-[#d8e1da] via-[#e9efeb] to-[#f6f4ed]",
    kind:"wellness",
  },
  "vk-swiss":{
    segment:"Compléments alimentaires",
    focus:"Compléments à base de plantes et de ghee suisse",
    letter:"VK",
    tone:"from-[#e7dfcc] via-[#f1ebdd] to-[#f8f5ee]",
    kind:"nutrition",
  },
};

function BrandIcon({kind}:{kind:"beauty"|"nutrition"|"wellness"}){
  if(kind==="beauty")return <Sparkles size={18} strokeWidth={1.8}/>;
  if(kind==="wellness")return <Leaf size={18} strokeWidth={1.8}/>;
  return <PackageCheck size={18} strokeWidth={1.8}/>;
}

export default async function Vitrine({
  searchParams,
}:{
  searchParams:Promise<{marque?:string;marques?:string;envoye?:string;erreur?:string;projet?:string}>
}){
  const db=await createServerSupabase();
  if(!db)throw new Error("Vitrine indisponible.");
  const [{data,error},params]=await Promise.all([
    db.rpc("public_catalogue_data"),
    searchParams,
  ]);
  if(error)throw new Error("Impossible de charger les marques.");
  const brands=((data as {brands?:Brand[]}|null)?.brands??[]);
  const products=((data as {products?:{brand_slug:string;price_ht:number|string|null;requestable?:boolean}[]}|null)?.products??[]);
  const requestedSlugs=(params.marques??params.marque??"").split(",").map(slug=>slug.trim()).filter(Boolean);
  const initialSlugs=[...new Set(requestedSlugs)].filter(slug=>brands.some(b=>b.slug===slug));

  return <main id="contenu" className="overflow-hidden bg-[#fbfaf7] text-[#142941]">
    <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-5 sm:px-7 lg:px-10 lg:pt-8">
      <section className="relative isolate min-h-[420px] overflow-hidden rounded-[30px] bg-[#10283d] shadow-[0_24px_70px_rgba(16,40,61,0.18)] sm:min-h-[460px] lg:min-h-[480px]">
        <Image
          src="/marketing/tr1-pharmacy-hero-hd.webp"
          alt="Accompagnement professionnel des pharmacies par TR1 PHARMA"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1360px"
          className="object-cover object-center opacity-55"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0d2338] via-[#10283d]/90 to-[#10283d]/35"/>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0d2338]/70 via-transparent to-[#0d2338]/10"/>
        <div aria-hidden="true" className="absolute -right-24 -top-36 h-[520px] w-[520px] rounded-full border border-white/10"/>
        <div aria-hidden="true" className="absolute -right-5 -top-16 h-[360px] w-[360px] rounded-full border border-white/10"/>
        <div className="relative grid min-h-[420px] items-center gap-12 px-6 py-12 sm:min-h-[460px] sm:px-10 sm:py-14 lg:min-h-[480px] lg:grid-cols-[1.1fr_.9fr] lg:px-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#f1c79f] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f1c79f]"/> Catalogue professionnel · Officines
            </div>
            <h1 className="mt-7 max-w-3xl text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-[62px]">
              Faites grandir votre assortiment.<br/>
              <span className="font-serif font-normal italic text-[#efc39b]">Révélez votre différence.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-white/80 sm:text-base">
              Explorez les marques, comparez leurs assortiments et estimez votre budget d’implantation. Un interlocuteur terrain vous accompagne de la découverte au développement en officine.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#marques" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#edc197] px-6 py-3 text-sm font-extrabold text-[#142941] shadow-[0_8px_25px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-[#f5d3b1]">
                Explorer les marques <ArrowDown size={16}/>
              </a>
              <a href="#contact" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/35 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15">
                Parler de mon projet <ArrowUpRight size={16}/>
              </a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/20 pt-6 text-xs font-medium text-white/75">
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#efc39b]"/> Sélection multimarque</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#efc39b]"/> Accompagnement terrain</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#efc39b]"/> Demande sans engagement</span>
            </div>
          </div>

          <div className="hidden justify-self-end lg:block">
            <div className="w-[320px] rounded-[26px] border border-white/25 bg-[#f8f5ef]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl xl:w-[350px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#a36c46]">L'approche TR1</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9ded1] text-[#29475a]"><Compass size={17}/></span>
              </div>
              <h2 className="mt-5 font-serif text-[28px] leading-tight text-[#142941]">Du choix à l'implantation.</h2>
              <p className="mt-3 text-sm leading-6 text-[#64747c]">Un parcours commercial clair, pensé pour les réalités de votre officine.</p>
              <div className="mt-6 space-y-4">
                {[
                  ["01","Découvrir","Explorer les marques et leurs univers."],
                  ["02","Construire","Étudier le référencement et l'assortiment."],
                  ["03","Développer","Être accompagné dans la durée sur le terrain."],
                ].map(([n,title,desc])=><div key={n} className="flex gap-3 border-t border-[#deded7] pt-4">
                  <span className="font-serif text-lg italic text-[#b77b50]">{n}</span>
                  <div><p className="text-sm font-extrabold text-[#203b4d]">{title}</p><p className="mt-1 text-xs leading-5 text-[#748188]">{desc}</p></div>
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 py-9 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#e5e1d9]">
        <div className="flex items-center gap-4 px-2 sm:px-7">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e9efed] text-[#31576a]"><Store size={19}/></span>
          <div><p className="text-sm font-extrabold">{brands.length} univers de marques</p><p className="mt-1 text-xs text-[#77838a]">Une offre multimarque à explorer</p></div>
        </div>
        <div className="flex items-center gap-4 px-2 sm:px-7">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2e8df] text-[#a46b45]"><Target size={19}/></span>
          <div><p className="text-sm font-extrabold">Un projet à votre mesure</p><p className="mt-1 text-xs text-[#77838a]">Assortiment et référencement étudiés</p></div>
        </div>
        <div className="flex items-center gap-4 px-2 sm:px-7">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e9e9dc] text-[#69724e]"><Headset size={19}/></span>
          <div><p className="text-sm font-extrabold">Un interlocuteur terrain</p><p className="mt-1 text-xs text-[#77838a]">TR1 coordonne votre demande</p></div>
        </div>
      </section>

      <section id="marques" className="scroll-mt-28 space-y-7 py-7 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#a66a43]">La sélection TR1 PHARMA</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#142941] sm:text-4xl">Des marques. Des univers. <span className="font-serif italic font-normal text-[#a66a43]">De nouvelles opportunités.</span></h2>
            <p className="mt-4 text-sm leading-7 text-[#687982]">Découvrez les marques présentées aux officines, de la skincare coréenne à la micronutrition. Sélectionnez celles qui correspondent à votre stratégie de développement.</p>
          </div>
          <span className="rounded-full border border-[#dcded8] bg-white px-4 py-2 text-xs font-bold text-[#536b79]">{brands.length} marques à découvrir</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand,index)=>{
            const assortment=products.filter(p=>p.brand_slug===brand.slug&&p.requestable!==false);const prices=assortment.map(p=>Number(p.price_ht)).filter(p=>p>0&&Number.isFinite(p));const money=(v:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(v);
            const profile=profiles[brand.slug]??{segment:"Sélection officinale",focus:"Marque présentée par TR1 PHARMA",letter:brand.name.slice(0,2).toUpperCase(),tone:"from-[#dce4e3] via-[#edf1ed] to-[#f7f5ef]",kind:"wellness" as const};
            return <article key={brand.id} className="group overflow-hidden rounded-[22px] border border-[#e3e4df] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#c7d2d0] hover:shadow-[0_18px_42px_rgba(20,41,65,0.1)]">
              <div className={`group relative h-[188px] overflow-hidden bg-gradient-to-br ${profile.tone}`}>
                <BrandHero slug={brand.slug} name={brand.name}/>
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#10283d]/35 via-transparent to-transparent"/>
                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#526a76] shadow-sm backdrop-blur-sm">
                  <BrandIcon kind={profile.kind}/>{profile.segment.split(" · ")[0]}
                </span>
                <div className="absolute bottom-4 left-4 flex min-h-[52px] min-w-[150px] items-center rounded-xl border border-white/80 bg-white/95 px-3 py-1.5 shadow-[0_8px_24px_rgba(15,35,50,0.12)]">
                  <BrandLogo slug={brand.slug} name={brand.name}/>
                </div>
                <span className="absolute bottom-5 right-4 text-[10px] font-extrabold tracking-[0.18em] text-white drop-shadow">{String(index+1).padStart(2,"0")} / {String(brands.length).padStart(2,"0")}</span>
              </div>
              <div className="p-5">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#a66a43]">{profile.segment}</p>
                <h3 className="mt-2 min-h-7 text-[21px] font-extrabold tracking-[-0.035em] text-[#142941]">{brand.name}</h3>
                <p className="mt-2 min-h-[48px] text-[13px] leading-6 text-[#748188]">{brand.description||profile.focus}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-[#edf1ed] px-3 py-2 font-semibold">{assortment.length} références</span>{prices.length>0&&<span className="rounded-lg bg-[#f5f1ea] px-3 py-2 font-semibold">Dès {money(Math.min(...prices))} HT</span>}</div><div className="mt-5 flex items-center justify-between gap-3 border-t border-[#eceeea] pt-4">
                  <Link
                    href={"/vitrine/brands/"+brand.slug}
                    className="inline-flex items-center gap-2 text-xs font-extrabold text-[#31576a] transition hover:text-[#a66a43]"
                  >
                    Découvrir & composer <ArrowRight size={15}/>
                  </Link>
                  <Link
                    href={"/vitrine?marque="+encodeURIComponent(brand.slug)+"#contact"}
                    className="text-[10px] font-bold text-[#8b989d] underline decoration-[#cbd2cf] underline-offset-4 transition hover:text-[#31576a]"
                  >
                    Sélectionner
                  </Link>
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[28px] bg-[#e9eee9] px-6 py-9 sm:px-10 sm:py-12">
        <div aria-hidden="true" className="absolute -right-12 -top-24 h-72 w-72 rounded-full border border-[#31576a]/10"/>
        <div className="relative grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#a66a43]">Votre projet officinal</p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#142941] sm:text-[38px]">Une implantation réussie commence par <span className="font-serif italic font-normal text-[#a66a43]">le bon échange.</span></h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-[#64747c]">Vous avez repéré une marque ? Vous souhaitez élargir votre offre ou étudier un nouvel univers ? TR1 vous accompagne pour construire une proposition cohérente avec votre officine.</p>
            <a href="#contact" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#142941] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#25465d]">Parler de mon projet <ArrowRight size={16}/></a>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {n:"01",icon:<Compass size={20}/>,title:"Explorer",text:"Identifier les univers et les marques qui vous intéressent."},
              {n:"02",icon:<Layers3 size={20}/>,title:"Étudier",text:"Construire un assortiment et demander les conditions applicables."},
              {n:"03",icon:<Headset size={20}/>,title:"Accompagner",text:"Suivre votre projet avec un interlocuteur terrain."},
            ].map(step=><article key={step.n} className="rounded-2xl border border-white/80 bg-white/75 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[#31576a]"><span>{step.icon}</span><span className="font-serif text-sm italic text-[#b17a52]">{step.n}</span></div>
              <h3 className="mt-7 text-lg font-extrabold text-[#142941]">{step.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#748188]">{step.text}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-28 overflow-hidden rounded-[28px] border border-[#e0e3df] bg-white shadow-[0_16px_48px_rgba(20,41,65,0.07)]">
        <div className="relative overflow-hidden bg-[#142941] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div aria-hidden="true" className="absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/10"/>
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#efc39b]">On en parle ?</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Parlons de votre prochaine implantation.</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">Choisissez une ou plusieurs marques. Nous revenons vers vous pour qualifier votre besoin et étudier les possibilités de référencement.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85"><BadgeCheck size={15} className="text-[#efc39b]"/> Demande sans engagement</span>
          </div>
        </div>

        <form action={submitBrandInterest} className="p-6 sm:p-10">
          {params.envoye&&<p role="status" className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Votre demande a bien été enregistrée. TR1 reprendra contact avec vous.</p>}
          {params.erreur&&<p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">La demande n'a pas pu être enregistrée. Vérifiez les marques sélectionnées et les coordonnées saisies.</p>}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a66a43]">Étape 1</p>
              <h3 className="mt-1 text-xl font-extrabold text-[#142941]">Quelles marques souhaitez-vous développer ?</h3>
            </div>
            <span className="rounded-full bg-[#f4f2ec] px-3 py-1.5 text-[10px] font-bold text-[#6c7c82]">Plusieurs choix possibles</span>
          </div>
          <BrandMultiSelect brands={brands} initialSlugs={initialSlugs}/>

          <div className="mt-9 border-t border-[#eceeea] pt-7">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a66a43]">Étape 2</p>
              <h3 className="mt-1 text-xl font-extrabold text-[#142941]">Vos coordonnées professionnelles</h3>
              <p className="mt-2 text-xs leading-5 text-[#7a888e]">Pour que nous puissions vous recontacter et préparer un échange utile.</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["pharmacy_name","Nom de la pharmacie","organization"],
                ["city","Ville","address-level2"],
                ["contact_name","Votre nom","name"],
                ["email","E-mail professionnel","email"],
              ].map(([name,label,auto])=><label key={name} className="grid gap-2 text-xs font-bold text-[#536b79]">
                {label}
                <input name={name} type={name==="email"?"email":"text"} autoComplete={auto} minLength={2} maxLength={name==="email"?254:180} required placeholder={name==="pharmacy_name"?"Ex. : Pharmacie du Centre":name==="city"?"Ex. : Aix-en-Provence":name==="contact_name"?"Prénom et nom":"nom@pharmacie.fr"} className="min-h-12 rounded-xl border border-[#d9e0df] bg-[#fdfdfb] px-4 text-sm font-medium text-[#142941] outline-none transition placeholder:text-[#aab2b2] focus:border-[#587c89] focus:bg-white focus:ring-4 focus:ring-[#587c89]/10"/>
              </label>)}
              <label className="grid gap-2 text-xs font-bold text-[#536b79] sm:col-span-2">
                Votre projet <span className="font-normal text-[#87949b]">(facultatif)</span>
                <textarea name="note" rows={5} defaultValue={(params.projet??"").slice(0,1500)} maxLength={1500} placeholder="Ex. : première implantation, extension de gamme, demande de rendez-vous ou de conditions commerciales…" className="rounded-xl border border-[#d9e0df] bg-[#fdfdfb] px-4 py-3 text-sm font-medium text-[#142941] outline-none transition placeholder:text-[#aab2b2] focus:border-[#587c89] focus:bg-white focus:ring-4 focus:ring-[#587c89]/10"/>
              </label>
            </div>
            <div aria-hidden="true" className="absolute -left-[10000px]"><input name="website" tabIndex={-1} autoComplete="off"/></div>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-lg text-[11px] leading-5 text-[#7a8990]">Vos coordonnées sont utilisées pour traiter votre demande. Aucun engagement de commande n'est créé. <Link href="/politique-de-confidentialite" className="font-semibold underline underline-offset-2">Confidentialité</Link>.</p>
              <button className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#e9bd94] px-7 py-3 text-sm font-extrabold text-[#142941] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f1cda9]">
                Envoyer ma demande <ArrowRight size={17}/>
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="mt-8 flex flex-col gap-4 border-t border-[#e4e3dc] pt-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold text-[#142941]">Le rôle de TR1 PHARMA</p>
          <p className="mt-2 text-xs leading-6 text-[#77848a]">TR1 PHARMA est votre interlocuteur commercial et votre partenaire terrain. La marque concernée confirme les conditions définitives, la disponibilité, la facturation et la livraison des produits. Une demande de présentation ou d'étude d'implantation n'est pas une commande.</p>
        </div>
        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a66a43]">TR1 PHARMA · Officine & terrain</span>
      </section>
    </div>
  </main>;
}
