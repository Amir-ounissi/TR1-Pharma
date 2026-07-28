import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("user_profiles").select("full_name").eq("user_id", userId).maybeSingle();
  return (
    <Card><CardHeader><CardTitle>Bienvenue sur TR1 Pharma</CardTitle><CardDescription>Finalisez votre profil avant d’accéder à vos marques.</CardDescription></CardHeader><CardContent><OnboardingForm defaultName={data?.full_name} /></CardContent></Card>
  );
}
