"use server";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Field = "fullName" | "professionalEmail" | "companyName" | "websiteUrl" | "location" | "need";
export type LeadCaptureState = {
  error?: string;
  fields?: Partial<Record<Field, string>>;
  fieldErrors?: Partial<Record<Field, string>>;
};
const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  professionalEmail: z.email().max(254),
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: z.union([z.url(), z.literal("")]).optional(),
  location: z.string().trim().max(120),
  need: z.string().trim().max(2000),
});
export async function captureLeadAction(_state: LeadCaptureState, form: FormData): Promise<LeadCaptureState> {
  if (String(form.get("website") ?? "")) redirect("/merci");
  const audience = form.get("leadAudience") === "pharmacy" ? "pharmacy" : "brand";
  const fields: Record<Field, string> = {
    fullName: String(form.get("fullName") ?? ""),
    professionalEmail: String(form.get("professionalEmail") ?? ""),
    companyName: String(form.get("companyName") ?? ""),
    websiteUrl: String(form.get("websiteUrl") ?? ""),
    location: String(form.get("location") ?? ""),
    need: String(form.get("need") ?? ""),
  };
  const validation = schema.safeParse(fields);
  if (!validation.success) {
    const messages = validation.error.flatten().fieldErrors;
    return {
      error: "Vérifiez les champs indiqués avant de continuer.", fields,
      fieldErrors: Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value?.[0] ?? "Invalide"])) as LeadCaptureState["fieldErrors"],
    };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const salt = process.env.LEAD_CAPTURE_SALT;
  if (!url || !secret || !salt || salt.length < 24)
    return { error: "Le formulaire V2 n'est pas encore activé. Merci d'utiliser le site principal.", fields };

  const id = randomUUID();
  try {
    const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const today = new Date().toISOString().slice(0, 10);
    const fingerprint = createHash("sha256").update(salt + audience + validation.data.professionalEmail.toLowerCase() + today).digest("hex");
    const sourceIp = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(salt + sourceIp).digest("hex");
    const { count } = await db.from("leads").select("id", { head: true, count: "exact" })
      .eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if (count !== null && count !== undefined && count >= 5)
      return { error: "Trop de demandes successives. Réessayez plus tard.", fields };
    const { error } = await db.from("leads").insert({
      audience, full_name: validation.data.fullName, email: validation.data.professionalEmail.toLowerCase(),
      company_name: validation.data.companyName, website_url: validation.data.websiteUrl || null,
      city: validation.data.location || null, note: validation.data.need || null, fingerprint, ip_hash: ipHash,
    });
    if (error && error.code !== "23505") {
      console.error("V2 lead capture failed", { id, code: error.code });
      return { error: "Votre demande n'a pas été enregistrée. Veuillez réessayer.", fields };
    }
  } catch {
    console.error("V2 lead capture unavailable", { id });
    return { error: "Le formulaire est momentanément indisponible.", fields };
  }
  redirect("/merci");
}
