import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { LandingActionScenario } from "@/components/marketing/landing-action-scenario";
import { LandingPilotageMap } from "@/components/marketing/landing-pilotage-map";
import { LandingTrainingDemo } from "@/components/marketing/landing-training-demo";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

export const metadata: Metadata = {
  title: "TR1 Pharma | Pilotage commercial et actions terrain en pharmacie",
  description:
    "TR1 Pharma aide les marques et laboratoires à identifier où agir, coordonner commerciaux, animateurs et formateurs, puis suivre les résultats dans leur réseau officinal.",
};

const valueBlocks = [
  {
    title: "Identifiez les priorités",
    text: "Repérez les réassorts attendus, les comptes à risque et les pharmacies sans prochaine action.",
  },
  {
    title: "Coordonnez les équipes",
    text: "Partagez les objectifs, les briefs et le planning des visites, animations et formations.",
  },
  {
    title: "Suivez les résultats",
    text: "Retrouvez les comptes rendus, les ventes déclarées, les équipes formées et les résultats des quiz.",
  },
] as const;

const interventionMetrics = [
  {
    title: "Commercial",
    lines: ["Commandes et implantations", "Réassorts et comptes à suivre", "Progression par rapport aux objectifs"],
  },
  {
    title: "Animations",
    lines: ["Missions réalisées", "Ventes déclarées et coûts", "Résultats observés et comparaison avant / après"],
  },
  {
    title: "Formations",
    lines: ["Pharmacies et participants formés", "Modules suivis", "Résultats des quiz et progression"],
  },
] as const;

