# VK Swiss — Preflight Phase 0

_Date_: 2026-08-21  
_Branch_: `release/sprint-12-2a-pilot-gate-closure`  
_HEAD observé au début de la recovery_: `79f81af35c0a8c3e8d8203b7a308e9b2acbeb255`  
_Project ref lié localement_: `zhifmehctuflwfexlvkz`

## Verdict

L’environnement local est restauré et validé. Aucun développement métier VK Swiss n’a été démarré.

- `LOCAL_ENV_READY = YES`
- `NODE_GATE = PASS`
- `APP_GATE = PASS`
- `DATABASE_GATE = PASS`
- `E2E_GATE = PASS`
- `STAGING_CONNECTIVITY = UNVERIFIED`
- `STAGING_MIGRATION_STATE = UNVERIFIED`
- `VK_SWISS_IMPLEMENTATION_STARTED = NO`

## Résultats finaux

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| `npm ci` | PASS | dépendances reconstruites depuis le lockfile |
| `npm run lint` | PASS | exit code 0 |
| `npm run typecheck` | PASS | exit code 0 |
| `npm run test:unit` | PASS | 38 fichiers, 225/225 tests |
| `npm run build` | PASS | build exécuté par la validation Playwright |
| `npm run db:reset` | PASS | 15 migrations + seed |
| `npm run db:test` | PASS | 14 fichiers, 478/478 assertions pgTAP |
| second `npm run db:test` sans reset | PASS | répétabilité vérifiée avant l’E2E |
| `npm run db:lint` | PASS | aucune erreur de schéma |
| `npm run db:advisors` | PASS avec WARN | un avertissement de performance préexistant |
| `npm run test:e2e` | PASS | 48/48 scénarios Chromium en 4,8 min |
| `sh -n` sur les scripts touchés | PASS | syntaxe shell valide |
| `git diff --check` | PASS | aucune erreur whitespace |

## Cause racine de l’instabilité Docker/Supabase

Le daemon Docker et le socket Desktop étaient exploitables. Le blocage reproductible venait d’une collision entre plusieurs pipelines locaux travaillant sur le même stack Supabase :

1. Playwright construisait et démarrait l’application.
2. Un second pipeline lançait en parallèle `db reset`, puis `db:test`.
3. PostgreSQL était recréé alors que l’authentification E2E commençait.
4. Auth répondait alors `500` avec une connexion PostgreSQL refusée.
5. Auth et Storage redémarraient ensuite ; Storage pouvait transitoirement devenir `unhealthy`.

Les logs PostgreSQL ont confirmé la réapplication des migrations et le démarrage de pgTAP pendant le test navigateur. Il ne s’agissait donc ni d’identifiants erronés, ni d’une panne persistante du socket Docker.

## Stabilisation appliquée

### Verrou local interprocessus

Un verrou commun protège désormais :

- toutes les commandes passant par `scripts/supabase-local.sh` ;
- toute la durée de `scripts/e2e.sh`.

Un `db:start`, `db:reset` ou `db:test` concurrent attend la fin de l’E2E au lieu de recréer la base sous le navigateur. Le verrou détecte aussi un propriétaire disparu et nettoie son état résiduel.

### Readiness après le build

Playwright exécute désormais, après `next build` et avant le serveur de test, une barrière qui exige trois contrôles consécutifs réussis sur :

- PostgREST ;
- Auth health ;
- Storage health ;
- une vraie authentification contre le seed local.

Le parcours critique qui échouait au login passe ensuite en 1,5 minute, et la suite complète passe à 48/48.

## Corrections d’isolation pgTAP

Les premiers échecs DB après restauration de la connectivité étaient des collisions entre le seed enrichi et des fixtures historiques.

Corrections limitées aux tests :

- namespaces UUID/SIRET dédiés dans `orders.test.sql` et `rls.test.sql` ;
- compteurs attendus dérivés de l’état seedé au lieu de tailles historiques codées en dur ;
- assertion post-RPC superadmin exécutée hors RLS afin de vérifier la ligne persistée ;
- conservation de la correction antérieure d’isolation de `agent_experience.test.sql`.

