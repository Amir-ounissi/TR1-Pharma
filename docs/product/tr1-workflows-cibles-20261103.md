# TR1 PHARMA — processus métier cibles (novembre 2026)

## Décision produit

TR1 PHARMA est l'outil de travail de l'agence commerciale d'Amir Ounissi. Ce n'est pas un logiciel SaaS vendu à des équipes externes.

Trois parcours doivent rester compréhensibles :

1. **TR1 (propriétaire)** : un cockpit multimarque mobile pour gérer officines, commandes, prestations, suivis et rentabilité.
2. **Marque partenaire** : tableau de suivi de ses seules données, **lecture seule** au lancement.
3. **Pharmacie** : un prospect consulte librement les marques et demande une implantation ; une pharmacie cliente peut transmettre une **demande de réassort**, à confirmer par TR1 et la marque.

## Invariants de données et sécurité

- Une officine physique ne doit exister qu'une fois dans le référentiel, identifiée par ses informations administratives vérifiées.
- Chaque relation **marque × officine** garde ses conditions commerciales, commandes, produits, prestations et résultats propres.
- Une marque ne lit jamais les données d'une autre marque, ni les marges, commissions ou contrats internes de TR1.
- Les rôles et RLS actuels sont conservés. Les nouveaux accès partenaires passent par une invitation contrôlée ; le rôle `brand_direction` sert de point de départ en consultation.
- Un prospect n'a pas besoin de compte pour regarder les marques. Les conditions commerciales détaillées ne sont pas publiques.
- Les demandes publiques sont des **demandes**, jamais des commandes acceptées. Aucune commande, commission, facture ou intervention n'est créée automatiquement depuis un simple formulaire.
- Ne jamais importer des données confidentielles de Naali dans l'environnement TR1 PHARMA.

## Circuit 1 — Prospection et implantation

**Entrée :** une visite, un appel, une demande du site ou un contact groupement.

1. Retrouver ou créer l'officine unique, avec contact et origine de l'opportunité.
2. La rattacher à une marque avec statut prospect, responsable et prochaine action.
3. Enregistrer la présentation, les conditions proposées, puis la validation commerciale.
4. Préparer l'implantation et la transmettre à la marque selon le mandat.
5. Ne considérer l'implantation réalisée qu'après l'événement contractuellement retenu (confirmation, livraison ou facturation suivant la marque).
6. Déclencher alors le suivi sell-out et la prévision du premier réassort.

**Mesures :** prospects qualifiés, implantations confirmées, délai avant première commande, pharmacies actives.

## Circuit 2 — Demandes de commandes et réassorts

**Entrée :** demande officine (terrain, téléphone, e-mail, portail).

- Distinguer : demande reçue → contrôle TR1 → transmission marque → confirmation marque → livraison/facturation si connue.
- Conserver référence d'origine, date, marque, officine, références, quantités payantes, unités gratuites, offre, remises, notes et justificatifs.
- Dédupliquer et tracer les changements ; ne pas modifier silencieusement une commande déjà confirmée.
- Afficher séparément **CA demandé**, **CA confirmé** et **CA facturé/livré**. Les primes sont calculées selon le mandat, pas simplement à la réception d'une demande.
- Lorsqu'un réassort est probable, proposer une relance ; la proposition n'est pas une commande automatique.

**Mesures :** commandes confirmées, délai de réassort, taux de premier réassort, demandes sans réponse.

## Circuit 3 — Animations et formations

**Entrée :** besoin identifié en pharmacie, proposition de marque ou plan mensuel/trimestriel.

1. Demande de prestation avec objectif, date, officine, marque, coût et intervenant envisagé.
2. Validation explicite du donneur d'ordre et de TR1 **avant** la prestation.
3. Confirmation de l'intervenant et préparation des supports.
4. Réalisation avec rapport horodaté, ventes sorties et justificatifs si disponibles.
5. Rapprochement avec commandes antérieures et postérieures, **sans attribution causale automatique** des réassorts.
6. Contrôle de facture intervenant, facturation à la marque et suivi du règlement.

**Contrôle clé :** une animation non approuvée ne peut pas être comptée comme prestation autorisée ou dépense automatiquement acceptée. Le cas des animations facturées en supplément par Othman sert de test.

**Mesures :** sorties/animation, réassorts après intervention, coût complet, marge par prestation, interventions sans rapport.

## Circuit 4 — Revenus de TR1

- Séparer strictement le chiffre d'affaires vendu par les marques et les revenus propres de TR1.
- Historiser les contrats de représentation (forfait, implantation, palier, commission à la boîte, animation, formation).
- Calculer les montants dus à partir des événements admissibles et des tarifs valides à leur date.
- Suivre distinctement : **à justifier**, **à facturer**, **facturé**, **encaissé**, et coûts engagés.
- Conserver le détail des calculs, notamment les paliers d'implantation rétroactifs quand ils sont contractuellement prévus.

**Mesures :** revenu TR1 acquis, factures à émettre, encours à recevoir, coût intervenants, marge par marque.

## Le quotidien mobile : peu de saisie

- **Le matin :** trois blocs maximum : actions du jour, demandes en attente, alertes de réassort/prestations.
- **Après visite :** sélectionner officine + marque, noter résultat, éventuellement commande/prestation, définir prochaine action. Objectif de saisie : moins d'une minute pour une visite simple.
- **Fin de semaine :** récapitulatif des commandes confirmées, prestations terminées, points bloquants et relances.
- **Fin de mois :** synthèse justifiée des commissions, prestations et factures par marque.

## Mise en œuvre progressive

### Étape 1 — Interface, sans migration

- Simplifier la navigation propriétaire et le site public.
- Créer une entrée pharmacie publique avec demande de présentation/implantation et demande de réassort à confirmer.
- Réutiliser le formulaire public et ses protections anti-abus.
- Garder le portail marque en consultation seule, sur la base des permissions existantes.

### Étape 2 — Fiabiliser les commandes

- Définir les statuts cibles et leur correspondance avec le modèle existant avant toute migration.
- Mettre en place un formulaire de réassort structuré pour clients préalablement vérifiés/invités.
- Relier chaque demande à la bonne relation marque × pharmacie, avec contrôle humain avant transmission.

### Étape 3 — Unifier terrain et prestations

- Cockpit quotidien multimarque, visite rapide, relances et mission complète de l'accord à la facture.
- Pas de double saisie avec les outils connectés : choisir explicitement les sources de vérité par objet.

### Étape 4 — Rentabilité et reporting

- Calcul justifié des commissions et coûts ; tableaux de bord utiles à Amir.
- Espace partenaire limité à ses propres résultats ; aucun accès à la rentabilité interne TR1.

## Critères de validation

1. Le prospect pharmacie peut demander une présentation sans compte.
2. Un client peut transmettre une demande de réassort ; elle ne produit pas de commande confirmée sans contrôle.
3. Amir retrouve l'historique d'une officine sans mélanger les marques.
4. Une marque partenaire ne voit et ne modifie aucune donnée d'une autre marque.
5. Une animation non autorisée n'est jamais considérée comme prestation validée.
6. Aucune prime n'est créée à partir d'une précommande ou d'un simple formulaire si le contrat ne le prévoit pas.
7. Les parcours restent utilisables sur smartphone et ne forcent pas de saisie redondante.

> Ce document décrit les processus cibles. Il ne certifie pas que chaque fonction est déjà livrée.