export default function LandingPage() {
  return (
    <main className="bg-[var(--tr1-ivory)] text-[var(--tr1-navy)]">
      <MarketingPageEvent event="landing_view" />

      <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(circle_at_70%_16%,rgba(182,211,230,.3),transparent_38%),radial-gradient(circle_at_18%_0%,rgba(255,255,255,.94),transparent_58%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.86fr_1.14fr] lg:gap-8">
          <div className="relative z-10 max-w-[39rem] py-4 lg:py-8">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">
              Pour les marques qui se développent en pharmacie
            </p>
            <h1 className="mt-6 text-[3rem] font-black leading-[.98] tracking-[-.065em] sm:text-[3.7rem] lg:text-[4.3rem]">
              Une vision claire de votre réseau. <span className="text-[var(--tr1-orange)]">Des actions concrètes dans chaque pharmacie.</span>
            </h1>
            <p className="mt-7 max-w-[37rem] text-lg leading-8 text-[var(--tr1-muted)] sm:text-xl sm:leading-9">
              Coordonnez vos commerciaux, animateurs et formateurs. Identifiez où intervenir et suivez les résultats de vos visites, animations et formations.
            </p>
            <div className="mt-9">
              <MarketingTrackedLink
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tr1-navy)] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(14,29,49,.16)] transition hover:-translate-y-0.5 hover:bg-[#173a5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-orange)] focus-visible:ring-offset-2 motion-reduce:transition-none"
                event="primary_cta_click"
                href="#diagnostic"
                properties={{ placement: "hero" }}
              >
                Demander une démo
                <ArrowRight className="size-4" />
              </MarketingTrackedLink>
            </div>
            <p className="mt-4 text-sm text-[var(--tr1-muted)]">30 minutes pour découvrir TR1 à partir de vos enjeux terrain.</p>
          </div>

          <div className="relative min-w-0 lg:-mr-5 xl:-mr-8">
            <LandingPilotageMap />
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--tr1-line)] bg-white/28 px-5 py-20 lg:px-8 lg:py-28" id="scenario">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">Du signal à la prochaine action</p>
            <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-.055em] sm:text-5xl lg:text-[3.7rem]">Une action terrain avance, étape par étape.</h2>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--tr1-muted)]">Une pharmacie à relancer → une animation planifiée → un bilan disponible. Explorez les trois étapes pour voir comment TR1 garde le fil.</p>
          </div>
          <div className="mt-12"><LandingActionScenario /></div>
          <div className="mt-10 text-center">
            <MarketingTrackedLink
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tr1-orange)] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(234,112,21,.18)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 motion-reduce:transition-none"
              event="primary_cta_click"
              href="#diagnostic"
              properties={{ placement: "after_scenario" }}
            >
              Demander une démo
              <ArrowRight className="size-4" />
            </MarketingTrackedLink>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8 lg:py-28" id="pourquoi-tr1">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">Pourquoi TR1</p>
            <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-.055em] sm:text-5xl lg:text-[3.7rem]">
              Sachez où agir, qui intervient et ce qui se passe ensuite.
            </h2>
          </div>
          <div className="mt-12 grid border-t border-[var(--tr1-line)] md:grid-cols-3">
            {valueBlocks.map((item, index) => (
              <article className={`border-b border-[var(--tr1-line)] py-7 md:px-7 md:py-9 ${index < 2 ? "md:border-r" : ""} ${index === 0 ? "md:pl-0" : ""} ${index === 2 ? "md:pr-0" : ""}`} key={item.title}>
                <span className="font-mono text-xs font-black text-[var(--tr1-orange)]">0{index + 1}</span>
                <h3 className="mt-6 text-2xl font-black tracking-[-.04em]">{item.title}</h3>
                <p className="mt-4 leading-7 text-[var(--tr1-muted)]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--tr1-line)] px-5 py-20 lg:px-8 lg:py-28" id="plateforme">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">La plateforme</p>
            <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-.055em] sm:text-5xl lg:text-[3.7rem]">
              Un suivi continu, de la visite commerciale à la formation de l’équipe officinale.
            </h2>
          </div>

          <div className="mt-16 space-y-20 lg:space-y-28">
            <article className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
              <div>
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">Commercial</p>
                <h3 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">Gardez le fil après chaque visite.</h3>
                <p className="mt-5 text-lg leading-8 text-[var(--tr1-muted)]">
                  Vos commerciaux retrouvent l’historique de la pharmacie, préparent leurs visites et renseignent leur retour depuis leur téléphone. Commandes, relances et prochaines actions restent rattachées au compte.
                </p>
                <div className="mt-7 space-y-3 text-sm font-semibold">
                  {["Historique pharmacie", "Préparation de visite", "Compte rendu mobile", "Commandes, relances et prochaine action"].map((text) => (
                    <p className="flex items-center gap-2" key={text}><CheckCircle2 className="size-4 text-[var(--tr1-orange)]" />{text}</p>
                  ))}
                </div>
              </div>
              <div className="relative min-w-0 rounded-[1.35rem] border border-[var(--tr1-line)] bg-white/35 p-3 shadow-[0_24px_70px_rgba(14,29,49,.09)] sm:p-5">
                <Image alt="Fiche pharmacie TR1 : historique commercial et prochaine action" className="w-full rounded-xl border border-[var(--tr1-line)]" height={600} src="/marketing/pharmacy-account.webp" width={716} />
                <div className="absolute -bottom-6 right-4 hidden w-[27%] min-w-[9rem] overflow-hidden rounded-t-[1rem] border border-b-0 border-[var(--tr1-line)] bg-white shadow-[0_18px_45px_rgba(14,29,49,.16)] sm:block">
                  <Image alt="Aperçu mobile TR1 pour le commercial terrain" className="w-full" height={600} src="/marketing/agent-day-mobile.webp" width={716} />
                </div>
              </div>
            </article>

            <article className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-14" id="animations-formations">
              <div className="order-2 min-w-0 rounded-[1.35rem] border border-[var(--tr1-line)] bg-[#fffdf8] p-3 shadow-[0_24px_70px_rgba(14,29,49,.09)] sm:p-5 lg:order-1">
                <Image alt="Planning TR1 des animations et missions terrain" className="w-full rounded-xl border border-[var(--tr1-line)]" height={600} src="/marketing/missions-board.webp" width={716} />
              </div>
              <div className="order-1 lg:order-2">
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">Animations</p>
                <h3 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">Pilotez chaque journée, du brief au bilan.</h3>
                <p className="mt-5 text-lg leading-8 text-[var(--tr1-muted)]">
                  Organisez vos animations avec vos intervenants, précisez les produits et les objectifs, puis centralisez les comptes rendus, les photos et les ventes déclarées. Retrouvez les coûts et le suivi de facturation associés à chaque journée.
                </p>
                <div className="mt-7 flex flex-wrap gap-2 font-mono text-[.67rem] font-black uppercase tracking-[.08em]">
                  {["Brief", "Planification", "Réalisation", "Compte rendu", "Bilan"].map((step, index) => (
                    <span className="rounded-full border border-[var(--tr1-line)] bg-white/55 px-3 py-2" key={step}>{index + 1}. {step}</span>
                  ))}
                </div>
              </div>
            </article>

            <article className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
              <div>
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">Formations</p>
                <h3 className="mt-3 text-3xl font-black tracking-[-.05em] sm:text-4xl">Sachez qui a été formé et ce qui a été retenu.</h3>
                <p className="mt-5 text-lg leading-8 text-[var(--tr1-muted)]">
                  Mettez vos modules à disposition des formateurs. Retrouvez, pour chaque pharmacie, les participants et les formations suivies. Des quiz courts et ludiques permettent d’évaluer les acquis et d’identifier les sujets à renforcer.
                </p>
                <div className="mt-7 space-y-3 text-sm font-semibold">
                  {["Catalogue de modules par marque, gamme ou produit", "Participants et formations par pharmacie", "Quiz avec réponse expliquée", "Synthèse des résultats et sujets à renforcer"].map((text) => (
                    <p className="flex items-start gap-2" key={text}><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--tr1-orange)]" />{text}</p>
                  ))}
                </div>
              </div>
              <LandingTrainingDemo />
            </article>
          </div>

          <div className="mt-16 text-center">
            <MarketingTrackedLink
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tr1-orange)] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(234,112,21,.18)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tr1-navy)] focus-visible:ring-offset-2 motion-reduce:transition-none"
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

      <section className="border-y border-[var(--tr1-line)] bg-white/28 px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="font-mono text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">Pilotage et mesure</p>
              <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-.055em] sm:text-5xl">Chaque intervention vous aide à préparer la suivante.</h2>
              <p className="mt-6 text-lg leading-8 text-[var(--tr1-muted)]">
                Retrouvez l’activité commerciale, les animations et les formations de chaque pharmacie. Appuyez-vous sur cet historique et les résultats disponibles pour décider des prochaines actions.
              </p>
            </div>
            <div className="overflow-hidden rounded-[1.35rem] border border-[var(--tr1-line)] bg-white/55 p-3 shadow-[0_24px_70px_rgba(14,29,49,.08)] sm:p-5">
              <Image alt="Vue Manager TR1 pour le pilotage du réseau" className="w-full rounded-xl border border-[var(--tr1-line)]" height={600} src="/marketing/manager-day.webp" width={716} />
            </div>
          </div>

          <div className="mt-12 grid border-t border-[var(--tr1-line)] lg:grid-cols-3">
            {interventionMetrics.map((group, index) => (
              <article className={`border-b border-[var(--tr1-line)] py-7 lg:px-7 ${index < 2 ? "lg:border-r" : ""} ${index === 0 ? "lg:pl-0" : ""} ${index === 2 ? "lg:pr-0" : ""}`} key={group.title}>
                <h3 className="text-xl font-black">{group.title}</h3>
                <div className="mt-5 space-y-3 text-sm leading-6 text-[var(--tr1-muted)]">
                  {group.lines.map((line) => <p key={line}>{line}</p>)}
                </div>
                {group.title === "Animations" ? <p className="mt-5 rounded-lg bg-[var(--tr1-ivory)] p-3 text-xs font-semibold text-[var(--tr1-muted)]">Exemple de suivi : <strong className="text-[var(--tr1-navy)]">En cours d’observation</strong> tant que la période de comparaison n’est pas terminée.</p> : null}
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-5 text-[var(--tr1-muted)]">
            Les comparaisons avant / après décrivent des résultats observés. Elles ne présentent pas automatiquement le chiffre d’affaires après intervention comme causé par l’action terrain.
          </p>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid overflow-hidden rounded-[1.5rem] bg-[var(--tr1-navy)] text-[var(--tr1-ivory)] lg:grid-cols-[.38fr_.62fr]">
            <div className="flex min-h-56 items-end bg-[radial-gradient(circle_at_35%_28%,rgba(234,112,21,.22),transparent_30%),linear-gradient(145deg,#173a5c,#0e1d31)] p-8 lg:min-h-full lg:p-10">
              <div>
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.18em] text-[var(--tr1-orange)]">Origine de TR1</p>
                <p className="mt-5 text-sm leading-6 text-white/55">Un produit construit à partir des contraintes réelles du terrain officinal.</p>
              </div>
            </div>
            <div className="p-8 sm:p-10 lg:p-12">
              <h2 className="text-3xl font-black tracking-[-.05em] sm:text-4xl">TR1 est né de mon quotidien de délégué pharmaceutique.</h2>
              <blockquote className="mt-7 space-y-5 text-lg leading-8 text-white/72">
                <p>« Je pouvais passer deux heures à préparer une tournée. Entre les visites, je prenais mes notes sur mon téléphone, puis je les recopiais dans mon CRM le soir… quand je le faisais.</p>
                <p>J’ai commencé à construire TR1 pour simplifier ce quotidien. Avec une conviction : les informations du terrain doivent servir autant à ceux qui interviennent qu’à ceux qui pilotent la marque. »</p>
              </blockquote>
              <div className="mt-8 border-t border-white/12 pt-6">
                <p className="font-black">Amir Ounissi</p>
                <p className="mt-1 text-sm text-white/55">Délégué pharmaceutique et fondateur de TR1 Pharma</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--tr1-line)] bg-white/28 px-5 py-20 lg:px-8 lg:py-28" id="diagnostic">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <p className="font-mono text-[.66rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">Découvrir TR1</p>
            <h2 className="mt-5 text-4xl font-black leading-[1] tracking-[-.055em] sm:text-5xl lg:text-[3.7rem]">Découvrez comment piloter votre terrain avec TR1.</h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-[var(--tr1-muted)]">
              En 30 minutes, parcourons votre organisation et les usages qui vous concernent : suivi commercial, animations, formations et mesure des résultats.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-2xl"><LeadForm /></div>
        </div>
      </section>
    </main>
  );
}
