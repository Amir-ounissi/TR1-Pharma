import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-4.6rem)] max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-16">
      <div className="space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0b1e32]/10 bg-white/80 px-3 py-2 font-mono text-[.62rem] font-black uppercase tracking-[.14em] text-[#c84f24] shadow-sm">
          <LockKeyhole className="size-3.5" aria-hidden="true" />
          Accès sécurisé plateforme
        </div>
        <div className="space-y-5">
          <h1 className="max-w-3xl text-[3rem] font-black leading-[.94] tracking-[-.07em] text-[#0b1e32] sm:text-6xl">
            Connectez-vous à <span className="text-[#c84f24]">l’espace opérationnel</span> TR1.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[#667384]">
            Retrouvez vos comptes, vos pharmacies, vos missions terrain et vos prochaines actions dans la même expérience que le reste de la plateforme.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Suivi marque", "Accédez aux pharmacies, commandes et priorités de votre portefeuille."],
            ["Pilotage terrain", "Vos équipes voient uniquement les comptes, missions et actions autorisés."],
            ["Sécurité tenant", "Chaque marque conserve son périmètre de données et ses droits dédiés."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-[#0b1e32]/10 bg-white/75 p-5 shadow-[0_18px_40px_rgba(7,20,33,.06)] backdrop-blur-sm">
              <Sparkles className="size-4 text-[#c84f24]" aria-hidden="true" />
              <h2 className="mt-5 text-lg font-black tracking-[-.03em] text-[#0b1e32]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667384]">{text}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#445265]">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#0b1e32]/10 bg-[#f8f2e8] px-3 py-2 font-semibold">
            <ShieldCheck className="size-4 text-[#c84f24]" aria-hidden="true" />
            Authentification par email et mot de passe
          </div>
          <Link className="inline-flex items-center gap-2 font-black text-[#0b1e32] hover:text-[#c84f24]" href="/">
            Retour à la présentation
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <Card className="overflow-hidden rounded-[1.8rem] border border-[#0b1e32]/10 bg-white/88 shadow-[0_32px_90px_rgba(7,20,33,.14)] backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="border-b border-[#0b1e32]/10 bg-[radial-gradient(circle_at_top_right,rgba(47,108,163,.18),transparent_34%),#071421] px-6 py-8 text-white sm:px-8">
            <p className="font-mono text-[.68rem] font-black uppercase tracking-[.16em] text-[#ff9d78]">Connexion TR1 Pharma</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-.05em]">Accédez à votre espace commercial sécurisé.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/72">
              Sélection de marque, rôles, droits et navigation restent alignés avec votre périmètre opérationnel.
            </p>
          </div>
          <div className="bg-[#fffefa] px-6 py-8 sm:px-8">
            <LoginForm />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
