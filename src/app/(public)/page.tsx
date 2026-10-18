import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import styles from "./landing-editorial.module.css";

const pageTitle = "TR1 PHARMA — Votre développement en pharmacie";
const pageDescription = "Développez votre marque en pharmacie avec Amir Ounissi : prospection, implantation, formation et suivi commercial en PACA, dans le Gard et l’Hérault.";
const publicUrl = "https://www.tr1pharma.com/";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: publicUrl },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    siteName: "TR1 PHARMA",
    url: publicUrl,
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary", title: pageTitle, description: pageDescription },
};

const businessStructuredData = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "TR1 PHARMA",
  url: publicUrl,
  description: pageDescription,
  inLanguage: "fr-FR",
  areaServed: [
    { "@type": "AdministrativeArea", name: "Provence-Alpes-Côte d’Azur" },
    { "@type": "AdministrativeArea", name: "Gard" },
    { "@type": "AdministrativeArea", name: "Hérault" },
  ],
  founder: { "@type": "Person", name: "Amir Ounissi" },
};

const missions = [
  { number: "01", title: "Ouvrir les bonnes portes.", text: "Identifier les officines adaptées à votre gamme, rencontrer les décideurs et construire les premières commandes.", detail: "Prospection · Rendez-vous · Implantation" },
  { number: "02", title: "Donner vie à votre gamme.", text: "Accompagner les équipes pour qu’elles connaissent vos produits et puissent les conseiller. Organiser la visibilité et les animations prévues avec votre marque.", detail: "Formation · Merchandising · Animation" },
  { number: "03", title: "Construire la suite.", text: "Revenir vers les pharmacies, suivre les réassorts et vous transmettre les retours utiles pour faire évoluer les actions.", detail: "Suivi commercial · Réassort · Retours terrain" },
];

export default function LandingPage() {
  return (
    <main id="contenu" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessStructuredData).replace(/</g, "\\u003c") }}
      />
      <RecoveryHashRedirect />
      <MarketingPageEvent event="landing_view" />
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.container}>
          <div className={styles.heroTop}><span>Développement commercial en pharmacie</span><span className={styles.location}><MapPin size={14} aria-hidden="true" /> Le Sud, notre terrain.</span></div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 id="hero-title">Votre marque.<br />Les bonnes officines.<br /><em>Une vraie présence.</em></h1>
              <p>De la première rencontre au prochain réassort, TR1 PHARMA accompagne votre développement en pharmacie.</p>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Parlons de votre marque <ArrowUpRight size={19} aria-hidden="true" /></MarketingTrackedLink>
              <a className={styles.heroSecondary} href="#pharmacies">Je suis pharmacien <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <aside className={styles.heroManifesto} aria-label="L’approche TR1 PHARMA">
              <div className={styles.manifestoTop}><span>TR1 / L’engagement</span><ArrowUpRight size={30} aria-hidden="true" /></div>
              <p>Rencontrer.<br />Convaincre.<br /><em>Accompagner.</em></p>
              <div className={styles.manifestoBottom}><span>Une relation se construit.<br />Une présence s’entretient.</span><span className={styles.manifestoMark} aria-hidden="true">1</span></div>
            </aside>
          </div>
          <div className={styles.heroBottom}><span>PACA <i /> Gard <i /> Hérault</span><a href="#marques">Découvrir l’accompagnement <ArrowDown size={16} aria-hidden="true" /></a></div>
        </div>
      </section>

      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>01 / Pour les marques & laboratoires</p><h2 id="missions-title">L’implantation est un début.<br /><em>Le développement se poursuit.</em></h2></div>
          <div id="methode" className={styles.missionList}>{missions.map((mission) => <article className={styles.mission} key={mission.number}><span className={styles.number}>{mission.number}</span><h3>{mission.title}</h3><div><p>{mission.text}</p><span className={styles.detail}>{mission.detail}</span></div></article>)}</div>
        </div>
      </section>

      <section id="terrain" className={styles.founder} aria-labelledby="founder-title">
        <div className={[styles.container, styles.founderGrid].join(" ")}>
          <div className={styles.founderIdentity}>
            <p className={styles.eyebrow}>02 / Votre interlocuteur</p>
            <h2 id="founder-title">Amir Ounissi.<br /><em>À vos côtés,<br />en officine.</em></h2>
            <p className={styles.founderRole}>Commercial terrain · Fondateur de TR1 PHARMA</p>
            <p className={styles.bodyCopy}>Présenter une gamme, échanger avec une équipe, préparer une implantation, suivre une commande : mon métier se joue dans le quotidien des pharmacies.</p>
            <p className={styles.bodyCopy}>Avec TR1 PHARMA, je mets cette expérience au service des marques qui souhaitent développer leur présence dans le Sud.</p>
            <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noopener noreferrer" className={styles.textLink}>Voir le travail terrain <ArrowUpRight size={17} aria-hidden="true" /></a>
          </div>
          <div className={styles.followUp}>
            <div className={styles.followUpHeading}><span>Le suivi fait partie du métier.</span><ArrowUpRight size={22} aria-hidden="true" /></div>
            <div className={styles.screenFrame}><Image src="/marketing/manager-day.webp" alt="Aperçu de l’interface de suivi TR1 PHARMA" width={1440} height={1000} sizes="(max-width: 800px) 90vw, 42vw" className={styles.screen} /></div>
            <p>Visites, commandes et prochaines actions : une plateforme pour garder le fil de l’accompagnement.</p>
            <Link href="/connexion" className={styles.textLink}>Accès plateforme <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section id="pharmacies" className={styles.pharmacies} aria-labelledby="pharmacy-title">
        <div className={[styles.container, styles.pharmacyGrid].join(" ")}>
          <p className={styles.eyebrow}>03 / Pour les pharmacies</p>
          <div><h2 id="pharmacy-title">Des marques à découvrir.<br /><em>Un interlocuteur à retrouver.</em></h2><p>Échangeons sur les gammes adaptées à votre officine et l’accompagnement proposé : présentation des produits, formation de l’équipe et suivi de vos besoins.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_section" }} className={styles.lightCta}>Échanger pour mon officine <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink></div>
        </div>
      </section>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactHeading}><p className={styles.eyebrow}>Et si on en parlait ?</p><h2 id="contact-title">La prochaine rencontre<br /><em>commence ici.</em></h2><p>Une marque à développer, une gamme à découvrir : laissez vos coordonnées pour un premier échange.</p></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}><span className={styles.contactIndex}>01 / Marque & laboratoire</span><h3>Développons votre présence.</h3><LeadForm audience="brand" /></article>
            <article id="contact-pharmacie" className={styles.contactCard}><span className={styles.contactIndex}>02 / Pharmacie</span><h3>Parlons de votre officine.</h3><LeadForm audience="pharmacy" /></article>
          </div>
        </div>
      </section>
    </main>
  );
}
