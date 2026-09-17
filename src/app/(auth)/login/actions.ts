"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { shouldBlockLocalFixtureAccount } from "@/lib/auth/local-fixture-guard";
import { resolveLoginDestination } from "@/lib/auth/resolve-login-destination";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Adresse email ou mot de passe invalide." };

  if (shouldBlockLocalFixtureAccount(parsed.data.email)) {
    return { error: "Connexion impossible. Vérifiez vos identifiants." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !signInData.user) return { error: "Connexion impossible. Vérifiez vos identifiants." };

  const destination = await resolveLoginDestination(supabase, signInData.user.id);
  redirect(destination);
}
