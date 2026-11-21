"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePharmacy } from "@/lib/auth";
export async function submitProductRequest(form: FormData) {
  const parsed = z.object({
    pharmacy_id: z.uuid(), product_id: z.uuid(), quantity: z.coerce.number().int().min(1).max(5000),
  }).parse({
    pharmacy_id: form.get("pharmacy_id"),
    product_id: form.get("product_id"),
    quantity: form.get("quantity"),
  });
  const { db } = await requirePharmacy();
  // La procédure SQL valide l'appartenance, la marque, le prix et la quantité
  // puis inscrit la demande et sa ligne dans une transaction atomique.
  const { error } = await db.rpc("submit_catalogue_request", {
    p_pharmacy_id: parsed.pharmacy_id,
    p_product_id: parsed.product_id,
    p_quantity: parsed.quantity,
  });
  if (error) throw new Error("Demande refusée : conditions ou accès à vérifier.");
  revalidatePath("/catalogue/mes-demandes");
  redirect("/catalogue/mes-demandes?envoye=1");
}
