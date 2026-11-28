import type {Metadata} from "next";
import Link from "next/link";
import {ArrowLeft,ArrowRight,BadgeInfo,ShieldCheck} from "lucide-react";
import {notFound} from "next/navigation";
import {createServerSupabase} from "@/lib/supabase/server";
import {BrandLogo} from "../brand-visuals";

export const metadata:Metadata={
  title:"Catalogue professionnel Bloomster | TR1 PHARMA",
  description:"Découvrez les références Bloomster en officine : photos produits, formats, EAN et tarifs fournisseurs HT indicatifs.",
};

type Product={
  id:string;
  brand_slug:string;
  name:string;
  ean:string;
  format:string|null;
  category:string|null;
  price_ht:number|string;
  image_url:string|null;
  source_document:string|null;
};

function money(value:number|string){
  return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(value));
}

export default async function BloomsterCataloguePage(){
  const db=await createServerSupabase();
  if(!db)throw new Error("Catalogue Bloomster indisponible.");
  const {data,error}=await db.rpc("public_catalogue_data");
  if(error)throw new Error("Impossible de charger le catalogue Bloomster.");
  const products=((data as {products?:Product[]}|null)?.products??[])
    .filter(product=>product.brand_slug==="bloomster" && product.image_url);
  if(!products.length)notFound();
  const categories=[...new Set(products.map(product=>product.category||"AUTRES RÉFÉRENCES"))];

  return <main className="min-h-screen bg-[#f7f7f1] text-[#1d352d]">
    <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-5 sm:px-7 lg:px-10 lg:pt-8">
      <Link href="/vitrine#marques" className="inline-flex items-center gap-2 text-xs font-bold text-[#61756a] transition hover:text-[#9a7446]">
        <ArrowLeft size={15}/> Retour aux marques
      </Link>

      <section className="relative isolate mt-5 overflow-hidden rounded-[28px] bg-[#294b3c] shadow-[0_20px_55px_rgba(31,62,48,0.15)]">
        <div className="absolute inset-0 opacity-35">
          <img src="https://www.bloomster.fr/wp-content/uploads/2024/05/Untitled-design-1.png" alt="" className="h-full w-full object-cover" />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#19382c] via-[#254b3b]/90 to-[#254b3b]/25"/>
        <div className="relative flex min-h-[300px] flex-col justify-end gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#e9eaa8]">Catalogue professionnel · Officines</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Bloomster</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">Micronutrition · Champignons · Vitamines · Bien-être</p>
            <div className="mt-5 inline-flex rounded-xl border border-white/70 bg-white px-4 py-2"><BrandLogo slug="bloomster" name="Bloomster" compact/></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[250px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-semibold text-white tabular-nums">{products.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Références</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-semibold text-white tabular-nums">{categories.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Familles</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#e6dfc8] bg-[#fbf7e9] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <BadgeInfo size={20} className="mt-0.5 shrink-0 text-[#8a7544]"/>
          <div>
            <h2 className="text-sm font-extrabold text-[#5e573b]">Informations commerciales</h2>
            <p className="mt-2 text-xs leading-6 text-[#71694e]">Les visuels produits sont présentés avec les références de l'assortiment Bloomster. Les prix fournisseurs affichés sont indicatifs et doivent être confirmés par la marque avant toute commande. Les disponibilités, conditions commerciales, étiquetages et éléments réglementaires restent à valider auprès du fournisseur.</p>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8c7549]">Assortiment Bloomster</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Les produits de la gamme</h2>
          </div>
          <p className="text-xs text-[#77877d]">Visuels · EAN · Format · Prix unitaire HT indicatif</p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product=><article key={product.id} className="group overflow-hidden rounded-[22px] border border-[#e0e5dc] bg-white shadow-[0_7px_24px_rgba(31,62,48,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(31,62,48,0.11)]">
            <div className="relative flex h-[250px] items-center justify-center overflow-hidden bg-[#f0f3eb] p-4">
              <img src={product.image_url!} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.035]"/>
              <span className="absolute left-4 top-4 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#607365] shadow-sm">{product.category||"Bloomster"}</span>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-extrabold leading-snug tracking-[-0.025em] text-[#234333]">{product.name}</h3>
              <p className="mt-2 text-xs text-[#7b8980]">{product.format||"Format non précisé"}</p>
              <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-[#edf0e9] pt-4">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8c9a8f]">EAN</p>
                  <p className="mt-1 font-mono text-[11px] text-[#52665a]">{product.ean}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8c9a8f]">Prix HT indicatif</p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-[#234333]">{money(product.price_ht)}</p>
                </div>
              </div>
            </div>
          </article>)}
        </div>
      </section>

      <section className="mt-9 flex flex-col gap-5 rounded-[24px] bg-[#294b3c] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#e9eaa8]">Projet d'implantation</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Étudier Bloomster dans votre officine</h2>
          <p className="mt-2 text-xs leading-6 text-white/75">TR1 PHARMA centralise votre demande et vous accompagne dans l'étude de l'assortiment. La marque ou le fournisseur confirme les tarifs, stocks, conditions, facturation et livraison.</p>
        </div>
        <Link href="/vitrine?marque=bloomster#contact" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-[#e6e8a5] px-6 py-3 text-sm font-extrabold text-[#234333] transition hover:bg-[#f0f1bd]">
          Demander une étude d'implantation <ArrowRight size={16}/>
        </Link>
      </section>

      <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#87948a]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0"/>
        Ce catalogue est un support de présentation commerciale. L'affichage d'une référence ou d'un tarif ne constitue ni une confirmation de disponibilité, ni une offre ferme, ni une commande.
      </p>
    </div>
  </main>;
}
