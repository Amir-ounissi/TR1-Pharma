import type {Metadata} from "next";
import Link from "next/link";
import {ArrowLeft, ArrowRight, BadgeInfo, ShieldCheck} from "lucide-react";
import {notFound} from "next/navigation";
import {createServerSupabase} from "@/lib/supabase/server";
import {BrandHero,BrandLogo} from "../brand-visuals";

export const metadata:Metadata={
  title:"Catalogue professionnel COSRX | TR1 PHARMA",
  description:"104 références COSRX présentées aux officines avec EAN, formats, unités par carton et tarifs fournisseurs HT indicatifs.",
};

type Product={
  id:string;
  brand_slug:string;
  name:string;
  ean:string;
  format:string|null;
  category:string|null;
  price_ht:number|string;
  units_per_carton:number|null;
  source_catalog:string|null;
};

function money(value:number|string){
  return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(value));
}

export default async function CosrxCataloguePage(){
  const db=await createServerSupabase();
  if(!db)throw new Error("Catalogue COSRX indisponible.");
  const {data,error}=await db.rpc("public_catalogue_data");
  if(error)throw new Error("Impossible de charger le catalogue COSRX.");
  const products=((data as {products?:Product[]}|null)?.products??[])
    .filter(product=>product.brand_slug==="cosrx");
  if(!products.length)notFound();
  const categories=[...new Set(products.map(product=>product.category||"AUTRES RÉFÉRENCES"))];

  return <main className="min-h-screen bg-[#fbfaf7] text-[#142941]">
    <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-5 sm:px-7 lg:px-10 lg:pt-8">
      <Link href="/vitrine#marques" className="inline-flex items-center gap-2 text-xs font-bold text-[#647782] transition hover:text-[#a66a43]">
        <ArrowLeft size={15}/> Retour aux marques
      </Link>

      <section className="relative isolate mt-5 min-h-[290px] overflow-hidden rounded-[28px] bg-[#142941] shadow-[0_20px_55px_rgba(20,41,65,0.16)]">
        <div className="absolute inset-0 opacity-35"><BrandHero slug="cosrx" name="COSRX"/></div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#10283d] via-[#10283d]/90 to-[#10283d]/35"/>
        <div className="relative flex min-h-[290px] flex-col justify-end gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#efc39b]">Catalogue professionnel · Officines</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Catalogue COSRX</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Soins coréens du visage · Nettoyants · Hydratation · Soins ciblés</p>
            <div className="mt-5 inline-flex rounded-xl border border-white/70 bg-white px-4 py-2"><BrandLogo slug="cosrx" name="COSRX" compact/></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[250px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-semibold text-white tabular-nums">{products.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Références</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-semibold text-white tabular-nums">{categories.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Familles</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#e6d6bd] bg-[#fbf4e9] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <BadgeInfo size={20} className="mt-0.5 shrink-0 text-[#a66a43]"/>
          <div>
            <h2 className="text-sm font-extrabold text-[#63472f]">Tarifs fournisseurs HT indicatifs</h2>
            <p className="mt-2 text-xs leading-6 text-[#745f4b]">Les prix unitaires HT, EAN, formats et unités par carton sont reproduits à partir du catalogue professionnel Amalfi transmis à TR1 PHARMA (104 références). Le document précise que les tarifs sont indicatifs et sous réserve de confirmation. Disponibilités, conditions commerciales et conformité UE sont à vérifier avant toute commande.</p>
            <p className="mt-2 text-[11px] font-semibold text-[#745f4b]">Source : Catalogue_commercial_COSRX.pdf · Amalfi · 8 pages</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#a66a43]">Assortiment fournisseur</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Les références et tarifs</h2>
          </div>
          <p className="text-xs text-[#77858b]">Prix unitaire HT · EAN produit</p>
        </div>

        <div className="mt-5 space-y-3">
          {categories.map((category,index)=>{
            const rows=products.filter(product=>(product.category||"AUTRES RÉFÉRENCES")===category);
            return <details key={category} open={index===0} className="group overflow-hidden rounded-2xl border border-[#e2e5e1] bg-white shadow-[0_5px_18px_rgba(20,41,65,0.035)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#f8f7f3] [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-sm font-extrabold text-[#203b4d]">{category}</span>
                  <span className="mt-1 block text-[11px] text-[#879399]">{rows.length} références</span>
                </span>
                <span className="rounded-full bg-[#edf1ed] px-3 py-1.5 text-[11px] font-bold text-[#31576a]">{rows.length}</span>
              </summary>
              <div className="overflow-x-auto border-t border-[#edf0ec]">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead className="bg-[#f8f8f5] text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#78868b]">
                    <tr>
                      <th className="px-5 py-3">Produit</th>
                      <th className="px-4 py-3">EAN</th>
                      <th className="px-4 py-3 text-center">Unités / carton</th>
                      <th className="px-5 py-3 text-right">Prix unitaire HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff0ec]">
                    {rows.map(product=><tr key={product.ean} className="transition hover:bg-[#fbfaf7]">
                      <td className="px-5 py-3.5">
                        <span className="block text-xs font-bold text-[#203b4d]">{product.name}</span>
                        <span className="mt-1 block text-[11px] text-[#849096]">{product.format||"Format non précisé"}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-[#687982]">{product.ean}</td>
                      <td className="px-4 py-3.5 text-center text-xs tabular-nums text-[#687982]">{product.units_per_carton??"—"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-sm font-extrabold tabular-nums text-[#142941]">{money(product.price_ht)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </details>;
          })}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-5 rounded-[24px] bg-[#142941] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#efc39b]">Projet d'implantation</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Étudier COSRX dans votre officine</h2>
          <p className="mt-2 text-xs leading-6 text-white/70">TR1 PHARMA centralise votre demande et vous accompagne dans l'étude de l'assortiment. La marque ou le fournisseur confirme les tarifs, stocks, conditions, conformité, facturation et livraison.</p>
        </div>
        <Link href="/vitrine?marque=cosrx#contact" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-[#e9bd94] px-6 py-3 text-sm font-extrabold text-[#142941] transition hover:bg-[#f1cda9]">
          Demander une étude d'implantation <ArrowRight size={16}/>
        </Link>
      </section>

      <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#879399]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0"/>
        Ce catalogue est un support de présentation commerciale. L'affichage d'une référence ou d'un tarif ne constitue ni une confirmation de disponibilité, ni une offre ferme, ni une commande.
      </p>
    </div>
  </main>;
}
