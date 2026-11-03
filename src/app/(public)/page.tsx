import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { FieldReferences } from "@/components/marketing/field-references";
import { PharmacyIllustration } from "@/components/marketing/pharmacy-illustration";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import styles from "./landing-editorial.module.css";

const pageTitle = "TR1 PHARMA — Développement commercial en pharmacie";
const pageDescription = "TR1 PHARMA accompagne les marques de santé, beauté et bien-être en pharmacie et parapharmacie, du sell-in au sell-out : ouverture de comptes, formation, animation et suivi terrain.";
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
    number: "01", label: "SELL-IN", title: "Ouvrir les bons comptes",
    description: "Identifier les pharmacies et parapharmacies pertinentes pour votre gamme, rencontrer les décideurs et transformer les opportunités en premières implantations.",
    tags: "Ciblage · Prospection · Négociation · Implantation",
  },
  {
    number: "02", label: "FORMATION", title: "Donner aux équipes les bons arguments",
    description: "Transmettre les connaissances produit, les bénéfices et les arguments utiles pour que les équipes puissent présenter et conseiller vos références.",
    tags: "Connaissance produit · Conseil · Équipes officinales",
  },
  {
    number: "03", label: "ANIMATION", title: "Créer des temps forts en officine",
    description: "Organiser des animations et des mises en avant pour faire découvrir vos produits, engager les équipes et soutenir l’activité commerciale.",
    tags: "Découverte produit · Visibilité · Sell-out",
  },
  {
    number: "04", label: "PERFORMANCE", title: "Suivre la distribution et les ventes",
    description: "Lire les commandes, les réassorts et les ventes disponibles, repérer les comptes à potentiel et définir les actions prioritaires.",
    tags: "Commandes · Réassorts · Bilans commerciaux",
  },
  {
    number: "05", label: "REMONTÉES TERRAIN", title: "Faire remonter la réalité du terrain",
    description: "Partager les retours des pharmaciens, les questions des équipes, les objections et les opportunités pour ajuster le discours et les actions.",
    tags: "Retours équipes · Besoins · Opportunités",
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
            <p className={styles.eyebrow}>DÉVELOPPEMENT COMMERCIAL EN PHARMACIE & PARAPHARMACIE</p>
            <h1 id="hero-title">Du référencement à la vente, <span>votre marque se construit sur le terrain.</span></h1>
            <p className={styles.heroIntro}>TR1 PHARMA accompagne les marques de santé, beauté et bien-être pour ouvrir les bons comptes, mobiliser les équipes officinales et activer les ventes. Un partenaire commercial à vos côtés, du sell-in au sell-out.</p>
            <div className={styles.heroActions}>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Construisons votre présence en pharmacie <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink>
              <a className={styles.secondaryCta} href="#marques">Voir notre méthode <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <ul className={styles.heroSignals} aria-label="Domaines d’intervention">
              <li><span aria-hidden="true" />Développer la distribution</li>
              <li><span aria-hidden="true" />Activer les équipes</li>
              <li><span aria-hidden="true" />Suivre les ventes</li>
            </ul>
            <p className={styles.heroTerritory}>SUD-EST · PACA · GARD · HÉRAULT</p>
            <p className={styles.heroNote}>Un interlocuteur commercial. Des expertises terrain mobilisées selon vos besoins.</p>
          </div>
          <figure className={styles.heroVisual}>
            <PharmacyIllustration />
            <figcaption>De la première implantation au suivi des ventes.<span>Ouvrir · Former · Animer · Développer</span></figcaption>
          </figure>
        </div>
      </section>
      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>CE QUE TR1 PREND EN CHARGE</p><h2 id="missions-title">Une présence commerciale qui <span>va au-delà de l’implantation.</span></h2></div>
            <p>Une gamme référencée n’est qu’un point de départ. Nous accompagnons aussi ce qui construit sa place dans la durée : connaissance produit, visibilité, conseil, réassort et retours terrain.</p>
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
      <section id="reseau" className={styles.network} aria-labelledby="network-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>LE RÉSEAU TR1 PHARMA</p><h2 id="network-title">Un interlocuteur commercial.<br/><span>Un réseau pour aller plus loin.</span></h2></div>
            <p>Selon les objectifs de la marque et les besoins des officines, TR1 coordonne des agents commerciaux, formateurs et animateurs. Chaque expertise intervient au bon moment, dans une logique commune de développement.</p>
          </div>
          <div className={styles.networkRoles}>
            <article><p className={styles.networkLabel}>DÉVELOPPER</p><h3>Les agents commerciaux</h3><p>Ouvrir les comptes, présenter les gammes, négocier les implantations et entretenir la relation avec les officines.</p></article>
            <article><p className={styles.networkLabel}>TRANSMETTRE</p><h3>Les formateurs</h3><p>Faire progresser les équipes en connaissance produit et leur donner les arguments concrets pour le conseil.</p></article>
            <article><p className={styles.networkLabel}>ACTIVER</p><h3>Les animateurs</h3><p>Créer la rencontre avec le consommateur, faire découvrir la gamme et accompagner les temps forts en point de vente.</p></article>
          </div>
          <div className={styles.networkPromise}>
            <strong>Une coordination, plusieurs expertises.</strong>
            <p>La marque conserve un interlocuteur commercial. TR1 organise les relais terrain nécessaires selon le secteur, les objectifs et les actions à mener.</p>
          </div>
          <div className={styles.networkAudiences}>
            <div><h3>Pour les marques</h3><p>Un dispositif terrain adapté à votre ambition, à votre secteur et au niveau de développement de votre marque.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "network_brand" }} className={styles.textCta}>Mobiliser le réseau pour ma marque <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div>
            <div><h3>Pour les pharmacies</h3><p>Des interventions coordonnées autour des marques partenaires, en fonction des besoins de votre officine.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "network_pharmacy" }} className={styles.textCta}>Être accompagné dans mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div>
          </div>
          <p className={styles.networkNote}>Les interventions sont organisées selon le secteur, les objectifs et la disponibilité des intervenants. Zone actuelle : PACA, Gard et Hérault.</p>
        </div>
      </section>
      <section id="terrain" className={styles.followUp} aria-labelledby="terrain-title">
        <div className={`${styles.container} ${styles.followUpGrid}`}>
          <div>
            <p className={styles.eyebrow}>LE PILOTAGE TERRAIN</p>
            <h2 id="terrain-title">Chaque action terrain <span>prépare la suivante.</span></h2>
            <p className={styles.bodyCopy}>Les informations collectées en officine servent à décider quoi faire ensuite : relancer, former, animer, réassortir ou ouvrir un nouveau compte. Le suivi ne s’arrête pas à la visite.</p>
          </div>
          <figure className={styles.methodFigure}>
            <div className={styles.methodHeading}>Un suivi commercial exploitable.</div>
            <ol className={styles.methodSteps}>
              <li><span aria-hidden="true">01</span><div><strong>Actions menées</strong><p>Visites, implantations et accompagnement des équipes</p></div></li>
              <li><span aria-hidden="true">02</span><div><strong>Signaux du terrain</strong><p>Retours, objections, besoins et opportunités identifiés</p></div></li>
              <li><span aria-hidden="true">03</span><div><strong>Plan d’action</strong><p>Relances, formations, animations et réassorts à préparer</p></div></li>
            </ol>
          </figure>
        </div>
      </section>
      <section id="amir" className={styles.founder} aria-labelledby="founder-title">
        <div className={`${styles.container} ${styles.founderGrid}`}>
          <div><p className={styles.eyebrow}>UNE RELATION DIRECTE</p><h2 id="founder-title">Amir Ounissi,<br/><span>votre interlocuteur terrain.</span></h2></div>
          <div>
            <p className={styles.founderRole}>Fondateur de TR1 PHARMA</p>
            <p className={styles.bodyCopy}>J’accompagne les marques au contact des pharmacies : prospection, implantation, formation, animation et suivi. Je privilégie une approche directe : comprendre les enjeux de la marque, les réalités de l’officine et transformer les échanges terrain en actions commerciales concrètes.</p>
            <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noopener noreferrer" className={styles.textCta}>Découvrir mon parcours <ArrowUpRight size={18} aria-hidden="true"/></a>
          </div>
        </div>
      </section>
      <section id="pharmacies" className={styles.pharmacies} aria-labelledby="pharmacy-title">
        <div className={styles.container}>
          <div className={styles.pharmacyGrid}>
            <div>
              <p className={styles.eyebrow}>PHARMACIES · VOTRE PARTENAIRE DANS LE SUD-EST</p>
              <h2 id="pharmacy-title">Des marques à potentiel.<br/><span>Un partenaire pour les faire tourner.</span></h2>
            </div>
            <div>
              <p className={styles.bodyCopy}>Des gammes adaptées à votre clientèle, une équipe accompagnée et un suivi dans la durée. Avec TR1 PHARMA, construisez une sélection cohérente pour votre officine et faites-la vivre, du rayon au comptoir.</p>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_section" }} className={styles.pharmacyCta}>Échanger pour mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink>
            </div>
          </div>
          <div className={styles.pharmacyBenefits}>
            <article><p className={styles.pharmacyStep}>01 · SÉLECTIONNER</p><h3>Des gammes qui ont leur place chez vous.</h3><p>Nous échangeons sur votre clientèle, vos besoins et votre espace de vente pour choisir les marques et les références pertinentes pour votre officine.</p></article>
            <article><p className={styles.pharmacyStep}>02 · FAIRE VIVRE</p><h3>Un accompagnement après l’implantation.</h3><p>Formation de l’équipe, mise en avant et animations : nous définissons les actions adaptées pour faciliter le conseil et soutenir les ventes.</p></article>
            <article><p className={styles.pharmacyStep}>03 · SUIVRE</p><h3>Un interlocuteur qui revient.</h3><p>Des points réguliers sur les rotations, les stocks et les retours de votre équipe pour ajuster les actions et préparer les réassorts selon vos besoins.</p></article>
          </div>
          <aside className={styles.partnerProgram} aria-labelledby="partner-program-title">
            <div>
              <p className={styles.eyebrow}>LE PROGRAMME TR1 PARTENAIRES</p>
              <h3 id="partner-program-title">Plusieurs marques.<br/>Une relation qui vous apporte plus.</h3>
              <p>Votre engagement ouvre l’accès à des avantages progressifs, selon les marques partenaires travaillées, la régularité des réassorts et les actions mises en place ensemble.</p>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_partner_program" }} className={styles.pharmacyCta}>Découvrir les avantages pour mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink>
            </div>
            <div>
              <ul className={styles.partnerAdvantages}>
                <li><strong>Des bonus produits</strong><span>Dotations et offres partenaires selon les marques participantes.</span></li>
                <li><strong>Des moyens pour gagner en visibilité</strong><span>Supports de mise en avant et opérations commerciales adaptées.</span></li>
                <li><strong>Des actions pour accompagner votre équipe</strong><span>Formations et animations supplémentaires selon les conditions du programme.</span></li>
              </ul>
              <p className={styles.partnerTerms}>Avantages soumis aux conditions du programme et des marques participantes, précisés lors de notre échange. Les actions sont définies ensemble selon les besoins de l’officine.</p>
            </div>
          </aside>
        </div>
      </section>
      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactIntro}><p className={styles.eyebrow}>PREMIER ÉCHANGE</p><h2 id="contact-title">Parlons de votre <span>développement en pharmacie.</span></h2></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}>
              <p className={styles.contactAudience}>Marque & laboratoire</p><h3>Construisons la suite.</h3>
              <p className={styles.cardDescription}>Présentez-nous votre gamme, votre territoire et vos objectifs. Nous ferons le point sur les leviers à activer pour développer votre présence en pharmacie.</p>
              <LeadForm audience="brand" />
            </article>
            <details id="contact-pharmacie" className={styles.pharmacyContact}><summary>Vous représentez une pharmacie ? Contactez-nous <ArrowRight size={17} aria-hidden="true" /></summary><div className={styles.pharmacyContactBody}>
              <p className={styles.contactAudience}>Pharmacie</p><h3>Parlons de votre officine.</h3>
              <p className={styles.cardDescription}>Échangeons sur les marques adaptées à votre officine, l’accompagnement de votre équipe et les avantages TR1 Partenaires.</p>
              <LeadForm audience="pharmacy" />
            </div></details>
          </div>
        </div>
      </section>
    </main>
  );
}
