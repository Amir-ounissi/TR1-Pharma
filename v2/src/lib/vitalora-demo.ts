import "server-only";
import { requirePharmacy } from "@/lib/auth";

const VITALORA_BRAND_ID = "8b119990-e3c3-40fa-b9cd-f40f86a50a7c";

export async function requireVitaloraDemo() {
  const { db, user } = await requirePharmacy();
  const { data: memberships, error: membershipError } = await db.from("pharmacy_memberships")
    .select("pharmacy_id").eq("user_id",user.id).eq("active",true);
  if(membershipError)throw new Error("Impossible de vérifier votre rattachement.");
  const ids=(memberships??[]).map(x=>x.pharmacy_id);
  const {data:grants,error:grantError}=ids.length
    ? await db.from("demo_catalogue_access")
      .select("pharmacy_id,brand_id").eq("brand_id",VITALORA_BRAND_ID)
      .eq("active",true).in("pharmacy_id",ids).limit(1)
    : {data:[],error:null};
  if(grantError)throw new Error("Impossible de vérifier les autorisations de démonstration.");
  const pharmacyId=grants?.[0]?.pharmacy_id??null;
  return {db,user,pharmacyId,brandId:VITALORA_BRAND_ID,authorized:!!pharmacyId};
}
