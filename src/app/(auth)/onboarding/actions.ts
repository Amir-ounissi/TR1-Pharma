"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type OnboardingState = { error?: string };

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120) });

export async function completeOnboardingAction(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { error: "Renseignez un nom complet valide." };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: parsed.data.fullName, onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) return { error: "Le profil n’a pas pu être enregistré." };

  const { data: membership } = await supabase
    .from("memberships")
    .select("id,roles!inner(key)")
    .is("brand_id", null)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("roles.key", "super_admin")
    .maybeSingle();

  if (membership) redirect("/dashboard");
  redirect("/select-brand");
}
