import Link from "next/link";
import { ArrowRight, BadgePlus } from "lucide-react";
import { SignUpForm } from "@/components/auth/signup-form";
import { Card, CardContent } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-4.6rem)] max-w-7xl items-center gap-12 px-5 py-10 lg:grid-cols-[.9fr_.7fr] lg:px-8 lg:py-16">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0b1e32]/10 bg-white/80 px-3 py-2 font-mono text-[.62rem] font-black uppercase tracking-[.14em] text-[#c84f24]">
          <BadgePlus className="size-3.5" aria-hidden="true" />
          Création de compte
        </div>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-[2.8rem] font-black leading-[.95] tracking-[-.07em] text-[#0b1e32] sm:text-[4.2rem]">
            Créez votre accès <span className="text-[#c84f24]">TR1</span>.
          </h1>
          <p className="max-w-xl text-base leading-7 text-[#667384] sm:text-lg">
            Marque, agent terrain ou intervenant : ouvrez votre compte avec un parcours adapté, confirmez votre email, puis laissez TR1 activer le bon périmètre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#445265]">
          <div className="font-mono text-[.68rem] font-bold uppercase tracking-[.14em] text-[#667384]">
            Choix du profil · Confirmation email · Activation des accès
          </div>
          <Link className="inline-flex items-center gap-2 font-black text-[#0b1e32] hover:text-[#c84f24]" href="/login">
            J’ai déjà un compte
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <Card className="overflow-hidden rounded-[1.6rem] border border-[#0b1e32]/10 bg-white/92 shadow-[0_24px_70px_rgba(7,20,33,.12)]">
        <CardContent className="p-0">
          <div className="border-b border-[#0b1e32]/10 bg-[#071421] px-6 py-7 text-white sm:px-8">
            <p className="font-mono text-[.68rem] font-black uppercase tracking-[.16em] text-[#ff9d78]">Nouveau compte TR1 Pharma</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-.05em]">Commencez simplement.</h2>
          </div>
          <div className="bg-[#fffefa] px-6 py-7 sm:px-8">
            <SignUpForm />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
