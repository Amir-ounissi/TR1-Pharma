"use server";
import {createHash,randomBytes} from "node:crypto";
import {z} from "zod";
import {requireOwner} from "@/lib/auth";
import {revalidatePath} from "next/cache";
export type LinkState={error?:string;path?:string;pharmacy?:string};
export async function generateCatalogueLink(_state:LinkState,form:FormData):Promise<LinkState>{
 const {db}=await requireOwner();const p=z.object({pharmacy_id:z.union([z.uuid(),z.literal("")]),name:z.string().trim().max(180),city:z.string().trim().max(120),days:z.coerce.number().int().refine(n=>[7,30,90].includes(n))}).safeParse(Object.fromEntries(["pharmacy_id","name","city","days"].map(k=>[k,form.get(k)??""])));
 if(!p.success)return {error:"Vérifiez les champs."};
 let pharmacyId=p.data.pharmacy_id,pharmacyName="";
 if(!pharmacyId){if(p.data.name.length<2||p.data.city.length<2)return {error:"Renseignez le nom et la ville de la nouvelle officine."};
 const {data:existing,error:lookupError}=await db.from("pharmacies").select("id,name").eq("name",p.data.name).eq("city",p.data.city).limit(1);
 if(lookupError)return {error:"Impossible de vérifier la pharmacie."};
 if(existing?.length){pharmacyId=existing[0].id;pharmacyName=existing[0].name;}else{const {data,error}=await db.from("pharmacies").insert({name:p.data.name,city:p.data.city}).select("id,name").single();if(error||!data)return {error:"Création de l’officine impossible."};pharmacyId=data.id;pharmacyName=data.name;}
 }else{const {data,error}=await db.from("pharmacies").select("name").eq("id",pharmacyId).single();if(error||!data)return {error:"Officine introuvable."};pharmacyName=data.name;}
 const token=randomBytes(32).toString("hex"),tokenHash=createHash("sha256").update(token).digest("hex");
 const {error}=await db.from("pharmacy_catalogue_links").insert({pharmacy_id:pharmacyId,token_hash:tokenHash,expires_at:new Date(Date.now()+p.data.days*86400000).toISOString()});
 if(error)return {error:"Lien non créé. Réessayez."};
 revalidatePath("/app/catalogue-public");revalidatePath("/app/catalogue-public/liens");revalidatePath("/app/pharmacies");return {path:"/vitrine/prive/"+token,pharmacy:pharmacyName};
}
export async function revokeCatalogueLink(form:FormData){
 const {db}=await requireOwner();const id=z.uuid().parse(form.get("id"));const {data,error}=await db.from("pharmacy_catalogue_links").update({revoked_at:new Date().toISOString()}).eq("id",id).is("revoked_at",null).select("id").maybeSingle();if(error||!data)throw new Error("Impossible de révoquer le lien.");revalidatePath("/app/catalogue-public/liens");
}
