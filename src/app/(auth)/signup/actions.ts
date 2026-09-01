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
    facilitatorKind: getOptionalField(formData, "facilitatorKind"),
    specialty: getOptionalField(formData, "specialty"),
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
      data: buildSignupMetadata(parsed.data),
      emailRedirectTo: resolveOnboardingRedirectUrl(),
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
