"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./pharmacy-illustration.module.css";

const scenes = [
  {
    title: "Implantation",
    short: "Implantation",
    detail: "Présenter la gamme au pharmacien et installer la relation commerciale.",
    image: "/marketing/tr1-parcours-implantation.webp",
    alt: "Un commercial présente une gamme de produits sans marque à une pharmacienne au comptoir.",
  },
  {
    title: "Formation",
    short: "Formation",
    detail: "Transmettre les arguments produits et accompagner les équipes officinales.",
    image: "/marketing/tr1-parcours-formation.webp",
    alt: "Le commercial forme trois membres de l’équipe de la pharmacie autour d’une gamme fictive.",
  },
  {
    title: "Sell-out",
    short: "Sell-out",
    detail: "Soutenir le conseil au comptoir et l’animation commerciale en rayon.",
    image: "/marketing/tr1-parcours-sellout.webp",
    alt: "Une pharmacienne conseille une cliente tandis qu’une mise en avant commerciale a lieu en rayon.",
  },
  {
    title: "Suivi & développement",
    short: "Suivi",
    detail: "Échanger dans le bureau du pharmacien sur les ventes, les réassorts et les prochaines actions.",
    image: "/marketing/tr1-parcours-suivi.webp",
    alt: "Le commercial et le pharmacien se réunissent dans un bureau devant un graphique de suivi des ventes.",
  },
] as const;

const duration = 6000;

export function PharmacyIllustration() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % scenes.length);
    }, duration);
    return () => window.clearInterval(timer);
  }, [playing, active]);

  const goTo = (index: number) => {
    setActive((index + scenes.length) % scenes.length);
  };

  return (
    <div className={styles.carousel} role="region" aria-roledescription="carrousel" aria-label="Les quatre étapes de l’accompagnement commercial">
      <div className={styles.heading}>
        <span>LE PARCOURS TERRAIN</span>
        <span className={styles.counter}>{String(active + 1).padStart(2, "0")} / 04</span>
      </div>

      <div className={styles.stage}>
        {scenes.map((scene, index) => (
          <div
            key={scene.image}
            className={index === active ? `${styles.slide} ${styles.visible}` : styles.slide}
            aria-hidden={index !== active}
          >
            <Image
              src={scene.image}
              alt={scene.alt}
              fill
              sizes="(max-width: 820px) 460px, (max-width: 1300px) 45vw, 580px"
              priority={index === 0}
              className={styles.image}
            />
          </div>
        ))}
      </div>

      <div className={styles.caption} aria-live={playing ? "off" : "polite"} aria-atomic="true">
        <div>
          <h3>{scenes[active].title}</h3>
          <p>{scenes[active].detail}</p>
        </div>
        <span className={styles.largeIndex} aria-hidden="true">{String(active + 1).padStart(2, "0")}</span>
      </div>

      <div className={styles.progress} aria-hidden="true">
        <div key={`${active}-${playing}`} className={playing ? styles.progressRunning : styles.progressStopped} />
      </div>

      <div className={styles.footer}>
        <div className={styles.steps} role="group" aria-label="Choisir une étape">
          {scenes.map((scene, index) => (
            <button
              key={scene.short}
              type="button"
              onClick={() => goTo(index)}
              className={index === active ? `${styles.step} ${styles.selected}` : styles.step}
              aria-label={`Afficher l’étape ${index + 1} : ${scene.short}`}
              aria-pressed={index === active}
            >
              <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <span>{scene.short}</span>
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          <button type="button" aria-label="Scène précédente" onClick={() => goTo(active - 1)}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" aria-label={playing ? "Mettre en pause" : "Reprendre la lecture"} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause size={14} fill="currentColor" aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}
          </button>
          <button type="button" aria-label="Scène suivante" onClick={() => goTo(active + 1)}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
