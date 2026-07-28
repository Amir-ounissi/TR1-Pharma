# Sprint 9 — Pilotage commercial et réassort

## Modèle

La vue RLS `commercial_account_health` consolide un compte par couple marque–pharmacie. Les composants utilisent exclusivement les RPC `get_commercial_dashboard`, `get_commercial_priorities`, `get_commercial_health` et `get_agent_reorder_opportunities`.

Une commande contribue à l’activité seulement si son statut satisfait `private.order_counts_for_activity`. Le chiffre d’affaires suit `private.order_counts_for_revenue` : les brouillons, commandes annulées ou remboursées sont exclus, tandis que les avoirs finalisés réduisent le CA. Les intervalles nuls ou négatifs, notamment plusieurs commandes le même jour, sont exclus de la cadence.

## Cadence et statuts

- Au moins trois intervalles positifs : médiane.
- Un ou deux intervalles positifs : moyenne.
- Aucun intervalle exploitable : `brand_settings.default_reorder_interval_days`, 60 jours par défaut.
- Premier réassort : seconde commande commerciale valide.
- Date attendue : dernière commande + cadence représentative.

| Situation | Statut |
| --- | --- |
| Aucune commande valide | `insufficient_history` |
| Première commande depuis 0 à 7 jours | `newly_implanted` |
| Première commande avant J-53 | `awaiting_first_reorder` |
| Première commande entre J-53 et J-60 | `reorder_due_soon` |
| Retard après la cible et jusqu’à 1,35 × la cible | `reorder_overdue` |
| Retard supérieur à 1,35 × la cible | `at_risk` |
| Retard supérieur à 2 × la cible | `dormant` |
| Compte récurrent à moins de 7 jours de sa cadence | `reorder_due_soon` |
| Compte récurrent dans sa cadence | `reorder_expected`, ou `healthy` à partir de quatre commandes |

Les valeurs 7, 60, 1,35 et 2 sont configurables par marque. Les frontières sont évaluées dans cet ordre afin de rester déterministes.

## Priorité

Le score est borné entre 0 et 100. Il additionne :

- statut : dormant 50, à risque 42, retard 34, bientôt attendu 22, premier réassort attendu 18, nouvellement implanté 10 ;
- absence de prochaine action : 18 ;
- priorité stratégique : 12 ;
- potentiel très élevé : 12, élevé : 8 ;
- baisse forte de CA : 12, baisse : 7.

Les motifs exposés reprennent chaque contribution. La recommandation découle du statut et de l’existence d’une prochaine action ; aucune IA ni donnée transmise par l’interface ne décide de l’action.

## Tendance de CA

La variation compare le CA des 90 derniers jours aux 90 jours précédents :

- supérieure à +20 % : forte croissance ;
- supérieure à +5 % : croissance ;
- entre -5 % et +5 % inclus : stable ;
- entre -20 % inclus et -5 % : baisse ;
- inférieure à -20 % : forte baisse ;
- période précédente nulle : données insuffisantes.

## Configuration

`brand_settings` contient :

- `default_reorder_interval_days` ;
- `first_reorder_target_days` ;
- `reorder_due_soon_days` ;
- `at_risk_multiplier` ;
- `dormant_multiplier` ;
- `reorder_eligibility_days`.

Seuls `tr1_manager` et `brand_admin` peuvent modifier ces seuils via `update_commercial_health_settings`. L’agent ne peut ni lire le dashboard manager ni modifier ces réglages.

## Sécurité et actions

La vue utilise `security_invoker=true`. Les RPC conservent la portée RLS de l’appelant. Un agent ne reçoit que les comptes qui lui sont affectés, avec un maximum de cinq opportunités. Une autre marque ne peut ni lire la santé du compte ni forger un identifiant de marque ou de pharmacie.

La relance n’est créée qu’après confirmation explicite. L’action serveur recharge le compte autorisé, vérifie la marque active, recalcule titre, priorité et description, puis appelle le RPC existant `create_agent_task`. Les champs cachés ne sont jamais une source d’autorisation.

## Performance

La vue agrège commandes, actions, interactions et missions en une requête SQL. L’index `missions_health_relation_idx` accélère la dernière mission par compte ; les index existants couvrent commandes, tâches et interactions. La liste manager est limitée à 500 lignes et l’espace agent à cinq lignes. Une matérialisation pourra être évaluée seulement avec des volumes réels et des mesures démontrant un besoin.

## Validation

- pgTAP : seuils, médiane/moyenne/fallback, commandes non finalisées, premier réassort, score, recommandations, configuration et RLS.
- Vitest : règles pures, frontières exactes, tendances, intervalles du même jour et préremplissage de relance.
- E2E : parcours manager, conversion au premier réassort, parcours agent, données finales et contournements d’accès.

Les captures sont produites dans `artifacts/sprint9/`.

## Risques ouverts

`npm audit --json` reste inaccessible dans l’environnement de validation avec `getaddrinfo ENOTFOUND registry.npmjs.org`. Le Sprint 9 n’ajoute ni ne met à jour aucune dépendance npm ; il n’introduit donc aucun changement de l’arbre runtime validé au gate précédent. L’audit doit être rejoué dès que le registre npm est accessible.
