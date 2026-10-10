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

    requiresInvitationPassword = !tenantMemberships.some(
      (membership) => membership.status === "active",
    );
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

    // Invitation activation is deliberately server-controlled. The legacy
    // authenticated RPC is revoked by the pre-pilot hardening migration.
    const admin = createAdminClient();
    const { error: activationError } = await admin
      .from("memberships")
      .update({ status: "active" })
      .eq("user_id", userId)
      .not("brand_id", "is", null)
      .eq("status", "invited");

    if (activationError) {
      return { error: "Vos accès de marque n’ont pas pu être activés." };
    }
  }

  // An authenticated user may exist before a profile row is provisioned (notably
  // in isolated staging). An UPDATE with zero affected rows is not an error in
  // PostgREST, so checking the returned row prevents an endless onboarding loop.
  const completedAt = new Date().toISOString();
  const profileValues = {
    full_name: profile.data.fullName,
    onboarding_completed_at: completedAt,
  };
  const { data: updatedProfile, error: updateError } = await supabase
    .from("user_profiles")
    .update(profileValues)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (updateError) {
    return { error: "Le profil n’a pas pu être enregistré. Réessayez." };
  }

  if (!updatedProfile) {
    // Only the verified owner of this session may complete its missing profile.
    // INSERT is deliberately not exposed to the normal authenticated role by RLS.
    const admin = createAdminClient();
    const { error: createError } = await admin
      .from("user_profiles")
      .upsert({ user_id: userId, ...profileValues }, { onConflict: "user_id" });
    if (createError) {
      return { error: "Impossible de créer votre profil. Réessayez." };
    }
  }

  if (!user.invited_at && user.user_metadata?.requested_profile_type === "brand") {
    redirect("/setup");
  }
  redirect("/select-brand");
}
