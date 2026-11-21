import { LeadForm } from "@/components/marketing/lead-form";
export default function DemanderAcces() {
  return <main className="mx-auto max-w-2xl px-5 py-12">
    <p className="text-xs font-bold uppercase tracking-wider text-[#ad4b08]">Catalogue B2B · TR1 PHARMA</p>
    <h1 className="mt-3 text-3xl font-bold">Demander un accès professionnel</h1>
    <p className="mt-3 mb-8 text-sm leading-6 text-[#69717d]">Notre équipe vérifie chaque demande avant d'autoriser l'accès au catalogue.</p>
    <LeadForm audience="pharmacy" />
  </main>;
}
