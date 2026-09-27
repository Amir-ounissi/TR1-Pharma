import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
  Store,
  Users,
} from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import { LandingNeeds } from "./landing-needs";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "TR1 Pharma | Développement commercial terrain en pharmacie",
  description:
    "TR1 Pharma accompagne les marques en pharmacie, du sell-in au sell-out : prospection, implantation, activation, formation, animation et suivi terrain.",
};

const fieldJourney = [
  {
    number: "01",
    title: "Cibler",
    copy: "Choisir les officines cohérentes avec la marque, sa catégorie et la zone à développer.",
  },
  {
    number: "02",
    title: "Rencontrer",
    copy: "Présenter la gamme aux bons interlocuteurs et comprendre le contexte réel de l'officine.",
  },
  {
    number: "03",
    title: "Implanter",
    copy: "Construire l'assortiment, accompagner la première commande et poser les bases du lancement.",
  },
  {
    number: "04",
    title: "Activer",
    copy: "Former, animer et travailler la visibilité quand le dispositif de la marque le prévoit.",
  },
  {
    number: "05",
    title: "Revenir",
    copy: "Suivre les commandes, les réassorts, les retours équipe et la prochaine action utile.",
  },
] as const;

const pharmacyBenefits = [
  ["Un interlocuteur terrain", "La même logique de suivi avant, pendant et après l'implantation.", Users],
  ["Des marques ciblées", "Des propositions adaptées au profil de l'officine, pas un catalogue généraliste.", Store],
  ["Une activation concrète", "Formation, animation ou merchandising lorsque le plan de la marque le prévoit.", GraduationCap],
] as const;

