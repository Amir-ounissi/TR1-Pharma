# Core Reliability — pipeline de release

## Règle de base

Une release TR1 est identifiée par un SHA Git unique.

Le SHA validé en staging est le SHA déployé en production. Aucun commit, changement de `vercel.json`, rebuild depuis une branche flottante ou modification applicative ne doit être inséré entre les deux environnements.

`vercel.json` reste un contrat d'infrastructure. `git.deploymentEnabled=false` coupe uniquement les déploiements automatiques liés au provider Git ; la publication contrôlée est effectuée par le workflow GitHub `Release production` via Vercel CLI.

## Infrastructure vérifiée le 10 octobre 2026

### Vercel

- **Production :** projet `tr-1-pharma` (`prj_KziP4kPjCBHDULmFuvGSLFOzDtVh`), domaines publics `www.tr1pharma.com` et `tr1pharma.com`.
- **Staging :** projet dédié `tr1-pharma-staging` (`prj_qUQM4tS4vVKQtBLSOlo545y3vEjt`), déploiements `preview` distincts de la production.
- Le workflow `release-staging.yml` a été corrigé pour cibler exclusivement le second projet, et refuse l'ID du projet de production. Le workflow `release-production.yml` refuse que les deux identifiants soient identiques.
- Les URL et clés publiques Supabase sur le projet Vercel staging ont été mises à jour vers le projet Supabase staging. Les identifiants *serveur* doivent rester isolés et provenir de l'environnement GitHub staging.
- La preview V2 de contrôle a été vérifiée en `READY` avec `appEnv=staging` et `supabaseProjectRef=ehptapmuzckazyxmnmnm`. Une preview ad hoc n'est **pas** la preuve que le circuit officiel de release a entièrement réussi.

### Supabase

- **Production :** `zhifmehctuflwfexlvkz`.
- **Staging :** `ehptapmuzckazyxmnmnm`, distinct de la production.
- Le nom affiché d'un projet n'est pas une preuve de l'environnement : seule la référence du projet, vérifiée côté app et côté workflow, fait foi.

## Configuration GitHub requise

Créer les environnements GitHub `staging` et `production`. La production devrait utiliser une règle d'approbation manuelle.

### Environnement `staging`

Secrets :

- `STAGING_DATABASE_URL` : connexion PostgreSQL vers **Supabase staging** (`ehptapmuzckazyxmnmnm`).
- `STAGING_SUPABASE_SECRET_KEY` : **clé serveur secrète** (`sb_secret_...` ou, si nécessaire, ancienne clé `service_role`) du projet `ehptapmuzckazyxmnmnm`. Elle ne doit jamais être la clé serveur de production, ni être placée dans une variable publique ou dans le dépôt.
- `VERCEL_TOKEN` : token Vercel autorisé à déployer le projet staging.
- `VERCEL_AUTOMATION_BYPASS_SECRET` : secret du bypass d'automatisation Vercel pour les smoke tests de la preview protégée.

Variables :

