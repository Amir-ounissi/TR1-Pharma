import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { FieldReferences } from "@/components/marketing/field-references";
import { PharmacyIllustration } from "@/components/marketing/pharmacy-illustration";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import styles from "./landing-editorial.module.css";

const pageTitle = "TR1 PHARMA — Développement commercial en pharmacie";
const pageDescription = "Prospection, implantation, formation et suivi commercial en pharmacie. TR1 PHARMA accompagne les marques et laboratoires en PACA, dans le Gard et l’Hérault.";
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
    number: "01", label: "Déployer", title: "Ouvrir les bons comptes.",
    description: "Cibler les officines adaptées à votre gamme, rencontrer les décideurs et accompagner les premières commandes.",
    tags: "Ciblage · Prospection · Implantation",
  },
  {
    number: "02", label: "Activer", title: "Donner aux équipes les moyens de vendre.",
    description: "Former les équipes, travailler la visibilité en rayon et coordonner les actions d’animation adaptées à la pharmacie.",
    tags: "Formation · Merchandising · Animation",
  },
  {
    number: "03", label: "Développer", title: "Faire progresser la relation commerciale.",
    description: "Suivre les ventes selon les données disponibles, identifier les besoins de réassort, réactiver les comptes et faire remonter les informations utiles du terrain.",
    tags: "Suivi · Réactivation · Réassort",
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
            <h1 id="hero-title">Implantez votre marque.<br /> <span>Développez ses ventes <span className={styles.heroLocation}>en pharmacie.</span></span></h1>
            <p className={styles.heroIntro}>TR1 PHARMA représente les marques de santé, de beauté et de bien-être en PACA, dans le Gard et dans l’Hérault. Prospection, implantation, formation et suivi des réassorts : un interlocuteur terrain pour développer votre présence en officine.</p>
            <div className={styles.heroActions}>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Parlons de votre développement <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink>
              <a className={styles.secondaryCta} href="#pharmacies">Je suis pharmacien <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroNote}>Du sell-in au sell-out, un accompagnement dans la durée.</p>
          </div>
          <figure className={styles.heroVisual}>
            <PharmacyIllustration />
            <figcaption>PACA · Gard · Hérault <span>Une présence au plus près des officines.</span></figcaption>
          </figure>
        </div>
      </section>
      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>Notre accompagnement</p><h2 id="missions-title">De l’ouverture de compte <span>au réassort.</span></h2></div>
            <p>Chaque implantation est un point de départ. Nous accompagnons ensuite les équipes et suivons les comptes pour soutenir le développement de votre gamme.</p>
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
            <p className={styles.eyebrow}>Le suivi au service du terrain</p>
            <h2 id="terrain-title">Une vision claire des actions <span>sur votre secteur.</span></h2>
            <p className={styles.bodyCopy}>Le suivi complète le travail en officine : actions réalisées, besoins identifiés et prochaines étapes. Vous disposez d’informations concrètes pour échanger sur le développement de votre marque.</p>
          </div>
          <figure className={styles.methodFigure}>
            <div className={styles.methodHeading}>Un échange, des actions, une suite.</div>
            <ol className={styles.methodSteps}>
              <li><span aria-hidden="true">01</span><div><strong>Actions réalisées</strong><p>Visites et accompagnement des équipes</p></div></li>
              <li><span aria-hidden="true">02</span><div><strong>Besoins identifiés</strong><p>Retours officine et besoins de la gamme</p></div></li>
              <li><span aria-hidden="true">03</span><div><strong>Prochaines étapes</strong><p>Actions à prévoir et réassorts à préparer</p></div></li>
            </ol>
            <figcaption>Illustration de la méthode de suivi</figcaption>
          </figure>
        </div>
      </section>
      <section id="amir" className={styles.founder} aria-labelledby="founder-title">
        <div className={`${styles.container} ${styles.founderGrid}`}>
          <div><p className={styles.eyebrow}>Une relation directe</p><h2 id="founder-title">Amir Ounissi,<br/><span>votre interlocuteur terrain.</span></h2></div>
          <div>
            <p className={styles.founderRole}>Fondateur de TR1 PHARMA · Développement commercial en pharmacie</p>
            <p className={styles.bodyCopy}>J’accompagne les marques dans leur développement en officine, de la prise de contact au suivi des comptes. Mon rôle : construire une relation avec les pharmaciens, accompagner leurs équipes et assurer la continuité des actions sur le terrain.</p>
            <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noopener noreferrer" className={styles.textCta}>Découvrir mon parcours <ArrowUpRight size={18} aria-hidden="true"/></a>
          </div>
        </div>
      </section>
      <section id="pharmacies" className={styles.pharmacies} aria-labelledby="pharmacy-title">
        <div className={`${styles.container} ${styles.pharmacyGrid}`}>
          <div><p className={styles.eyebrow}>Vous êtes pharmacien ?</p><h2 id="pharmacy-title">Des gammes à découvrir.<br/><span>Un interlocuteur pour les développer.</span></h2></div>
          <div><p className={styles.bodyCopy}>Échangeons sur les gammes adaptées à votre officine et les moyens de les accompagner : présentation des produits, formation de l’équipe, visibilité et suivi des réassorts.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_section" }} className={styles.pharmacyCta}>Échanger pour mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div>
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
