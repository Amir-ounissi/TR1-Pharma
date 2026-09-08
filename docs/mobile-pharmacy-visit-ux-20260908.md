# Mobile pharmacy visit UX — 2026-09-08

## Objectif

Corriger les débordements visibles sur iPhone dans la fiche pharmacie et rendre l’ajout d’une visite immédiatement accessible depuis `Ma journée`.

## Changements

- CTA `Ajouter une visite` visible sous le bloc de journée pour les profils disposant du CRM terrain ;
- le CTA ouvre l’Agenda, qui reste la source de vérité pour créer une visite complète ;
- nom de pharmacie limité proprement à deux lignes sur mobile ;
- `Appeler` et `Maps` restent côte à côte, `Historique` passe en pleine largeur ;
- navigation des sections pharmacie réorganisée en grille mobile 3 colonnes, sans débordement horizontal ;
- aucun changement de schéma, de données, de workflow de démarrage/clôture de visite ou d’application Expo.

## Non-régression

Le bouton `Visite` existant de la fiche pharmacie conserve sa logique actuelle : planification si aucune visite n’existe, démarrage si une visite est planifiée, clôture si elle est en cours.
