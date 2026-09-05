import { requireUser } from "@/lib/auth";

export type SelfServiceOnboardingRow = {
  onboarding_id: string;
  organization_id: string;
  brand_id: string;
  status: string;
  current_step: string;
  step_statuses: Record<string, string>;
  selected_plan_key: string;
};

export async function getMySelfServiceOnboarding() {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.rpc("get_my_self_service_onboarding");
  if (error) throw new Error(error.message);
  const row = (data?.[0] ?? null) as SelfServiceOnboardingRow | null;
  return { supabase, userId, onboarding: row };
}

export async function requireSelfServiceOnboardingBrand(expectedBrandId?: string) {
  const context = await getMySelfServiceOnboarding();
  if (!context.onboarding) {
    throw new Error("Aucun onboarding autonome actif n’est associé à ce compte.");
  }
  if (expectedBrandId && context.onboarding.brand_id !== expectedBrandId) {
    throw new Error("Cette marque n’appartient pas à votre onboarding autonome.");
  }

  const { data: enabled, error } = await context.supabase.rpc("has_brand_capability", {
    target_brand_id: context.onboarding.brand_id,
    target_capability_key: "autonomous_onboarding",
  });
  if (error) throw new Error(error.message);
  if (!enabled) {
    throw new Error("Le plan sélectionné ne permet pas l’onboarding autonome.");
  }

  return context as typeof context & { onboarding: SelfServiceOnboardingRow };
}
