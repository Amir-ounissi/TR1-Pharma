import "server-only";
import { requirePharmacy } from "@/lib/auth";

export type AlthesiaOffer = {
  paid_quantity:number;
  free_quantity:number;
  price_ht:number|string;
  price_confirmed:boolean;
};
export type AlthesiaProduct = {
  id:string; brand_id:string; brand:string; brand_slug:string;
  name:string;sku:string;ean:string|null;format:string|null;category:string|null;
  image_url:string|null;summary:string|null;ingredients:string|null;dosage:string|null;
  audience:string|null;precautions:string|null;
  source_document:string;source_page:number|null;sub_brand:string|null;
  retail_ttc:number|string|null;vat_rate:number|string|null;
  market_status:"food_cbd_blocked"|"review_required"|"verified";
  offers:AlthesiaOffer[];
};
export async function loadAlthesiaShowroom():Promise<AlthesiaProduct[]> {
  const {db}=await requirePharmacy();
  const {data,error}=await db.rpc("althesia_showroom_catalogue");
  if(error)throw new Error("Catalogue documentaire Althesia indisponible.");
  return (Array.isArray(data)?data:[]) as AlthesiaProduct[];
}
export function euro(value:number|string|null|undefined) {
  if(value===null || value===undefined)return "Non renseigné";
  return Number(value).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
}
export function althesiaPricing(o:AlthesiaOffer,retailTTC:number|null,vatPercent:number){
  const delivered=o.paid_quantity+o.free_quantity;
  const lineCost=Number(o.price_ht)*o.paid_quantity;
  const effectiveUnit=delivered>0?lineCost/delivered:0;
  const retailHT=retailTTC===null?null:retailTTC/(1+vatPercent/100);
  const marginHT=retailHT===null?null:retailHT-effectiveUnit;
  const marginRate=retailHT && retailHT>0?100*marginHT!/retailHT:null;
  return {delivered,lineCost,effectiveUnit,retailHT,marginHT,marginRate};
}
export function isBlocked(p:AlthesiaProduct){
  return p.market_status==="food_cbd_blocked";
}
