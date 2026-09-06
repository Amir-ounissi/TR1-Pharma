# Lot 11 — Direction Workspace

## Objectif

Distinguer explicitement le pilotage Direction du pilotage Manager et des opérations terrain.

## Périmètre

- rôle `brand_direction` dédié ;
- accès marque en lecture sans héritage des permissions opérationnelles élevées ;
- capacité SaaS `direction_workspace` obligatoire ;
- route dédiée `/dashboard/direction` ;
- trajectoire YTD, comparaison N-1, atterrissage déterministe, objectif annuel et écart ;
- DN moyenne et stratégique ;
- implantations, réassorts, comptes actifs / à risque / dormants ;
- comparaison des territoires ;
- aucune action de création de commande, tâche, mission, pharmacie ou utilisateur dans l’espace Direction.

## Sécurité

Le rôle Direction n’est volontairement pas ajouté à `private.has_elevated_brand_access`, car ce helper protège aussi des opérations d’écriture. Le workspace utilise un RPC dédié, brand-scoped et capability-gated, avec contrôle explicite du rôle avant l’agrégation des données.

## Validation

- tests unitaires de navigation ;
- pgTAP pour le rôle, l’isolation et l’accès RPC ;
- Playwright pour l’atterrissage Direction et l’absence de navigation opérationnelle.

Ce lot reste empilé sur Lot 10 tant que les branches précédentes ne sont pas fusionnées dans `main`.
