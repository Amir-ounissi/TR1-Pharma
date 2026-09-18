"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

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
  if (authError || !user || user.id !== userId) {
    return { error: "Votre session n’est plus valide. Reconnectez-vous." };
  }

  const profile = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!profile.success) return { error: "Renseignez un nom complet valide." };

  let requiresInvitationPassword = false;

  if (user.invited_at) {
    const { data: memberships, error: membershipsError } = await supabase
      .from("memberships")
      .select("id,status")
      .eq("user_id", userId)
      .not("brand_id", "is", null)
      .in("status", ["invited", "active"]);

    if (membershipsError) {
      return { error: "Vos accès TR1 n’ont pas pu être vérifiés. Réessayez dans quelques instants." };
    }

    const tenantMemberships = memberships ?? [];
    if (!tenantMemberships.length) {
      return {
        error:
          "Aucun accès de marque invité n’a été trouvé pour ce compte. Contactez votre administrateur TR1.",
      };
    }

    requiresInvitationPassword = !tenantMemberships.some((membership) => membership.status === "active");
  }

  if (requiresInvitationPassword) {
    const invitedProfile = invitedProfileSchema.safeParse({
      fullName: formData.get("fullName"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!invitedProfile.success) {
      return { error: "Renseignez un mot de passe d’au moins 8 caractères." };
    }
    if (invitedProfile.data.password !== invitedProfile.data.confirmPassword) {
      return { error: "Les mots de passe ne correspondent pas." };
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password: invitedProfile.data.password,
    });
    if (passwordError) return { error: "Le mot de passe n’a pas pu être enregistré." };

    const { data: activatedCount, error: activationError } = await supabase.rpc(
      "accept_my_invited_memberships",
    );
    if (activationError) {
      return { error: "Vos accès de marque n’ont pas pu être activés." };
    }
    if (!Number(activatedCount ?? 0)) {
      return {
        error:
          "Aucun accès de marque invité n’a été trouvé pour ce compte. Contactez votre administrateur TR1.",
      };
    }
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: profile.data.fullName,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return { error: "Le profil n’a pas pu être enregistré." };

  if (!user.invited_at && user.user_metadata?.requested_profile_type === "brand") {
    redirect("/setup");
  }
  redirect("/select-brand");
}
