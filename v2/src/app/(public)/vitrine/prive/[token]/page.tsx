import type {Metadata} from "next";
import Link from "next/link";
import {createServerSupabase} from "@/lib/supabase/server";
import {PublicCatalogueClient,type PublicCatalogueData} from "@/components/catalogue/public-catalogue";
import {SupplierEstimates,type SupplierEstimate} from "@/components/catalogue/supplier-estimates";
import {InvitationLogin} from "@/components/auth/invitation-login";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Catalogue professionnel privé | TR1 PHARMA",robots:{index:false,follow:false,nocache:true},referrer:"no-referrer"};
export default async function PrivateCatalogue({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{erreur?:string;devis?:string}>}){
 const {token}=await params;const qs=await searchParams;
 const db=await createServerSupabase();if(!db)throw new Error("Catalogue indisponible.");
 const valid=/^[a-f0-9]{64}$/.test(token);
 const [result,state,auth]=await Promise.all([valid?db.rpc("catalogue_link_data",{p_token:token}):Promise.resolve({data:null,error:null}),valid?db.rpc("catalogue_invitation_status",{p_token:token}):Promise.resolve({data:null,error:null}),db.auth.getUser()]);
 if(result.error||state.error)throw new Error("Impossible de charger le catalogue privé.");
 const user=auth.data.user,activated=state.data==="activated";
 if(state.data==="login_required")return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-3xl font-bold">Retrouvez votre catalogue privé</h1><p className="mt-3 text-sm text-[#69717d]">Votre invitation a été activée. Ce même lien reste valable : connectez-vous pour retrouver vos tarifs et votre espace officine.</p>{qs.erreur&&<p className="mt-3 text-sm text-red-800">Connexion échouée. Demandez un nouveau lien de connexion.</p>}<InvitationLogin token={token} signedIn={!!user}/>{estimates.length>0&&<SupplierEstimates estimates={estimates} token={token} email={allowed?user?.email??"":""} result={qs.devis??""}/>}</main>;
 const data=result.data as (PublicCatalogueData&{pharmacy:{name:string;city:string|null};expires_at:string})|null;
 if(!data||state.data==="legacy")return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-bold">Ce lien n’est plus disponible</h1><p className="mt-3 text-sm">Demandez un nouveau lien à votre interlocuteur TR1.</p><Link href="/vitrine#contact" className="mt-5 inline-block rounded-lg bg-[#142941] px-4 py-3 text-sm font-bold text-white">Contacter TR1</Link></main>;
 const estimateResult=await db.rpc("invitation_supplier_estimates",{p_token:token});
 const estimates=estimateResult.error?[]:(estimateResult.data??[]) as SupplierEstimate[];
 const allowed=user?.email?(activated?true:(await db.rpc("catalogue_invitation_email_allowed",{p_token:token,p_email:user.email})).data===true):false;
 return <main id="contenu" className="mx-auto max-w-7xl px-4 py-6 sm:px-7"><div className="mb-3 flex flex-wrap justify-between gap-3"><p className="text-xs font-semibold text-[#69717d]">{activated?"Compte activé · accès permanent réservé à votre officine":"Invitation valable jusqu’au "+new Date(data.expires_at).toLocaleDateString("fr-FR")+" · ne pas diffuser publiquement."}</p>{activated&&<Link href="/catalogue" className="text-sm font-bold underline">Mon espace officine</Link>}</div><PublicCatalogueClient key={token} data={{brands:data.brands,products:data.products}} error={qs.erreur??""} token={token} pharmacy={data.pharmacy} authEmail={allowed?user?.email??null:null} activated={activated} signedIn={!!user}/></main>;
}
