import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, GraduationCap, Handshake, MapPin, PackageCheck, RefreshCw, Store, Users } from "lucide-react";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingPageEvent, MarketingTrackedLink } from "@/components/marketing/marketing-events";
import { RecoveryHashRedirect } from "@/components/auth/recovery-hash-redirect";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "TR1 Pharma | Développement commercial terrain en pharmacie",
  description: "TR1 Pharma accompagne les marques en pharmacie, du sell-in au sell-out : prospection, implantation, activation, formation, animation et suivi terrain.",
};

const brandActions = [
  ["Prospection ciblée", "Identifier et approcher les officines pertinentes pour la marque.", Store],
  ["Implantation", "Construire l’entrée en pharmacie et développer les références adaptées.", PackageCheck],
  ["Réassort", "Suivre les commandes, les stocks disponibles et les prochaines actions commerciales.", RefreshCw],
  ["Activation", "Former les équipes, coordonner les animations et soutenir la visibilité en officine.", GraduationCap],
  ["Pilotage", "Tracer les actions terrain et restituer les indicateurs réellement disponibles.", BarChart3],
] as const;

const method = [
  ["01", "Sélectionner", "Cibler les pharmacies cohérentes avec le positionnement, la catégorie et le potentiel de la marque."],
  ["02", "Implanter", "Présenter la gamme, construire l’assortiment et accompagner la première commande."],
  ["03", "Activer", "Former, animer, travailler la visibilité et donner à l’équipe officinale les moyens de conseiller."],
  ["04", "Suivre", "Revenir sur les commandes, réassorts, actions réalisées et ventes lorsqu’elles sont effectivement mesurées."],
] as const;

export default function LandingPage() {
  return (
    <main className="bg-transparent text-[#0b1e32]">
      <RecoveryHashRedirect />
      <MarketingPageEvent event="landing_view" />

      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroBadge}><MapPin size={14} /> PACA · Gard · Hérault</div>
          <h1>Développez votre marque <span>en pharmacie.</span></h1>
          <p className={styles.heroPromise}>Du sell-in au sell-out.</p>
          <p className={styles.heroIntro}>TR1 PHARMA est un partenaire commercial terrain multimarque. Nous ouvrons les bonnes portes, accompagnons l’implantation et organisons les actions qui font vivre une gamme dans la durée.</p>
          <div className={styles.heroChoices}>
            <MarketingTrackedLink event="primary_cta_click" href="#marques" properties={{ placement: "hero_brand" }} className={styles.primaryCta}>Je représente une marque <ArrowRight size={17} /></MarketingTrackedLink>
            <MarketingTrackedLink event="primary_cta_click" href="#pharmacies" properties={{ placement: "hero_pharmacy" }} className={styles.secondaryCta}>Je suis pharmacien <ArrowRight size={17} /></MarketingTrackedLink>
          </div>
          <p className={styles.heroNote}>Une exécution terrain structurée. Pas une promesse de sell-out garanti.</p>
        </div>
      </section>

      <section className={styles.brandSection} id="marques">
        <div className={styles.container}>
          <div className={styles.splitHeading}>
            <div><p className={styles.eyebrow}>Pour les marques</p><h2>Votre développement ne s’arrête pas au bon de commande.</h2></div>
            <p>TR1 PHARMA prend en charge l’exécution commerciale locale : de la prospection jusqu’au suivi après implantation, avec un interlocuteur terrain et une lecture claire des actions menées.</p>
          </div>
          <div className={styles.actionGrid}>
            {brandActions.map(([title, copy, Icon]) => <article key={title} className={styles.actionCard}><Icon size={20} /><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
          <div className={styles.platformStrip}><div><strong>La plateforme soutient le terrain.</strong><span>Visites, missions, animateurs, formateurs et reporting sont organisés au même endroit.</span></div><Link href="/connexion">Accès plateforme <ArrowRight size={15} /></Link></div>
        </div>
      </section>

      <section className={styles.pharmacySection} id="pharmacies">
        <div className={[styles.container, styles.pharmacyGrid].join(" ")}>
          <div><p className={styles.eyebrow}>Pour les pharmacies</p><h2>Des marques choisies pour votre officine. Un suivi après l’implantation.</h2><p className={styles.sectionCopy}>L’objectif n’est pas d’empiler des références. Nous présentons des marques que nous estimons cohérentes avec votre officine et restons identifiés pour la suite.</p></div>
          <div className={styles.pharmacyBenefits}>
            <div><Handshake size={20} /><p><strong>Un interlocuteur identifié</strong><span>Pour la présentation, l’implantation et le suivi commercial.</span></p></div>
            <div><Store size={20} /><p><strong>Une sélection ciblée</strong><span>Des propositions adaptées au profil de l’officine, pas un catalogue généraliste.</span></p></div>
            <div><Users size={20} /><p><strong>Un accompagnement terrain</strong><span>Formation, animation ou activation lorsque le dispositif de la marque le prévoit.</span></p></div>
          </div>
        </div>
      </section>

      <section className={styles.methodSection} id="methode">
        <div className={styles.container}>
          <p className={styles.eyebrow}>La méthode TR1</p><h2>Sélectionner → Implanter → Activer → Suivre.</h2>
          <div className={styles.methodGrid}>{method.map(([number, title, copy]) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
          <p className={styles.dataNote}><Check size={16} /> Les commandes et réassorts sont distingués des ventes consommateur. Le sell-out n’est présenté que lorsqu’une donnée de vente est réellement disponible.</p>
        </div>
      </section>

      <section className={styles.proofSection} id="terrain">
        <div className={[styles.container, styles.proofGrid].join(" ")}>
          <div><p className={styles.eyebrow}>Le terrain, documenté</p><h2>Voir le travail, pas une promesse marketing.</h2></div>
          <div className={styles.proofCard}><p>Implantations, merchandising, formations, animations et réflexions métier sont documentés publiquement par le fondateur sur LinkedIn.</p><a href="https://fr.linkedin.com/in/amirounissi" target="_blank" rel="noreferrer">Voir les contenus LinkedIn <ArrowRight size={16} /></a><small>Ces contenus illustrent une expérience terrain personnelle et ne sont pas présentés comme des références clients de TR1 PHARMA.</small></div>
        </div>
      </section>

      <section className={styles.contactSection} id="contact">
        <div className={styles.container}>
          <div className={styles.contactHeading}><p className={styles.eyebrow}>Prendre contact</p><h2>Deux besoins. Deux échanges différents.</h2></div>
          <div className={styles.contactGrid}>
            <article id="contact-marque" className={styles.contactCard}><div><span className={styles.contactTag}>Marque / laboratoire</span><h3>Vous voulez développer votre présence en pharmacie ?</h3><p>Présentez-nous votre marque et votre besoin terrain. Nous revenons vers vous pour qualifier le périmètre.</p></div><LeadForm audience="brand" /></article>
            <article id="contact-pharmacie" className={styles.contactCard}><div><span className={styles.contactTag}>Pharmacie</span><h3>Vous souhaitez découvrir les marques accompagnées ?</h3><p>Laissez vos coordonnées et le nom de votre officine. Nous vous recontactons directement.</p></div><LeadForm audience="pharmacy" /></article>
          </div>
        </div>
      </section>
    </main>
  );
}
