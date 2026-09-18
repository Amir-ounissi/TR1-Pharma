"use server";

import { z } from "zod";
import { resolveAppUrl } from "@/lib/runtime-environment";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  error?: string;
  success?: string;
};

const forgotPasswordSchema = z.object({
  email: z.email(),
});

export async function forgotPasswordAction(
  _state: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Saisissez une adresse email valide." };
  }

  const appUrl = resolveAppUrl();
  if (!appUrl) {
    return { error: "La récupération du mot de passe est temporairement indisponible." };
  }

  const redirectTo = `${new URL(appUrl).origin}/reset-password`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    return { error: "Impossible d’envoyer l’email pour le moment. Réessayez dans quelques instants." };
  }

  return {
    success: "Si un compte TR1 existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.",
  };
}
