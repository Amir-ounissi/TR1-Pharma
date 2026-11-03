import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, PackageCheck, Store } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

export const metadata: Metadata = {
  title: "Pharmacies — Marques partenaires et demandes | TR1 PHARMA",
  description: "Découvrez les marques accompagnées par TR1 PHARMA en officine, demandez les conditions d'implantation ou transmettez votre besoin de réassort.",
  alternates: { canonical: "https://www.tr1pharma.com/pharmacies" },
};

const steps = [
  {
    number: "01",
    title: "Découvrir une marque",
    text: "Consultez les gammes représentées par TR1 PHARMA, sans inscription préalable.",
  },
  {
    number: "02",
    title: "Exprimer votre besoin",
    text: "Demandez une présentation, une implantation ou un réassort si vous êtes déjà client.",
  },
  {
    number: "03",
    title: "Être accompagné",
    text: "TR1 PHARMA vérifie votre demande et organise la suite avec la marque concernée.",
  },
];

export default function PharmaciesPage() {
  return (
    <main id="contenu" className="bg-[var(--tr1-ivory)] text-[var(--tr1-navy)]">
      <MarketingPageEvent event="landing_view" />
      <section className="border-b border-[var(--tr1-line)] px-[18px] py-16 sm:px-8 sm:py-20 lg:px-11 lg:py-24">
        <div className="mx-auto grid max-w-[1260px] gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">Pour les pharmacies & parapharmacies</p>
            <h1 className="max-w-[850px] text-[clamp(2.55rem,5vw,5rem)] font-semibold leading-[1.08] tracking-[-0.055em]">
              Des marques à découvrir. <span className="text-[var(--tr1-orange)]">Un partenaire pour les développer.</span>
            </h1>
          </div>
          <div className="space-y-6 lg:pb-2">
            <p className="max-w-xl text-base leading-8 text-[#515d6b] sm:text-lg">TR1 PHARMA sélectionne et accompagne des marques en pharmacie : présentation des gammes, implantation, formation, animation et suivi des réassorts.</p>
            <MarketingTrackedLink className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[var(--tr1-orange)] px-5 py-3 text-sm font-bold text-[var(--tr1-navy)] transition hover:brightness-110" event="primary_cta_click" href="#demande" properties={{ placement: "pharmacies_hero" }}>
              Faire une demande <ArrowUpRight size={17} aria-hidden="true" />
            </MarketingTrackedLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="brand-title" className="px-[18px] py-14 sm:px-8 sm:py-20 lg:px-11">
        <div className="mx-auto max-w-[1260px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#69717d]">Notre sélection</p>
              <h2 id="brand-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Les marques représentées</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#515d6b]">Le catalogue évolue au rythme des partenariats commerciaux de TR1 PHARMA.</p>
          </div>

          <article className="grid overflow-hidden rounded-xl border border-[var(--tr1-line-strong)] bg-white md:grid-cols-[.75fr_1.25fr]">
            <div className="flex min-h-64 flex-col justify-between bg-[var(--tr1-navy)] p-8 text-white sm:p-10">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/55">Marque partenaire</span>
              <div>
                <p className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">VK SWISS</p>
                <p className="mt-3 max-w-xs text-sm text-white/70">Compléments alimentaires</p>
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--tr1-orange)]">Implantation · Formation · Animation</span>
            </div>
            <div className="flex flex-col justify-between gap-8 p-8 sm:p-10">
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.035em]">Découvrez la gamme VK SWISS</h3>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#515d6b]">TR1 PHARMA accompagne le développement commercial de VK SWISS en officine. Nous pouvons vous présenter la gamme, les conditions d&apos;implantation et le dispositif d&apos;accompagnement terrain.</p>
              </div>
              <MarketingTrackedLink className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-bold text-[var(--tr1-navy)] underline decoration-[var(--tr1-orange)] decoration-2 underline-offset-8 hover:text-[var(--tr1-orange)]" event="primary_cta_click" href="#demande" properties={{ placement: "pharmacies_vk_swiss" }}>
                Demander les conditions commerciales <ArrowRight size={16} aria-hidden="true" />
              </MarketingTrackedLink>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="how-title" className="border-y border-[var(--tr1-line)] bg-white/65 px-[18px] py-14 sm:px-8 sm:py-16 lg:px-11">
        <div className="mx-auto max-w-[1260px]">
          <h2 id="how-title" className="text-3xl font-semibold tracking-[-0.04em]">Un parcours simple pour votre officine</h2>
          <div className="mt-9 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="border-t border-[var(--tr1-line-strong)] pt-5">
                <span className="text-xs font-bold tracking-[0.12em] text-[var(--tr1-orange)]">{step.number}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#515d6b]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="request-title" className="px-[18px] py-14 sm:px-8 sm:py-20 lg:px-11" id="demande">
        <div className="mx-auto grid max-w-[1260px] gap-9 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--tr1-orange)]">Un seul formulaire</p>
            <h2 id="request-title" className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Une implantation ou un réassort ?</h2>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#515d6b]">Pas besoin de créer un compte pour découvrir nos marques. Choisissez simplement votre besoin et indiquez-nous les informations utiles.</p>
            <div className="mt-8 space-y-4 text-sm text-[#515d6b]">
              <p className="flex items-start gap-3"><Store aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--tr1-orange)]" /> Prospects : une présentation et des conditions adaptées à votre pharmacie.</p>
              <p className="flex items-start gap-3"><PackageCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--tr1-orange)]" /> Clients : transmettez vos références et quantités de réassort.</p>
              <p className="flex items-start gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--tr1-orange)]" /> Toute demande est vérifiée par TR1 PHARMA avant transmission à la marque.</p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--tr1-line-strong)] bg-white p-5 shadow-[0_16px_44px_rgba(14,29,49,.06)] sm:p-8">
            <LeadForm audience="pharmacy" />
            <p className="mt-4 text-xs leading-5 text-[#515d6b]">Une demande de réassort ne vaut pas commande confirmée. Vous recevez une confirmation après traitement par TR1 PHARMA et la marque.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--tr1-line)] px-[18px] py-8 sm:px-8 lg:px-11">
        <div className="mx-auto flex max-w-[1260px] flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[#515d6b]">Vous représentez une marque et souhaitez développer sa présence en pharmacie ?</p>
          <Link href="/#contact-marque" className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--tr1-orange)]">Découvrir l&apos;accompagnement des marques <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
