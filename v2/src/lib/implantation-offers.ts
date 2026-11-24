import "server-only";
import { requirePharmacy } from "@/lib/auth";
export type ImplantationOfferLine={product_name:string;format:string|null;paid_units:number;free_units:number;line_note:string|null};
export type ImplantationOffer={
 id:string;brand_id:string;title:string;offer_kind:"flexible"|"quantity_tier"|"fixed_pack";
 summary:string|null;min_distinct_references:number|null;min_units_per_reference:number|null;
 free_units_per_reference:number;min_total_paid_units:number|null;min_order_ht:number|null;
 fixed_pack_ht:number|null;discount_pct:number|null;offer_conditions:string|null;
 plv_commitment:string|null;training_commitment:string|null;shipping_terms:string|null;
 verification_status:"draft"|"verified";valid_until:string|null;lines:ImplantationOfferLine[];
};
export async function loadPharmacyImplantationOffers():Promise<ImplantationOffer[]>{
 const {db}=await requirePharmacy();
 const {data,error}=await db.rpc("pharmacy_implantation_offers");
 if(error)throw new Error("Impossible de consulter les offres d'implantation.");
 return (Array.isArray(data)?data:[]) as ImplantationOffer[];
}
export function implantationEuro(value:number|null|undefined){
 return value===null||value===undefined?"À confirmer":
 Number(value).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
}
