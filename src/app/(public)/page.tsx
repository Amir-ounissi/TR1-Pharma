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
            <figcaption>Votre marque, accompagnée à chaque étape.<span>Implanter · Former · Animer · Suivre les résultats</span></figcaption>
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
      <section id="reseau" className={styles.network} aria-labelledby="network-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>LE RÉSEAU TR1 PHARMA</p><h2 id="network-title">Des expertises complémentaires.<br/><span>Une même exigence terrain.</span></h2></div>
            <p>Agents commerciaux, formateurs et animateurs : TR1 PHARMA coordonne les compétences nécessaires pour accompagner les marques et les pharmacies, de l’implantation au conseil et à la vente.</p>
          </div>
          <div className={styles.networkRoles}>
            <article><p className={styles.networkLabel}>DÉVELOPPER</p><h3>Les agents commerciaux</h3><p>Présenter les gammes, ouvrir les comptes et entretenir la relation avec l’officine. Un suivi commercial pour faire le lien entre les besoins du point de vente et les marques représentées.</p></article>
            <article><p className={styles.networkLabel}>TRANSMETTRE</p><h3>Les formateurs</h3><p>Donner aux équipes les connaissances produit et les arguments utiles au conseil. Des échanges concrets, adaptés aux questions rencontrées au comptoir.</p></article>
            <article><p className={styles.networkLabel}>ACTIVER</p><h3>Les animateurs</h3><p>Faire découvrir les produits aux clients, accompagner leur prise en main et soutenir les temps forts en officine. Une présence au contact des consommateurs.</p></article>
          </div>
          <div className={styles.networkAudiences}>
            <div><h3>Pour les marques</h3><p>Des relais terrain coordonnés pour déployer votre gamme, accompagner les équipes et faire remonter les retours des points de vente.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "network_brand" }} className={styles.textCta}>Mobiliser le réseau pour ma marque <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div>
            <div><h3>Pour les pharmacies</h3><p>Des compétences complémentaires autour de votre officine, avec des interventions organisées selon vos besoins et les marques travaillées.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "network_pharmacy" }} className={styles.textCta}>Être accompagné dans mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div>
          </div>
          <p className={styles.networkNote}>Interventions organisées selon le secteur, les besoins et la disponibilité des intervenants. Présence actuelle : PACA, Gard et Hérault.</p>
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
          <div className={styles.contactIntro}><p className={styles.eyebrow}>Faisons le point</p><h2 id="contact-title">Parlons du développement <span>de votre marque.</span></h2></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}>
              <p className={styles.contactAudience}>Marque & laboratoire</p><h3>Développons votre marque.</h3>
              <p className={styles.cardDescription}>Un premier échange pour faire le point sur votre gamme, votre territoire et vos objectifs en pharmacie et parapharmacie.</p>
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
