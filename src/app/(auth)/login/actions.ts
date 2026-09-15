"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !signInData.user) return { error: "Connexion impossible. Vérifiez vos identifiants." };

  const destination = await resolveLoginDestination(supabase, signInData.user.id);
  redirect(destination);
}
