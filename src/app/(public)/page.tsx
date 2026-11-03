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
    number: "01", label: "SELL-IN", title: "Développer la distribution",
    description: "Cibler, prospecter et ouvrir les comptes qui correspondent à votre marque.",
  },
  {
    number: "02", label: "FORMATION", title: "Donner les clés du conseil",
    description: "Former les équipes pour qu’elles connaissent vos produits et sachent les recommander.",
  },
  {
    number: "03", label: "ANIMATION", title: "Faire vivre la marque en officine",
    description: "Créer des temps forts, des mises en avant et des rencontres avec les consommateurs.",
  },
  {
    number: "04", label: "PILOTAGE TERRAIN", title: "Faire progresser les ventes",
    description: "Suivre commandes, réassorts et retours terrain pour définir les prochaines actions.",
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
            <p className={styles.heroIntro}>Nous développons votre présence en pharmacie : ouverture de comptes, formation des équipes, animation et suivi des ventes.</p>
            <div className={styles.heroActions}>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Développer ma marque en pharmacie <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink>
              <a className={styles.secondaryCta} href="#marques">Découvrir l’accompagnement <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroTerritory}>SUD-EST · PACA · GARD · HÉRAULT</p>
          </div>
          <figure className={styles.heroVisual}>
            <PharmacyIllustration />
            <figcaption>Votre marque, présente et active en officine.</figcaption>
          </figure>
        </div>
      </section>

      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>L’ACCOMPAGNEMENT TR1</p><h2 id="missions-title">Quatre leviers pour <span>développer votre marque.</span></h2></div>
            <p>Un accompagnement opérationnel, adapté à vos objectifs et au stade de développement de votre gamme.</p>
          </div>
          <div id="methode" className={styles.serviceGrid}>
            {services.map((service) => (
              <article id={service.number === "04" ? "terrain" : undefined} className={styles.service} key={service.number}>
                <p className={styles.serviceStep}><span>{service.number}</span> {service.label}</p>
                <h3>{service.title}</h3>
                <p className={styles.serviceDescription}>{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FieldReferences items={[]} />

      <section id="reseau" className={styles.network} aria-labelledby="network-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.eyebrow}>LE RÉSEAU TR1 PHARMA</p><h2 id="network-title">Les bonnes expertises, <span>au bon moment.</span></h2></div>
            <p>Agents commerciaux, formateurs et animateurs interviennent en coordination autour d’un même objectif : faire progresser votre marque en officine.</p>
          </div>
          <div className={styles.networkRoles}>
            <article><p className={styles.networkLabel}>DÉVELOPPER</p><h3>Agents commerciaux</h3><p>Prospection, implantation et relation avec les officines.</p></article>
            <article><p className={styles.networkLabel}>TRANSMETTRE</p><h3>Formateurs</h3><p>Connaissance produit et maîtrise des arguments de conseil.</p></article>
            <article><p className={styles.networkLabel}>ACTIVER</p><h3>Animateurs</h3><p>Mise en avant des gammes et temps forts en point de vente.</p></article>
          </div>
          <div className={styles.networkPromise}>
            <strong>Un interlocuteur côté marque.</strong>
            <p>TR1 coordonne les expertises terrain selon vos besoins, votre secteur et vos priorités.</p>
          </div>
        </div>
      </section>

      <section id="amir" className={styles.founder} aria-labelledby="founder-title">
        <div className={`${styles.container} ${styles.founderGrid}`}>
          <div><p className={styles.eyebrow}>UNE RELATION DIRECTE</p><h2 id="founder-title">Un accompagnement <span>ancré dans le terrain.</span></h2></div>
          <div>
            <p className={styles.founderRole}>Amir Ounissi · Fondateur de TR1 PHARMA</p>
            <p className={styles.bodyCopy}>Mon expérience du développement en pharmacie guide une approche concrète : comprendre les réalités de l’officine, agir sur le terrain et suivre les résultats.</p>
            <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noopener noreferrer" className={styles.textCta}>Découvrir mon parcours <ArrowUpRight size={18} aria-hidden="true"/></a>
          </div>
        </div>
      </section>

      <section id="pharmacies" className={styles.pharmacies} aria-labelledby="pharmacy-title">
        <div className={styles.container}>
          <div className={styles.pharmacyGrid}>
            <div>
              <p className={styles.eyebrow}>PHARMACIES · SUD-EST</p>
              <h2 id="pharmacy-title">Des marques à potentiel. <span>Un accompagnement pour les faire vivre.</span></h2>
            </div>
            <div>
              <p className={styles.bodyCopy}>Des gammes choisies pour votre clientèle, et un accompagnement adapté à votre officine.</p>
              <MarketingTrackedLink event="primary_cta_click" href="/pharmacies" properties={{ placement: "pharmacy_section" }} className={styles.pharmacyCta}>Découvrir les marques partenaires <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink>
            </div>
          </div>
          <div className={styles.pharmacyBenefits}>
            <article><p className={styles.pharmacyStep}>01 · SÉLECTIONNER</p><h3>Les bonnes gammes</h3><p>Une sélection cohérente avec votre clientèle et votre espace de vente.</p></article>
            <article><p className={styles.pharmacyStep}>02 · MOBILISER</p><h3>Votre équipe</h3><p>Des formations et animations pour mieux présenter les produits.</p></article>
            <article><p className={styles.pharmacyStep}>03 · DÉVELOPPER</p><h3>Les ventes</h3><p>Un suivi des rotations et des réassorts selon vos besoins.</p></article>
          </div>
          <aside className={styles.partnerProgram} aria-labelledby="partner-program-title">
            <div>
              <p className={styles.eyebrow}>LE PROGRAMME TR1 PARTENAIRES</p>
              <h3 id="partner-program-title">Plusieurs marques. <span>Plus d’avantages.</span></h3>
              <p>Des avantages liés aux marques travaillées et aux actions mises en place avec votre officine.</p>
              <MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_partner_program" }} className={styles.pharmacyCta}>Découvrir le programme <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink>
            </div>
            <div>
              <ul className={styles.partnerAdvantages}>
                <li><strong>Dotations & offres produits</strong><span>Selon les marques participantes.</span></li>
                <li><strong>Visibilité en officine</strong><span>Supports et opérations commerciales.</span></li>
                <li><strong>Formations & animations</strong><span>Des actions adaptées à votre équipe.</span></li>
              </ul>
              <p className={styles.partnerTerms}>Avantages soumis aux conditions de chaque marque partenaire.</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactIntro}><p className={styles.eyebrow}>PREMIER ÉCHANGE</p><h2 id="contact-title">Parlons de votre <span>développement en pharmacie.</span></h2></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}>
              <p className={styles.contactAudience}>Marque & laboratoire</p><h3>Présentez-nous votre projet.</h3>
              <p className={styles.cardDescription}>Votre gamme, votre territoire et vos objectifs : faisons le point.</p>
              <LeadForm audience="brand" />
            </article>
            <details id="contact-pharmacie" className={styles.pharmacyContact}><summary>Vous représentez une pharmacie ? Contactez-nous <ArrowRight size={17} aria-hidden="true" /></summary><div className={styles.pharmacyContactBody}>
              <p className={styles.contactAudience}>Pharmacie</p><h3>Parlons de votre officine.</h3>
              <p className={styles.cardDescription}>Échangeons sur les marques et les accompagnements adaptés à votre équipe.</p>
              <LeadForm audience="pharmacy" />
            </div></details>
          </div>
        </div>
      </section>
    </main>
  );
}