Aucune contrainte, policy, RPC ou migration métier n’a été modifié pour faire passer les tests.

Important : la suite E2E crée volontairement des données persistantes. Le gate pgTAP de référence doit donc être lancé après `npm run db:reset`. Cette séquence finale a été vérifiée : reset PASS, puis 478/478.

## Alignement des contrats E2E

Les tests historiques ont été alignés sur les écrans déjà présents dans le worktree, sans changement applicatif :

- authentification superadmin pouvant arriver sur la vue plateforme avant la sélection de marque ;
- vue Performance consolidée sous `/dashboard/network` ;
- libellés français des statuts ;
- navigation mobile actuelle ;
- preuve marketing reposant sur des images accessibles ;
- titres et actions actuels des cockpits.

Le test critique ne conserve plus d’états navigateur globaux dans un `beforeAll`, ce qui supprime le worker Playwright qui restait ouvert après la réussite du scénario.

## Advisor DB restant

`npm run db:advisors` retourne un avertissement de performance, sans erreur :

- table `public.performance_objectives` ;
- rôle `authenticated` ;
- action `SELECT` ;
- policies permissives concernées : `performance_objectives_manage` et `performance_objectives_select`.

Ce point est préexistant, non bloquant pour la recovery, et n’a pas été corrigé afin de ne pas modifier le schéma avant VK Swiss.

## Migration et staging

- 15 migrations sont visibles localement.
- 14 migrations sont trackées au HEAD observé.
- `20260811130000_superadmin_onboarding_hardening.sql` reste non trackée et préservée.
- Cette migration s’applique correctement pendant `db reset`.
- Aucune migration trackée existante n’a été modifiée.
- Son état sur staging reste non vérifié.
- Le projet staging était précédemment signalé inactif ; aucune mutation ni tentative de réactivation n’a été faite pendant cette recovery locale.

## Fichiers de recovery

Corrections antérieures conservées :

- `supabase/seed.sql`
- `src/lib/pharmacy-summary.test.ts`
- `supabase/tests/database/agent_experience.test.sql`

Corrections de cette continuation :

- `supabase/tests/database/orders.test.sql`
- `supabase/tests/database/rls.test.sql`
- `supabase/tests/database/superadmin_onboarding.test.sql`
- `e2e/critical.spec.ts`
- `e2e/pharmacy-account-cockpit.spec.ts`
- `e2e/sprint10-mission-impact.spec.ts`
- `e2e/sprint11-2-ux-foundation.spec.ts`
- `e2e/sprint12-go-to-market.spec.ts`
- `e2e/sprint5.spec.ts`
- `e2e/sprint9-commercial-reorder.spec.ts`
- `e2e/test-helpers.ts`
- `playwright.config.ts`
- `scripts/e2e.sh`
- `scripts/supabase-local.sh`
- `scripts/local-env-lock.sh`
- `scripts/wait-for-supabase.sh`
- `docs/vk-swiss-preflight.md`

Les captures sous `artifacts/` ont été régénérées par la suite E2E. Le worktree reste volontairement non propre et contient d’autres changements utilisateur hors recovery ; ils n’ont pas été modifiés ni supprimés.

## Conclusion opérationnelle

La chaîne locale Node → Next.js → Docker → Supabase → pgTAP → Playwright est maintenant fonctionnelle et protégée contre les resets concurrents.

Le seul gate non résolu est externe au local : la connectivité staging et l’état staging de la migration non trackée restent à vérifier séparément. Cela ne remet pas en cause `LOCAL_ENV_READY = YES`, mais doit être traité avant toute opération de déploiement ou de migration distante.

## P0.1 — VK Swiss brand configuration

### Gaps détectés

