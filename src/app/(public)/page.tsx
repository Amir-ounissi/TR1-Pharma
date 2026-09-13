import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingAnimationDemo } from "@/components/marketing/landing-animation-demo";
import { LandingBrandOverview } from "@/components/marketing/landing-brand-overview";
import { LandingPilotageMap } from "@/components/marketing/landing-pilotage-map";
import { LandingTrainingDemo } from "@/components/marketing/landing-training-demo";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

export const metadata: Metadata = {
  title: "TR1 Pharma | Visites, animations et formations en pharmacie",
  description:
    "Coordonnez vos commerciaux, animateurs et formateurs. Pilotez les interventions en pharmacie et suivez leurs résultats avec TR1 Pharma.",
};

const commercialPoints = [
  "Historique, commandes et contexte de la pharmacie.",
  "Visites, relances et réassorts à suivre.",
  "Compte rendu et prochaine action depuis le terrain.",
] as const;

const animationPoints = [
  "Intervenant, planning, produits et objectifs.",
  "Photos, compte rendu et ventes déclarées.",
  "Coûts, résultats observés et facturation.",
] as const;

const trainingPoints = [
  "Catalogue de modules par marque, gamme ou produit.",
  "Liste des formations et des participants par pharmacie.",
  "Quiz ludiques dans TR1, scores et progression.",
] as const;

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
              TR1 réunit vos commerciaux, animateurs et formateurs dans un même outil. Identifiez les pharmacies prioritaires, coordonnez les interventions et suivez leurs résultats.
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
              30 minutes pour découvrir TR1 et échanger sur votre organisation terrain.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-6xl sm:mt-12">
            <LandingPilotageMap />
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 border-t border-[var(--tr1-line)] px-5 py-16 lg:px-8 lg:py-20" id="plateforme">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">La plateforme</p>
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">
              Vos équipes avancent. Votre marque garde le fil.
            </h2>
            <p className="mt-5 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              Chaque visite, animation et formation reste rattachée à la pharmacie, avec son objectif, son intervenant et son suivi.
            </p>
          </div>

          <div className="mt-12 space-y-16 lg:space-y-20">
            <article className="grid items-center gap-8 lg:grid-cols-[.42fr_.58fr] lg:gap-12">
              <div>
                <p className="font-mono text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">COMMERCIAL</p>
                <h3 className="mt-3 text-[1.75rem] font-black leading-tight tracking-[-.025em] sm:text-[2rem]">Préparez les visites. Organisez la suite.</h3>
                <p className="mt-4 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-[1.06rem]">
                  Vos commerciaux retrouvent l’historique et les informations utiles avant chaque visite. Depuis leur téléphone, ils renseignent leur compte rendu, saisissent une commande et préparent la prochaine action.
                </p>
                <FeatureList items={commercialPoints} />
              </div>
              <div className="min-w-0 rounded-2xl border border-[var(--tr1-line)] bg-white p-3 shadow-[0_14px_38px_rgba(14,29,49,.06)] sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <p className="text-xs font-bold text-[var(--tr1-muted)]">Fiche pharmacie · démonstration</p>
                  <span className="rounded-full bg-[var(--tr1-ivory)] px-2.5 py-1 text-[.68rem] font-bold text-[var(--tr1-muted)]">Démonstration</span>
                </div>
                <Image
                  alt="Fiche pharmacie TR1 montrant le dernier échange et la prochaine action"
                  className="h-auto w-full rounded-xl border border-[var(--tr1-line)]"
                  height={600}
                  src="/marketing/pharmacy-account.webp"
                  width={716}
                />
              </div>
            </article>

            <article className="scroll-mt-24 grid items-center gap-8 lg:grid-cols-[.42fr_.58fr] lg:gap-12" id="animations-formations">
              <div>
                <p className="font-mono text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">ANIMATIONS</p>
                <h3 className="mt-3 text-[1.75rem] font-black leading-tight tracking-[-.025em] sm:text-[2rem]">Du brief au bilan, gardez la main sur vos animations.</h3>
                <p className="mt-4 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-[1.06rem]">
                  Coordonnez vos animateurs et prestataires, définissez les objectifs et planifiez les interventions. Retrouvez les comptes rendus, les preuves terrain, les ventes déclarées et le suivi de facturation.
                </p>
                <FeatureList items={animationPoints} />
              </div>
              <LandingAnimationDemo />
            </article>

            <article className="grid items-center gap-8 lg:grid-cols-[.42fr_.58fr] lg:gap-12">
              <div>
                <p className="font-mono text-[.64rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">FORMATIONS</p>
                <h3 className="mt-3 text-[1.75rem] font-black leading-tight tracking-[-.025em] sm:text-[2rem]">Sachez qui a été formé et ce qui a été retenu.</h3>
                <p className="mt-4 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-[1.06rem]">
                  Mettez vos modules à disposition des formateurs et suivez les formations réalisées dans chaque pharmacie. Retrouvez les participants, les modules suivis et les résultats des quiz pour identifier les acquis et les sujets à renforcer.
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
          <div className="max-w-3xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.14em] text-[var(--tr1-orange)]">Pilotage de la marque</p>
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">Décidez de la prochaine action avec une vue d’ensemble.</h2>
            <p className="mt-5 text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              Rassemblez l’activité commerciale, les interventions et les résultats disponibles pour suivre votre réseau et concentrer vos efforts sur les pharmacies qui en ont besoin.
            </p>
          </div>

          <div className="mt-10">
            <LandingBrandOverview />
          </div>

          <div className="mt-8 grid gap-6 border-t border-[var(--tr1-line)] pt-7 md:grid-cols-3">
            <PilotageLegend title="Commercial">Commandes, implantations, réassorts et objectifs.</PilotageLegend>
            <PilotageLegend title="Animations">Réalisation, ventes déclarées, coûts et évolution du CA après intervention.</PilotageLegend>
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
            <h2 className="mt-4 text-[2rem] font-black leading-[1.08] tracking-[-.03em] sm:text-[2.35rem]">Découvrez TR1 à partir de votre organisation terrain.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-[1.55] text-[var(--tr1-muted)] sm:text-lg">
              En 30 minutes, échangeons sur votre réseau et parcourons les usages qui vous concernent : suivi commercial, animations, formations et pilotage des résultats.
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