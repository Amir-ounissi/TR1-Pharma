"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

const bases=["undetermined","order_ht","invoiced_ht","collected_ht","net_ht_after_discounts"] as const;
const triggers=["undetermined","order_validated","invoice_issued","payment_collected"] as const;
const optionalDate = z.union([z.iso.date(),z.literal("")]);
const optionalAmount = z.preprocess(v=>v===""||v==null?null:v,z.coerce.number().nonnegative().max(99999999).nullable());
const optionalUnits = z.preprocess(v=>v===""||v==null?null:v,z.coerce.number().int().nonnegative().max(999999).nullable());

export async function saveBrandCommissionAction(form:FormData) {
  const data=z.object({
    brand_id:z.uuid(),
    rate_percent:z.coerce.number().min(0).max(100),
    base_type:z.enum(bases),
    trigger_event:z.enum(triggers),
    beneficiary:z.string().trim().min(3).max(200),
    notes:z.string().trim().max(2000),
    confirmation_reference:z.string().trim().max(500),
    effective_from:optionalDate,
  }).parse(Object.fromEntries([
    "brand_id","rate_percent","base_type","trigger_event","beneficiary",
    "notes","confirmation_reference","effective_from",
  ].map(key=>[key,form.get(key)??""])));
  const confirmed=form.get("confirm") === "yes";
  if(confirmed&&(
    data.base_type==="undetermined"||
    data.trigger_event==="undetermined"||
    data.confirmation_reference.length<6||
    !data.effective_from
  )) throw new Error("Pour confirmer une commission, préciser l'assiette, le fait générateur, la date d'effet et une référence contractuelle.");
  const {db}=await requireOwner();
  const {error}=await db.from("brand_commission_settings").update({
    rate_percent:data.rate_percent,base_type:data.base_type,
    trigger_event:data.trigger_event,beneficiary:data.beneficiary,
    notes:data.notes||null,
    confirmation_reference:data.confirmation_reference||null,
    effective_from:data.effective_from||null,
    review_status:confirmed?"confirmed":"draft",
    updated_at:new Date().toISOString(),
  }).eq("brand_id",data.brand_id);
  if(error)throw new Error("Enregistrement de la commission impossible : "+error.message);
  revalidatePath("/app/commissions");
  redirect("/app/commissions?enregistre=1");
}

export async function addBrandBonusAction(form:FormData) {
  const data=z.object({
    brand_id:z.uuid(),
    title:z.string().trim().min(3).max(180),
    bonus_type:z.enum(["fixed","per_unit","percent"]),
    amount:z.coerce.number().min(0).max(1000000),
    threshold_ht:optionalAmount,
    threshold_units:optionalUnits,
    event_condition:z.string().trim().max(900),
    source_document:z.string().trim().max(300),
    confirmation_reference:z.string().trim().max(500),
    effective_from:optionalDate,
    effective_until:optionalDate,
  }).parse(Object.fromEntries([
    "brand_id","title","bonus_type","amount","threshold_ht","threshold_units",
    "event_condition","source_document","confirmation_reference","effective_from","effective_until",
  ].map(key=>[key,form.get(key)??""])));
  const confirmed=form.get("confirm") === "yes";
  if(confirmed && (data.event_condition.length<5 ||data.confirmation_reference.length<6 ||!data.effective_from))
    throw new Error("Une prime confirmée doit avoir sa condition de déclenchement, sa date d'effet et son justificatif.");
  if(data.bonus_type==="percent"&&data.amount>100)
    throw new Error("Le taux de prime ne peut pas dépasser 100 %.");
  if(data.effective_from&&data.effective_until&&data.effective_until<data.effective_from)
    throw new Error("La fin de validité doit être après la date d'effet.");
  const {db}=await requireOwner();
  const {error}=await db.from("brand_bonus_rules").insert({
    ...data,
    threshold_ht:data.threshold_ht,
    threshold_units:data.threshold_units,
    event_condition:data.event_condition||null,
    source_document:data.source_document||null,
    confirmation_reference:data.confirmation_reference||null,
    effective_from:data.effective_from||null,
    effective_until:data.effective_until||null,
    review_status:confirmed?"confirmed":"draft",
  });
  if(error)throw new Error("Enregistrement de la prime impossible : "+error.message);
  revalidatePath("/app/commissions");
  redirect("/app/commissions?prime=1");
}

export async function deleteDraftBonusAction(form:FormData) {
  const id=z.uuid().parse(form.get("bonus_id"));
  const {db}=await requireOwner();
  const {error}=await db.from("brand_bonus_rules").delete()
    .eq("id",id).eq("review_status","draft");
  if(error)throw new Error("Suppression de la prime impossible : "+error.message);
  revalidatePath("/app/commissions");
  redirect("/app/commissions?prime_supprimee=1");
}
