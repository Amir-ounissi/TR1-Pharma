import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, MapPin, Store, UsersRound, Package, Boxes, ClipboardList, GraduationCap, CheckCircle2, CalendarClock } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";
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
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            src="/marketing/tr1-pharmacy-hero-hd.webp"
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className={styles.heroMediaPhoto}
          />
        </div>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowLeft}><span className={styles.liveDot} /> L’EXPERTISE TERRAIN. LA VISION EN PLUS.</span>
            <span className={styles.heroRegion}><MapPin size={14} aria-hidden="true" /> PACA · GARD · HÉRAULT</span>
          </div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.heroLabel}>DÉVELOPPEMENT COMMERCIAL EN PHARMACIE <span> / TR1</span></div>
              <h1 id="hero-title">Plus qu’une présence,<br/>un développement durable <span>en pharmacie.</span></h1>
              <p className={styles.heroIntro}>TR1 PHARMA accompagne les marques de santé et bien-être avec une présence terrain structurée : visite, implantation, formation, suivi et réassort.</p>
              <div className={styles.heroActions}>
                <MarketingTrackedLink event="primary_cta_click" href="#marques" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Découvrir notre accompagnement <ArrowUpRight size={19} aria-hidden="true" /></MarketingTrackedLink>
                <a className={styles.heroSecondary} href="#pharmacies">Je suis pharmacien <ArrowRight size={17} aria-hidden="true" /></a>
              </div>
              <div className={styles.heroTrust}><span className={styles.smallLine} /> Une présence terrain, du premier contact au suivi.</div>
            </div>
            <div className={styles.heroVisual} role="group" aria-label="Illustration du parcours commercial en pharmacie, sans données réelles">
              <div className={styles.visualTopline}><span><span className={styles.visualDot} /> TR1 PHARMA / ACCOMPAGNEMENT TERRAIN</span><span>PARCOURS ILLUSTRATIF</span></div>
              <div className={styles.journeyGrid} aria-label="Les étapes de notre accompagnement">
                <div className={styles.journeyStep}>
                  <div className={styles.stepIcons}><Store size={23} aria-hidden="true" /><CheckCircle2 size={18} aria-hidden="true" /></div>
                  <strong>Visite réalisée</strong><span className={styles.donePill}>Réalisé</span>
                </div>
                <div className={styles.journeyStep}>
                  <div className={styles.stepIcons}><Boxes size={23} aria-hidden="true" /><CheckCircle2 size={18} aria-hidden="true" /></div>
                  <strong>Implantation validée</strong><span className={styles.donePill}>Réalisé</span>
                </div>
                <div className={styles.journeyStep}>
                  <div className={styles.stepIcons}><UsersRound size={23} aria-hidden="true" /><span className={styles.blueIndicator} /></div>
                  <strong>Formation équipe</strong><span className={styles.currentPill}>En cours</span>
                </div>
                <div className={styles.journeyStep}>
                  <div className={styles.stepIcons}><Package size={23} aria-hidden="true" /><span className={styles.orangeIndicator} /></div>
                  <strong>Réassort à planifier</strong><span className={styles.nextPill}>À suivre</span>
                </div>
              </div>
              <div className={styles.terrainCard}>
                <div className={styles.terrainCardIntro}>
                  <div><p>LA MÉTHODE TR1 PHARMA</p><h2>Suivi terrain</h2><span>Une exécution structurée pour développer vos marques en pharmacie, étape par étape.</span></div>
                  <Tr1BrandLogo className={styles.terrainCardBrandLogo} />
                </div>
                <div className={styles.terrainCardGrid}>
                  <div className={styles.fieldScene} aria-hidden="true">
                    <div className={styles.sceneSign}>PHARMACIE <span>✚</span></div>
                    <div className={styles.sceneShelves}>
                      <div/><div/><div/>
                    </div>
                    <div className={styles.sceneCaption}><Store size={17} /><span>Officine partenaire <small>Un suivi de proximité</small></span></div>
                  </div>
                  <ol className={styles.terrainTimeline} aria-label="Visite, implantation, formation, suivi et réassort">
                    <li className={styles.timelineDone}><span className={styles.timelineIcon}><Store size={18} aria-hidden="true" /></span><div><strong>Visite terrain</strong><span>Échange et recommandations</span></div></li>
                    <li className={styles.timelineDone}><span className={styles.timelineIcon}><Boxes size={18} aria-hidden="true" /></span><div><strong>Implantation rayon</strong><span>Mise en avant de la gamme</span></div></li>
                    <li className={styles.timelineActive}><span className={styles.timelineIcon}><GraduationCap size={18} aria-hidden="true" /></span><div><strong>Formation équipe</strong><span>Présentation et conseils</span></div></li>
                    <li><span className={styles.timelineIcon}><ClipboardList size={18} aria-hidden="true" /></span><div><strong>Suivi des commandes</strong><span>Contrôle et accompagnement</span></div></li>
                    <li><span className={styles.timelineIcon}><Package size={18} aria-hidden="true" /></span><div><strong>Réassort programmé</strong><span>Anticipation des besoins</span></div></li>
                  </ol>
                  <div className={styles.nextAction}>
                    <p className={styles.nextActionLabel}>PROCHAINE ACTION</p>
                    <div className={styles.nextActionIcon}><Package size={22} aria-hidden="true" /></div>
                    <strong>Réassort de la gamme à confirmer</strong>
                    <p>Anticiper les besoins et préparer les prochaines actions.</p>
                    <div className={styles.nextActionWhen}><CalendarClock size={15} aria-hidden="true" /> Étape à planifier</div>
                    <MarketingTrackedLink event="primary_cta_click" href="#contact-marque" properties={{ placement: "terrain_card" }} className={styles.nextActionCta}>Échanger sur vos besoins <ArrowUpRight size={15} aria-hidden="true" /></MarketingTrackedLink>
                  </div>
                </div>
              </div>
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
            <article id="contact-pharmacie" className={styles.contactCard}><div className={styles.contactCardTop}><span>02 — PHARMACIE</span><ArrowUpRight size={20} aria-hidden="true"/></div><h3>Parlons de votre officine.</h3><p className={styles.cardDescription}>Découvrons les gammes et l’accompagnement adaptés à votre équipe.</p><LeadForm audience="pharmacy" /></article>
          </div>
        </div>
      </section>
    </main>
  );
}
