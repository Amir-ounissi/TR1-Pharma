"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCatalogueBrandForPharmacy, isAllowedQuantity, requirePharmacyCatalogue, sumOrderCents } from "@/lib/private-catalogue";
import { tierForQuantity } from "@/lib/private-catalogue-format";

export async function connectPharmacyCatalogue(formData: FormData) {
  const parsed = z.object({ email: z.email(), password: z.string().min(8) }).safeParse({
    email: formData.get("email"), password: formData.get("password"),
  });
  if (!parsed.success) redirect("/catalogue/connexion?erreur=identifiants");

  const client = await createClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) redirect("/catalogue/connexion?erreur=identifiants");
  redirect("/catalogue");
}

export async function activatePharmacyCatalogue(formData: FormData) {
  const schema = z.object({
    password: z.string().min(10).max(128),
    confirm: z.string(),
  }).refine((value) => value.password === value.confirm);
  const parsed = schema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) redirect("/catalogue/activer?erreur=motdepasse");

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/catalogue/connexion");
  const admin = createAdminClient();
  const { data: membership } = await admin.from("private_catalog_memberships")
    .select("active,invited_email").eq("user_id", user.id).maybeSingle();
  if (!membership?.active || membership.invited_email.toLowerCase() !== user.email?.toLowerCase()) {
    redirect("/catalogue/connexion?erreur=acces");
  }
  const { error } = await client.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/catalogue/activer?erreur=motdepasse");
  redirect("/catalogue");
}

export async function disconnectPharmacyCatalogue() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/catalogue/connexion");
}

export type PrivateRequestState = { error: string };

export async function sendPrivateCatalogueRequest(
  _state: PrivateRequestState,
  formData: FormData,
): Promise<PrivateRequestState> {
  const slug = z.string().regex(/^[a-z0-9-]{1,100}$/).safeParse(formData.get("slug"));
  if (!slug.success) return { error: "Cette marque n'est pas valide." };

  const { admin, pharmacy, userId } = await requirePharmacyCatalogue();
  const { brand, products } = await getCatalogueBrandForPharmacy(pharmacy.id, slug.data, admin);
  const selected: Array<{
    product_id: string; product_name: string; sku: string; quantity: number;
    unit_price_ht: number | null; vat_rate: number; line_total_ht: number | null;
  }> = [];

  for (const product of products) {
    const raw = formData.get("quantity_" + product.id);
    if (raw === null || raw === "" || raw === "0") continue;
    if (typeof raw !== "string" || !/^[0-9]{1,5}$/.test(raw)) {
      return { error: "Les quantités saisies sont invalides." };
    }
    const quantity = Number(raw);
    if (!isAllowedQuantity(quantity, product.min_quantity, product.quantity_step)) {
      return { error: "Vérifiez les quantités minimales et les conditionnements." };
    }

    const tier = product.pricing.mode === "contractual"
      ? tierForQuantity(product.pricing.tiers, quantity) : null;
    const unitPrice = tier ? Math.round(tier.price_ht * 100) / 100 : null;
    selected.push({
      product_id: product.id, product_name: product.name, sku: product.sku,
      quantity, unit_price_ht: unitPrice, vat_rate: Number(product.vat_rate),
      line_total_ht: unitPrice === null ? null : Math.round(unitPrice * 100) * quantity / 100,
    });
  }

  if (!selected.length) return { error: "Sélectionnez au moins un produit." };

  // Une demande comportant ne serait-ce qu'un prix non contractuel reste
  // une demande de devis : aucun total fictif ou prix partiel n'est enregistré.
  const firmPrice = selected.every((item) => item.unit_price_ht !== null);
  const requestKind = firmPrice ? "order" : "quote";
  const totalCents = firmPrice
    ? sumOrderCents(selected.map((item) => ({ price_ht: item.unit_price_ht ?? 0, quantity: item.quantity })))
    : null;
  if (totalCents !== null && (totalCents < 0 || totalCents > 100_000_000_00)) {
    return { error: "Le montant de la demande est invalide." };
  }

  // Accès au service-role après validation de l'identité et de l'autorisation
  // pharmacie + marque. Aucun montant provenant du navigateur n'est accepté.
  const { data: request, error: requestError } = await admin
    .from("private_catalog_requests")
    .insert({
      pharmacy_id: pharmacy.id, brand_id: brand.id, created_by: userId,
      request_kind: requestKind, total_ht: totalCents === null ? null : totalCents / 100,
      status: "received",
    })
    .select("id")
    .single();
  if (requestError || !request) return { error: "La demande n'a pas pu être enregistrée." };

  const items = selected.map((item) => ({
    ...item, request_id: request.id,
    unit_price_ht: firmPrice ? item.unit_price_ht : null,
    line_total_ht: firmPrice ? item.line_total_ht : null,
  }));
  const { error: itemsError } = await admin.from("private_catalog_request_items").insert(items);
  if (itemsError) {
    await admin.from("private_catalog_requests").delete().eq("id", request.id).eq("pharmacy_id", pharmacy.id);
    return { error: "La demande n'a pas pu être finalisée. Aucun accusé de réception n'a été émis." };
  }

  revalidatePath("/catalogue/mes-demandes");
  redirect("/catalogue/mes-demandes?envoyee=1");
}
