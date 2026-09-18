import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const [
    { data: profile },
    { data: authData, error: authError },
    { data: activeContexts, error: contextsError },
  ] = await Promise.all([
    supabase.from("user_profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    supabase.auth.getUser(),
    supabase.rpc("get_my_brand_contexts"),
  ]);

  if (authError || !authData.user || authData.user.id !== userId) redirect("/login");

  const requiresPassword = Boolean(
    authData.user.invited_at && !contextsError && (activeContexts ?? []).length === 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bienvenue sur TR1 Pharma</CardTitle>
        <CardDescription>Finalisez votre profil avant d’accéder à vos marques.</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingForm defaultName={profile?.full_name} requiresPassword={requiresPassword} />
      </CardContent>
    </Card>
  );
}
