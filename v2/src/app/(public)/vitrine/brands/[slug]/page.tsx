import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft,ArrowRight,BadgeInfo,ShieldCheck} from "lucide-react";
import {createServerSupabase} from "@/lib/supabase/server";
import {BrandHero,BrandLogo} from "../../brand-visuals";
import {BrandProductTable,type CatalogueProduct} from "./brand-product-table";

type Brand={id:string;name:string;slug:string;description:string|null};

type PublicCatalogue={
  brands?:Brand[];
  products?:Array<CatalogueProduct&{
    brand_id:string;
    brand_slug:string;
    brand_name:string;
    source_catalog:string|null;
    source_document:string|null;
    price_status:string|null;
  }>;
};

const profiles:Record<string,{segment:string;intro:string;theme:string}> = {
  "beauty-of-joseon":{
    segment:"K-beauty · Soins du visage",
    intro:"Une gamme de soins coréens inspirés des ingrédients traditionnels et des routines contemporaines.",
    theme:"from-[#6d473e] via-[#a67b68] to-[#e7c9b5]",
  },
  biodance:{
    segment:"K-beauty · Masques & soins",
    intro:"Des soins coréens axés sur l'hydratation, l'éclat et le confort cutané.",
    theme:"from-[#365e65] via-[#789b9a] to-[#dce8e4]",
  },
  "dr-althea":{
    segment:"K-beauty · Dermocosmétique",
    intro:"Des soins coréens formulés autour du confort cutané et de la barrière cutanée.",
    theme:"from-[#55435d] via-[#9b829c] to-[#e7dce9]",
  },
  medicube:{
    segment:"K-beauty · Skin care & beauty tech",
    intro:"Une gamme de soins et d'appareils orientés vers les besoins ciblés de la peau.",
    theme:"from-[#6d3439] via-[#a86d72] to-[#ead6d7]",
  },
  noto:{
    segment:"Bien-être · Gammes naturelles",
    intro:"Une sélection de références bien-être et de soins de la gamme NŌTO.",
    theme:"from-[#2c5149] via-[#668a78] to-[#d9e7dc]",
  },
  vitalora:{
    segment:"Micronutrition · Compléments alimentaires",
    intro:"Une gamme de micronutrition structurée autour de besoins quotidiens et de formules ciblées.",
    theme:"from-[#414b39] via-[#89936d] to-[#e2e6d2]",
  },
  "vk-swiss":{
    segment:"Compléments alimentaires · Tradition ayurvédique",
    intro:"Des compléments inspirés de la tradition ayurvédique et associés au ghee suisse.",
    theme:"from-[#514630] via-[#9c8658] to-[#eee2c6]",
  },
};

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const label=profiles[slug]?.segment||"Catalogue professionnel";
  return {
    title:"Catalogue professionnel | TR1 PHARMA",
    description:label+" — références, formats, EAN et tarifs fournisseurs HT indicatifs.",
  };
}

export default async function BrandCataloguePage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const db=await createServerSupabase();
  if(!db)throw new Error("Catalogue de marque indisponible.");
  const {data,error}=await db.rpc("public_catalogue_data");
  if(error)throw new Error("Impossible de charger le catalogue de la marque.");
  const catalogue=(data as PublicCatalogue|null)??{};
  const brand=(catalogue.brands??[]).find(item=>item.slug===slug);
  if(!brand)notFound();
  const products=(catalogue.products??[])
    .filter(product=>product.brand_slug===slug)
    .sort((a,b)=>(a.category||"").localeCompare(b.category||"","fr")||a.name.localeCompare(b.name,"fr"));
  if(!products.length)notFound();
  const profile=profiles[slug]??{
    segment:"Catalogue professionnel",
    intro:brand.description||"Découvrez les références de cette marque proposées aux officines.",
    theme:"from-[#334c58] via-[#82969b] to-[#e3e9e7]",
  };
  const categories=new Set(products.map(product=>product.category||"Autres références"));

  return <main className="min-h-screen bg-[#fbfaf7] text-[#142941]">
    <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-5 sm:px-7 lg:px-10 lg:pt-8">
      <Link href="/vitrine#marques" className="inline-flex items-center gap-2 text-xs font-bold text-[#647782] transition hover:text-[#a66a43]">
        <ArrowLeft size={15}/> Retour aux marques
      </Link>

      <section className={`relative isolate mt-5 min-h-[300px] overflow-hidden rounded-[28px] bg-gradient-to-br ${profile.theme} shadow-[0_20px_55px_rgba(20,41,65,0.16)]`}>
        <div className="absolute inset-0 opacity-65"><BrandHero slug={brand.slug} name={brand.name}/></div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#10283d]/90 via-[#10283d]/65 to-[#10283d]/20"/>
        <div className="relative flex min-h-[300px] flex-col justify-end gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/90">Catalogue professionnel · Officines</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{brand.name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">{profile.segment}</p>
            <div className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-white/80 bg-white px-4 py-2 shadow-sm">
              <BrandLogo slug={brand.slug} name={brand.name} compact/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[250px]">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-semibold text-white tabular-nums">{products.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">Références</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-semibold text-white tabular-nums">{categories.size}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">Familles</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#e6e2d9] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <BadgeInfo size={20} className="mt-0.5 shrink-0 text-[#a66a43]"/>
          <div>
            <h2 className="text-sm font-extrabold text-[#203b4d]">Informations commerciales</h2>
            <p className="mt-2 text-xs leading-6 text-[#6e7b81]">{profile.intro} Les prix fournisseurs HT affichés sont ceux enregistrés dans le catalogue TR1 PHARMA. Ils sont présentés à titre indicatif et peuvent être confirmés par la marque ou son fournisseur avant commande.</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#a66a43]">Assortiment fournisseur</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Références & tarifs</h2>
          </div>
          <p className="text-xs text-[#77858b]">Visuels disponibles · EAN · Formats · Prix unitaires HT</p>
        </div>
        <BrandProductTable products={products}/>
      </section>

      <section className="mt-9 flex flex-col gap-5 rounded-[24px] bg-[#142941] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#efc39b]">Projet d'implantation</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Étudier {brand.name} dans votre officine</h2>
          <p className="mt-2 text-xs leading-6 text-white/75">TR1 PHARMA centralise votre demande et vous accompagne dans l'étude de l'assortiment. La marque ou le fournisseur prend en charge la confirmation de commande, la facturation et la livraison.</p>
        </div>
        <Link href={`/vitrine?marque=${encodeURIComponent(brand.slug)}#contact`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-[#edc197] px-6 py-3 text-sm font-extrabold text-[#142941] transition hover:bg-[#f5d3b1]">
          Demander une étude d'implantation <ArrowRight size={16}/>
        </Link>
      </section>

      <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#879399]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0"/>
        Ce catalogue est un support de présentation commerciale. Les disponibilités, conditions commerciales, facturation et livraison sont confirmées par la marque ou son fournisseur.
      </p>
    </div>
  </main>;
}