| Besoin | Existe | Partiel | Manquant | Action |
| --- | --- | --- | --- | --- |
| `country_code` | oui |  |  | réutilisé |
| `currency_code` | oui |  |  | réutilisé |
| `logo` | oui (`logo_path`) |  |  | réutilisé |
| `order_email` |  |  | oui | ajouté sur `brands` |
| `commercial_email` |  |  | oui | ajouté sur `brands` |
| téléphone / adresse opérationnelle |  | oui | partiel | ajout de `phone`, `address_line_1`, `postal_code`, `city` |
| SKU | oui |  |  | réutilisé |
| EAN | oui |  |  | réutilisé |
| prix HT | oui |  |  | réutilisé |
| PVC TTC | oui |  |  | réutilisé |
| TVA |  |  | oui | ajout de `tax_rate` |
| colisage |  |  | oui | ajout de `units_per_case` |
| MOQ |  |  | oui | ajout de `minimum_order_quantity` |
| DN (`counts_for_distribution`) | oui |  |  | réutilisé |
| priorité stratégique | oui |  |  | réutilisé |

### Fonctionnalités réutilisées

- modèle `brands` existant avec `slug`, `code`, `country_code`, `currency_code`, `status`, `logo_path`
- modèle `products` existant avec `sku`, `ean`, `wholesale_price_ht`, `retail_price_ttc`, `strategic_priority`, `counts_for_distribution`, `is_active`
- RPC onboarding existantes `create_brand_onboarding`, `update_onboarding_settings`, `execute_onboarding_import`
- écrans admin onboarding et catalogue existants
- RLS catalogue existante : lecture agent autorisé, écriture réservée aux rôles d’administration

### Schéma ajouté

- migration : `supabase/migrations/20260821203516_p0_1_vk_swiss_brand_configuration.sql`
- `brands`
  - `commercial_email`
  - `order_email`
  - `phone`
  - `address_line_1`
  - `postal_code`
  - `city`
- `products`
  - `tax_rate`
  - `units_per_case`
  - `minimum_order_quantity`
- contraintes :
  - emails marque valides
  - TVA entre `0` et `100`
  - colisage strictement positif
  - MOQ strictement positif

### UI adaptée

- onboarding marque :
  - slug explicite
  - logo
  - pays / devise
  - email commercial
  - email commande
  - téléphone
  - adresse
  - description courte
- catalogue produits :
  - description
  - TVA
  - colisage
  - MOQ
  - rendu multi-colonnes plus opérationnel

### Imports adaptés

- template CSV produit canonique préparé via `import_templates`
- moteur d’import moderne aligné sur :
  - `sku`
  - `ean`
  - `name`
  - `description`
  - `product_family`
  - `format`
  - `wholesale_price_ht`
  - `retail_price_ttc`
  - `tax_rate`
  - `units_per_case`
  - `minimum_order_quantity`
  - `strategic_priority`
  - `counts_for_distribution`
  - `is_active`
- parseur CSV historique corrigé pour ne plus appliquer d’alias produit aux imports de commandes

### Tests

- DB ajoutés / adaptés :
  - `supabase/tests/database/vk_brand_config.test.sql`
  - `supabase/tests/database/onboarding_imports.test.sql`
- unit ajoutés / adaptés :
  - `src/lib/imports/import-engine.test.ts`
  - `src/lib/csv-import.test.ts`
  - `src/app/(protected)/dashboard/reference/actions.test.ts`
  - `src/app/(protected)/dashboard/admin/onboarding/actions.test.ts`
  - `vitest.config.ts` ajouté pour fiabiliser la résolution de l’alias `@/`

### Résultat

- `npm run typecheck` → PASS
- `npm run lint` → PASS
- `npm run test:unit` → PASS (`40` fichiers, `231/231` tests)
- `npm run build` → PASS
- `npm run db:reset` → BLOCKED_BY_SANDBOX_DOCKER_SOCKET
- `npm run db:test` → BLOCKED_BY_SANDBOX_DB_CONNECTION
- `npm run db:lint` → BLOCKED_BY_SANDBOX_DB_CONNECTION

### Conclusion P0.1

- la capacité métier P0.1 est implémentée localement sans hardcode VK Swiss
- les validations applicatives sont vertes
- la revalidation DB demandée pour clore complètement P0.1 reste à rejouer sur une machine ayant accès au daemon Docker local

`P0_1_VK_BRAND_CONFIG = FAIL`
