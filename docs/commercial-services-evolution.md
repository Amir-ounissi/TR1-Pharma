# TR1 Pharma — évolution vers un opérateur de développement commercial

## Positionnement

TR1 Pharma n'est plus pensé uniquement comme un logiciel vendu à une marque.

TR1 Pharma devient un partenaire de développement commercial en pharmacie :

> **TR1 Pharma — Du sell-in au sell-out.**
>
> Votre partenaire commercial pour implanter votre marque, accompagner vos pharmacies et coordonner les actions qui soutiennent les ventes.

La plateforme TR1 reste le moteur d'exécution propriétaire utilisé pour délivrer, tracer et piloter ces prestations.

## Principe d'architecture

La hiérarchie cible devient :

```
TR1 Pharma (prestataire)
  → Client
    → Marque
      → Prestation commerciale
        → Secteur / territoires
        → Équipe
        → Pharmacies
        → Actions terrain
        → Résultats
```

Les objets existants restent en place :

- `organizations` : société cliente ou TR1 Pharma ;
- `brands` : marque commerciale ;
- `pharmacies` / `brand_pharmacies` : réseau officinal ;
- `orders` : sell-in ;
- `field_visits` : visites commerciales ;
- `missions` : actions terrain ponctuelles (animation, formation, merchandising, etc.) ;
- sell-out, tâches, interactions et reporting : exécution opérationnelle.

La nouvelle couche `commercial_engagements` représente le mandat / projet commercial confié à TR1 Pharma. Elle ne remplace pas les `missions` terrain.

## Phase 1 — Fondation non destructive

Cette phase ajoute uniquement :

- `commercial_engagements` ;
- `commercial_engagement_members` ;
- `commercial_engagement_territories` ;
- `commercial_engagement_objectives` ;
- une vue administrateur **Prestations commerciales** ;
- la création d'une prestation depuis une marque existante.

Les objets opérationnels ne reçoivent pas encore de `commercial_engagement_id`. Le cockpit actuel continue donc de fonctionner sans changement de comportement.

## Phase 2 — Cockpit de prestation

Objectif : entrer dans TR1 par une prestation, puis retrouver le cockpit de la marque.

À ajouter :

- contexte actif de prestation ;
- page détail avec période, secteur, équipe et objectifs ;
- KPI d'exécution : visites, implantations, commandes, CA, réassorts, formations, animations ;
- rattachement nullable des visites, commandes et missions à une prestation ;
- règles de rétrocompatibilité pour l'historique.

## Phase 3 — Portail client

Le client marque doit pouvoir suivre uniquement son périmètre :

- activité terrain ;
- couverture du secteur ;
- implantations ;
- sell-in ;
- réassorts ;
- formations et animations ;
- preuves terrain ;
- comptes à risque ;
- synthèses périodiques.

Le portail client ne doit pas exposer les données des autres marques ni les informations internes TR1.

## Phase 4 — Économie de la prestation

À développer seulement après validation terrain du modèle :

- forfait / jours terrain / variable ;
- coûts intervenants ;
- facturation de la prestation ;
- marge par mission commerciale ;
- contrats et renouvellements.

TR1 ne doit pas devenir un ERP d'agence avant que le modèle de prestation soit validé.

## Décision structurante

La base existante avait déjà la bonne séparation :

- `brands.organization_id` = organisation cliente propriétaire de la marque ;
- `brands.managed_by_organization_id` = organisation opératrice.

En production, Naali et VK SWISS sont déjà configurées comme marques clientes gérées par l'organisation **TR1 Pharma**. La nouvelle approche exploite donc un principe déjà présent dans l'architecture au lieu de le remplacer.
