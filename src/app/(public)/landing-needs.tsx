"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import styles from "./landing.module.css";

const needs = [
  {
    id: "launch",
    label: "Je lance ma marque",
    kicker: "Lancement",
    title: "Créer les premiers points de vente avec une méthode terrain claire.",
    copy: "On part du positionnement, de la zone et du profil d'officine recherché pour organiser la prospection et les premiers rendez-vous.",
    actions: ["Ciblage des officines", "Prospection et rendez-vous", "Premières implantations", "Suivi des retours terrain"],
  },
  {
    id: "grow",
    label: "Je veux développer une zone",
    kicker: "Développement régional",
    title: "Donner plus de rythme à un territoire déjà ouvert.",
    copy: "On priorise les comptes, organise les tournées et travaille les opportunités de réassort, de réactivation ou d'extension de gamme.",
    actions: ["Priorisation du portefeuille", "Tournées terrain", "Réassort et réactivation", "Lecture des prochaines actions"],
  },
  {
    id: "activate",
    label: "Je veux activer après implantation",
    kicker: "Activation",
    title: "Faire vivre la gamme après son arrivée en officine.",
    copy: "Selon le dispositif prévu par la marque, TR1 coordonne les actions utiles pour aider l'équipe officinale à connaître, voir et conseiller la gamme.",
    actions: ["Formation équipe", "Animation", "Merchandising", "Suivi après activation"],
  },
] as const;

export function LandingNeeds() {
  const [activeId, setActiveId] = useState<(typeof needs)[number]["id"]>("launch");
  const active = needs.find((need) => need.id === activeId) ?? needs[0];

  return (
    <section className={styles.needsSection} id="besoins">
      <div className={styles.container}>
        <div className={styles.needsHeading}>
          <div>
            <p className={styles.eyebrow}>Selon votre situation</p>
            <h2>Le terrain ne commence pas au même endroit pour tout le monde.</h2>
          </div>
          <p>Choisissez votre point de départ. L'accompagnement s'adapte au niveau de maturité de votre développement en pharmacie.</p>
        </div>

        <div className={styles.needsControls} role="tablist" aria-label="Besoins de développement">
          {needs.map((need) => (
            <button
              key={need.id}
              type="button"
              role="tab"
              aria-selected={activeId === need.id}
              className={[styles.needButton, activeId === need.id ? styles.needButtonActive : ""].join(" ")}
              onClick={() => setActiveId(need.id)}
            >
              {need.label}
            </button>
          ))}
        </div>

        <div className={styles.needPanel} role="tabpanel">
          <div className={styles.needPanelMain}>
            <span>{active.kicker}</span>
            <h3>{active.title}</h3>
            <p>{active.copy}</p>
            <a href="#contact-marque" className={styles.needPanelCta}>
              En parler avec TR1 <ArrowRight size={15} />
            </a>
          </div>
          <div className={styles.needPanelAside}>
            <strong>Ce que cela peut couvrir</strong>
            <ul>
              {active.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
