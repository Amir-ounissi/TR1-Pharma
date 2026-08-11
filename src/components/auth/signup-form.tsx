"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { signUpAction } from "@/app/(auth)/signup/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const profileOptions = [
  {
    value: "brand",
    label: "Marque",
    description: "Je représente une marque et je veux piloter mon réseau officinal.",
    accent: "Validation TR1 puis accès marque",
  },
  {
    value: "agent",
    label: "Agent",
    description: "Je suis commercial terrain et je veux accéder à mes pharmacies et actions.",
    accent: "Rattachement marque puis affectations",
  },
  {
    value: "facilitator",
    label: "Intervenant",
    description: "Je suis animateur ou formateur et je veux gérer mes missions terrain.",
    accent: "Accès missions après validation",
  },
] as const;

export function SignUpForm() {
  const [profileType, setProfileType] = useState<(typeof profileOptions)[number]["value"]>("brand");
  const [state, action, pending] = useActionState(signUpAction, {});
  const helperMessage = useMemo(() => {
    if (profileType === "brand") return "Le rôle final reste attribué par TR1. Ce formulaire enregistre votre demande d’accès marque.";
    if (profileType === "agent") return "Vous créez votre identité TR1, puis votre marque et vos pharmacies vous seront affectées.";
    return "Vous créez votre identité TR1, puis vos missions et périmètres terrain seront activés.";
  }, [profileType]);

  return (
    <form action={action} className="space-y-5">
      {state.error || state.success ? (
        <Alert variant={state.error ? "destructive" : "default"} className={state.error ? "border-[#d95034]/35 bg-[#fff1ec] text-[#8f2e19]" : "border-[#0b1e32]/10 bg-[#f4f8f3] text-[#1f5130]"}>
          <AlertDescription>{state.error ?? state.success}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="profileType" value={profileType} />
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Type de compte demandé</p>
          <p className="text-sm text-[#667384]">Choisissez votre parcours. Les droits finaux sont attribués ensuite par TR1 ou par la marque.</p>
        </div>
        <div className="grid gap-3">
          {profileOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setProfileType(option.value)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition",
                profileType === option.value
                  ? "border-[#c84f24] bg-[#fff1ec] shadow-[0_10px_24px_rgba(200,79,36,.12)]"
                  : "border-[#e6ded1] bg-white hover:border-[#c84f24]/35 hover:bg-[#fffdfa]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#0b1e32]">{option.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[#667384]">{option.description}</p>
                </div>
                <span className={cn("mt-1 inline-flex size-4 rounded-full border", profileType === option.value ? "border-[#c84f24] bg-[#c84f24]" : "border-[#c8c0b2] bg-white")} />
              </div>
              <p className="mt-3 font-mono text-[.62rem] font-black uppercase tracking-[.14em] text-[#c84f24]">{option.accent}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Nom complet</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Prénom Nom" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Email professionnel</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="vous@marque.com" />
      </div>
      {profileType === "brand" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Marque ou société</Label>
            <Input id="companyName" name="companyName" autoComplete="organization" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="VK Swiss" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Fonction</Label>
            <Input id="jobTitle" name="jobTitle" autoComplete="organization-title" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Directeur commercial, chef de marque…" />
          </div>
        </>
      ) : null}
      {profileType === "agent" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="currentOrganization" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Structure actuelle</Label>
            <Input id="currentOrganization" name="currentOrganization" autoComplete="organization" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="VK Swiss, réseau externalisé, freelance…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="territory" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Zone ou secteur</Label>
            <Input id="territory" name="territory" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Île-de-France, PACA, Suisse romande…" />
          </div>
        </>
      ) : null}
      {profileType === "facilitator" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="facilitatorKind" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Type d’intervention</Label>
            <select id="facilitatorKind" name="facilitatorKind" required className="flex h-12 w-full rounded-xl border border-[#d8d0c2] bg-white px-3 text-sm text-[#0b1e32] shadow-none outline-none focus:border-[#c84f24]">
              <option value="">Sélectionner</option>
              <option value="animateur">Animateur</option>
              <option value="formateur">Formateur</option>
              <option value="mixte">Animateur + formateur</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialty" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Spécialité</Label>
            <Input id="specialty" name="specialty" required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Dermocosmétique, OTC, conseil équipe, sell-out…" />
          </div>
        </>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Au moins 8 caractères" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-xs font-black uppercase tracking-[.12em] text-[#445265]">Confirmer le mot de passe</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="h-12 rounded-xl border-[#d8d0c2] bg-white text-[#0b1e32] shadow-none placeholder:text-[#8a93a1] focus-visible:border-[#c84f24] focus-visible:ring-[#c84f24]/25" placeholder="Répétez le mot de passe" />
      </div>
      <Button className="h-12 w-full rounded-xl bg-[#c84f24] text-sm font-black text-white shadow-[0_16px_34px_rgba(200,79,36,.24)] hover:bg-[#a63f19]" disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="rounded-xl border border-[#0b1e32]/8 bg-white/75 px-4 py-3 text-sm leading-6 text-[#445265]">
        {helperMessage}
      </p>
      <p className="text-center text-xs leading-5 text-[#667384]">
        La création du compte n’accorde pas automatiquement un rôle final, une marque ou des droits terrain.
      </p>
      <p className="text-center text-sm text-[#445265]">
        Déjà un compte ?{" "}
        <Link className="font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
