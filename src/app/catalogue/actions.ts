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
    products: { id: string; name: string; min_quantity: number }[];
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
    if (!isAllowedQuantity(quantity, product.min_quantity)) {
      return { error: `Minimum de commande pour ${product.name} : ${product.min_quantity} unité(s). Quantité maximale : 5 000.` };
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

export async function sendMultiBrandCatalogueRequest(
  _state: PrivateRequestState,
  formData: FormData,
): Promise<PrivateRequestState> {
  const { admin, pharmacy, catalog: pharmacyCatalog } = await requirePharmacyCatalogue();

  const seenIds = new Set<string>();
  const quantities = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity_")) continue;
    const productId = key.slice("quantity_".length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
      || seenIds.has(productId) || typeof value !== "string") {
      return { error: "Le panier contient une référence ou une quantité invalide." };
    }
    seenIds.add(productId);
    if (value === "" || value === "0") continue;
    if (!/^[0-9]{1,5}$/.test(value)) {
      return { error: "Les quantités saisies doivent être des nombres entiers." };
    }
    quantities.set(productId, Number(value));
  }

  if (quantities.size === 0 || quantities.size > 40) {
    return { error: "Sélectionnez entre 1 et 40 références avant de transmettre votre panier." };
  }

  const brands = pharmacyCatalog.brands ?? [];
  if (!brands.length || brands.length > 20) {
    return { error: "Le catalogue de votre officine n'est pas disponible." };
  }

  const loadedCatalogues = await Promise.all(brands.map(async (brand) => {
    const { data, error } = await admin.rpc("catalogue_my_data", { p_slug: brand.slug });
    if (error) return { error: true as const, catalog: null };
    return { error: false as const, catalog: data as {
      pharmacy: { id: string };
      brand: { slug: string } | null;
      products: { id: string; name: string; min_quantity: number }[];
    } | null };
  }));

  if (loadedCatalogues.some((result) => result.error || !result.catalog?.brand
    || result.catalog.pharmacy.id !== pharmacy.id)) {
    return { error: "Les références du catalogue n'ont pas pu être vérifiées. Actualisez la page et réessayez." };
  }

  const authorizedProducts = new Map<string, {
    brandSlug: string;
    name: string;
    minQuantity: number;
  }>();
  for (const result of loadedCatalogues) {
    const current = result.catalog!;
    for (const product of current.products ?? []) {
      authorizedProducts.set(product.id, {
        brandSlug: current.brand!.slug,
        name: product.name,
        minQuantity: product.min_quantity,
      });
    }
  }

  const groupedLines = new Map<string, { product_id: string; quantity: number }[]>();
  for (const [productId, quantity] of quantities) {
    const product = authorizedProducts.get(productId);
    if (!product) {
      return { error: "Une référence sélectionnée n'est plus accessible à votre officine. Actualisez le catalogue." };
    }
    if (!isAllowedQuantity(quantity, product.minQuantity)) {
      return { error: `Minimum de commande pour ${product.name} : ${product.minQuantity} unité(s). Quantité maximale : 5 000.` };
    }
    const lines = groupedLines.get(product.brandSlug) ?? [];
    lines.push({ product_id: productId, quantity });
    groupedLines.set(product.brandSlug, lines);
  }

  const groups = [...groupedLines.entries()].map(([slug, lines]) => ({ slug, lines }));
  if (!groups.length || groups.length > 20) {
    return { error: "Le nombre de marques sélectionnées n'est pas valide." };
  }

  // Une seule transaction PostgreSQL traite tous les groupes : en cas d'erreur
  // sur une marque, aucune demande partielle n'est conservée.
  const { error } = await admin.rpc("catalogue_submit_multibrand_request", {
    p_groups: groups,
  });
  if (error) {
    return { error: "Le panier n'a pas pu être transmis. Vérifiez les quantités et réessayez." };
  }

  // Une demande acceptée vide le brouillon serveur. Les demandes sont déjà
  // enregistrées ; un échec de nettoyage ne peut pas créer de doublon.
  await admin.rpc("catalogue_save_cart", { p_lines: [] });
  revalidatePath("/catalogue/mes-demandes");
  revalidatePath("/catalogue");
  redirect(`/catalogue/mes-demandes?envoyee=1&marques=${groups.length}`);
}


/** Persiste un brouillon par utilisateur et officine, jamais des tarifs. */
export async function savePharmacyCart(
  lines: { product_id: string; quantity: number }[],
): Promise<{ saved: boolean; error?: string }> {
  const parsed = z.array(z.object({
    product_id: z.uuid(),
    quantity: z.number().int().min(1).max(5000),
  })).max(40).safeParse(lines);

  if (!parsed.success) return { saved: false, error: "Quantités invalides." };
  try {
    const { admin } = await requirePharmacyCatalogue();
    const { error } = await admin.rpc("catalogue_save_cart", { p_lines: parsed.data });
    if (error) return { saved: false, error: "Le panier n'a pas pu être enregistré." };
    return { saved: true };
  } catch {
    return { saved: false, error: "Enregistrement du panier indisponible." };
  }
}
