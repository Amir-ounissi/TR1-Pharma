"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const itemSchema = z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(5000) });

export async function submitPublicCatalogueRequestAction(form: FormData) {
  const input = z.object({
    contact_name: z.string().trim().min(2).max(120),
    pharmacy_name: z.string().trim().min(2).max(180),
    email: z.email().max(254),
    phone: z.string().trim().max(30).optional(),
    city: z.string().trim().min(2).max(120),
    postal_code: z.string().trim().max(12).optional(),
    siret: z.union([z.string().regex(/^[0-9]{14}$/), z.literal("")]).optional(),
    note: z.string().trim().max(1500).optional(),
    items_json: z.string().min(2).max(20000),
    website: z.string().max(200).optional(),
  }).safeParse({
    contact_name: form.get("contact_name"), pharmacy_name: form.get("pharmacy_name"),
    email: form.get("email"), phone: form.get("phone") ?? "", city: form.get("city"),
    postal_code: form.get("postal_code") ?? "", siret: form.get("siret") ?? "",
    note: form.get("note") ?? "", items_json: form.get("items_json"),
    website: form.get("website") ?? "",
  });
  if (!input.success) redirect("/vitrine?erreur=coordonnees");
  if (input.data.website?.trim()) redirect("/vitrine/merci");

  let decoded: unknown;
  try { decoded = JSON.parse(input.data.items_json); }
  catch { redirect("/vitrine?erreur=panier"); }
  const items = z.array(itemSchema).min(1).max(100).safeParse(decoded);
  if (!items.success || new Set(items.data.map(x => x.product_id)).size !== items.data.length) {
    redirect("/vitrine?erreur=panier");
  }

  const db = await createServerSupabase();
  if (!db) redirect("/vitrine?erreur=indisponible");
  const { error } = await db.rpc("submit_public_catalogue_request", {
    p_contact_name: input.data.contact_name,
    p_pharmacy_name: input.data.pharmacy_name,
    p_email: input.data.email,
    p_phone: input.data.phone || null,
    p_city: input.data.city,
    p_postal_code: input.data.postal_code || null,
    p_siret: input.data.siret || null,
    p_note: input.data.note || null,
    p_items: items.data,
    p_honeypot: "",
  });
  if (error) redirect("/vitrine?erreur=conditions");
  revalidatePath("/app/catalogue-public");
  redirect("/vitrine/merci");
}