export default function LandingPage() {
  return (
    <main className="bg-transparent text-[#0b1e32]">
      <RecoveryHashRedirect />
      <MarketingPageEvent event="landing_view" />

      <section className={styles.hero}>
        <div className={[styles.container, styles.heroGrid].join(" ")}>
          <div className={styles.heroCopy}>
            <div className={styles.heroBadge}>
              <MapPin size={14} /> PACA · Gard · Hérault
            </div>
            <h1>
              Votre prochain point de vente commence <span>sur le terrain.</span>
            </h1>
            <p className={styles.heroPromise}>Du sell-in au sell-out.</p>
            <p className={styles.heroIntro}>
              TR1 PHARMA développe votre présence en pharmacie : prospection, implantation, activation et suivi. Une approche
              terrain, officine par officine.
            </p>
            <div className={styles.heroChoices}>
              <MarketingTrackedLink
                event="primary_cta_click"
                href="#contact-marque"
                properties={{ placement: "hero_brand" }}
                className={styles.primaryCta}
              >
                Parlons de votre marque <ArrowRight size={17} />
              </MarketingTrackedLink>
              <MarketingTrackedLink
                event="primary_cta_click"
                href="#pharmacies"
                properties={{ placement: "hero_pharmacy" }}
                className={styles.secondaryCta}
              >
                Je suis pharmacien <ArrowRight size={17} />
              </MarketingTrackedLink>
            </div>
            <div className={styles.heroSignals} aria-label="Expertises terrain">
              <span>Prospection</span>
              <span>Implantation</span>
              <span>Activation</span>
              <span>Suivi</span>
            </div>
          </div>

          <aside className={styles.territoryPanel} aria-label="Territoire couvert par TR1 Pharma">
            <div className={styles.territoryTopline}>
              <div>
                <span className={styles.panelKicker}>Territoire TR1</span>
                <strong>Le développement se joue en mouvement.</strong>
              </div>
              <Route size={24} />
            </div>
            <div className={styles.routeMap} aria-hidden="true">
              <span className={styles.routeLine} />
              <div className={[styles.routeStop, styles.routeStopOne].join(" ")}>
                <i />
                <b>PACA</b>
                <small>Prospecter</small>
              </div>
              <div className={[styles.routeStop, styles.routeStopTwo].join(" ")}>
                <i />
                <b>Gard</b>
                <small>Implanter</small>
              </div>
              <div className={[styles.routeStop, styles.routeStopThree].join(" ")}>
                <i />
                <b>Hérault</b>
                <small>Suivre</small>
              </div>
            </div>
            <p>
              Une zone claire, des visites préparées et une continuité entre la première présentation et les actions qui suivent.
            </p>
          </aside>
        </div>
      </section>

      <section className={styles.journeySection} id="marques">
        <div className={styles.container}>
          <div className={styles.journeyHeading}>
            <div>
              <p className={styles.eyebrow}>Le parcours terrain</p>
              <h2>Une marque se développe visite après visite.</h2>
            </div>
            <p>
              TR1 PHARMA ne s'arrête pas à la première commande. Le travail continue avec l'équipe officinale, les réassorts et les
              prochaines actions utiles.
            </p>
          </div>

          <div className={styles.journeyRail}>
            {fieldJourney.map((step) => (
              <article key={step.number} className={styles.journeyStep}>
                <span className={styles.stepNumber}>{step.number}</span>
                <span className={styles.stepDot} />
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.reportSection}>
        <div className={[styles.container, styles.reportGrid].join(" ")}>
          <div className={styles.reportCopy}>
            <p className={styles.eyebrow}>Après une visite</p>
            <h2>Vous savez ce qui s'est passé. Et ce qui vient ensuite.</h2>
            <p>
              La plateforme TR1 soutient l'exécution terrain : préparation, compte rendu, commandes, actions menées et prochaine
              étape au même endroit.
            </p>
            <Link href="/connexion" className={styles.textLink}>
              Accès plateforme <ArrowRight size={15} />
            </Link>
          </div>

          <div className={styles.visitCard}>
            <div className={styles.visitCardHeader}>
              <div>
                <span>Compte rendu terrain</span>
                <strong>Officine exemple</strong>
              </div>
              <span className={styles.demoBadge}>Démonstration</span>
            </div>
            <div className={styles.visitMeta}>
              <span>
                <MapPin size={14} /> Secteur Sud
              </span>
              <span>
                <ClipboardCheck size={14} /> Visite clôturée
              </span>
            </div>
            <div className={styles.visitRows}>
              <div>
                <span>Objectif</span>
                <strong>Présentation de gamme</strong>
              </div>
              <div>
                <span>Action réalisée</span>
                <strong>Formation équipe + implantation</strong>
              </div>
              <div>
                <span>Retour terrain</span>
                <strong>Intérêt confirmé sur les références prioritaires</strong>
              </div>
              <div>
                <span>Prochaine étape</span>
                <strong>Suivi du réassort et activation</strong>
              </div>
            </div>
            <small>Exemple fictif destiné à illustrer le type de suivi disponible.</small>
          </div>
        </div>
      </section>

      <LandingNeeds />

      <section className={styles.pharmacySection} id="pharmacies">
        <div className={[styles.container, styles.pharmacyGrid].join(" ")}>
          <div className={styles.pharmacyIntro}>
            <p className={styles.eyebrow}>Pour les pharmacies</p>
            <h2>Une gamme ne doit pas juste arriver. Elle doit être accompagnée.</h2>
            <p>
              Nous présentons des marques cohérentes avec votre officine et restons identifiés pour la suite : implantation,
              formation, animation ou suivi selon le dispositif prévu.
            </p>
            <MarketingTrackedLink
              event="primary_cta_click"
              href="#contact-pharmacie"
              properties={{ placement: "pharmacy_section" }}
              className={styles.pharmacyCta}
            >
              Échanger avec TR1 <ArrowRight size={16} />
            </MarketingTrackedLink>
          </div>

          <div className={styles.pharmacyBenefits}>
            {pharmacyBenefits.map(([title, copy, Icon]) => (
              <div key={title}>
                <Icon size={20} />
                <p>
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.founderSection} id="terrain">
        <div className={[styles.container, styles.founderGrid].join(" ")}>
          <div>
            <p className={styles.eyebrow}>Le terrain avant le discours</p>
            <h2>TR1 PHARMA est construit depuis le quotidien officinal.</h2>
          </div>
          <div className={styles.founderCopy}>
            <p>
              Le projet est porté par Amir Ounissi, commercial terrain en pharmacie. Implantations, merchandising, formations,
              animations et réflexions métier sont documentés publiquement sur LinkedIn.
            </p>
            <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noreferrer" className={styles.textLink}>
              Voir le travail terrain <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section className={styles.contactSection} id="contact">
        <div className={styles.container}>
          <div className={styles.contactHeading}>
            <p className={styles.eyebrow}>Prendre contact</p>
            <h2>Parlons de votre développement.</h2>
            <p>Dites-nous où en est votre marque aujourd'hui et ce que vous voulez construire sur le terrain.</p>
          </div>

          <div className={styles.contactLayout}>
            <article id="contact-marque" className={styles.brandContactCard}>
              <div className={styles.contactLead}>
                <span className={styles.contactTag}>Marque / laboratoire</span>
                <h3>Développer une zone, lancer une gamme ou remettre du mouvement sur le terrain.</h3>
                <p>Présentez votre marque et votre besoin. Nous revenons vers vous pour parler du contexte, du territoire et des prochaines étapes.</p>
                <div className={styles.contactChecks}>
                  <span>
                    <CheckCircle2 size={15} /> Besoin terrain
                  </span>
                  <span>
                    <PackageCheck size={15} /> Gamme / lancement
                  </span>
                  <span>
                    <RefreshCw size={15} /> Suivi / réassort
                  </span>
                </div>
              </div>
              <LeadForm audience="brand" />
            </article>

            <article id="contact-pharmacie" className={styles.pharmacyContactCard}>
              <span className={styles.contactTag}>Pharmacie</span>
              <h3>Vous souhaitez découvrir les marques accompagnées ?</h3>
              <p>Laissez vos coordonnées et le nom de votre officine. Nous vous recontactons directement.</p>
              <LeadForm audience="pharmacy" />
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
