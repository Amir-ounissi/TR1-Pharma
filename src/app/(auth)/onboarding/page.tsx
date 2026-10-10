import { ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { requireUser } from "@/lib/auth";

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const [
    { data: profile },
    { data: authData, error: authError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name,onboarding_completed_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("memberships")
      .select("status")
      .eq("user_id", userId)
      .not("brand_id", "is", null)
      .in("status", ["invited", "active"]),
  ]);

  if (authError || !authData.user || authData.user.id !== userId) redirect("/login");

  // An already-complete profile must not get stuck on the onboarding form,
  // including after a password recovery or an OAuth authorization retry.
  if (profile?.full_name?.trim() && profile.onboarding_completed_at) {
    redirect("/select-brand");
  }

  const requiresPassword = Boolean(
    authData.user.invited_at
      && !membershipsError
      && (memberships ?? []).length > 0
      && !(memberships ?? []).some((membership) => membership.status === "active"),
  );

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-4.6rem)] w-full max-w-6xl items-center px-5 py-10 sm:py-14 lg:px-8">
      <div className="grid w-full overflow-hidden rounded-[1.75rem] border border-[#0b1e32]/10 bg-[#fffefa] shadow-[0_24px_80px_rgb(11_30_50/0.1)] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative isolate flex flex-col overflow-hidden bg-[#0b1e32] px-7 py-10 text-white sm:px-10 sm:py-12 lg:min-h-[32rem] lg:px-12 lg:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 -z-10 h-72 w-72 rounded-full border border-white/10" />
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.17em] text-[#ffab82]">
            TR1 PHARMA / ESPACE PROFESSIONNEL
          </p>
          <h1 className="mt-8 max-w-sm text-[2.15rem] font-black leading-[1.08] tracking-[-0.055em] sm:text-[2.8rem]">
            Votre espace terrain commence ici.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/70 sm:text-base">
            Un seul accès pour retrouver vos marques, vos pharmacies et le suivi de votre activité.
          </p>
          <div className="mt-9 space-y-4 text-sm text-white/90">
            <div className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-[#ffab82]"><Check className="size-4" /></span>
              Accès à vos marques autorisées
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-[#ffab82]"><Check className="size-4" /></span>
              Vos données commerciales au même endroit
            </div>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-10 text-xs font-medium text-white/55">
            <ShieldCheck className="size-4 text-[#ffab82]" aria-hidden="true" />
            Votre accès est personnel et sécurisé.
          </div>
        </aside>

        <div className="flex flex-col justify-center px-7 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#fce9da] text-[#c84f24]">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.13em] text-[#667384]">
              Dernière étape
            </span>
          </div>
          <h2 className="text-[1.75rem] font-black leading-tight tracking-[-0.055em] text-[#0b1e32] sm:text-[2rem]">
            Finalisez votre profil.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#667384]">
            Indiquez votre nom pour accéder à votre environnement de travail. Cette étape ne se fait qu’une seule fois.
          </p>
          <div className="mt-8">
            <OnboardingForm defaultName={profile?.full_name} requiresPassword={requiresPassword} />
          </div>
          <div className="mt-8 flex items-center gap-2 border-t border-[#0b1e32]/10 pt-6 text-xs text-[#667384]">
            <ArrowRight className="size-3.5 text-[#c84f24]" aria-hidden="true" />
            Vous retrouverez automatiquement les marques associées à votre compte.
          </div>
        </div>
      </div>
    </section>
  );
}
