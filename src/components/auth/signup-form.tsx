"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { signUpAction } from "@/app/(auth)/signup/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FacilitatorActivity = "animation" | "training";

const profileOptions = [
  {
    value: "brand",
    label: "Marque",
    description: "Piloter un espace marque.",
    accent: "Accès marque après validation",
  },
  {
    value: "agent",
    label: "Agent",
    description: "Accéder au terrain et aux pharmacies.",
    accent: "Rattachement ensuite par TR1",
  },
  {
    value: "facilitator",
    label: "Intervenant",
    description: "Réaliser des animations et/ou formations en pharmacie.",
    accent: "Validation puis rattachement à une marque",
  },
] as const;

const facilitatorActivityOptions: Array<{
  value: FacilitatorActivity;
  label: string;
}> = [
  { value: "animation", label: "Animation" },
  { value: "training", label: "Formation" },
];

export function SignUpForm() {
  const [profileType, setProfileType] = useState<(typeof profileOptions)[number]["value"]>("brand");
  const [facilitatorActivities, setFacilitatorActivities] = useState<FacilitatorActivity[]>([]);
  const [state, action, pending] = useActionState(signUpAction, {});
  const helperMessage = useMemo(() => {
    if (profileType === "brand") return "Votre accès final sera activé après validation de votre demande marque.";
    if (profileType === "agent") return "Votre accès final sera activé après rattachement à une marque et à votre périmètre.";
    return "Votre accès final sera activé après validation de vos activités et rattachement à une marque.";
  }, [profileType]);

  function toggleFacilitatorActivity(activity: FacilitatorActivity) {
    setFacilitatorActivities((current) =>
      current.includes(activity)
        ? current.filter((value) => value !== activity)
        : [...current, activity],
    );
  }

  const facilitatorActivityMissing =
    profileType === "facilitator" && facilitatorActivities.length === 0;

  return (
    <form action={action} className="space-y-5">
      {state.error || state.success ? (
        <Alert variant={state.error ? "destructive" : "default"} className={state.error ? "border-[#d95034]/35 bg-[#fff1ec] text-[#8f2e19]" : "border-[#dfe6dc] bg-[#f7fbf5] text-[#245135]"}>
          <AlertDescription>{state.error ?? state.success}</AlertDescription>
        </Alert>
      ) : null}

      <input type="hidden" name="profileType" value={profileType} />

      <div className="space-y-3">
        <p className="text-sm font-medium text-[#0b1e32]">Profil</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {profileOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setProfileType(option.value)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition",
                profileType === option.value
                  ? "border-[#0b1e32] bg-[#f7f8fa]"
                  : "border-[#e6e8ec] bg-white hover:border-[#cfd5dd] hover:bg-[#fafbfc]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0b1e32]">{option.label}</p>
                  <p className="mt-1 text-[.82rem] leading-5 text-[#667384]">{option.description}</p>
                </div>
                <span className={cn("mt-0.5 inline-flex size-3 rounded-full border", profileType === option.value ? "border-[#0b1e32] bg-[#0b1e32]" : "border-[#c8cdd5] bg-white")} />
              </div>
              <p className="mt-2 text-[.72rem] font-medium text-[#667384]">{option.accent}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fullName" className="text-sm font-medium text-[#0b1e32]">Nom complet</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="Prénom Nom" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email" className="text-sm font-medium text-[#0b1e32]">Email professionnel</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="vous@marque.com" />
        </div>

        {profileType === "brand" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-sm font-medium text-[#0b1e32]">Marque ou société</Label>
              <Input id="companyName" name="companyName" autoComplete="organization" required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="VK Swiss" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle" className="text-sm font-medium text-[#0b1e32]">Fonction</Label>
              <Input id="jobTitle" name="jobTitle" autoComplete="organization-title" required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="Directeur commercial, chef de marque…" />
            </div>
          </>
        ) : null}

        {profileType === "agent" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="currentOrganization" className="text-sm font-medium text-[#0b1e32]">Structure actuelle</Label>
              <Input id="currentOrganization" name="currentOrganization" autoComplete="organization" required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="VK Swiss, freelance…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="territory" className="text-sm font-medium text-[#0b1e32]">Zone ou secteur</Label>
              <Input id="territory" name="territory" required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="Suisse romande" />
            </div>
          </>
        ) : null}

        {profileType === "facilitator" ? (
          <fieldset className="space-y-3 rounded-2xl border border-[#e6e8ec] bg-[#fafbfc] p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium text-[#0b1e32]">Votre activité</legend>
            <p className="text-[.82rem] leading-5 text-[#667384]">
              Sélectionnez au moins une activité. Vous pouvez choisir les deux avec un seul compte.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {facilitatorActivityOptions.map((option) => {
                const checked = facilitatorActivities.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium text-[#0b1e32] transition",
                      checked ? "border-[#0b1e32]" : "border-[#dfe3ea] hover:border-[#cfd5dd]",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="facilitatorActivities"
                      value={option.value}
                      checked={checked}
                      onChange={() => toggleFacilitatorActivity(option.value)}
                      className="size-4 rounded border-[#c8cdd5] accent-[#0b1e32]"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            {facilitatorActivityMissing ? (
              <p className="text-xs text-[#667384]">Au moins une activité est obligatoire.</p>
            ) : null}
          </fieldset>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-[#0b1e32]">Mot de passe</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="Au moins 8 caractères" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#0b1e32]">Confirmer le mot de passe</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="h-11 rounded-2xl border-[#dfe3ea] bg-white text-[#0b1e32] shadow-none placeholder:text-[#98a2b3] focus-visible:border-[#0b1e32]/30 focus-visible:ring-[#0b1e32]/10" placeholder="Répétez le mot de passe" />
        </div>
      </div>

      <Button className="h-11 w-full rounded-2xl bg-[#0b1e32] text-sm font-medium text-white shadow-none hover:bg-[#152a40]" disabled={pending || facilitatorActivityMissing}>
        {pending ? "Création…" : "Créer mon compte"}
      </Button>

      <p className="rounded-2xl border border-[#e6e8ec] bg-[#fafbfc] px-4 py-3 text-sm leading-6 text-[#445265]">
        {helperMessage}
      </p>

      <p className="text-center text-[.8rem] leading-5 text-[#667384]">
        La création du compte n’accorde pas automatiquement un rôle final, une marque ou des droits terrain.
      </p>

      <p className="text-center text-sm text-[#445265] sm:hidden">
        Déjà un compte ?{" "}
        <Link className="font-medium text-[#0b1e32] hover:text-[#0b1e32]" href="/login">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
