import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {createServerSupabase} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get("code"),jar=await cookies();
 const saved=jar.get("tr1_invitation_return")?.value??"/catalogue";
 const next=/^\/vitrine\/prive\/[a-f0-9]{64}$/.test(saved)?saved:"/catalogue";
 const db=await createServerSupabase();const result=code&&db?await db.auth.exchangeCodeForSession(code):null;
 const destination=result&&!result.error?next+(next.startsWith("/vitrine/")?"#transmission":""):next.startsWith("/vitrine/")?next+"?erreur=connexion":"/catalogue/connexion?erreur=connexion";
 const response=NextResponse.redirect(new URL(destination,url.origin));response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");response.cookies.set("tr1_invitation_return","",{path:"/auth/callback",maxAge:0});return response;
}
