import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { FieldReferences } from "@/components/marketing/field-references";
import { PharmacyIllustration } from "@/components/marketing/pharmacy-illustration";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import styles from "./landing-editorial.module.css";

const pageTitle = "TR1 PHARMA — Votre marque en pharmacie et parapharmacie";
const pageDescription = "Développez votre marque en pharmacie et parapharmacie, du sell-in au sell-out : prospection, implantation, formation des équipes et animations. TR1 PHARMA accompagne les marques en PACA, dans le Gard et l’Hérault.";
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
    number: "01", label: "SELL-IN", title: "Ouvertures de comptes",
    description: "Cibler les pharmacies et parapharmacies adaptées à votre gamme, rencontrer les acheteurs et négocier les premières commandes pour développer votre distribution.",
    tags: "Prospection · Présentation de gamme · Implantation",
  },
  {
    number: "02", label: "FORMATION", title: "Donner aux équipes les clés du conseil.",
    description: "Former les équipes à vos produits, à leurs bénéfices et à leurs arguments de conseil pour qu’elles puissent recommander votre gamme au comptoir.",
    tags: "Connaissance produit · Arguments de conseil · Équipes",
  },
  {
    number: "03", label: "ANIMATION", title: "Faire vivre votre marque en point de vente.",
    description: "Organiser et coordonner des animations commerciales pour faire découvrir vos produits aux consommateurs et soutenir les ventes en pharmacie et parapharmacie.",
    tags: "Découverte produit · Mise en avant · Sell-out",
  },
  {
    number: "04", label: "SUIVI DE LA PERFORMANCE", title: "Suivre les résultats et ajuster les actions.",
    description: "Faire le point sur les commandes, les réassorts et les ventes selon les données disponibles. Identifier les comptes à développer et prioriser les prochaines actions avec votre marque.",
    tags: "Commandes · Réassorts · Bilans commerciaux",
  },
  {
    number: "05", label: "REMONTÉES TERRAIN", title: "Comprendre ce qui se passe en rayon.",
    description: "Vous transmettre les retours des équipes, les objections, les besoins et les observations en point de vente pour adapter votre approche commerciale à la réalité du terrain.",
    tags: "Retours équipes · Visibilité · Opportunités",
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
            <p className={styles.eyebrow}>MARQUES DE SANTÉ, BEAUTÉ & BIEN-ÊTRE</p>
            <h1 id="hero-title">Votre partenaire commercial terrain <span>en pharmacie et parapharmacie.</span></h1>
            <p className={styles.heroIntro}>TR1 PHARMA accompagne le développement de votre marque, du sell-in au sell-out. Ouvertures de comptes, formation, animation, suivi de la performance et remontées terrain : une présence à vos côtés et auprès des points de vente.</p>
            <div className={styles.heroActions}>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Parlons de votre marque <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink>
              <a className={styles.secondaryCta} href="#marques">Découvrir l’accompagnement <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroTerritory}>PACA · Gard · Hérault</p>
            <p className={styles.heroNote}>Votre partenaire terrain, du sell-in au sell-out.</p>
          </div>
          <figure className={styles.heroVisual}>
            <PharmacyIllustration />
            <figcaption>Votre marque, accompagnée à chaque étape.<span>Ouvrir des comptes · Former · Animer · Suivre · Vous informer</span></figcaption>
          </figure>
        </div>
      </section>
      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>Notre accompagnement, du sell-in au sell-out</p><h2 id="missions-title">Cinq leviers pour <span>développer votre marque.</span></h2></div>
            <p>Vous lancez votre gamme, développez votre distribution ou souhaitez mieux accompagner vos comptes existants ? Nous construisons avec vous un plan d’action adapté à votre marque et à votre secteur.</p>
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
            <p className={styles.bodyCopy}>J’accompagne les marques dans leur développement en pharmacie et parapharmacie, du sell-in au sell-out. Prospection, implantation, formation des équipes, visibilité en officine et animations commerciales : mon objectif est de faire le lien entre la présence de la marque sur le terrain et l’activation de ses ventes.</p>
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
          <div className={styles.contactIntro}><p className={styles.eyebrow}>Faisons le point</p><h2 id="contact-title">Parlons du développement <span>de votre marque.</span></h2></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}>
              <p className={styles.contactAudience}>Marque & laboratoire</p><h3>Développons votre marque.</h3>
              <p className={styles.cardDescription}>Un premier échange pour faire le point sur votre gamme, votre territoire et vos objectifs en pharmacie et parapharmacie.</p>
              <LeadForm audience="brand" />
            </article>
            <details id="contact-pharmacie" className={styles.pharmacyContact}><summary>Vous représentez une pharmacie ? Contactez-nous <ArrowRight size={17} aria-hidden="true" /></summary><div className={styles.pharmacyContactBody}>
              <p className={styles.contactAudience}>Pharmacie</p><h3>Parlons de votre officine.</h3>
              <p className={styles.cardDescription}>Présentez-nous votre officine et les besoins de votre équipe.</p>
              <LeadForm audience="pharmacy" />
            </div></details>
          </div>
        </div>
      </section>
    </main>
  );
}
