import Link from "next/link";
import { ArrowRight, BadgePlus, CheckCircle2 } from "lucide-react";
import { SignUpForm } from "@/components/auth/signup-form";
import { Card, CardContent } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4.6rem)] max-w-7xl items-center px-5 py-6 lg:px-8 lg:py-8">
      <Card className="w-full overflow-hidden rounded-[2rem] border border-[#0b1e32]/10 bg-white/94 shadow-[0_28px_80px_rgba(7,20,33,.12)]">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[minmax(0,1.02fr)_minmax(34rem,.98fr)]">
            <div className="border-b border-[#0b1e32]/10 bg-[#fffefa] px-6 py-8 lg:border-b-0 lg:border-r lg:px-8 lg:py-10 xl:px-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0b1e32]/10 bg-white px-3 py-2 font-mono text-[.62rem] font-black uppercase tracking-[.14em] text-[#c84f24]">
                <BadgePlus className="size-3.5" aria-hidden="true" />
                Création de compte
              </div>
              <div className="mt-5 space-y-4">
                <h1 className="max-w-2xl text-[2.6rem] font-black leading-[.92] tracking-[-.08em] text-[#0b1e32] sm:text-[3.6rem] xl:text-[4.4rem]">
                  Créez votre accès <span className="text-[#c84f24]">TR1</span>.
                </h1>
                <p className="max-w-xl text-base leading-7 text-[#667384] sm:text-[1.15rem] sm:leading-8">
                  Un parcours unique, plus clair et plus rapide, pour ouvrir un espace marque, agent ou intervenant sans confusion de rôle.
                </p>
              </div>
              <div className="mt-6 font-mono text-[.68rem] font-bold uppercase tracking-[.16em] text-[#667384]">
                Choix du profil · Confirmation email · Activation des accès
              </div>
              <div className="mt-6 grid gap-3">
                {[
                  "Parcours plus lisible, sans attribution prématurée de droits.",
                  "Informations utiles selon le type d’utilisateur.",
                  "Activation finale gardée côté TR1 ou administrateur marque.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#0b1e32]/8 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(11,30,50,.04)]">
                    <CheckCircle2 className="mt-0.5 size-4 text-[#c84f24]" aria-hidden="true" />
                    <p className="text-sm leading-6 text-[#445265]">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7">
                <Link className="inline-flex items-center gap-2 text-base font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">
                  J’ai déjà un compte
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="bg-[#071421] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#fffefa] shadow-[0_18px_50px_rgba(0,0,0,.18)]">
                <div className="border-b border-[#0b1e32]/10 px-5 py-4 sm:px-6">
                  <p className="font-mono text-[.68rem] font-black uppercase tracking-[.16em] text-[#c84f24]">Nouveau compte TR1 Pharma</p>
                  <h2 className="mt-2 text-[1.65rem] font-black tracking-[-.05em] text-[#0b1e32]">Commencez simplement.</h2>
                </div>
                <div className="px-5 py-4 sm:px-6 sm:py-5">
                  <SignUpForm />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
