import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { FieldReferences } from "@/components/marketing/field-references";
import { PharmacyIllustration } from "@/components/marketing/pharmacy-illustration";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import styles from "./landing-editorial.module.css";

const pageTitle = "TR1 PHARMA — Du sell-in au sell-out en pharmacie";
const pageDescription = "Développement commercial en pharmacie, du sell-in au sell-out : prospection, implantation, formation, merchandising et animations. TR1 PHARMA accompagne les marques en PACA, dans le Gard et l’Hérault.";
const publicUrl = "https://www.tr1pharma.com/";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: publicUrl },
  openGraph: {
    title: pageTitle, description: pageDescription, siteName: "TR1 PHARMA",
    url: publicUrl, locale: "fr_FR", type: "website",
  },
  twitter: { card: "summary", title: pageTitle, description: pageDescription },
};

const businessStructuredData = {
  "@context": "https://schema.org", "@type": "ProfessionalService",
  name: "TR1 PHARMA", url: publicUrl, description: pageDescription, inLanguage: "fr-FR",
  areaServed: [
    { "@type": "AdministrativeArea", name: "Provence-Alpes-Côte d’Azur" },
    { "@type": "AdministrativeArea", name: "Gard" },
    { "@type": "AdministrativeArea", name: "Hérault" },
  ],
  founder: { "@type": "Person", name: "Amir Ounissi" },
};

const services = [
  {
    number: "01", label: "SELL-IN", title: "Développer votre distribution.",
    description: "Identifier les officines adaptées à votre gamme, rencontrer les décideurs, accompagner les négociations commerciales et déployer les implantations pour développer votre présence en pharmacie.",
    tags: "Ciblage · Prospection · Ouverture de comptes · Implantation",
  },
  {
    number: "02", label: "SELL-OUT", title: "Activer les ventes en officine.",
    description: "Donner aux équipes officinales les moyens de valoriser vos produits grâce à la formation, au merchandising, aux mises en avant et à la coordination d’animations commerciales adaptées au terrain.",
    tags: "Formation · Merchandising · Animation · Activation commerciale",
  },
  {
    number: "03", label: "SUIVI COMMERCIAL", title: "Faire vivre les comptes dans la durée.",
    description: "Suivre les actions réalisées, recueillir les retours des pharmacies, identifier les opportunités, réactiver les comptes et accompagner les besoins de réassort.",
    tags: "Suivi · Remontées terrain · Réactivation · Réassort",
  },
];

