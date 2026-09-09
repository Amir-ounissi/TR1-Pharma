import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";

const problems = [
  {
    number: "01",
    title: "Vos données commerciales sont dispersées.",
    text: "Pharmacies, commandes, contacts, visites et prochaines actions restent souvent répartis entre plusieurs outils.",
  },
  {
    number: "02",
    title: "Les priorités terrain sont difficiles à partager.",
    text: "Le management et le terrain ne travaillent pas toujours à partir de la même lecture du réseau.",
  },
  {
    number: "03",
    title: "Un compte ouvert ne doit pas disparaître du radar.",
    text: "La première commande n’est qu’une étape : réassort, animation, formation et suivi doivent ensuite prendre le relais.",
  },
];

const missionSteps = [
  ["01", "Recruter", "Mobilisez un animateur ou un formateur adapté à la mission, au secteur et aux besoins de la marque."],
  ["02", "Planifier", "Définissez la pharmacie, la date, l’intervenant, le type de mission et son objectif."],
  ["03", "Suivre", "Suivez les missions planifiées, affectées, réalisées et celles qui attendent encore leur compte rendu."],
  ["04", "Mesurer", "Analysez l’impact observé après la mission et rapprochez le résultat du coût engagé."],
] as const;

export default function LandingPage() {
  return (
    <main className="bg-[var(--tr1-ivory)] text-[var(--tr1-navy)]">
      <MarketingPageEvent event="landing_view" />

      <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.85),transparent_65%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <p className="font-mono text-[.68rem] font-black uppercase tracking-[.22em] text-[var(--tr1-orange)]">
              Exécution commerciale terrain
            </p>

            <h1 className="mx-auto mt-6 max-w-5xl text-[3.25rem] font-black leading-[.94] tracking-[-.07em] text-[var(--tr1-navy)] sm:text-6xl lg:text-[5.4rem]">
              Pilotez votre développement en pharmacie.
            </h1>

            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-[var(--tr1-muted)] sm:text-xl sm:leading-9">
              De l’ouverture d’un compte au réassort, TR1 réunit le management et le terrain dans un même système.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <MarketingTrackedLink
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--tr1-orange)] px-5 text-sm font-black text-white shadow-[0_10px_28px_rgba(234,112,21,.18)] transition hover:-translate-y-0.5 hover:brightness-95"
                event="primary_cta_click"
                href="#diagnostic"
              >
                Demander une démo
                <ArrowRight className="size-4" />
              </MarketingTrackedLink>

              <a
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--tr1-line-strong)] bg-white/35 px-5 text-sm font-black transition hover:bg-white/65"
                href="#produit"
              >
                Voir la plateforme
              </a>
            </div>

            <p className="mt-4 text-sm text-[var(--tr1-muted)]">
              Diagnostic et démonstration personnalisée de 30 minutes.
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-6xl sm:mt-16 lg:mt-20">
            <div className="absolute inset-x-[8%] bottom-[-5%] h-28 rounded-full bg-[var(--tr1-orange)]/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.4rem] border border-[var(--tr1-line)] bg-[var(--tr1-ivory-deep)] p-2 shadow-[0_30px_90px_rgba(14,29,49,.12)] sm:p-4">
              <Image
                alt="Dashboard TR1 Manager présentant objectifs, priorités et actions commerciales"
                className="w-full rounded-xl"
                height={600}
                priority
                src="/marketing/manager-day.webp"
                width={716}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--tr1-line)] bg-white/28 px-5 py-24 lg:px-8 lg:py-32" id="pourquoi">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.67rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">
              Pourquoi TR1
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-5xl lg:text-6xl">
              Votre réseau grandit. Votre organisation doit pouvoir suivre.
            </h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--tr1-muted)]">
              Développer une marque en pharmacie demande de faire deux choses en même temps : ouvrir de nouveaux comptes et continuer à faire progresser ceux qui existent déjà.
            </p>
          </div>

          <div className="mt-14 border-t border-[var(--tr1-line)]">
            {problems.map((problem) => (
              <article
                className="grid gap-4 border-b border-[var(--tr1-line)] py-8 sm:grid-cols-[5rem_1fr] lg:grid-cols-[8rem_.9fr_1.1fr] lg:items-start lg:py-10"
                key={problem.number}
              >
                <span className="font-mono text-sm font-black text-[var(--tr1-orange)]">{problem.number}</span>
                <h3 className="text-2xl font-black leading-tight tracking-[-.035em]">
                  {problem.title}
                </h3>
                <p className="max-w-xl text-base leading-7 text-[var(--tr1-muted)] sm:col-start-2 lg:col-start-auto">
                  {problem.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 lg:px-8 lg:py-32" id="produit">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.67rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">
              La plateforme
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-5xl lg:text-6xl">
              Un seul environnement pour savoir où agir.
            </h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--tr1-muted)]">
              TR1 transforme les données du réseau en décisions concrètes pour le management et le terrain.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-12">
            <article className="overflow-hidden rounded-[1.35rem] border border-[var(--tr1-line)] bg-white/35 lg:col-span-7">
              <div className="p-7 sm:p-9">
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">
                  Pilotage
                </p>
                <h3 className="mt-3 text-3xl font-black tracking-[-.05em]">
                  Savoir où agir aujourd’hui.
                </h3>
                <p className="mt-4 max-w-xl leading-7 text-[var(--tr1-muted)]">
                  Les comptes prioritaires, les alertes et les objectifs remontent dans une même vue.
                </p>
              </div>
              <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                <Image alt="Pilotage Manager TR1" className="w-full rounded-xl border border-[var(--tr1-line)]" height={600} src="/marketing/manager-day.webp" width={716} />
              </div>
            </article>

            <article className="overflow-hidden rounded-[1.35rem] border border-[var(--tr1-line)] bg-[#fffdf8] lg:col-span-5">
              <div className="p-7 sm:p-9">
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">
                  Compte pharmacie
                </p>
                <h3 className="mt-3 text-3xl font-black tracking-[-.05em]">
                  Comprendre chaque pharmacie.
                </h3>
                <p className="mt-4 leading-7 text-[var(--tr1-muted)]">
                  Commandes, activité, assortiment, historique et prochaine action restent rattachés au compte.
                </p>
              </div>
              <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                <Image alt="Fiche pharmacie TR1" className="w-full rounded-xl border border-[var(--tr1-line)]" height={600} src="/marketing/pharmacy-account.webp" width={716} />
              </div>
            </article>

            <article className="grid overflow-hidden rounded-[1.35rem] bg-[var(--tr1-navy)] text-[var(--tr1-ivory)] lg:col-span-12 lg:grid-cols-[.9fr_1.1fr]">
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">
                  Expérience terrain
                </p>
                <h3 className="mt-4 text-3xl font-black tracking-[-.05em] sm:text-4xl">
                  Donner au terrain la prochaine bonne action.
                </h3>
                <p className="mt-5 max-w-xl leading-7 text-white/65">
                  La prochaine visite est préparée avec la pharmacie, le contexte, l’objectif et les informations utiles.
                </p>
                <div className="mt-8 space-y-3 border-t border-white/12 pt-6 font-semibold">
                  <p>Où vais-je ?</p>
                  <p>Pourquoi cette pharmacie ?</p>
                  <p>Que dois-je faire sur place ?</p>
                </div>
              </div>
              <div className="flex items-end justify-center px-6 pt-8 lg:px-10">
                <Image alt="Expérience mobile Agent TR1" className="w-full max-w-[25rem] rounded-t-[1.4rem] border border-b-0 border-white/12" height={600} src="/marketing/agent-day-mobile.webp" width={716} />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--tr1-line)] bg-white/28 px-5 py-24 lg:px-8 lg:py-32" id="animations">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-[.67rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">
              Animation commerciale
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-5xl lg:text-6xl">
              Recrutez, planifiez et mesurez vos animations.
            </h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--tr1-muted)]">
              De la sélection de l’intervenant à l’analyse des résultats, TR1 permet de coordonner les animations et formations autour de chaque pharmacie.
            </p>
          </div>

          <div className="mt-14 grid border-t border-[var(--tr1-line)] lg:grid-cols-4">
            {missionSteps.map(([number, title, text], index) => (
              <article className={`border-b border-[var(--tr1-line)] py-8 lg:px-7 ${index < 3 ? "lg:border-r" : ""} ${index === 0 ? "lg:pl-0" : ""} ${index === 3 ? "lg:pr-0" : ""}`} key={number}>
                <span className="font-mono text-xs font-black text-[var(--tr1-orange)]">{number}</span>
                <h3 className="mt-7 text-2xl font-black tracking-[-.04em]">{title}</h3>
                <p className="mt-4 leading-7 text-[var(--tr1-muted)]">{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <div className="overflow-hidden rounded-[1.35rem] border border-[var(--tr1-line)] bg-[#fffdf8] p-3 shadow-[0_24px_70px_rgba(14,29,49,.09)] sm:p-5">
              <div className="mb-5 px-2 pt-2">
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">Exécution</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-.04em]">Toutes les missions dans un même planning.</h3>
              </div>
              <Image alt="Planning TR1 des animations, formations et missions terrain" className="w-full rounded-xl border border-[var(--tr1-line)]" height={600} src="/marketing/missions-board.webp" width={716} />
            </div>

            <div className="flex flex-col justify-between rounded-[1.35rem] bg-[var(--tr1-navy)] p-7 text-[var(--tr1-ivory)] sm:p-9">
              <div>
                <p className="font-mono text-[.62rem] font-black uppercase tracking-[.17em] text-[var(--tr1-orange)]">Performance & rentabilité</p>
                <h3 className="mt-4 text-3xl font-black leading-[1.04] tracking-[-.05em]">
                  Une animation ne devrait pas seulement être réalisée. Elle devrait être mesurée.
                </h3>
                <p className="mt-5 leading-7 text-white/65">
                  TR1 rapproche l’exécution terrain des données disponibles après la mission pour aider à comprendre ce qui produit réellement du résultat.
                </p>
              </div>
              <div className="mt-10 divide-y divide-white/12 border-y border-white/12">
                {[['Coût de la mission', 'Suivi'], ['Sell-out déclaré', 'Impact'], ['CA après mission', 'Performance'], ['Résultat / coût engagé', 'Rentabilité']].map(([label, value]) => (
                  <div className="flex items-center justify-between gap-4 py-4" key={label}>
                    <span className="text-sm text-white/60">{label}</span><strong className="text-sm">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 border-t border-[var(--tr1-line)] pt-8 text-center">
            <p className="text-2xl font-black tracking-[-.04em] sm:text-3xl">
              Le sell-in ouvre le compte. L’activation terrain aide à le développer.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 lg:px-8 lg:py-36" id="diagnostic">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <p className="font-mono text-[.67rem] font-black uppercase tracking-[.2em] text-[var(--tr1-orange)]">Découvrir TR1</p>
            <h2 className="mt-5 text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-5xl lg:text-6xl">Faites grandir votre réseau officinal.</h2>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[var(--tr1-muted)]">
              Découvrez comment TR1 peut structurer votre développement commercial et terrain.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl items-start gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div className="pt-3">
              <p className="text-xl font-black tracking-[-.03em]">En 30 minutes, faisons le point sur votre réseau.</p>
              <div className="mt-7 space-y-4 border-t border-[var(--tr1-line)] pt-6 text-[var(--tr1-muted)]">
                <p>Votre portefeuille officinal</p>
                <p>Votre organisation terrain</p>
                <p>Vos outils actuels</p>
                <p>Les points où TR1 peut simplifier le pilotage</p>
              </div>
            </div>
            <div><LeadForm /></div>
          </div>
        </div>
      </section>
    </main>
  );
}
