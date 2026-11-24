"use server";

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";

const testEmail = "amir.ounissi69@gmail.com";
const pilotPharmacyId = "33a4d857-98b0-412b-9f22-f6c8cd3ab623";

export type TestAccountState = {
  kind: "idle" | "error" | "pending" | "linked";
  message: string;
};



async function linkIfConfirmed(db: Awaited<ReturnType<typeof requireOwner>>["db"]): Promise<TestAccountState> {
  const { error } = await db.rpc("link_pharmacy_account", {
    p_pharmacy_id: pilotPharmacyId,
    p_email: testEmail,
  });
  if (error) {
    return {
      kind: "pending",
      message: "Compte créé ou déjà présent. Confirme l’adresse email, puis clique sur « Finaliser le rattachement ». Aucune autorisation catalogue n’a été activée.",
    };
  }
  revalidatePath("/app/acces");
  revalidatePath("/app/pilote");
  return {
    kind: "linked",
    message: "Compte pharmacie test rattaché à Plein Sud (Pérols). VK SWISS et ses produits restent inaccessibles jusqu’à leur validation.",
  };
}

export async function createPilotTestAccount(
  _previous: TestAccountState, form: FormData
): Promise<TestAccountState> {
  const viewer = await requireOwner();
  const password = form.get("password");
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return { kind: "error", message: "Choisis un mot de passe unique d’au moins 12 caractères, différent de celui du cockpit administrateur." };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { kind: "error", message: "Supabase Auth V2 n’est pas encore configuré." };
  }
  // Client séparé sans session persistante : n'altère jamais les cookies
  // du propriétaire connecté au cockpit.
  const auth = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await auth.auth.signUp({
    email: testEmail,
    password,
    options: { data: { account_type: "pharmacy_test" } },
  });
  if (error) {
    return { kind: "error", message: "Supabase Auth a refusé la création : " + error.message };
  }
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
    return {
      kind: "pending",
      message: "Un compte avec cette adresse semble peut-être exister. Vérifie sa confirmation dans Supabase Auth V2 et utilise « Finaliser le rattachement ».",
    };
  }
  if (data.user.email_confirmed_at) return linkIfConfirmed(viewer.db);
  return {
    kind: "pending",
    message: "Demande de création envoyée à Supabase Auth. Si la confirmation par email est activée, ouvre le lien reçu sur cette adresse, puis finalise le rattachement ci-dessous.",
  };
}

export async function finalizePilotTestAccount(
  _previous: TestAccountState, _form: FormData
): Promise<TestAccountState> {
  const viewer = await requireOwner();
  return linkIfConfirmed(viewer.db);
}