export default function LandingPage() {
  return (
    <main id="contenu" className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessStructuredData).replace(/</g, "\\u003c") }} />
      <RecoveryHashRedirect />
      <MarketingPageEvent event="landing_view" />
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>DÉVELOPPEMENT COMMERCIAL EN PHARMACIE</p>
            <h1 id="hero-title">Du sell-in au sell-out, <span>développons votre marque en pharmacie.</span></h1>
            <p className={styles.heroIntro}>De la prospection à l’activation des ventes en officine, TR1 PHARMA accompagne les marques de santé, de beauté et de bien-être dans leur développement commercial.</p>
            <div className={styles.heroActions}>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Parlons de votre marque <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink>
              <a className={styles.secondaryCta} href="#pharmacies">Je suis pharmacien <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroTerritory}>PACA · Gard · Hérault</p>
            <p className={styles.heroNote}>Un accompagnement terrain, de la distribution à la vente au comptoir.</p>
          </div>
          <figure className={styles.heroVisual}>
            <PharmacyIllustration />
            <figcaption>Une présence au plus près des officines.</figcaption>
          </figure>
        </div>
      </section>
      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>Du sell-in au sell-out</p><h2 id="missions-title">Implanter votre marque. <span>Activer ses ventes.</span></h2></div>
            <p>Le développement ne s’arrête pas au référencement. TR1 PHARMA associe développement de la distribution, activation des équipes et suivi commercial pour accompagner les marques de l’implantation à la vente au comptoir.</p>
          </div>
          <div id="methode" className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.service} key={service.number}>
                <p className={styles.serviceStep}><span>{service.number}</span> {service.label}</p>
                <h3>{service.title}</h3>
                <p className={styles.serviceDescription}>{service.description}</p>
                <p className={styles.serviceTags}>{service.tags}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <FieldReferences items={[]} />
      <section id="terrain" className={styles.followUp} aria-labelledby="terrain-title">
        <div className={`${styles.container} ${styles.followUpGrid}`}>
          <div>
            <p className={styles.eyebrow}>Le suivi commercial</p>
            <h2 id="terrain-title">Une vision claire des actions <span>sur votre secteur.</span></h2>
            <p className={styles.bodyCopy}>Des échanges réguliers pour savoir ce qui a été réalisé, comprendre les retours des pharmacies et définir les prochaines actions.</p>
          </div>
          <figure className={styles.methodFigure}>
            <div className={styles.methodHeading}>Du terrain aux prochaines actions.</div>
            <ol className={styles.methodSteps}>
              <li><span aria-hidden="true">01</span><div><strong>Actions réalisées</strong><p>Visites, implantations et accompagnement des équipes</p></div></li>
              <li><span aria-hidden="true">02</span><div><strong>Retours du terrain</strong><p>Besoins, objections et opportunités identifiées</p></div></li>
              <li><span aria-hidden="true">03</span><div><strong>Prochaines actions</strong><p>Relances, formations, animations et réassorts à préparer</p></div></li>
            </ol>
          </figure>
        </div>
      </section>
      <section id="amir" className={styles.founder} aria-labelledby="founder-title">
        <div className={`${styles.container} ${styles.founderGrid}`}>
          <div><p className={styles.eyebrow}>Une relation directe</p><h2 id="founder-title">Amir Ounissi,<br/><span>votre interlocuteur terrain.</span></h2></div>
          <div>
            <p className={styles.founderRole}>Fondateur de TR1 PHARMA</p>
            <p className={styles.bodyCopy}>J’accompagne les marques dans leur développement commercial en pharmacie, du sell-in au sell-out. Prospection, implantation, formation des équipes, visibilité en officine et animations commerciales : mon objectif est de faire le lien entre la présence de la marque sur le terrain et l’activation de ses ventes.</p>
            <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noopener noreferrer" className={styles.textCta}>Découvrir mon parcours <ArrowUpRight size={18} aria-hidden="true"/></a>
          </div>
        </div>
      </section>
      <section id="pharmacies" className={styles.pharmacies} aria-labelledby="pharmacy-title">
        <div className={`${styles.container} ${styles.pharmacyGrid}`}>
          <div><p className={styles.eyebrow}>Vous êtes pharmacien ?</p><h2 id="pharmacy-title">Des gammes pour votre officine.<br/><span>Un interlocuteur à vos côtés.</span></h2></div>
          <div><p className={styles.bodyCopy}>Découvrez les marques que nous représentons et échangeons sur leur place dans votre officine : présentation des produits, formation de l’équipe, visibilité et suivi des réassorts.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_section" }} className={styles.pharmacyCta}>Échanger pour mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div>
        </div>
      </section>
      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactIntro}><p className={styles.eyebrow}>Faisons le point</p><h2 id="contact-title">Parlons de vos besoins <span>en pharmacie.</span></h2></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}>
              <p className={styles.contactAudience}>Marque & laboratoire</p><h3>Développons votre marque.</h3>
              <p className={styles.cardDescription}>Un premier échange pour faire le point sur votre gamme, votre territoire et vos objectifs en pharmacie.</p>
              <LeadForm audience="brand" />
            </article>
            <article id="contact-pharmacie" className={styles.contactCard}>
              <p className={styles.contactAudience}>Pharmacie</p><h3>Parlons de votre officine.</h3>
              <p className={styles.cardDescription}>Présentez-nous votre officine et les besoins de votre équipe.</p>
              <LeadForm audience="pharmacy" />
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
