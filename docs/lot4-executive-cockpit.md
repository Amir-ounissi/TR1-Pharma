# Lot 4 — Executive Cockpit

## Objectif
Donner à la direction d’une marque une lecture condensée et déterministe de la trajectoire commerciale, sans dupliquer les calculs métier déjà présents dans TR1.

## Indicateurs couverts
- CA facturé YTD
- comparaison à période équivalente N-1
- projection de fin d’exercice par run-rate déterministe
- objectif annuel et taux d’atteinte
- implantations
- réassorts
- taux de premier réassort
- pharmacies actives
- DN moyenne et DN stratégique
- comptes à risque / dormants / stratégiques sans action
- alertes explicables
- top priorités commerciales avec accès direct à la fiche pharmacie

## Source de vérité
Le cockpit réutilise les RPC de performance et de santé commerciale existantes (`get_performance_overview`, `get_objective_progress`, `get_commercial_priorities`). Aucun calcul opaque ou LLM n’intervient dans les chiffres affichés.

## Accès
La route `/dashboard/executive` est protégée par la capacité SaaS `executive_cockpit` et réservée aux rôles de pilotage marque. Le Lot 11 pourra ensuite différencier plus finement le parcours Direction du parcours Manager.

## Validation
- tests unitaires des périodes YTD/N-1, variations, projections et alertes
- E2E sur le rendu du cockpit pour un `brand_admin`
- E2E vérifiant qu’un agent ne voit pas l’entrée de navigation
- CI GitHub comme source de validation tant que la limite de déploiement Vercel est atteinte
