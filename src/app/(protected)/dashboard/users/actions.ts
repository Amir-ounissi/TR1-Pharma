"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveBrand } from "@/lib/auth";

export type CreateUserState = { error?: string; success?: string };

const createUserSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["brand_admin", "brand_user", "agent", "facilitator"]),
});

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
  const { data: allowed } = await supabase.rpc("can_manage_brand_users", { target_brand_id: brand.id });
  if (!allowed) return { error: "Vous n’avez pas le droit de créer un utilisateur." };

  const admin = createAdminClient();
  const [{ data: brandRecord }, { data: role }] = await Promise.all([
    admin.from("brands").select("organization_id").eq("id", brand.id).single(),
    admin.from("roles").select("id").eq("key", parsed.data.role).single(),
  ]);
  if (!brandRecord || !role) return { error: "Configuration de marque incomplète." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { full_name: parsed.data.fullName }, redirectTo: `${appUrl}/auth/confirm?next=/onboarding` },
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
  if (membershipError) return { error: "L’utilisateur existe, mais son accès n’a pas pu être créé." };

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
  return { success: "Invitation envoyée." };
}
