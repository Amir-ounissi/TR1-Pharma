import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft,ArrowRight,ArrowUpRight} from "lucide-react";
import {createServerSupabase} from "@/lib/supabase/server";
import {BrandHero,BrandLogo} from "../../brand-visuals";
import {BrandProductTable,type CatalogueProduct} from "./brand-product-table";

type Brand={id:string;name:string;slug:string;description:string|null};
type PublicCatalogue={brands?:Brand[];products?:Array<CatalogueProduct&{brand_slug:string}>};
const profiles:Record<string,{origin:string;segment:string;story:string;interest:string;site:string;theme:string}> = {
 "beauty-of-joseon":{origin:"Corée du Sud",segment:"K-beauty · Rituels visage",story:"Beauty of Joseon revisite le Hanbang, héritage coréen des ingrédients végétaux, dans des soins contemporains. Le riz, le ginseng et les routines quotidiennes structurent son univers.",interest:"Construire un rayon K-beauty lisible autour du nettoyage, des sérums, de l'hydratation et de la protection solaire.",site:"https://beautyofjoseon.com/pages/about-beauty-of-joseon",theme:"from-[#6d473e] to-[#e7c9b5]"},
 biodance:{origin:"Corée du Sud",segment:"K-beauty · Masques & soins",story:"Biodance est née de l'expérience de sa fondatrice Mihwa dans l'univers de la beauté coréenne. La marque a développé son identité autour des masques hydrogel et de l'expérience d'application.",interest:"Développer un espace masques et soins complémentaires, avec des formats découverte et des achats d'impulsion.",site:"https://biodance.com/pages/our-story-mihwa",theme:"from-[#365e65] to-[#dce8e4]"},
 "dr-althea":{origin:"Corée du Sud",segment:"K-beauty · Dermocosmétique",story:"Dr. Althea développe un univers de soins orienté vers les peaux sensibles et le confort cutané. Sa philosophie associe recherche cosmétique et formules destinées aux routines quotidiennes.",interest:"Proposer une alternative K-beauty dans les rayons hydratation et soins ciblés, avec un conseil adapté aux besoins de la peau.",site:"https://doctoraltheaglobal.com/pages/about-us",theme:"from-[#55435d] to-[#e7dce9]"},
 medicube:{origin:"Corée du Sud",segment:"K-beauty · Soins ciblés",story:"Medicube associe soins cosmétiques et technologies de beauté. La marque construit ses gammes autour de préoccupations spécifiques de la peau et de routines ciblées.",interest:"Structurer le rayon par besoins et formats : nettoyants, pads, sérums, crèmes et masques selon l'assortiment disponible.",site:"https://medicube.us/fr/pages/brandstory",theme:"from-[#6d3439] to-[#ead6d7]"},
 cosrx:{origin:"Corée du Sud",segment:"K-beauty · Soins visage",story:"COSRX développe des routines de soins centrées sur les besoins de la peau. Son univers s'organise autour de familles d'ingrédients et de produits ciblés, dont les soins à la mucine d'escargot.",interest:"Composer une offre de routines courtes ou complètes selon le positionnement du rayon et la clientèle.",site:"https://www.cosrx.com/pages/about-us-old",theme:"from-[#5d5947] to-[#e7dfcb]"},
 bloomster:{origin:"France",segment:"Micronutrition · Champignons",story:"Bloomster est née d'une approche de la micronutrition inspirée des usages traditionnels des champignons et des connaissances nutritionnelles contemporaines.",interest:"Créer un espace dédié aux champignons et compléter une offre existante de micronutrition.",site:"https://www.bloomster.fr/notre-naissance/",theme:"from-[#294b3c] to-[#dce5d9]"},
 vitalora:{origin:"France",segment:"Micronutrition · Essentiels",story:"Vitalora est née d'une volonté de rendre la micronutrition plus lisible, avec des formules organisées autour des besoins du quotidien et un positionnement axé sur la transparence.",interest:"Construire un assortiment d'essentiels, élargissable par besoins, et étudier la rentabilité selon les quantités.",site:"https://vitalora.fr/la-marque",theme:"from-[#414b39] to-[#e2e6d2]"},
 noto:{origin:"France",segment:"Bien-être · Soins",story:"NŌTO fait partie de l'univers Althesia Pharma. La marque s'intéresse à différents besoins du quotidien, notamment le bien-être et le sommeil.",interest:"Identifier les références adaptées au rayon bien-être et retenir les produits dont le statut de commercialisation permet une implantation.",site:"https://althesiapharma.com/marques",theme:"from-[#2c5149] to-[#d9e7dc]"},
 "vk-swiss":{origin:"Suisse",segment:"Compléments · Ayurveda",story:"VK Swiss associe des plantes issues de la tradition ayurvédique à du ghee produit en Suisse. La marque a construit son concept autour de cette association.",interest:"Différencier un rayon compléments alimentaires avec une approche inspirée de l'Ayurveda, à accompagner par le conseil officinal.",site:"https://www.vk-swiss.ch/",theme:"from-[#514630] to-[#eee2c6]"},
};
const money=(n:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n);
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;return {title:(profiles[slug]?.segment||"Catalogue professionnel")+" | TR1 PHARMA",description:"Découvrez la marque, son assortiment et ses conditions indicatives. Préparez votre implantation officinale."};
}
export default async function BrandCataloguePage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createServerSupabase();if(!db)throw new Error("Catalogue indisponible.");
 const {data,error}=await db.rpc("public_catalogue_data");if(error)throw new Error("Catalogue indisponible.");
 const catalogue=(data as PublicCatalogue|null)??{};const brand=(catalogue.brands??[]).find(x=>x.slug===slug);if(!brand)notFound();
 const products=(catalogue.products??[]).filter(p=>p.brand_slug===slug);
 const profile=profiles[slug]??{origin:"",segment:"Catalogue professionnel",story:brand.description||"Découvrez la marque.",interest:"Étudiez votre assortiment avec TR1 PHARMA.",site:"",theme:"from-[#334c58] to-[#e3e9e7]"};
 const eligible=products.filter(p=>p.requestable!==false);const prices=eligible.map(p=>Number(p.price_ht)).filter(p=>p>0&&Number.isFinite(p));const matched=eligible.filter(p=>Number(p.retail_ttc)>0&&Number(p.price_ht)>0);
 const avg=prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:0;const avgCoef=matched.length?matched.reduce((a,p)=>a+Number(p.retail_ttc)/Number(p.price_ht),0)/matched.length:0;
 return <main className="min-h-screen bg-[#fbfaf7] text-[#142941]">
 <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-5 sm:px-7 lg:px-10">
 <Link href="/vitrine#marques" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#526a76]"><ArrowLeft size={16}/> Toutes les marques</Link>
 <section className={"relative isolate mt-3 overflow-hidden rounded-[28px] bg-gradient-to-br "+profile.theme}>
 <div className="absolute inset-0 opacity-65"><BrandHero slug={brand.slug} name={brand.name}/></div><div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#10283d]/95 via-[#10283d]/80 to-[#10283d]/25"/>
 <div className="relative max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
 <div className="inline-flex rounded-xl bg-white px-4 py-2"><BrandLogo slug={brand.slug} name={brand.name} compact/></div>
 <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#efc39b]">{profile.origin} · {profile.segment}</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{brand.name}</h1>
 <p className="mt-4 max-w-xl text-sm leading-7 text-white/90">{profile.story}</p>
 <div className="mt-6 flex flex-wrap gap-3"><a href="#assortiment" className="rounded-full bg-[#edc197] px-5 py-3 text-sm font-bold">Explorer l'assortiment <ArrowRight className="ml-1 inline" size={16}/></a>{profile.site&&<a href={profile.site} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white">Découvrir la marque <ArrowUpRight className="ml-1 inline" size={16}/></a>}</div>
 </div></section>
 <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
 {[[String(eligible.length),"Références à étudier"],[prices.length?money(Math.min(...prices))+" – "+money(Math.max(...prices)):"Sur devis","Fourchette d'achat HT"],[avg?money(avg):"Sur devis","Prix d'achat moyen HT"],[avgCoef?"× "+avgCoef.toFixed(2):"À simuler",avgCoef?"Coef. moyen sur "+matched.length+" PVC conseillés":"Coefficient personnalisable"]].map(([value,label])=><div key={label} className="rounded-2xl border border-[#e0e4df] bg-white p-4"><p className="text-lg font-bold tracking-tight sm:text-xl">{value}</p><p className="mt-1 text-xs text-[#64747c]">{label}</p></div>)}
 </section>
 <p className="mt-2 text-[11px] text-[#64747c]">Repères indicatifs, calculés sur les références disponibles dans le catalogue, hors remises et unités gratuites. Le coefficient est le PVC TTC divisé par le PA HT.</p>
 <section className="mt-5 rounded-2xl border border-[#e0e4df] bg-white p-5 sm:p-6"><h2 className="text-lg font-extrabold">Quel intérêt pour votre officine ?</h2><p className="mt-2 text-sm leading-6 text-[#64747c]">{profile.interest}</p><p className="mt-3 text-xs leading-5 text-[#64747c]">TR1 PHARMA vous accompagne dans le choix de l'assortiment et les conditions de référencement. La marque confirme les tarifs, la disponibilité, la facturation et la livraison.</p></section>
 <section id="assortiment" className="mt-8 scroll-mt-20"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#a66a43]">Votre assortiment</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Composez votre implantation</h2><p className="mt-2 text-sm text-[#64747c]">Recherchez, comparez les prix et choisissez les quantités pour estimer votre budget.</p></div></div>
 <BrandProductTable products={products} slug={slug}/></section>
 <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#e9eee9] p-6"><div><h2 className="text-lg font-bold">Besoin d'un assortiment adapté à votre officine ?</h2><p className="mt-2 text-sm text-[#64747c]">Demandez une étude sans engagement, même sans sélection de produits.</p></div><Link href={"/vitrine?marque="+encodeURIComponent(slug)+"#contact"} className="rounded-full bg-[#142941] px-5 py-3 text-sm font-bold text-white">Être accompagné <ArrowRight className="ml-1 inline" size={16}/></Link></section>
 </div></main>;
}
