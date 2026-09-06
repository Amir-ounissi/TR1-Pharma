"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin, requireActiveBrand } from "@/lib/auth";
import { resolveOnboardingRedirectUrl } from "@/lib/runtime-environment";

export type CreateUserState = { error?: string; success?: string };

const createUserSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["brand_admin", "brand_direction", "brand_user", "agent", "facilitator"]),
});

const managedRoles = ["brand_admin", "brand_direction", "brand_user", "agent", "facilitator"] as const;
const seatLimitMessage = "Limite de sièges atteinte pour cette marque. Augmentez la capacité de l’abonnement avant une nouvelle invitation.";

export async function createUserAction(
  _state: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Les informations saisies sont invalides." };

  const { supabase, userId, brand } = await requireActiveBrand();
  const platformAdmin = await isPlatformAdmin();
  const [{ data: allowed }, subscriptionResult] = await Promise.all([
    supabase.rpc("can_manage_brand_users", { target_brand_id: brand.id }),
    supabase.rpc("get_brand_saas_subscription", { target_brand_id: brand.id }),
  ]);
  if (!allowed) return { error: "Vous n’avez pas le droit de créer un utilisateur." };
  if (subscriptionResult.error) return { error: "Impossible de vérifier la capacité de l’abonnement." };

  const subscription = Array.isArray(subscriptionResult.data) ? subscriptionResult.data[0] : null;
  if (subscription?.seat_limit != null && Number(subscription.seats_remaining ?? 0) <= 0) {
    return { error: seatLimitMessage };
  }

  const { data: authorMembership } = await supabase
    .from("memberships")
    .select("roles!inner(key,rank)")
    .eq("user_id", userId)
    .eq("brand_id", brand.id)
    .eq("status", "active")
    .order("roles(rank)", { ascending: false })
    .limit(1)
    .maybeSingle();

  const admin = createAdminClient();
  const [{ data: brandRecord }, { data: role }] = await Promise.all([
    admin.from("brands").select("organization_id").eq("id", brand.id).single(),
    admin.from("roles").select("id,rank").eq("key", parsed.data.role).single(),
  ]);
  if (!brandRecord || !role) return { error: "Configuration de marque incomplète." };

  const authorRole = Array.isArray(authorMembership?.roles) ? authorMembership.roles[0] : authorMembership?.roles;
  if (!managedRoles.includes(parsed.data.role) || (!platformAdmin && (!authorRole || role.rank >= authorRole.rank))) {
    return { error: "Vous ne pouvez inviter qu’un rôle strictement inférieur au vôtre." };
  }

  const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { full_name: parsed.data.fullName }, redirectTo: resolveOnboardingRedirectUrl() },
  );
  if (invitationError || !invitation.user) return { error: invitationError?.message ?? "Invitation impossible." };

  const { error: membershipError } = await admin.from("memberships").insert({
    user_id: invitation.user.id,
    organization_id: brandRecord.organization_id,
    brand_id: brand.id,
    role_id: role.id,
    invited_by: userId,
    status: "invited",
  });
  if (membershipError) {
    if (membershipError.code === "23514" && membershipError.message.includes("SaaS seat limit reached")) {
      return { error: seatLimitMessage };
    }
    return { error: "L’utilisateur existe, mais son accès n’a pas pu être créé." };
  }

  await admin.from("activity_logs").insert({
    organization_id: brandRecord.organization_id,
    brand_id: brand.id,
    actor_user_id: userId,
    action: "user.invited",
    entity_type: "user",
    entity_id: invitation.user.id,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/subscription");
  return { success: "Invitation envoyée." };
}
