# Core Reliability — pipeline de release

## Règle de base

Une release TR1 est identifiée par un SHA Git unique.

Le SHA validé en staging est le SHA déployé en production. Aucun commit, changement de `vercel.json`, rebuild depuis une branche flottante ou modification applicative ne doit être inséré entre les deux environnements.

`vercel.json` reste un contrat d'infrastructure. `git.deploymentEnabled=false` coupe uniquement les déploiements automatiques liés au provider Git ; la publication contrôlée est effectuée par le workflow GitHub `Release production` via Vercel CLI.

## État d'infrastructure constaté le 17 septembre 2026

### Vercel

- Le projet Vercel `tr1-pharma-staging` (`prj_qUQM4tS4vVKQtBLSOlo545y3vEjt`) sert actuellement `tr1pharma.com` et `www.tr1pharma.com`. Malgré son nom, il joue donc aujourd'hui le rôle **production**.
- Le projet Vercel `tr-1-pharma` (`prj_KziP4kPjCBHDULmFuvGSLFOzDtVh`) ne sert pas les domaines publics. Son dernier build observé échouait parce que `APP_ENV` était vide. Il est le candidat naturel pour le rôle **staging** après configuration de ses variables.

### Supabase

- La production publique a été vérifiée via son flux OAuth Google : `/api/auth/google` redirige vers `https://zhifmehctuflwfexlvkz.supabase.co/auth/v1/authorize`.
- Le projet Supabase `zhifmehctuflwfexlvkz`, actuellement nommé `TR1 Pharma Staging`, est donc **la base réellement utilisée par la production** malgré son nom.
- Ce projet ne doit jamais être utilisé, réinitialisé ou traité comme un environnement staging.
- Un nouveau projet Supabase ou une branche de développement isolée doit être créé pour le vrai staging avant d'activer le workflow de release.

Les noms de projets ne sont jamais utilisés comme source de vérité. Les rôles staging/production sont définis par des références explicites et le workflow bloque toute tentative de faire pointer le staging vers le projet Supabase production connu.

## Configuration GitHub requise

Créer les environnements GitHub `staging` et `production`. La production devrait utiliser une règle d'approbation manuelle.

### Environnement `staging`

Secrets :

- `STAGING_DATABASE_URL` : connexion PostgreSQL vers une base Supabase de staging **distincte** de `zhifmehctuflwfexlvkz`.
- `VERCEL_TOKEN` : token Vercel autorisé à déployer le projet staging.

Variables :

- `STAGING_SUPABASE_PROJECT_REF` : référence du futur projet Supabase staging. Elle doit être différente de `zhifmehctuflwfexlvkz` et être présente dans `STAGING_DATABASE_URL`.
- `VERCEL_ORG_ID` : `team_WhI0GBrg7UZgZpDsvTwUGZ8V` pour l'organisation observée pendant l'audit.
- `VERCEL_STAGING_PROJECT_ID` : projet Vercel jouant le rôle staging. Le candidat actuel est `prj_KziP4kPjCBHDULmFuvGSLFOzDtVh`.
- `STAGING_URL` : URL HTTPS stable du staging.

### Environnement `production`

Secrets :

- `STAGING_DATABASE_URL` : accès à l'historique du vrai staging pour comparer les migrations juste avant la production.
- `PRODUCTION_DATABASE_URL` : connexion PostgreSQL vers le projet Supabase production `zhifmehctuflwfexlvkz`.
- `VERCEL_TOKEN` : token Vercel autorisé à déployer le projet production.

Variables :

- `STAGING_SUPABASE_PROJECT_REF` : même référence staging que dans l'environnement `staging`.
- `PRODUCTION_SUPABASE_PROJECT_REF` : `zhifmehctuflwfexlvkz` tant que la production publique reste branchée sur ce projet.
- `VERCEL_ORG_ID` : même organisation Vercel.
- `VERCEL_PRODUCTION_PROJECT_ID` : projet Vercel servant les domaines publics. À la date de l'audit : `prj_qUQM4tS4vVKQtBLSOlo545y3vEjt`.
- `PRODUCTION_URL` : `https://www.tr1pharma.com` lorsque le domaine public reste inchangé.

Le projet Vercel staging doit contenir `APP_ENV=staging` et les variables du nouveau Supabase staging. Le projet production doit contenir `APP_ENV=production` et les variables du Supabase production `zhifmehctuflwfexlvkz`. Les clés `NEXT_PUBLIC_*` sont donc construites séparément pour chaque environnement ; on ne promeut pas un build staging précompilé vers production.

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
4. Le job staging vérifie d'abord que sa base Supabase est distincte de la production.
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
