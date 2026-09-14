import type { Metadata } from "next";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, Clock3, GraduationCap, MoveUpRight } from "lucide-react";
import { LandingPilotageMap } from "@/components/marketing/landing-pilotage-map";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { demoPharmacyById } from "@/lib/marketing/demo-network";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "TR1 Pharma | Du sell-in au sell-out en pharmacie",
  description:
    "Pilotez visites commerciales, animations, formations et prochaines actions dans votre réseau officinal avec TR1 Pharma.",
};

const useCases = [
  {
    number: "01", label: "Commercial", icon: BriefcaseBusiness,
    title: "Développez vos comptes.",
    description: "Le bon contexte avant la visite. Une commande, un compte rendu et une prochaine action directement depuis le terrain.",
    features: ["Visites et portefeuille pharmacies", "Commandes et réassorts", "Compte rendu mobile"],
    outcome: "Chaque visite prépare la suivante.",
  },
  {
    number: "02", label: "Animations", icon: CalendarDays,
    title: "Activez vos points de vente.",
    description: "Un brief clair pour l’intervenant. Un planning partagé pour la marque. Les preuves et le bilan réunis après chaque animation.",
    features: ["Intervenants, briefs et planning", "Photos et ventes déclarées", "Coûts et suivi de facturation"],
    outcome: "Chaque animation reste suivie.",
  },
  {
    number: "03", label: "Formations", icon: GraduationCap,
    title: "Accompagnez le conseil.",
    description: "Des modules pour les équipes officinales. Le suivi des participants et les résultats des quiz pour savoir ce qui a été retenu.",
    features: ["Modules par gamme ou produit", "Formations et participants", "Quiz, scores et progression"],
    outcome: "Chaque formation laisse une trace utile.",
  },
] as const;

const priorities = [
  { pharmacy: demoPharmacyById.get("arcades-lille")!, mode: "commercial", label: "Commercial" },
  { pharmacy: demoPharmacyById.get("republique-paris")!, mode: "animations", label: "Animation" },
  { pharmacy: demoPharmacyById.get("prado-marseille")!, mode: "formations", label: "Formation" },
] as const;

