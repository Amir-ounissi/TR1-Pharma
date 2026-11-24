import "server-only";
import { requirePharmacy } from "@/lib/auth";

export type PharmacyBrand = {
  brand_id:string; name:string; slug:string;
  status:"implanted"|"not_implanted"|"unconfirmed";
  description:string|null; catalogue_note:string|null;
  demo_access:boolean; real_access:boolean;
  reorder_ready:boolean; showroom_available:boolean;
  interest_status:"received"|"under_review"|"closed"|null;
};

export async function loadPharmacyBrandDirectory() {
  const {db,user}=await requirePharmacy();
  const {data,error}=await db.rpc("pharmacy_brand_directory");
  if(error)throw new Error("Impossible de charger vos marques.");
  return {db,user,brands:(Array.isArray(data)?data:[]) as PharmacyBrand[]};
}
