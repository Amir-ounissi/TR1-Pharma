import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createServerSupabase} from "@/lib/supabase/server";
import {ClearInvitationCart} from "@/components/catalogue/clear-invitation-cart";
export const metadata:Metadata={robots:{index:false,follow:false,nocache:true},referrer:"no-referrer"};
export const dynamic="force-dynamic";
export default async function Merci({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{envoye?:string}>}){const {token}=await params;const qs=await searchParams;if(!/^[a-f0-9]{64}$/.test(token))redirect("/vitrine");const db=await createServerSupabase();const status=db?await db.rpc("catalogue_invitation_status",{p_token:token}):null;if(status?.data!=="activated"||qs.envoye!=="1")redirect("/vitrine/prive/"+token);return <main className="mx-auto max-w-xl px-5 py-16"><ClearInvitationCart token={token}/><h1 className="text-3xl font-bold">Votre demande est enregistrée et votre compte est actif</h1><p className="mt-4 text-sm leading-6 text-[#69717d]">Vous pouvez conserver le même lien : il ne sera plus limité à 30 jours. TR1 vérifie votre sélection et la transmet aux marques concernées. Aucun paiement en ligne.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/catalogue" className="rounded-lg bg-[#142941] px-5 py-3 text-sm font-bold text-white">Mon espace officine</Link><Link href={"/vitrine/prive/"+token} className="rounded-lg border px-5 py-3 text-sm font-bold">Retour à mon catalogue</Link></div></main>;}
