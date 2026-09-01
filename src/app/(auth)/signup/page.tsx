import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignUpForm } from "@/components/auth/signup-form";
import { Card, CardContent } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4.6rem)] max-w-5xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-[46rem] space-y-6">
        <div className="space-y-3 text-center">
          <h1 className="text-[2.2rem] font-semibold tracking-[-0.05em] text-[#0b1e32] sm:text-[3rem]">
            Créer un compte
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-[#667384] sm:text-base">
            Choisissez votre profil, renseignez vos informations, puis confirmez votre email.
          </p>
        </div>
        <Card className="overflow-hidden rounded-[1.75rem] border border-[#0b1e32]/10 bg-white shadow-[0_12px_40px_rgba(11,30,50,.08)]">
          <CardContent className="px-5 py-5 sm:px-7 sm:py-7">
            <SignUpForm />
          </CardContent>
        </Card>
        <div className="text-center">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#445265] hover:text-[#0b1e32]" href="/login">
            J’ai déjà un compte
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
