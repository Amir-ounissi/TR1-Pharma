import type {Metadata} from "next";
import Link from "next/link";
import {createServerSupabase} from "@/lib/supabase/server";
import {PublicCatalogueClient,type PublicCatalogueData} from "@/components/catalogue/public-catalogue";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Catalogue professionnel privé | TR1 PHARMA",robots:{index:false,follow:false,nocache:true},referrer:"no-referrer"};
export default async function PrivateCatalogue({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{erreur?:string}>}){
 const {token}=await params;const qs=await searchParams;
 const db=await createServerSupabase();if(!db)throw new Error("Catalogue indisponible.");
 const result=/^[a-f0-9]{64}$/.test(token)?await db.rpc("catalogue_link_data",{p_token:token}):{data:null,error:null};
 if(result.error)throw new Error("Impossible de charger le catalogue privé.");
 const data=result.data as (PublicCatalogueData&{pharmacy:{name:string;city:string|null};expires_at:string})|null;
 if(!data)return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-bold">Ce lien n’est plus disponible</h1><p className="mt-3 text-sm">Demandez un nouveau lien à votre interlocuteur TR1.</p><Link href="/vitrine#contact" className="mt-5 inline-block rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Contacter TR1</Link></main>;
 return <main id="contenu" className="mx-auto max-w-7xl px-4 py-6 sm:px-7"><p className="mb-3 text-xs font-semibold text-[#69717d]">Lien réservé à votre officine · valable jusqu’au {new Date(data.expires_at).toLocaleDateString("fr-FR")} · ne pas diffuser publiquement.</p><PublicCatalogueClient key={token} data={{brands:data.brands,products:data.products}} error={qs.erreur??""} token={token} pharmacy={data.pharmacy}/></main>;
}
