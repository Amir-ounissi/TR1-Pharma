"use server";
import {cookies,headers} from "next/headers";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createServerSupabase} from "@/lib/supabase/server";
export type InvitationState={error?:string;sent?:boolean};
const tokenPattern=/^[a-f0-9]{64}$/;
export async function requestInvitationLogin(_state:InvitationState,form:FormData):Promise<InvitationState>{
 const p=z.object({token:z.union([z.string().regex(tokenPattern),z.literal("")]),email:z.email().max(254)}).safeParse({token:form.get("token")??"",email:form.get("email")});
 if(!p.success)return {error:"Adresse e-mail invalide."};
 const db=await createServerSupabase();if(!db)return {error:"Connexion indisponible."};
 const email=p.data.email.trim().toLowerCase();let shouldCreateUser=false;
 if(p.data.token){const [allowed,status]=await Promise.all([db.rpc("catalogue_invitation_email_allowed",{p_token:p.data.token,p_email:email}),db.rpc("catalogue_invitation_status",{p_token:p.data.token})]);if(allowed.error||status.error||!allowed.data)return {error:"Cette adresse n’est pas autorisée pour ce lien. Contactez TR1."};shouldCreateUser=status.data==="invited";}
 const h=await headers();const host=h.get("host")??"";
 const allowedHosts=[process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL,process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//,"").replace(/\/$/,"")].filter(Boolean);
 const origin=allowedHosts.includes(host)?"https://"+host:process.env.VERCEL_URL?"https://"+process.env.VERCEL_URL:null;
 if(!origin)return {error:"Adresse de retour non configurée. Contactez TR1."};
 const {error}=await db.auth.signInWithOtp({email,options:{shouldCreateUser,emailRedirectTo:origin+"/auth/callback"}});
 if(error)return {error:"Impossible d’envoyer le lien. Vérifiez l’adresse ou réessayez ultérieurement."};
 const jar=await cookies();jar.set("tr1_invitation_return",p.data.token?"/vitrine/prive/"+p.data.token:"/catalogue",{httpOnly:true,secure:true,sameSite:"lax",path:"/auth/callback",maxAge:3600});
 return {sent:true};
}
export async function logoutInvitation(form:FormData){const t=z.string().regex(tokenPattern).parse(form.get("token"));const db=await createServerSupabase();if(db)await db.auth.signOut();redirect("/vitrine/prive/"+t);}
