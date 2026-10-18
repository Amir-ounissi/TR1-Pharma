import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, MoveUpRight, MapPin } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
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
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
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
    number: "01",
    label: "DÉPLOYER",
    title: "Ouvrir les bonnes portes.",
    description: "Cibler les officines adaptées à votre gamme, rencontrer les décideurs et transformer les échanges en implantations.",
    tags: ["Prospection", "Rendez-vous", "Implantation"],
  },
  {
    number: "02",
    label: "ACTIVER",
    title: "Faire vivre vos produits.",
    description: "Accompagner les équipes officinales, renforcer leur connaissance de la gamme et organiser les actions de visibilité.",
    tags: ["Formation", "Merchandising", "Animation"],
  },
  {
    number: "03",
    label: "DÉVELOPPER",
    title: "Installer la relation dans la durée.",
    description: "Suivre les pharmacies, anticiper les besoins de réassort et faire remonter les informations utiles du terrain.",
    tags: ["Suivi terrain", "Réassort", "Retour d’expérience"],
  },
];

export default function LandingPage() {
  return (
    <main id="contenu" className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessStructuredData).replace(/</g, "\\u003c") }} />
      <RecoveryHashRedirect />
      <MarketingPageEvent event="landing_view" />

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowLeft}><span className={styles.liveDot} /> L’EXPERTISE TERRAIN. LA VISION EN PLUS.</span>
            <span className={styles.heroRegion}><MapPin size={14} aria-hidden="true" /> PACA · GARD · HÉRAULT</span>
          </div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.heroLabel}>DÉVELOPPEMENT COMMERCIAL EN PHARMACIE <span> / TR1</span></div>
              <h1 id="hero-title">Votre marque mérite <span>plus qu’une place en rayon.</span></h1>
              <p className={styles.heroIntro}>De la première implantation aux réassorts, nous donnons à votre marque une vraie présence commerciale en pharmacie. Sur le terrain, avec une méthode et des outils pour garder le cap.</p>
              <div className={styles.heroActions}>
                <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Parlons de votre marque <ArrowUpRight size={19} aria-hidden="true" /></MarketingTrackedLink>
                <a className={styles.heroSecondary} href="#pharmacies">Je suis pharmacien <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
              <div className={styles.heroTrust}><span className={styles.smallLine} /> Une présence terrain, du premier contact au suivi.</div>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.visualTopline}><span><span className={styles.visualDot} /> TR1 PHARMA / PILOTAGE TERRAIN</span><span>01 — 03</span></div>
              <div className={styles.visualFrame}>
                <div className={styles.visualBrowser}><span className={styles.browserDots} aria-hidden="true"><i/><i/><i/></span><span>APERÇU DE LA PLATEFORME</span><span className={styles.visualSecure}>TR1 / WORKSPACE</span></div>
                <Image src="/marketing/manager-day.webp" alt="Capture réelle de l’interface de suivi commercial TR1 PHARMA" width={1440} height={1000} priority sizes="(max-width: 760px) 92vw, (max-width: 1200px) 45vw, 550px" className={styles.visualScreenshot} />
              </div>
              <div className={styles.visualFooter}><div><span className={styles.visualFooterKicker}>NOTRE DIFFÉRENCE</span><p>Une présence qui se construit.<br/>Un développement qui se suit.</p></div><MoveUpRight size={24} aria-hidden="true" /></div>
            </div>
          </div>
          <div className={styles.heroBottom}><span>UNE APPROCHE DE BOUT EN BOUT</span><div><span>Prospecter</span><i/><span>Implanter</span><i/><span>Accompagner</span></div><a href="#marques">Explorer notre méthode <ArrowDownRight size={17} aria-hidden="true" /></a></div>
        </div>
      </section>

      <section id="marques" className={styles.missions} aria-labelledby="missions-title">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <div><p className={styles.kicker}><span className={styles.kickerLine}/> POUR LES MARQUES & LABORATOIRES</p><h2 id="missions-title">Pas simplement être présent.<br/><span>Être vraiment développé.</span></h2></div>
            <p>Une belle implantation ne suffit pas. Ce qui compte, c’est ce qui se passe ensuite : les équipes qui connaissent la gamme, les visites qui s’enchaînent et la relation qui dure.</p>
          </div>
          <div id="methode" className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.number}>
                <div className={styles.serviceTop}><span>{service.number} / {service.label}</span><ArrowUpRight size={21} aria-hidden="true"/></div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <div className={styles.serviceTags}>{service.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </article>
            ))}
          </div>
          <div className={styles.sectionEnd}><span>STRATÉGIE COMMERCIALE + EXÉCUTION TERRAIN + SUIVI</span><MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "services" }} className={styles.textCta}>Discutons de vos objectifs <ArrowUpRight size={18} aria-hidden="true" /></MarketingTrackedLink></div>
        </div>
      </section>

      <section id="terrain" className={styles.terrain} aria-labelledby="terrain-title">
        <div className={styles.container}>
          <div className={styles.terrainGrid}>
            <div className={styles.terrainMessage}>
              <p className={styles.kicker}><span className={styles.kickerLine} /> UNE MÉTHODE, PAS UNE PROMESSE</p>
              <h2 id="terrain-title">Le terrain d’abord.<br/><span>La visibilité en plus.</span></h2>
              <p className={styles.terrainIntro}>Les résultats commerciaux se construisent en officine. Leur suivi mérite la même attention. TR1 PHARMA associe le travail de terrain à une plateforme dédiée à la continuité des actions.</p>
              <ul className={styles.checkList}>
                <li><Check size={16} aria-hidden="true"/> Visites et échanges structurés</li>
                <li><Check size={16} aria-hidden="true"/> Commandes et réassorts suivis</li>
                <li><Check size={16} aria-hidden="true"/> Prochaines actions identifiées</li>
              </ul>
              <Link href="/connexion" className={styles.terrainLink}>Accès à la plateforme <ArrowUpRight size={17} aria-hidden="true"/></Link>
            </div>
            <div className={styles.founderPanel}>
              <div className={styles.founderBadge}>VOTRE INTERLOCUTEUR SUR LE TERRAIN <span>↗</span></div>
              <div className={styles.founderMain}>
                <span className={styles.founderMonogram} aria-hidden="true">AO.</span>
                <h3>Amir Ounissi.</h3>
                <p className={styles.founderRole}>Fondateur de TR1 PHARMA · Développement commercial en pharmacie</p>
                <p>Un seul interlocuteur pour représenter votre marque, construire les relations en officine et assurer leur suivi dans le Sud de la France.</p>
                <a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noopener noreferrer" className={styles.founderLink}>Voir le travail terrain <ArrowUpRight size={17} aria-hidden="true"/></a>
              </div>
              <div className={styles.founderFoot}>PROXIMITÉ <span>—</span> EXÉCUTION <span>—</span> CONTINUITÉ</div>
            </div>
          </div>
        </div>
      </section>

      <section id="pharmacies" className={styles.pharmacies} aria-labelledby="pharmacy-title">
        <div className={styles.container}>
          <div className={styles.pharmacyShell}>
            <div className={styles.pharmacyOverline}>VOUS ÊTES PHARMACIEN ? <span>02 / NOS PARTENAIRES</span></div>
            <div className={styles.pharmacyGrid}><h2 id="pharmacy-title">Des marques à découvrir.<br/><span>Un vrai suivi à vos côtés.</span></h2><div><p>Des gammes adaptées à votre officine, des échanges directs et un accompagnement concret pour vos équipes. De la découverte au réassort, vous savez à qui vous adresser.</p><MarketingTrackedLink event="primary_cta_click" href="#contact-pharmacie" properties={{ placement: "pharmacy_section" }} className={styles.pharmacyCta}>Échanger pour mon officine <ArrowUpRight size={18} aria-hidden="true"/></MarketingTrackedLink></div></div>
            <div className={styles.pharmacyBottom}><span>UNE RELATION DIRECTE, SUR LE TERRAIN</span><span>TR1 PHARMA <ArrowUpRight size={15} aria-hidden="true"/></span></div>
          </div>
        </div>
      </section>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <div className={styles.container}>
          <div className={styles.contactIntro}><p className={styles.kicker}><span className={styles.kickerLine}/> LE PREMIER ÉCHANGE</p><div className={styles.contactIntroGrid}><h2 id="contact-title">Le prochain chapitre<br/><span>commence ici.</span></h2><p>Vous développez une marque ou vous représentez une officine ? Parlez-nous de votre projet. Nous reviendrons vers vous pour un échange concret.</p></div></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}><div className={styles.contactCardTop}><span>01 — MARQUE & LABORATOIRE</span><ArrowUpRight size={20} aria-hidden="true"/></div><h3>Développons votre marque.</h3><p className={styles.cardDescription}>Parlez-nous de votre gamme et de vos ambitions en pharmacie.</p><LeadForm audience="brand" /></article>
            <article id="contact-pharmacie" className={styles.contactCard}><div className={styles.contactCardTop}><span>02 — PHARMACIE</span><ArrowUpRight size={20} aria-hidden="true"/></div><h3>Parlons de votre officine.</h3><p className={styles.cardDescription}>Découvrons les gammes et l'accompagnement adaptés à votre équipe.</p><LeadForm audience="pharmacy" /></article>
          </div>
        </div>
      </section>
    </main>
  );
}