- `STAGING_SUPABASE_PROJECT_REF` : `ehptapmuzckazyxmnmnm`.
- `VERCEL_ORG_ID` : `team_WhI0GBrg7UZgZpDsvTwUGZ8V`.
- `VERCEL_STAGING_PROJECT_ID` : `prj_qUQM4tS4vVKQtBLSOlo545y3vEjt` (**à mettre à jour** si l'ancienne valeur `prj_KziP4kPjCBHDULmFuvGSLFOzDtVh` est encore enregistrée dans GitHub).
- `STAGING_URL` : éviter toute URL associée à `tr-1-pharma`, car ce préfixe désigne le projet de production. Le workflow officiel produit et teste sa propre URL de preview, sans dépendre d'une URL de staging statique.

**Important :** dans la version du workflow au 10/10/2026, les valeurs de référence Supabase et Vercel staging sont aussi verrouillées en code. Les variables de l'environnement GitHub figurant ci-dessus sont conservées pour la traçabilité et d'éventuels scripts, mais ne remplacent pas les contrôles du workflow.

### Environnement `production`

Secrets :

- `STAGING_DATABASE_URL` : accès à l'historique du vrai staging pour comparer les migrations juste avant la production.
- `PRODUCTION_DATABASE_URL` : connexion PostgreSQL vers le projet Supabase production `zhifmehctuflwfexlvkz`.
- `VERCEL_TOKEN` : token Vercel autorisé à déployer le projet production.

Variables :

- `STAGING_SUPABASE_PROJECT_REF` : même référence staging que dans l'environnement `staging`.
- `PRODUCTION_SUPABASE_PROJECT_REF` : `zhifmehctuflwfexlvkz` tant que la production publique reste branchée sur ce projet.
- `VERCEL_ORG_ID` : même organisation Vercel.
- `VERCEL_PRODUCTION_PROJECT_ID` : projet Vercel servant les domaines publics, `prj_KziP4kPjCBHDULmFuvGSLFOzDtVh`.
- `PRODUCTION_URL` : `https://www.tr1pharma.com` lorsque le domaine public reste inchangé.

Le projet Vercel staging doit contenir `APP_ENV=staging` et les variables de Supabase staging (`ehptapmuzckazyxmnmnm`). Le projet production doit contenir `APP_ENV=production` et les variables du Supabase production `zhifmehctuflwfexlvkz`. Les clés `NEXT_PUBLIC_*` sont donc construites séparément pour chaque environnement ; on ne promeut pas un build staging précompilé vers production.

## Garde-fous Supabase

Le workflow conserve en code la référence du projet Supabase actuellement vérifié en production : `zhifmehctuflwfexlvkz`.

Avant tout `db push` staging, il refuse de continuer si :

- `STAGING_SUPABASE_PROJECT_REF` est égal à la référence production connue ;
- `STAGING_DATABASE_URL` contient la référence production connue ;
- `STAGING_DATABASE_URL` ne contient pas la référence staging déclarée.

Avant tout `db push` production, il refuse de continuer si :

- `PRODUCTION_SUPABASE_PROJECT_REF` ne correspond pas à la référence production vérifiée ;
- staging et production déclarent la même référence ;
- les URL de connexion ne correspondent pas à leurs références déclarées.

Si la production change volontairement de projet Supabase, la référence connue doit être mise à jour dans le workflow via une PR revue avant la prochaine release.

## Déroulement d'une release

1. Merger le code dans `main` et attendre une CI verte sur le SHA exact.
2. Déclencher manuellement `Release production` avec ce SHA.
3. Le job `Gate du SHA` vérifie que le SHA appartient à `main`, qu'une CI complète est verte et que le release check local passe.
4. Le workflow `Release staging` vérifie d'abord que sa base et son projet Vercel sont distincts de la production. Le workflow `Release production` exige une release staging verte du même SHA.
5. Staging applique uniquement les migrations Git manquantes puis exige que l'historique staging soit exactement identique à Git.
6. Le même SHA est déployé sur le projet Vercel staging et soumis au smoke HTTP.
7. Après validation de l'environnement GitHub `production`, le job production vérifie l'identité des deux références Supabase, puis que staging = Git et que la production est soit identique, soit uniquement en retard avec un historique strictement compatible.
8. Un `db push --dry-run` est exécuté avant l'application des migrations production.
9. Après application, le gate exige `Git = staging = production`.
10. Le même SHA est déployé sur le projet Vercel production puis soumis au smoke HTTP public.

## Discipline migrations

Une migration appliquée sur un environnement partagé est immuable.

- Ne jamais renommer, modifier ou supprimer une migration déjà présente sur `main`.
- Une correction de schéma est une nouvelle migration.
- Le contrôle PR de `ci.yml` bloque déjà la réécriture d'une migration historique.
- `scripts/check-migration-drift.mjs staging` exige staging = Git.
- `scripts/check-migration-drift.mjs preflight` exige staging = Git et autorise seulement une production strictement en retard, sans branchement d'historique.
- `scripts/check-migration-drift.mjs strict` exige Git = staging = production.
- `supabase migration repair` est une procédure exceptionnelle de récupération, jamais une étape normale de release.

## Rollback et forward-fix

Les migrations de release doivent être rétrocompatibles avec la version applicative immédiatement précédente. Une migration destructive ou un changement qui rend l'ancienne application incompatible exige une fenêtre de maintenance et un plan spécifique ; il ne doit pas utiliser le workflow standard.

Si le déploiement Vercel échoue après une migration additive, le trafic reste sur la dernière version saine et la priorité est un **forward-fix** sur un nouveau SHA.

Un rollback applicatif vers un ancien SHA n'est autorisé que si ce SHA reste compatible avec le schéma courant. Le gate de migrations refusera volontairement un SHA dont l'historique Git est plus ancien que la base distante.

Ne jamais supprimer automatiquement des données ou inverser une migration destructive pour "faire passer" une release.

## Vérification du gate de dérive

Le script utilise la commande officielle `supabase migration list --db-url` et compare les timestamps de `supabase/migrations` aux historiques `supabase_migrations.schema_migrations` des bases concernées.

Le workflow refuse de continuer si :

- une URL ou une référence requise pour le job est absente ;
- staging pointe vers le projet Supabase production ;
- une URL de base ne correspond pas à la référence déclarée ;
- l'historique distant ne peut pas être lu ;
- une migration distante est inconnue dans le SHA Git ;
- les migrations production ne forment pas un préfixe exact de Git pendant le préflight ;
- staging n'est pas strictement identique au SHA ;
- après migration production, Git, staging et production ne sont pas strictement identiques.
