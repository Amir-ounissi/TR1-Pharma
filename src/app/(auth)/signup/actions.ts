"use server";

import { redirect } from "next/navigation";
import { buildSignupMetadata, getSignupSuccessMessage, signupIntentSchema } from "@/lib/signup-intent";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingRedirectUrl } from "@/lib/runtime-environment";

export type SignUpState = { error?: string; success?: string };

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
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    currentOrganization: formData.get("currentOrganization"),
    territory: formData.get("territory"),
    facilitatorKind: formData.get("facilitatorKind"),
    specialty: formData.get("specialty"),
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

  if (data.session) {
    redirect("/onboarding");
  }

  return {
    success: getSignupSuccessMessage(parsed.data.profileType),
  };
}
