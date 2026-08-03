# Sprint 12.2A — Stabilité du parcours commande

## Référence

- Scénario : `e2e/critical.spec.ts`.
- Exécution initiale : 10 répétitions, sans retry.
- Résultat initial : 8 réussies, 2 échouées.
- Échecs : retour bloqué après création de pharmacie ou de commande, bouton restant en état pending.

## Cause racine

Les identifiants de test sont uniques et les tests sont séquentiels. Les deux écritures correspondant aux échecs ont été retrouvées commitée en PostgreSQL. Après le RPC réussi, les actions exécutaient uniquement des invalidations `revalidatePath` sur des pages authentifiées déjà dynamiques. Ces invalidations redondantes empêchaient occasionnellement la réponse Server Action de revenir, alors que la transaction métier était terminée.

## Correctif

- Retrait des invalidations redondantes après création de pharmacie et de commande.
- Authentification Admin et Agent réalisée une seule fois dans `beforeAll`, puis réutilisation de storage states isolés pour chaque répétition afin de ne pas provoquer de rafale de connexions Supabase.
- Conservation des assertions UI et des contrôles de données.
- Playwright configuré avec `retries: 0` en local et en CI.
- Traces conservées à chaque échec avec `trace: retain-on-failure`.

## Preuve finale

- Scénario ciblé : 10/10 réussites consécutives, sans retry, en 11,3 minutes.
- Suite complète 1 : 45/45 réussites, sans retry, sur base reconstruite, en 9,2 minutes.
- Suite complète 2 : 45/45 réussites, sans retry, sur base reconstruite, en 14,0 minutes.
- Suite complète 3 : 45/45 réussites, sans retry, sur base reconstruite, en 13,3 minutes.
- Total de la preuve : 145/145 exécutions Playwright réussies sans retry.

## Risques restants

Aucun risque fonctionnel identifié sur ce scénario. La durée de la suite complète reste élevée, mais aucun timeout arbitraire, aucune assertion réduite et aucun retry ne masquent le résultat.
