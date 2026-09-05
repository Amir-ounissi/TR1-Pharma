"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnboardingState = { error?: string };

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120) });
const invitedProfileSchema = profileSchema.extend({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

export async function completeOnboardingAction(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { supabase, userId } = await requireUser();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user || user.id !== userId) return { error: "Votre session n’est plus valide. Reconnectez-vous." };

  const profile = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!profile.success) return { error: "Renseignez un nom complet valide." };

  if (user.invited_at) {
    const invitedProfile = invitedProfileSchema.safeParse({
      fullName: formData.get("fullName"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!invitedProfile.success) return { error: "Renseignez un mot de passe d’au moins 8 caractères." };
    if (invitedProfile.data.password !== invitedProfile.data.confirmPassword) return { error: "Les mots de passe ne correspondent pas." };

    const { error: passwordError } = await supabase.auth.updateUser({ password: invitedProfile.data.password });
    if (passwordError) return { error: "Le mot de passe n’a pas pu être enregistré." };

    const admin = createAdminClient();
    const { data: memberships, error: membershipsError } = await admin
      .from("memberships")
      .select("id,status")
      .eq("user_id", userId)
      .not("brand_id", "is", null)
      .in("status", ["invited", "active"]);

    if (membershipsError || !memberships?.length) {
      return { error: "Aucun accès de marque invité n’a été trouvé pour ce compte. Contactez votre administrateur TR1." };
    }

    const { error: activationError } = await admin
      .from("memberships")
      .update({ status: "active" })
      .eq("user_id", userId)
      .not("brand_id", "is", null)
      .eq("status", "invited");
    if (activationError) return { error: "Vos accès de marque n’ont pas pu être activés." };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: profile.data.fullName, onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) return { error: "Le profil n’a pas pu être enregistré." };

  const { data: pendingBrandRequest } = await supabase
    .from("access_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("requested_profile_type", "brand")
    .eq("status", "pending")
    .maybeSingle();

  if (pendingBrandRequest) redirect("/setup");
  redirect("/select-brand");
}
