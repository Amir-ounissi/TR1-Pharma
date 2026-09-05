"use server";

import { redirect } from "next/navigation";
import { buildSignupMetadata, getSignupSuccessMessage, signupIntentSchema } from "@/lib/signup-intent";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingRedirectUrl } from "@/lib/runtime-environment";

export type SignUpState = { error?: string; success?: string };

function getOptionalField(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function signUpAction(
  _state: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signupIntentSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    profileType: formData.get("profileType"),
    companyName: getOptionalField(formData, "companyName"),
    jobTitle: getOptionalField(formData, "jobTitle"),
    currentOrganization: getOptionalField(formData, "currentOrganization"),
    territory: getOptionalField(formData, "territory"),
    facilitatorActivities: getStringList(formData, "facilitatorActivities"),
    facilitatorKind: getOptionalField(formData, "facilitatorKind"),
    specialty: getOptionalField(formData, "specialty"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Les informations saisies sont invalides.";
    return { error: message };
  }

  let emailRedirectTo: string;

  try {
    emailRedirectTo = resolveOnboardingRedirectUrl();
  } catch (error) {
    console.error(
      "Configuration de redirection d’authentification invalide pour le signup.",
      error,
    );

    return {
      error:
        "La création de compte est momentanément indisponible. Contactez l’administrateur TR1.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: buildSignupMetadata(parsed.data),
      emailRedirectTo,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Le compte n’a pas pu être créé. Réessayez dans quelques instants." };
  }

  if (data.session) {
    redirect("/onboarding");
  }

  return {
    success: getSignupSuccessMessage(parsed.data.profileType),
  };
}