export default function LandingPage() {
  return (
    <main className="bg-transparent text-[#0b1e32]">
      <MarketingPageEvent event="landing_view" />

      <section className="px-5 py-12 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center rounded-full border border-[#0b1e32]/10 bg-white/80 px-3 py-2 font-mono text-[.62rem] font-black uppercase tracking-[.14em] text-[#c84f24] shadow-[0_8px_24px_rgba(7,20,33,.04)]">
              Cockpit d’exécution commerciale terrain
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-[2.8rem] font-black leading-[.95] tracking-[-.065em] text-[#0b1e32] sm:text-[4.4rem] lg:text-[5rem]">
              <span className="text-[#c84f24]">Du sell-in au sell-out,</span>{" "}
              pilotez chaque action qui fait vendre en pharmacie.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-[#667384] sm:text-lg">
              TR1 réunit visites commerciales, commandes, animations, formations et suivi du réseau dans un même cockpit terrain. Vos équipes savent où agir. Vous savez ce qui a été fait et ce qui doit suivre.
            </p>
            <div className="mt-8">
              <MarketingTrackedLink
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c84f24] px-5 font-mono text-[.68rem] font-black uppercase tracking-[.06em] text-white shadow-[0_14px_30px_rgba(200,79,36,.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b64620] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1e32] focus-visible:ring-offset-2 motion-reduce:transition-none"
                event="primary_cta_click"
                href="#diagnostic"
                properties={{ placement: "hero" }}
              >
                Demander une démo
                <ArrowRight className="size-4" />
              </MarketingTrackedLink>
            </div>
            <p className="mt-4 font-mono text-[.62rem] font-bold uppercase tracking-[.10em] text-[#667384]">
              30 minutes · Votre organisation terrain · Vos cas d’usage
            </p>
          </div>

          <div className="mx-auto mt-11 max-w-6xl rounded-[1.6rem] border border-[#0b1e32]/10 bg-white/72 p-2 shadow-[0_24px_70px_rgba(7,20,33,.10)] sm:mt-14 sm:p-3">
            <LandingPilotageMap />
          </div>
        </div>
      </section>

      <section className={styles.platform} id="plateforme" aria-labelledby="platform-title">
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>La plateforme</p>
              <h2 id="platform-title" className={styles.heading}>Trois métiers.<br />Un même suivi.</h2>
            </div>
            <p className={styles.intro}>Du premier contact au réassort, vos équipes travaillent autour de la même pharmacie. Vous gardez une lecture commune de votre réseau.</p>
          </div>

          <div className={styles.useCases}>
            {useCases.map(({ number, label, icon: Icon, title, description, features, outcome }, index) => (
              <article className={styles.useCase} key={label} id={index === 1 ? "animations-formations" : undefined}>
                <div className={styles.useCaseTop}>
                  <span className={styles.role}><Icon size={18} strokeWidth={1.6} aria-hidden="true" />{label}</span>
                  <span className={styles.number} aria-hidden="true">{number}</span>
                </div>
                <h3>{title}</h3>
                <p className={styles.description}>{description}</p>
                <ul className={styles.features}>
                  {features.map((feature) => <li key={feature}><Check size={15} strokeWidth={1.8} aria-hidden="true" />{feature}</li>)}
                </ul>
                <p className={styles.outcome}>{outcome}</p>
              </article>
            ))}
          </div>
          <div className={styles.platformFoot}>
            <p>Visites, commandes, animations et formations. <strong>Tout reste lié au compte pharmacie.</strong></p>
            <DemoLink placement="after_use_cases" className={styles.textLink} />
          </div>
        </div>
      </section>

      <section className={styles.brand} aria-labelledby="brand-title">
        <div className={`${styles.container} ${styles.brandGrid}`}>
          <div className={styles.brandCopy}>
            <p className={styles.eyebrow}>Côté marque</p>
            <h2 id="brand-title" className={styles.heading}>Le terrain avance.<br />Vous savez où agir.</h2>
            <p>Pharmacies à relancer, interventions à suivre, résultats à consulter : retrouvez les priorités sans reconstituer l’histoire du réseau.</p>
            <ul className={styles.brandBenefits}>
              <li><Check size={16} aria-hidden="true" />Coordonnez vos équipes et prestataires.</li>
              <li><Check size={16} aria-hidden="true" />Suivez la réalisation et les résultats disponibles.</li>
              <li><Check size={16} aria-hidden="true" />Décidez de la prochaine action.</li>
            </ul>
          </div>

          <div className={styles.networkPreview} aria-label="Exemple de priorités pour la marque">
            <div className={styles.previewHead}>
              <span>Votre réseau · les prochaines actions</span>
              <span className={styles.demoLabel}>Démonstration</span>
            </div>
            <div className={styles.priorities}>
              {priorities.map(({ pharmacy, mode, label }) => (
                <div className={styles.priority} key={pharmacy.id}>
                  <div className={styles.priorityLabel}><span>{label}</span><span>{pharmacy.city}</span></div>
                  <p className={styles.pharmacyName}>{pharmacy.name}</p>
                  <p className={styles.signal}>{pharmacy[mode].status}</p>
                  <div className={styles.nextAction}><span>{pharmacy[mode].nextAction}</span><MoveUpRight size={15} aria-hidden="true" /></div>
                </div>
              ))}
            </div>
            <p className={styles.previewFoot}>Une pharmacie. Son historique. La suite à donner.</p>
          </div>
        </div>
      </section>

      <section className={styles.founder} id="pourquoi-tr1" aria-labelledby="founder-title">
        <div className={`${styles.container} ${styles.founderGrid}`}>
          <div>
            <p className={styles.eyebrow}>Pourquoi TR1</p>
            <h2 id="founder-title" className={styles.heading}>Né sur le terrain.</h2>
            <p className={styles.founderContext}>L’expérience d’un délégué pharmaceutique, à l’origine du produit.</p>
          </div>
          <div className={styles.founderStory}>
            <blockquote>« Je voulais juste un outil qui colle davantage à ma réalité de délégué : préparer ma tournée plus rapidement, retrouver les bonnes infos avant d’entrer dans une pharmacie et faire mon retour directement sur mon téléphone en sortant. »</blockquote>
            <p className={styles.signature}><strong>Amir Ounissi</strong><span>Délégué pharmaceutique · Fondateur de TR1 Pharma</span></p>
          </div>
        </div>
      </section>

      <section className={styles.contact} id="diagnostic" aria-labelledby="contact-title">
        <div className={`${styles.container} ${styles.contactGrid}`}>
          <div className={styles.contactCopy}>
            <p className={styles.eyebrow}>Démonstration personnalisée</p>
            <h2 id="contact-title" className={styles.heading}>Votre réseau.<br />Vos équipes.<br /><span>Voyons ça ensemble.</span></h2>
            <p>Partons de votre organisation pour vous montrer comment TR1 relie le pilotage de la marque aux actions du terrain.</p>
            <div className={styles.duration}><Clock3 size={18} aria-hidden="true" /><span>30 minutes · Un échange autour de vos usages</span></div>
          </div>
          <div className={styles.formPanel}><LeadForm /></div>
        </div>
      </section>
    </main>
  );
}

function DemoLink({ placement, className }: { placement: string; className: string }) {
  return (
    <MarketingTrackedLink className={className} event="primary_cta_click" href="#diagnostic" properties={{ placement }}>
      Demander une démo<ArrowRight size={16} aria-hidden="true" />
    </MarketingTrackedLink>
  );
}
