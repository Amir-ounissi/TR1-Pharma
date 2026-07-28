# Sprint 6 — Agent Experience Foundation

## Parcours livré

- `Ma journée` privilégie la prochaine visite, les retards, missions, relances et rapports incomplets.
- La carte de visite expose fiche, appel, Waze, Google Maps et démarrage sans menu secondaire.
- La fiche pharmacie propose un header terrain et limite les historiques chargés à 12 événements, 10 commandes et 10 changements d’activité.
- L’interaction rapide crée atomiquement l’interaction et sa prochaine tâche.
- L’absence de prochaine action exige une justification.
- Les brouillons d’interaction et de rapport sont conservés dans `localStorage`, restaurés après navigation et supprimés après succès.
- Les largeurs 375, 390 et 430 px sont couvertes par Playwright.

## Migration

`supabase/migrations/20260727075737_sprint_6_agent_experience.sql` ajoute :

- le statut, la date et la source du géocodage ;
- la table privée `product_events` avec métadonnées JSON limitées à 4 Ko ;
- les RPC `track_product_event`, `search_authorized_pharmacies`, `get_field_pharmacy_summary`, `get_agent_today`, `get_next_agent_visit` et `create_agent_task`.

Les clients authentifiés n’ont aucun droit d’écriture direct sur `product_events`. Les RPC recalculent l’utilisateur, l’organisation et la marque depuis le contexte autorisé.

## Reconstruction

```sh
npm run db:start
npm run db:rebuild:sandbox
npm run db:test
```

## Instrumentation

Événements disponibles :

- `agent_dashboard_viewed`
- `pharmacy_opened`
- `navigation_waze_clicked`
- `navigation_maps_clicked`
- `interaction_started`
- `interaction_submitted`
- `next_action_created`
- `task_completed`
- `mission_opened`
- `report_started`
- `report_submitted`

## Dette technique

- Aucun géocodeur externe n’est branché : les coordonnées existantes sont utilisées, sinon les helpers passent l’adresse normalisée aux applications de navigation.
- La proximité n’est utilisée par le tri que lorsque les distances sont déjà disponibles ; aucune optimisation de tournée n’est implémentée.
- `images.unoptimized=true` reste obligatoire jusqu’à une version compatible de Sharp supérieure ou égale à 0.35.0.
- Les brouillons sont locaux à l’appareil et ne constituent pas un mode hors ligne complet.

## Validation finale

- reconstruction locale : 6 migrations et seed appliqués ;
- pgTAP : 228/228 ;
- Vitest : 31/31 ;
- E2E : 6/6, dont Agent Day desktop et mobile ;
- db lint : aucune erreur ;
- db advisors : aucun problème ;
- lint et build : réussis ;
- Security Gate : `/_next/image` reste désactivé et testé ;
- audit npm runtime : nouvelle tentative bloquée par `ENOTFOUND registry.npmjs.org`. Aucun paquet ni lockfile n’a été modifié pendant le Sprint 6 ; la qualification Sharp documentée dans `docs/security-gate-sprint5.md` reste inchangée.
