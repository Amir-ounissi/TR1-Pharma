import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingAnimationDemo } from "@/components/marketing/landing-animation-demo";
import { LandingBrandOverview } from "@/components/marketing/landing-brand-overview";
import { LandingCommercialDemo } from "@/components/marketing/landing-commercial-demo";
import { LandingPilotageMap } from "@/components/marketing/landing-pilotage-map";
import { LandingTrainingDemo } from "@/components/marketing/landing-training-demo";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

export const metadata: Metadata = {
  title: "TR1 Pharma | Du sell-in au sell-out en pharmacie",
  description:
    "Pilotez visites commerciales, animations, formations et prochaines actions dans votre réseau officinal avec TR1 Pharma.",
};

const commercialPoints = [
  "Les pharmacies à voir et la raison de la visite.",
  "Le contexte, l’historique et les actions en attente.",
  "Le compte rendu et la prochaine action depuis le téléphone.",
] as const;

const animationPoints = [
  "Un brief, un intervenant et un objectif rattachés à la pharmacie.",
  "Le suivi de réalisation, les preuves terrain et les ventes déclarées.",
  "Le bilan, les coûts et la suite commerciale à préparer.",
] as const;

const trainingPoints = [
  "Les modules à transmettre aux équipes officinales.",
  "Les participants et formations suivies par pharmacie.",
  "Les résultats des quiz et les sujets à renforcer.",
] as const;

const executionSteps = ["Commande", "Implantation", "Formation", "Animation", "Réassort", "Résultats"] as const;

