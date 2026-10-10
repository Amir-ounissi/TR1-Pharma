# TR1 Pharma — Agent Commercial +++ (phase 1)

**Décision produit : 10 octobre 2026.** TR1 Pharma est l'outil de travail d'un **seul agent commercial opérateur**. L'agent travaille pour plusieurs marques et coordonne des intervenants indépendants (animateurs, formateurs). TR1 est l'interface de travail commune **sans devenir un SaaS commercialisé aux marques ou à d'autres agents à ce stade**.

## Contrat produit

Le succès se mesure au **temps de saisie économisé**, à la **fiabilité des commandes**, au **suivi des réassorts/sell-out**, à la **qualité d'exécution des animations** et à la **marge réelle de chaque prestation**, pas au nombre de comptes SaaS créés.

Trois liens à coordonner :

1. **Agent ↔ pharmacies** : prospection, visites, commandes, merchandising, formation, sell-out, suivi.
2. **Agent ↔ marques** : portefeuille et conditions propres à la marque, commandes, rapports, conventions, facturation, paiements, commissions.
3. **Agent ↔ intervenants ↔ marques** : sollicitation, disponibilité, briefing, affectation, exécution, justificatifs, résultats et paiement.

### Règle d'accès

- L'agent propriétaire garde la vue opérationnelle globale.
- Chaque marque n'accède qu'à ses données et livrables autorisés, **jamais** aux éléments confidentiels des autres marques.
- Un intervenant n'accède qu'à ses propres missions et documents utiles.
- Les pharmacies physiques sont dédupliquées ; les relations commerciales, produits, prix et commandes restent **scopées par marque**.
- Toutes les actions externes engageantes (commande transmise, email envoyé, facture validée, mission affectée) nécessitent une confirmation ou une règle explicitement autorisée.
- **Ne pas retirer les RLS, les clés inter-tenant ou les journaux d'audit pour simplifier l'interface.**

## Interface cible

**Accueil : Mon cockpit** est l'entrée principale de l'agent terrain, sur mobile et desktop.

- **Aujourd'hui** : visites et relances de toutes les marques autorisées, commandes à terminer, missions en attente de réponse/rapport, alertes de réassort ; consolidation multimarque explicite. Les liens vers une autre marque activent son contexte après vérification d'accès.
- **Commercial** : pharmacies, agenda, commandes, produits et conditions, performances **avec filtre de marque**.
- **Interventions** : animations/formation, intervenants, documents, calendrier, preuves, sell-out, coûts et statut de facturation.
- **Mes revenus** (à construire) : contrats marques (forfait + commission, implantation/réassort, prestations), commissions dues, coût des intervenants, facturation et rentabilité par marque.
- **Assistant** : consultation du contexte TR1, préparation des actions, puis validation humaine avant écriture ou envoi.

Pour les premières itérations, conserver les routes et permissions existantes ; fournir des accès directs depuis le cockpit. Ne pas annoncer une IA générale : le moteur actuel est essentiellement déterministe. Le connecteur ChatGPT est encore en projet.

## Déjà utilisable ou présent en code

| Domaine | Constat actuel | Travail restant |
| --- | --- | --- |
| CRM, officines, visites, commandes, multimarque | Développés avec données de production | Fiabilité et parcours plus courts |
| HubSpot | Synchronisations entrantes et sortantes existantes | Anomalie de fraîcheur du rapprochement entrant à corriger |
| Missions, animateurs/formateurs, factures d'animation | Modèles et interfaces présents | Parcours complet réel demande → paiement à tester |
| Sell-out et documents de preuve | Modèles et interfaces présents | Adoption et qualité des données à valider |
| Assistant terrain | Brouillons, RPC contrôlées et moteur à règles | Extension conversationnelle, outils et consentements |
| Comptabilité de l'agent / commissions | Pas de module métier complet identifié | Concevoir calculs, justificatifs, contrats et rapprochements |
| Portail SaaS et administration multi-agents | Fonctionnalités historiques présentes | Mettre en arrière-plan, ne pas supprimer sans audit |

## Priorités de livraison

### P0 — Avant toute complexification

1. Restaurer et surveiller le rapprochement **HubSpot inbound** ; comparer les dernières synchronisations réussies des commandes et visites.
2. Expliquer la dérive de schéma staging/production ; bloquer une release si la validation d'intégrité n'est pas probante.
3. Revoir les RPC `SECURITY DEFINER` accessibles aux comptes authentifiés ; réviser les permissions sensibles avec tests RLS.
4. Tester sur mobile la commande, les visites et le circuit mission. **Aucune migration destructive.**

### P1 — Flux de travail personnel

1. **Cockpit** : actions fréquentes immédiatement visibles, navigation terrain prioritaire, résumé des visites/priorités sur toutes les marques autorisées et CA commandé HT séparé par marque. *Première version dans cette branche.*
2. **Missions** : demande d'animation ou formation, affectation, acceptation, rapport, preuve, sell-out, facture prestataire.
3. **Prestations de l'agent** : référentiel marque/contrat/territoire/conditions. Examiner la PR #308 sans la merger telle quelle.
4. **Revenus** : séparer CA des marques, commissions TR1, montants facturables et coûts externes. Conserver des taux historisés pour éviter de recalculer le passé avec les nouveaux tarifs.

### P2 — Assistant et automatisation

1. Finaliser les trois lectures ChatGPT de la PR #340, uniquement après validation OAuth et isolation en staging.
2. Ajouter des outils métier **bornés**, contrôlés et auditables : préparer visite/commande, créer mission, générer compte rendu, lancer relance.
3. Ajouter voix/photos et mode hors ligne après stabilisation des parcours principaux.
4. Produire des synthèses et bilans marques sans exposer leurs données croisées.

## Ce qu'on ne développe pas en phase 1

- Vente d'abonnements SaaS, gestion des quotas et acquisition de clients logiciels.
- Marketplace d'agents ou de prestataires.
- Gestion de plusieurs commerciaux internes.
- Tableaux de bord direction destinés à des équipes de marque entières, sauf livrables nécessaires pour rendre compte à une marque.

**Ne pas supprimer ces modèles en base** : ils peuvent être utiles plus tard et certains sont liés à des permissions existantes. L'objectif immédiat est une **priorisation d'expérience**, pas une réécriture des fondations.

## Critères de validation terrain

1. En sortie d'officine, enregistrer une visite et une commande par marque sans doublon, avec statut de synchronisation explicite.
2. Déclencher une demande d'animation depuis la pharmacie et suivre jusqu'au rapport, aux sorties et à la facture.
3. Consulter la journée multimarque sans confondre CA d'une marque et CA consolidé.
4. Préparer une action depuis l'assistant sans écriture externe silencieuse.
5. Produire un état des montants dus par marque (commission + prestation) et des coûts intervenants après implémentation du module financier.
6. Ne jamais laisser une marque consulter un contrat, des prix ou une commande d'une autre marque.

## Limites de ce premier changement

Cette branche ne touche **ni à la base Supabase ni aux workflows Vercel**, aux droits, au tarifage ou au connecteur ChatGPT. Elle recentre l'entrée terrain, affiche les activités de toutes les marques dont l'agent a le rôle approprié, et présente le CA commandé HT mensuel par marque avec un filtrage serveur explicite. Les changements de contexte utilisent les routes existantes avec vérification de l'appartenance ; aucune commission n'est extrapolée à partir du CA. L'intégration en production reste soumise aux tests GitHub CI, aux contrôles P0 et à une release explicitement autorisée.
