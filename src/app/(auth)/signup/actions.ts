"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingRedirectUrl } from "@/lib/runtime-environment";

export type SignUpState = { error?: string; success?: string };

const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
});

export async function signUpAction(
  _state: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Les informations saisies sont invalides.";
    return { error: message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: resolveOnboardingRedirectUrl(),
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/onboarding");
  }

  return {
    success: "Compte créé. Vérifiez votre email pour confirmer votre accès, puis attendez l’attribution de votre marque.",
  };
}
