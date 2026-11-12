"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/runtime-environment";
import { requirePharmacyCatalogue } from "@/lib/private-catalogue";
import { isAllowedQuantity } from "@/lib/private-catalogue-format";

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

export async function registerInvitedPharmacy(formData: FormData) {
  const schema = z.object({
    email: z.email().transform((email) => email.trim().toLowerCase()),
    password: z.string().min(10).max(128),
    confirm: z.string(),
  }).refine((value) => value.password === value.confirm);
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect("/catalogue/inscription?erreur=donnees");

  const client = await createClient();
  const appUrl = resolveAppUrl();
  const confirmationUrl = appUrl
    ? new URL("/auth/confirm?next=/catalogue", appUrl).toString()
    : undefined;
  const { error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: confirmationUrl ? { emailRedirectTo: confirmationUrl } : undefined,
  });
  // Always use the same generic response; do not reveal whether an email
  // is registered, invited or available to an attacker.
  if (error && !/already registered/i.test(error.message)) {
    redirect("/catalogue/inscription?erreur=service");
  }
  redirect("/catalogue/inscription?confirmation=1");
}

export async function activatePharmacyCatalogue(formData: FormData) {
  const schema = z.object({
    password: z.string().min(10).max(128),
    confirm: z.string(),
  }).refine((value) => value.password === value.confirm);
  const parsed = schema.safeParse({
    password: formData.get("password"), confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect("/catalogue/activer?erreur=motdepasse");

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/catalogue/connexion");
  const { data: claimed, error: claimError } = await client.rpc("catalogue_claim_invitation");
  if (claimError || !claimed) redirect("/catalogue/connexion?erreur=acces");
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
  const { admin, pharmacy } = await requirePharmacyCatalogue();
  const { data, error: loadError } = await admin.rpc("catalogue_my_data", { p_slug: slug.data });
  if (loadError) return { error: "Les conditions ne sont momentanément pas disponibles." };
  const catalog = data as {
    pharmacy: { id: string };
    products: { id: string; min_quantity: number; quantity_step: number }[];
    brand: { slug: string } | null;
  } | null;
  if (!catalog?.brand || catalog.pharmacy.id !== pharmacy.id) {
    return { error: "Cette marque n'est pas accessible à votre officine." };
  }

  const lines: { product_id: string; quantity: number }[] = [];
  for (const product of catalog.products) {
    const raw = formData.get("quantity_" + product.id);
    if (raw === null || raw === "" || raw === "0") continue;
    if (typeof raw !== "string" || !/^[0-9]{1,5}$/.test(raw)) {
      return { error: "Les quantités saisies sont invalides." };
    }
    const quantity = Number(raw);
    if (!isAllowedQuantity(quantity, product.min_quantity, product.quantity_step)) {
      return { error: "Vérifiez les minimums et les conditionnements." };
    }
    lines.push({ product_id: product.id, quantity });
  }

  if (lines.length === 0 || lines.length > 40) {
    return { error: "Sélectionnez entre 1 et 40 références." };
  }

  // La transaction Postgres refait l'intégralité des contrôles et recalcule
  // les prix depuis les accords réels, sans jamais accepter de total du client.
  const { error } = await admin.rpc("catalogue_submit_request", {
    p_slug: slug.data, p_lines: lines,
  });
  if (error) return { error: "La demande n'a pas pu être enregistrée. Vérifiez votre accès et réessayez." };

  revalidatePath("/catalogue/mes-demandes");
  redirect("/catalogue/mes-demandes?envoyee=1");
}