export default function LandingPage() {
  return (
    <main className="bg-[var(--tr1-ivory)] text-[var(--tr1-navy)]">
      <MarketingPageEvent event="landing_view" />

      <section className="px-5 py-10 sm:py-12 lg:px-8 lg:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-[2.35rem] font-black leading-[1.02] tracking-[-.04em] sm:text-5xl lg:text-[4rem]">
              <span className="text-[var(--tr1-orange)]">Du sell-in au sell-out,</span>{" "}
              pilotez chaque action qui fait vendre en pharmacie.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              TR1 réunit visites commerciales, commandes, animations, formations et suivi du réseau dans un même cockpit terrain. Vos équipes savent où agir. Vous savez ce qui a été fait et ce qui doit suivre.
            </p>
            <div className="mt-7">
              <MarketingTrackedLink
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tr1-orange)] px-5 text-sm font-black text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 motion-reduce:transition-none"
                event="primary_cta_click"
                href="#diagnostic"
                properties={{ placement: "hero" }}
              >
                Demander une démo
                <ArrowRight className="size-4" />
              </MarketingTrackedLink>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--tr1-muted)]">
              30 minutes pour découvrir TR1 à partir de votre organisation terrain.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-6xl sm:mt-12">
            <LandingPilotageMap />
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 border-t border-[var(--tr1-line)] px-5 py-16 lg:px-8 lg:py-20" id="plateforme">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">La plateforme</p>
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">
              Une pharmacie. Tout son historique terrain. Une prochaine action claire.
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              Chaque information sert à préparer la suivante. Le commercial, l’animateur, le formateur et la marque travaillent autour du même compte pharmacie.
            </p>
          </div>

          <div className="mt-8 overflow-x-auto pb-1">
            <div className="flex min-w-[760px] items-center rounded-2xl border border-[var(--tr1-line)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(14,29,49,.04)]">
              {executionSteps.map((step, index) => (
                <div className="flex flex-1 items-center" key={step}>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--tr1-navy)] font-mono text-[.67rem] font-black text-white">{index + 1}</span>
                    <span className="truncate text-sm font-black text-[var(--tr1-navy)]">{step}</span>
                  </div>
                  {index < executionSteps.length - 1 ? <ArrowRight className="mx-2 size-4 shrink-0 text-[var(--tr1-orange)]" aria-hidden="true" /> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 space-y-16 lg:space-y-20">
            <article className="grid items-center gap-8 lg:grid-cols-[.38fr_.62fr] lg:gap-12">
              <div>
                <p className="font-mono text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">COMMERCIAL</p>
                <h3 className="mt-3 text-[1.75rem] font-black leading-tight tracking-[-.025em] sm:text-[2rem]">Avant la visite, sachez où aller et pourquoi.</h3>
                <p className="mt-4 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-[1.06rem]">
                  Une pharmacie n’a pas commandé depuis plusieurs semaines ? Une prochaine action manque ? TR1 fait remonter le contexte utile pour préparer la tournée et éviter de repartir de zéro à chaque visite.
                </p>
                <FeatureList items={commercialPoints} />
              </div>
              <LandingCommercialDemo />
            </article>

            <article className="scroll-mt-24 grid items-center gap-8 lg:grid-cols-[.38fr_.62fr] lg:gap-12" id="animations-formations">
              <div>
                <p className="font-mono text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">ANIMATIONS</p>
                <h3 className="mt-3 text-[1.75rem] font-black leading-tight tracking-[-.025em] sm:text-[2rem]">Après l’implantation, organisez ce qui fera vivre la marque.</h3>
                <p className="mt-4 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-[1.06rem]">
                  Le commercial déclenche l’animation, l’intervenant reçoit son brief et la marque retrouve le bilan au même endroit. La journée ne disparaît plus dans une chaîne de messages, de photos et de fichiers séparés.
                </p>
                <FeatureList items={animationPoints} />
              </div>
              <LandingAnimationDemo />
            </article>

            <article className="grid items-center gap-8 lg:grid-cols-[.38fr_.62fr] lg:gap-12">
              <div>
                <p className="font-mono text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">FORMATIONS</p>
                <h3 className="mt-3 text-[1.75rem] font-black leading-tight tracking-[-.025em] sm:text-[2rem]">Formez les équipes. Retrouvez ce qui a vraiment été transmis.</h3>
                <p className="mt-4 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-[1.06rem]">
                  Pour chaque pharmacie, TR1 conserve les participants, les modules suivis et les résultats des quiz. La marque sait où la formation a eu lieu et quels sujets méritent d’être renforcés.
                </p>
                <FeatureList items={trainingPoints} />
              </div>
              <LandingTrainingDemo />
            </article>
          </div>

          <div className="mt-12 text-center">
            <MarketingTrackedLink
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tr1-orange)] px-5 text-sm font-black text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 motion-reduce:transition-none"
              event="primary_cta_click"
              href="#diagnostic"
              properties={{ placement: "after_use_cases" }}
            >
              Demander une démo
              <ArrowRight className="size-4" />
            </MarketingTrackedLink>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--tr1-line)] bg-white/28 px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">Pilotage de la marque</p>
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">Pendant que le terrain agit, la direction voit où intervenir ensuite.</h2>
            <p className="mt-5 max-w-3xl text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              Pharmacies à relancer, interventions à suivre, résultats disponibles : la vue marque rassemble les signaux utiles pour prioriser l’action sans devoir reconstruire l’histoire du réseau.
            </p>
          </div>

          <div className="mt-10">
            <LandingBrandOverview />
          </div>

          <div className="mt-8 grid gap-6 border-t border-[var(--tr1-line)] pt-7 md:grid-cols-3">
            <PilotageLegend title="Commercial">Commandes, implantations, réassorts et prochaines visites.</PilotageLegend>
            <PilotageLegend title="Animations">Réalisation, ventes déclarées, coûts et évolution observée après intervention.</PilotageLegend>
            <PilotageLegend title="Formations">Couverture du réseau, participants formés et résultats des quiz.</PilotageLegend>
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-5 text-[var(--tr1-muted)]">
            Le « CA observé après intervention » décrit une évolution constatée sur la période suivie. Il ne constitue pas, à lui seul, une preuve de causalité de l’action terrain.
          </p>
        </div>
      </section>

      <section className="scroll-mt-24 px-5 py-16 lg:px-8 lg:py-20" id="pourquoi-tr1">
        <div className="mx-auto max-w-7xl rounded-2xl bg-[var(--tr1-navy)] px-6 py-10 text-[var(--tr1-ivory)] sm:px-10 lg:px-14 lg:py-12">
          <div className="max-w-4xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">Pourquoi TR1</p>
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">TR1 est né sur le terrain.</h2>
            <div className="mt-6 space-y-4 text-base leading-[1.65] text-white/75 sm:text-lg">
              <p>Avant une tournée, je pouvais passer deux heures à choisir les pharmacies à revoir, retrouver nos derniers échanges et organiser les trajets autour des rendez-vous.</p>
              <p>Entre deux visites, je prenais mes notes sur mon téléphone. Le soir, je les recopiais dans mon CRM… quand je le faisais.</p>
              <p>J’ai commencé à construire TR1 pour préparer mes tournées plus rapidement, retrouver les bonnes informations avant d’entrer en pharmacie et faire mon retour directement sur mon téléphone en sortant.</p>
            </div>
            <div className="mt-7 border-t border-white/15 pt-5">
              <p className="font-black">Amir Ounissi</p>
              <p className="mt-1 text-sm text-white/55">Délégué pharmaceutique et fondateur de TR1 Pharma</p>
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 border-t border-[var(--tr1-line)] bg-white/28 px-5 py-16 lg:px-8 lg:py-20" id="diagnostic">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">Démonstration</p>
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">Voyez comment TR1 s’adapte à votre organisation terrain.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              En 30 minutes, partons de votre réseau, de vos équipes et de vos actions actuelles pour voir comment TR1 peut structurer leur suivi du sell-in au sell-out.
            </p>
          </div>
          <div className="mx-auto mt-9 max-w-xl"><LeadForm /></div>
        </div>
      </section>
    </main>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <div className="mt-6 space-y-3 text-sm leading-6 text-[var(--tr1-navy)]">
      {items.map((text) => (
        <p className="flex items-start gap-2.5" key={text}>
          <CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-[var(--tr1-orange)]" />
          <span>{text}</span>
        </p>
      ))}
    </div>
  );
}

function PilotageLegend({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-black text-[var(--tr1-navy)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--tr1-muted)]">{children}</p>
    </div>
  );
}
